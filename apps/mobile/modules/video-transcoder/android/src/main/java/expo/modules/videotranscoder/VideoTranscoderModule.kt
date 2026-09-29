package expo.modules.videotranscoder

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.ChannelMixingAudioProcessor
import androidx.media3.common.audio.ChannelMixingMatrix
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.FrameDropEffect
import androidx.media3.effect.Presentation
import androidx.media3.transformer.AudioEncoderSettings
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.nio.ByteBuffer
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread
import kotlin.math.max
import kotlin.math.min

// tinyPet on-device video transcoder (Android), built on Media3 Transformer:
// - H.264 video / AAC audio in MP4 (Transformer default muxer)
// - Presentation.createForWidthAndHeight(w, h, LAYOUT_SCALE_TO_FIT_WITH_CROP): exact output frame, center crop
//   (input rotation is applied by the decoder/video graph before effects, so frames are upright)
// - setPortraitEncodingEnabled(true): portrait targets are encoded as 1080x1920/720x1280, not landscape+rotation
// - FrameDropEffect: ≤ maxFrameRate
// - VideoEncoderSettings bitrate + keyframe interval; AudioEncoderSettings bitrate
// - ChannelMixingAudioProcessor (→ stereo) also forces audio re-encoding: without an audio processor Transformer
//   would transmux an AAC source track as-is and keep its original (often 192–256 kbps) bitrate.

class TranscodeOptions : Record {
  @Field var jobId: String = ""
  @Field var uri: String = ""
  @Field var width: Int = 1280
  @Field var height: Int = 720
  @Field var videoBitrate: Int = 900_000
  @Field var audioBitrate: Int = 96_000
  @Field var maxFrameRate: Double = 30.0
  @Field var keyFrameIntervalSeconds: Double = 2.0
  /** When > 0, only the first N seconds of the source are transcoded (plan duration limit). */
  @Field var maxDurationSeconds: Double = 0.0
}

class TranscodeException(message: String, cause: Throwable? = null) : CodedException("ERR_TRANSCODE", message, cause)
class TranscodeCancelledException : CodedException("ERR_CANCELLED", "Transcode cancelled", null)

private class Job(val transformer: Transformer, val promise: Promise, val output: File, val poll: Runnable) {
  @Volatile var settled = false
}

@OptIn(markerClass = [UnstableApi::class])
class VideoTranscoderModule : Module() {
  private val jobs = ConcurrentHashMap<String, Job>()
  private val mainHandler = Handler(Looper.getMainLooper())

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("VideoTranscoder")

    Events("onProgress")

    AsyncFunction("probe") { uri: String ->
      probe(context, uri, withBitrates = false)
    }

    AsyncFunction("transcode") { options: TranscodeOptions, promise: Promise ->
      // Transformer must be created and driven from a thread with a Looper; use the main looper.
      mainHandler.post {
        try {
          start(options, promise)
        } catch (e: CodedException) {
          promise.reject(e)
        } catch (e: Throwable) {
          promise.reject(TranscodeException(e.message ?: e.toString(), e))
        }
      }
    }

    AsyncFunction("cancel") { jobId: String ->
      mainHandler.post {
        val job = jobs.remove(jobId) ?: return@post
        mainHandler.removeCallbacks(job.poll)
        job.transformer.cancel() // no listener callback is delivered after cancel()
        job.output.delete()
        if (!job.settled) {
          job.settled = true
          job.promise.reject(TranscodeCancelledException())
        }
      }
    }

