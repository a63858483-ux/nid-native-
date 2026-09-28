Pod::Spec.new do |s|
  s.name           = 'NidTextMenu'
  s.version        = '1.0.0'
  s.summary        = 'Text Effects in the text input edit menu'
  s.description    = 'Adds a Messages-style Text Effects submenu to React Native text inputs.'
  s.license        = 'MIT'
  s.author         = 'Nid'
  s.homepage       = 'https://github.com/a63858483-ux/nid-native-'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/a63858483-ux/nid-native-.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
