import AVFoundation
import CoreMedia
import CoreVideo
import ExpoModulesCore

// tinyPet on-device video transcoder (iOS).
// AVAssetReader (+ AVVideoComposition for rotation, aspect-fill scale and center crop to the exact
// target frame, ≤ maxFrameRate) → AVAssetWriter (H.264 High, average bitrate, keyframe interval;
// AAC-LC stereo 44.1 kHz at the requested bitrate). Output frames are written upright: identity
// track transform, so the MP4 has no rotation matrix.

struct TranscodeOptions: Record {
  @Field var jobId: String = ""
  @Field var uri: String = ""
  @Field var width: Int = 1280
  @Field var height: Int = 720
  @Field var videoBitrate: Int = 900_000
  @Field var audioBitrate: Int = 96_000
  @Field var maxFrameRate: Double = 30
  @Field var keyFrameIntervalSeconds: Double = 2
  /// When > 0, only the first N seconds of the source are transcoded (plan duration limit).
  @Field var maxDurationSeconds: Double = 0
}

final class TranscodeException: Exception {
  private let text: String
  init(_ text: String) {
    self.text = text
    super.init()
  }
  override var code: String { "ERR_TRANSCODE" }
  override var reason: String { text }
}

final class TranscodeCancelledException: Exception {
  override var code: String { "ERR_CANCELLED" }
  override var reason: String { "Transcode cancelled" }
}

private final class TranscodeJob {
  private let lock = NSLock()
  private var _cancelled = false
  var reader: AVAssetReader?
  var writer: AVAssetWriter?

  var cancelled: Bool {
    lock.lock(); defer { lock.unlock() }
    return _cancelled
  }

  func cancel() {
    lock.lock()
    _cancelled = true
    lock.unlock()
    reader?.cancelReading()
  }
}

public class VideoTranscoderModule: Module {
  private var jobs: [String: TranscodeJob] = [:]
  private let jobsLock = NSLock()

  public func definition() -> ModuleDefinition {
    Name("VideoTranscoder")

    Events("onProgress")

    AsyncFunction("probe") { (uri: String) -> [String: Any] in
      guard let url = Self.fileURL(uri) else { throw TranscodeException("Invalid URI: \(uri)") }
      return try Self.probe(url: url)
    }

    AsyncFunction("transcode") { (options: TranscodeOptions, promise: Promise) in
      self.transcode(options, promise: promise)
    }

    AsyncFunction("cancel") { (jobId: String) in
      self.jobsLock.lock()
      let job = self.jobs[jobId]
      self.jobsLock.unlock()
      job?.cancel()
    }
  }

  // MARK: - Probe

  static func fileURL(_ uri: String) -> URL? {
    if uri.hasPrefix("/") { return URL(fileURLWithPath: uri) }
    return URL(string: uri)
  }

  /// Display size (after preferredTransform), rotation in degrees, duration, codecs and average bitrates.
  static func probe(url: URL) throws -> [String: Any] {
    let asset = AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
    guard let video = asset.tracks(withMediaType: .video).first else {
      throw TranscodeException("The file has no video track")
    }
    let natural = video.naturalSize
    let t = video.preferredTransform
    let rect = CGRect(origin: .zero, size: natural).applying(t)
    let rotation = Int((atan2(Double(t.b), Double(t.a)) * 180.0 / Double.pi).rounded())
    let audio = asset.tracks(withMediaType: .audio).first
    let duration = CMTimeGetSeconds(asset.duration)
    var size: Int64 = 0
    if url.isFileURL, let attrs = try? FileManager.default.attributesOfItem(atPath: url.path), let n = attrs[.size] as? NSNumber {
      size = n.int64Value
    }
    return [
      "width": Int(abs(rect.width).rounded()),
      "height": Int(abs(rect.height).rounded()),
      "rotation": (rotation + 360) % 360,
      "durationSeconds": duration.isFinite ? duration : 0,
      "frameRate": Double(video.nominalFrameRate),
      "videoCodec": codecName(video),
      "videoBitrate": Int(video.estimatedDataRate),
      "hasAudio": audio != nil,
      "audioCodec": audio.map { codecName($0) } ?? NSNull(),
      "audioBitrate": audio.map { Int($0.estimatedDataRate) } ?? 0,
      "sizeBytes": size,
    ]
  }