    OnDestroy {
      mainHandler.post {
        for ((_, job) in jobs) {
          mainHandler.removeCallbacks(job.poll)
          job.transformer.cancel()
          job.output.delete()
        }
        jobs.clear()
      }
    }
  }

  private fun start(o: TranscodeOptions, promise: Promise) {
    if (o.width <= 0 || o.height <= 0 || o.width % 2 != 0 || o.height % 2 != 0) {
      throw TranscodeException("Invalid target size ${o.width}x${o.height}")
    }
    val ctx = context
    val jobId = o.jobId.ifEmpty { UUID.randomUUID().toString() }
    val output = File(ctx.cacheDir, "tinypet-video-${UUID.randomUUID()}.mp4")

    val encoderFactory = DefaultEncoderFactory.Builder(ctx)
      .setRequestedVideoEncoderSettings(
        VideoEncoderSettings.Builder()
          .setBitrate(o.videoBitrate)
          .setiFrameIntervalSeconds(o.keyFrameIntervalSeconds.toFloat())
          .build()
      )
      .setRequestedAudioEncoderSettings(AudioEncoderSettings.Builder().setBitrate(o.audioBitrate).build())
      // Fallback lets weak encoders pick a supported config; the JS side re-checks the real frame size/bitrate.
      .setEnableFallback(true)
      .build()

    val mixer = ChannelMixingAudioProcessor()
    for (n in 1..8) mixer.putChannelMixingMatrix(stereoMatrix(n))

    val effects = Effects(
      listOf(mixer),
      listOf(
        FrameDropEffect.createDefaultFrameDropEffect(o.maxFrameRate.toFloat()),
        Presentation.createForWidthAndHeight(o.width, o.height, Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP),
      ),
    )
    val mediaItem = MediaItem.Builder().setUri(toUri(o.uri)).apply {
      if (o.maxDurationSeconds > 0) {
        setClippingConfiguration(
          MediaItem.ClippingConfiguration.Builder()
            .setEndPositionMs((o.maxDurationSeconds * 1000).toLong())
            .build()
        )
      }
    }.build()
    val item = EditedMediaItem.Builder(mediaItem).setEffects(effects).build()

    lateinit var job: Job
    val holder = ProgressHolder()
    var lastProgress = -1
    val poll = object : Runnable {
      override fun run() {
        if (job.settled) return
        if (job.transformer.getProgress(holder) == Transformer.PROGRESS_STATE_AVAILABLE && holder.progress > lastProgress) {
          lastProgress = holder.progress
          sendEvent("onProgress", mapOf("jobId" to jobId, "progress" to min(0.99, holder.progress / 100.0)))
        }
        mainHandler.postDelayed(this, 250)
      }
    }

    val transformer = Transformer.Builder(ctx)
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      .setAudioMimeType(MimeTypes.AUDIO_AAC)
      .setPortraitEncodingEnabled(true)
      .setEncoderFactory(encoderFactory)
      .setLooper(Looper.getMainLooper())
      .addListener(object : Transformer.Listener {
        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
          mainHandler.removeCallbacks(poll)
          jobs.remove(jobId)
          if (job.settled) return
          job.settled = true
          thread(name = "tinypet-transcoder-probe") {
            try {
              val info = probe(ctx, output.absolutePath, withBitrates = true).toMutableMap()
              info["uri"] = Uri.fromFile(output).toString()
              sendEvent("onProgress", mapOf("jobId" to jobId, "progress" to 1.0))
              promise.resolve(info)
            } catch (e: Throwable) {
              output.delete()
              promise.reject(TranscodeException("Transcoded file is unreadable: ${e.message}", e))
            }
          }
        }

        override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
          mainHandler.removeCallbacks(poll)
          jobs.remove(jobId)
          output.delete()
          if (job.settled) return
          job.settled = true
          promise.reject(TranscodeException("${exportException.errorCodeName}: ${exportException.message}", exportException))
        }
      })
      .build()

    job = Job(transformer, promise, output, poll)
    jobs[jobId] = job
    transformer.start(item, output.absolutePath)
    mainHandler.postDelayed(poll, 250)
  }

  /** Row-major (input rows × 2 output columns): mono duplicated, stereo identity, multichannel folded L/R. */
  private fun stereoMatrix(inputChannels: Int): ChannelMixingMatrix {
    if (inputChannels <= 2) return ChannelMixingMatrix.create(inputChannels, 2)
    val perSide = (inputChannels + 1) / 2
    val coefficients = FloatArray(inputChannels * 2)
    for (i in 0 until inputChannels) coefficients[i * 2 + (i % 2)] = 1f / perSide
    return ChannelMixingMatrix(inputChannels, 2, coefficients)
  }

  private fun toUri(uri: String): Uri = if (uri.startsWith("/")) Uri.fromFile(File(uri)) else Uri.parse(uri)

  /**
   * Display width/height (rotation applied), rotation, duration, codecs, size.
   * With [withBitrates], also walks every sample to compute exact average video/audio bitrates
   * (same measure the API applies on /media/complete). Only used on our own small output file.
   */
  private fun probe(ctx: Context, uri: String, withBitrates: Boolean): Map<String, Any?> {
    val parsed = toUri(uri)
    val retriever = MediaMetadataRetriever()
    val rawW: Int
    val rawH: Int
    val rotation: Int
    val durationMs: Long
    try {
      retriever.setDataSource(ctx, parsed)
      rawW = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
      rawH = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
      rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
    } catch (e: Throwable) {
      throw TranscodeException("Cannot read video metadata: ${e.message}", e)
    } finally {
      try { retriever.release() } catch (_: Throwable) {}
    }
    if (rawW <= 0 || rawH <= 0) throw TranscodeException("The file has no video track")
    val swap = rotation % 180 != 0

    val extractor = MediaExtractor()
    var videoTrack = -1
    var audioTrack = -1
    var videoCodec = ""
    var audioCodec: String? = null
    var frameRate = 0.0
    var videoBitrate = 0
    var audioBitrate = 0
    try {
      extractor.setDataSource(ctx, parsed, null)
      val durations = LongArray(extractor.trackCount)
      for (i in 0 until extractor.trackCount) {
        val f = extractor.getTrackFormat(i)
        val mime = f.getString(MediaFormat.KEY_MIME) ?: ""
        durations[i] = if (f.containsKey(MediaFormat.KEY_DURATION)) f.getLong(MediaFormat.KEY_DURATION) else durationMs * 1000
        if (mime.startsWith("video/") && videoTrack < 0) {
          videoTrack = i
          videoCodec = mime
          if (f.containsKey(MediaFormat.KEY_FRAME_RATE)) {
            frameRate = try { f.getInteger(MediaFormat.KEY_FRAME_RATE).toDouble() } catch (_: Throwable) { f.getFloat(MediaFormat.KEY_FRAME_RATE).toDouble() }
          }
          if (f.containsKey(MediaFormat.KEY_BIT_RATE)) videoBitrate = f.getInteger(MediaFormat.KEY_BIT_RATE)
        } else if (mime.startsWith("audio/") && audioTrack < 0) {
          audioTrack = i
          audioCodec = mime
          if (f.containsKey(MediaFormat.KEY_BIT_RATE)) audioBitrate = f.getInteger(MediaFormat.KEY_BIT_RATE)
        }
      }
      if (withBitrates && videoTrack >= 0) {
        extractor.selectTrack(videoTrack)
        if (audioTrack >= 0) extractor.selectTrack(audioTrack)
        val bytes = LongArray(extractor.trackCount)
        val buffer = ByteBuffer.allocateDirect(4 * 1024 * 1024)
        while (true) {
          val t = extractor.sampleTrackIndex
          if (t < 0) break
          val n = extractor.readSampleData(buffer, 0)
          if (n < 0) break
          bytes[t] += n.toLong()
          buffer.clear()
          if (!extractor.advance()) break
        }
        fun rate(track: Int): Int {
          val us = durations[track]
          return if (us > 0) (bytes[track] * 8.0 * 1_000_000.0 / us).toInt() else 0
        }
        videoBitrate = rate(videoTrack)
        if (audioTrack >= 0) audioBitrate = rate(audioTrack)
      }
    } catch (e: TranscodeException) {
      throw e
    } catch (e: Throwable) {
      if (withBitrates) throw TranscodeException("Cannot inspect video tracks: ${e.message}", e)
    } finally {
      extractor.release()
    }

    val size = if (parsed.scheme == "file" || parsed.scheme == null) File(parsed.path ?: uri).length() else 0L
    return mapOf(
      "width" to if (swap) rawH else rawW,
      "height" to if (swap) rawW else rawH,
      "rotation" to ((rotation % 360) + 360) % 360,
      "durationSeconds" to durationMs / 1000.0,
      "frameRate" to frameRate,
      "videoCodec" to fourCC(videoCodec),
      "videoBitrate" to max(0, videoBitrate),
      "hasAudio" to (audioTrack >= 0),
      "audioCodec" to audioCodec?.let { fourCC(it) },
      "audioBitrate" to max(0, audioBitrate),
      "sizeBytes" to size,
    )
  }

  /** Normalizes Android MIME types to the MP4 sample-entry names reported on iOS. */
  private fun fourCC(mime: String): String = when (mime) {
    MimeTypes.VIDEO_H264 -> "avc1"
    MimeTypes.VIDEO_H265 -> "hvc1"
    MimeTypes.AUDIO_AAC -> "mp4a"
    else -> mime
  }
}
