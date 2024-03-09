## LightNetwork[中文文档](https://github.com/lengain/LightNetwork/blob/main/README_CN.md)

[![Swift](https://img.shields.io/badge/Swift-5.7_5.8_5.9-orange?style=flat-square)](https://img.shields.io/badge/Swift-5.7_5.8_5.9-Orange?style=flat-square)
[![Platforms](https://img.shields.io/badge/Platforms-macOS_iOS_tvOS_watchOS_visionOS-yellowgreen?style=flat-square)](https://img.shields.io/badge/Platforms-macOS_iOS_tvOS_watchOS_vision_OS-Green?style=flat-square)

LightNetwork is a very easy-write HTTP networking library written in Swift, depend on [Alamofire](https://github.com/Alamofire/Alamofire)

- [Features](#features)
- [Introduction](#introduction)
- [Installation](#installation)
- [Requirements](#requirements)
- [License](#license)

## Features

- [x] All Alamofire Functions

- [x] Use a class method to initiate a request 

- [x] Support base url, path

- [x] Add global parameters

- [x] Add global headers

- [x] Add global response

- [x] Intercept begin and end for all of request

- [x] Allow or deny request globally

- [x] [Easy Example](https://github.com/lengain/ExampleForLightNetwork)

## Introduction

After the global configuration, you can easily initiate a request using `LightNetwork`.

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

## Installation

### Swift Package Manager

The [Swift Package Manager](https://swift.org/package-manager/) is a tool for automating the distribution of Swift code and is integrated into the `swift` compiler.

Once you have your Swift package set up, adding `LightNetwork` as a dependency is as easy as adding it to the `dependencies` value of your `Package.swift` or the Package list in Xcode.

```swift
dependencies: [
    .package(url: "https://github.com/lengain/LightNetwork.git", .upToNextMajor(from: "1.0.0"))
]
```

Normally you'll want to depend on the `LightNetwork` target:

```swift
.product(name: "LightNetwork", package: "LightNetwork")
```

### Manually

If you prefer not to use any of the aforementioned dependency managers, you can integrate LightNetwork into your project manually.

## Requirements

* iOS 13.0+ 
* macOS 10.15+ 
* tvOS 13.0+ 
* watchOS 6.0+ 
* Swift 5.7.1 
* Xcode 14.1 

## License

LightNetwork is released under the MIT license. [See LICENSE](https://raw.githubusercontent.com/lengain/LightNetwork/main/LICENSE) for details.