  private static func codecName(_ track: AVAssetTrack) -> String {
    guard let desc = track.formatDescriptions.first else { return "" }
    let fourCC = CMFormatDescriptionGetMediaSubType(desc as! CMFormatDescription)
    // Audio format descriptions carry the CoreAudio format ID ('aac ' for AAC), not the MP4 sample entry.
    // Report the sample entry ("mp4a") like Android does, so JS validation sees the same codec names.
    if fourCC == kAudioFormatMPEG4AAC || fourCC == kAudioFormatMPEG4AAC_HE || fourCC == kAudioFormatMPEG4AAC_HE_V2 || fourCC == kAudioFormatMPEG4AAC_LD {
      return "mp4a"
    }
    let bytes = [24, 16, 8, 0].map { UInt8((fourCC >> $0) & 0xFF) }
    return String(bytes: bytes, encoding: .ascii)?.trimmingCharacters(in: .whitespaces) ?? ""
  }

  // MARK: - Transcode

  private func transcode(_ o: TranscodeOptions, promise: Promise) {
    guard let src = Self.fileURL(o.uri) else {
      promise.reject(TranscodeException("Invalid URI: \(o.uri)"))
      return
    }
    guard o.width > 0, o.height > 0, o.width % 2 == 0, o.height % 2 == 0 else {
      promise.reject(TranscodeException("Invalid target size \(o.width)x\(o.height)"))
      return
    }
    let jobId = o.jobId.isEmpty ? UUID().uuidString : o.jobId
    let job = TranscodeJob()
    jobsLock.lock(); jobs[jobId] = job; jobsLock.unlock()
    let finish: () -> Void = { [weak self] in
      guard let self = self else { return }
      self.jobsLock.lock(); self.jobs.removeValue(forKey: jobId); self.jobsLock.unlock()
    }

    // Write into Caches (not tmp): expo-file-system only allows deleting inside its document/cache directories, so
    // outputs in NSTemporaryDirectory could never be cleaned up by the JS side (rejected attempts, cancel, unmount).
    let cachesDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first ?? FileManager.default.temporaryDirectory
    let outURL = cachesDir.appendingPathComponent("tinypet-video-\(UUID().uuidString).mp4")
    try? FileManager.default.removeItem(at: outURL)

    do {
      let asset = AVURLAsset(url: src, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
      guard let videoTrack = asset.tracks(withMediaType: .video).first else {
        throw TranscodeException("The file has no video track")
      }
      let audioTracks = asset.tracks(withMediaType: .audio)
      var duration = asset.duration
      if o.maxDurationSeconds > 0 {
        let limit = CMTime(seconds: o.maxDurationSeconds, preferredTimescale: 600)
        if CMTimeCompare(limit, duration) < 0 { duration = limit }
      }
      let durationSeconds = max(CMTimeGetSeconds(duration), 0.001)
      let target = CGSize(width: o.width, height: o.height)

      // Frame rate: keep the source rate up to maxFrameRate.
      let srcFps = Double(videoTrack.nominalFrameRate)
      let fps = max(1, min(o.maxFrameRate, srcFps > 0 ? srcFps : o.maxFrameRate))
      let fpsScale: Int32 = 600
      let frameDuration = CMTime(value: CMTimeValue((Double(fpsScale) / fps).rounded()), timescale: fpsScale)

      // Transform: natural → upright display (normalized to origin) → aspect-fill scale → center.
      let pref = videoTrack.preferredTransform
      let displayRect = CGRect(origin: .zero, size: videoTrack.naturalSize).applying(pref)
      let upright = pref.concatenating(CGAffineTransform(translationX: -displayRect.origin.x, y: -displayRect.origin.y))
      let dw = abs(displayRect.width), dh = abs(displayRect.height)
      guard dw > 0, dh > 0 else { throw TranscodeException("Invalid source dimensions") }
      let scale = max(target.width / dw, target.height / dh)
      let tx = (target.width - dw * scale) / 2
      let ty = (target.height - dh * scale) / 2
      let transform = upright
        .concatenating(CGAffineTransform(scaleX: scale, y: scale))
        .concatenating(CGAffineTransform(translationX: tx, y: ty))

      let instruction = AVMutableVideoCompositionInstruction()
      instruction.timeRange = CMTimeRange(start: .zero, duration: duration)
      let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
      layer.setTransform(transform, at: .zero)
      instruction.layerInstructions = [layer]

      let composition = AVMutableVideoComposition()
      composition.renderSize = target
      composition.frameDuration = frameDuration
      composition.instructions = [instruction]
      // SDR BT.709 output (tone-maps HDR/Dolby Vision sources from recent iPhones).
      composition.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2
      composition.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2
      composition.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2

      let reader = try AVAssetReader(asset: asset)
      let videoOutput = AVAssetReaderVideoCompositionOutput(
        videoTracks: [videoTrack],
        videoSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange]
      )
      videoOutput.videoComposition = composition
      videoOutput.alwaysCopiesSampleData = false
      guard reader.canAdd(videoOutput) else { throw TranscodeException("Cannot read the video track") }
      reader.add(videoOutput)

      var stereo = AudioChannelLayout()
      stereo.mChannelLayoutTag = kAudioChannelLayoutTag_Stereo
      let layoutData = Data(bytes: &stereo, count: MemoryLayout<AudioChannelLayout>.size)

      var audioOutput: AVAssetReaderAudioMixOutput?
      if !audioTracks.isEmpty {
        let out = AVAssetReaderAudioMixOutput(audioTracks: audioTracks, audioSettings: [
          AVFormatIDKey: kAudioFormatLinearPCM,
          AVSampleRateKey: 44_100,
          AVNumberOfChannelsKey: 2,
          AVChannelLayoutKey: layoutData,
          AVLinearPCMBitDepthKey: 16,
          AVLinearPCMIsFloatKey: false,
          AVLinearPCMIsBigEndianKey: false,
          AVLinearPCMIsNonInterleaved: false,
        ])
        out.alwaysCopiesSampleData = false
        if reader.canAdd(out) {
          reader.add(out)
          audioOutput = out
        }
      }

      let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
      writer.shouldOptimizeForNetworkUse = true

      let keyFrameInterval = max(1, Int((fps * o.keyFrameIntervalSeconds).rounded()))
      let videoSettings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: o.width,
        AVVideoHeightKey: o.height,
        AVVideoColorPropertiesKey: [
          AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
          AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
          AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
        ],
        AVVideoCompressionPropertiesKey: [
          AVVideoAverageBitRateKey: o.videoBitrate,
          AVVideoMaxKeyFrameIntervalKey: keyFrameInterval,
          AVVideoMaxKeyFrameIntervalDurationKey: o.keyFrameIntervalSeconds,
          AVVideoExpectedSourceFrameRateKey: Int(fps.rounded()),
          AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
          AVVideoH264EntropyModeKey: AVVideoH264EntropyModeCABAC,
          AVVideoAllowFrameReorderingKey: true,
        ] as [String: Any],
      ]
      let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
      videoInput.expectsMediaDataInRealTime = false
      videoInput.transform = .identity
      guard writer.canAdd(videoInput) else { throw TranscodeException("H.264 encoder unavailable for \(o.width)x\(o.height)") }
      writer.add(videoInput)

      var audioInput: AVAssetWriterInput?
      if audioOutput != nil {
        let input = AVAssetWriterInput(mediaType: .audio, outputSettings: [
          AVFormatIDKey: kAudioFormatMPEG4AAC,
          AVSampleRateKey: 44_100,
          AVNumberOfChannelsKey: 2,
          AVChannelLayoutKey: layoutData,
          AVEncoderBitRateKey: o.audioBitrate,
        ])
        input.expectsMediaDataInRealTime = false
        if writer.canAdd(input) {
          writer.add(input)
          audioInput = input
        } else {
          throw TranscodeException("AAC encoder unavailable")
        }
      }

      // Trim (first N seconds) — also bounds the composition instruction above.
      reader.timeRange = CMTimeRange(start: .zero, duration: duration)

      job.reader = reader
      job.writer = writer

      guard reader.startReading() else {
        throw TranscodeException(reader.error?.localizedDescription ?? "Cannot start reading the video")
      }
      guard writer.startWriting() else {
        reader.cancelReading()
        throw TranscodeException(writer.error?.localizedDescription ?? "Cannot start writing the video")
      }
      writer.startSession(atSourceTime: .zero)

      let group = DispatchGroup()
      var lastProgress = -1
      let progressLock = NSLock()
      let report: (CMTime) -> Void = { [weak self] pts in
        let p = min(99, max(0, Int(CMTimeGetSeconds(pts) / durationSeconds * 100)))
        progressLock.lock()
        let shouldSend = p > lastProgress
        if shouldSend { lastProgress = p }
        progressLock.unlock()
        if shouldSend { self?.sendEvent("onProgress", ["jobId": jobId, "progress": Double(p) / 100.0]) }
      }

      func pump(_ input: AVAssetWriterInput, _ output: AVAssetReaderOutput, label: String, reportsProgress: Bool) {
        group.enter()
        var done = false
        let queue = DispatchQueue(label: "br.com.tinypet.transcoder.\(label)")
        input.requestMediaDataWhenReady(on: queue) {
          if done { return }
          while input.isReadyForMoreMediaData {
            if job.cancelled || reader.status != .reading {
              done = true
              input.markAsFinished()
              group.leave()
              return
            }
            guard let sample = output.copyNextSampleBuffer() else {
              done = true
              input.markAsFinished()
              group.leave()
              return
            }
            if reportsProgress { report(CMSampleBufferGetPresentationTimeStamp(sample)) }
            if !input.append(sample) {
              done = true
              reader.cancelReading()
              input.markAsFinished()
              group.leave()
              return
            }
          }
        }
      }

      pump(videoInput, videoOutput, label: "video", reportsProgress: true)
      if let audioInput = audioInput, let audioOutput = audioOutput {
        pump(audioInput, audioOutput, label: "audio", reportsProgress: false)
      }

      group.notify(queue: DispatchQueue.global(qos: .userInitiated)) {
        let fail: (Exception) -> Void = { error in
          writer.cancelWriting()
          try? FileManager.default.removeItem(at: outURL)
          finish()
          promise.reject(error)
        }
        if job.cancelled {
          fail(TranscodeCancelledException())
          return
        }
        if reader.status == .failed {
          fail(TranscodeException(reader.error?.localizedDescription ?? "Failed to read the video"))
          return
        }
        if writer.status == .failed {
          fail(TranscodeException(writer.error?.localizedDescription ?? "Failed to encode the video"))
          return
        }
        writer.endSession(atSourceTime: duration)
        writer.finishWriting {
          if job.cancelled {
            try? FileManager.default.removeItem(at: outURL)
            finish()
            promise.reject(TranscodeCancelledException())
            return
          }
          guard writer.status == .completed else {
            try? FileManager.default.removeItem(at: outURL)
            finish()
            promise.reject(TranscodeException(writer.error?.localizedDescription ?? "Failed to finish the video"))
            return
          }
          do {
            var info = try Self.probe(url: outURL)
            info["uri"] = outURL.absoluteString
            self.sendEvent("onProgress", ["jobId": jobId, "progress": 1.0])
            finish()
            promise.resolve(info)
          } catch {
            finish()
            promise.reject(TranscodeException("Transcoded file is unreadable: \(error.localizedDescription)"))
          }
        }
      }
    } catch let error as Exception {
      try? FileManager.default.removeItem(at: outURL)
      finish()
      promise.reject(error)
    } catch {
      try? FileManager.default.removeItem(at: outURL)
      finish()
      promise.reject(TranscodeException(error.localizedDescription))
    }
  }
}
