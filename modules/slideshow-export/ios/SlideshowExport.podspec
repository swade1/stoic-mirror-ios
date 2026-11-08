Pod::Spec.new do |s|
  s.name           = 'SlideshowExport'
  s.version        = '1.0.0'
  s.summary        = 'Renders a slideshow (slides + music) to an MP4 file.'
  s.description    = 'Local Expo module for The Stoic Mirror.'
  s.author         = 'The Stoic Mirror'
  s.homepage       = 'https://stoicmirror.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
