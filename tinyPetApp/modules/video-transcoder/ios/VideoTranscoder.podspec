Pod::Spec.new do |s|
  s.name           = 'VideoTranscoder'
  s.version        = '1.0.0'
  s.summary        = 'tinyPet on-device video transcoder (AVAssetReader/AVAssetWriter → H.264/AAC MP4)'
  s.description    = 'Local Expo module: exact output frame with center crop, bitrate caps, AAC audio.'
  s.author         = 'tinyPet'
  s.homepage       = 'https://tinypet.com.br'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'CoreMedia', 'CoreVideo'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
