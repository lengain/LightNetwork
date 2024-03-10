## LightNetwork

[![Swift](https://img.shields.io/badge/Swift-5.7_5.8_5.9-orange?style=flat-square)](https://img.shields.io/badge/Swift-5.7_5.8_5.9-Orange?style=flat-square)
[![Platforms](https://img.shields.io/badge/Platforms-macOS_iOS_tvOS_watchOS_visionOS-yellowgreen?style=flat-square)](https://img.shields.io/badge/Platforms-macOS_iOS_tvOS_watchOS_vision_OS-Green?style=flat-square)

LightNetwork是一个非常易于发起请求的swift网络库, 依赖于[Alamofire](https://github.com/Alamofire/Alamofire)

## 功能

- [x] 类方法发起请求

- [x] 设置baseURL,Path

- [x] 添加全局参数

- [x] 添加全局请求头

- [x] 全局解析响应结果

- [x] 监听拦截请求开始和请求结束(可统一弹出加载指示器)

- [x] 终止请求

- [x] 支持Alamofire原有功能

- [x] [示例工程](https://github.com/lengain/ExampleForLightNetwork)

## 介绍

在经过全局的一些配置后, 你可以使用`LightNetwork`轻松地发起请求.

```swift
    //Global Config
    var config = LNNetworkConfiguration(baseURL: URL(string: "http://example.com/"))
    LNNetworkManager.default.configuration = config

    //packaging
    class ExampleRequest : LNRequest {
        class func modify(userName:String,success: @escaping LNRequestSuccess, failure:@escaping LNRequestFailure) {
            self.post(path: "/modify", parameters: ["userName":userName], success: success, failure: failure)
        }
    }
    //use
    ExampleRequest.modify(userName: "Light") { request, responseData in
        print("Success:\(responseData)")
    } failure: { request, error in
        print("Failure:\(error)")
    }
```
更详细的配置可参考[示例工程](https://github.com/lengain/ExampleForLightNetwork).

## 安装

### Swift Package Manager

[Swift Package Manager](https://swift.org/package-manager/) 是一个用于自动分发Swift代码的工具，并集成到Swift编译器中。
一旦你的Swift包设置好了，添加' LightNetwork '作为依赖项就像把它添加到你的' package . Swift '或Xcode中的package列表的' dependencies '值一样简单。

```swift
dependencies: [
    .package(url: "https://github.com/lengain/LightNetwork.git", .upToNextMajor(from: "1.0.0"))
]
```

通常情况下，您需要依赖 `LightNetwork` target:

```swift
.product(name: "LightNetwork", package: "LightNetwork")
```

### 手动集成

如果您不喜欢使用任何依赖项管理器，您可以手动将LightNetwork集成到您的项目中。

## 环境

* iOS 13.0+ 
* macOS 10.15+ 
* tvOS 12.0+ 
* watchOS 4.0+ 
* Swift 5.7.1 
* Xcode 14.1 

## 证书

LightNetwork 使用 MIT 证书. [详情参见 LICENSE](https://raw.githubusercontent.com/lengain/LightNetwork/main/LICENSE)
