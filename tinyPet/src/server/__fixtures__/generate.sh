#!/usr/bin/env bash
# Regenerates the MP4 fixtures used by video-validate.test.ts (requires ffmpeg with libx264, libx265, aac).
set -euo pipefail
cd "$(dirname "$0")"
Q="-y -loglevel error"
TONE="-f lavfi -i sine=frequency=440:sample_rate=44100"
# Valid: 1280x720 H.264 + AAC, ~2 s, ~600 kbps video / 96 kbps audio
ffmpeg $Q -f lavfi -i testsrc2=size=1280x720:rate=30 $TONE -t 2 -c:v libx264 -b:v 600k -maxrate 800k -bufsize 1200k -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart valid-720p.mp4
# Valid portrait: 720x1280
ffmpeg $Q -f lavfi -i testsrc2=size=720x1280:rate=30 $TONE -t 2 -c:v libx264 -b:v 600k -maxrate 800k -bufsize 1200k -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart valid-portrait.mp4
# Valid via rotation matrix: coded 1280x720, displayed 720x1280
ffmpeg $Q -display_rotation 90 -i valid-720p.mp4 -c copy rotated.mp4
# Bitrate fail: 1280x720 at ~3 Mbps (noisy source, CBR)
ffmpeg $Q -f lavfi -i "testsrc2=size=1280x720:rate=30,noise=alls=60:allf=t" $TONE -t 0.5 -c:v libx264 -b:v 2500k -minrate 2500k -maxrate 2500k -bufsize 2500k -x264-params nal-hrd=cbr -pix_fmt yuv420p -c:a aac -b:a 96k high-bitrate.mp4
# Frame fail: 1000x1000
ffmpeg $Q -f lavfi -i testsrc2=size=1000x1000:rate=30 -t 1 -c:v libx264 -b:v 400k -pix_fmt yuv420p bad-frame.mp4
# Codec fail: HEVC
ffmpeg $Q -f lavfi -i testsrc2=size=1280x720:rate=30 -t 1 -c:v libx265 -b:v 400k -tag:v hvc1 -pix_fmt yuv420p hevc.mp4
# Container fail: QuickTime
ffmpeg $Q -f lavfi -i testsrc2=size=1280x720:rate=30 -t 1 -c:v libx264 -b:v 400k -pix_fmt yuv420p -f mov quicktime.mov
# Audio bitrate fail: 1280x720 H.264 ~300 kbps + AAC ~256 kbps (white noise, stereo)
ffmpeg $Q -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i anoisesrc=sample_rate=48000:amplitude=0.5 -t 2 -c:v libx264 -b:v 300k -pix_fmt yuv420p -c:a aac -ac 2 -b:a 256k high-audio.mp4
