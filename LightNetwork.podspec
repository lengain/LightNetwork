#
# Be sure to run `pod lib lint LightNetwork.podspec' to ensure this is a
# valid spec before submitting.
#
# Any lines starting with a # are optional, but their use is encouraged
# To learn more about a Podspec see https://guides.cocoapods.org/syntax/podspec.html
#

Pod::Spec.new do |s|
  s.name             = 'LightNetwork'
  s.version          = '1.0.1'
  s.summary          = 'LightNetwork is a very easy-write HTTP networking library written in Swift'

  s.description      = <<-DESC
LightNetwork is a very easy-write HTTP networking library written in Swift, depend on Alamofire.Support that use a class method to initiate a request.
                       DESC

  s.homepage         = 'https://github.com/lengain/LightNetwork'
  s.license          = { :type => 'MIT', :file => 'LICENSE' }
  s.author           = { '童玉龙' => 'lengain@qq.com' }
  s.source           = { :git => 'hhttps://github.com/lengain/LightNetwork.git', :tag => s.version.to_s }
  # s.social_media_url = 'https://twitter.com/<TWITTER_USERNAME>'
  s.cocoapods_version = '>= 1.12.0'

  s.ios.deployment_target = '13.0'
  s.osx.deployment_target = '10.15'
  s.tvos.deployment_target = '12.0'
  s.watchos.deployment_target = '4.0'

  s.swift_versions = ['5']

  s.source_files = 'Sources/**/*.swift'
  s.dependency 'Alamofire', '~> 5.8.1'
end
