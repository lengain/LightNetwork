---
title: 封装一个超级易用的Swift网络请求库
date: 2024-03-11 11:38:55
tags: iOS
categories:
---

Swift网络库最著名的就是`Alamofire`,但是在实际项目中，想要尽可能简单的发起网络请求，必须对`Alamofire`进行一层封装。依赖`Alamofire`的封装库也有很多优秀的，比如`Moya`。但是经过项目的使用，我发现`Moya`用起来并不简单。
<!-- more -->
它有以下问题：

* 硬编码较多
  Moya使用时要在指定的方法中添加请求方法，请求参数，路径。
* 封装复杂
  `Alamofire`已经是一个功能繁多的网络库了，`Moya`的二次封装，既要保证功能完整，又要使用面向协议，导致了过多的抽象，用户在使用时，大都需要三次业务的封装，虽然也面向协议了，但却复杂了。

因此对于众多中小项目而言，笔者觉得`Moya`并不是一个合适的选项。合适的网络库，应该是对基础库（Alamofire）的精简，保证既简单易用，又有灵活的扩展性。

那发起的请求，要简化到什么程度？
只需指定`参数`和`路径`，就可以发起请求，最好使用`类方法`，来直接发起请求。
而简化的越彻底，其他地方要做的就越多，因此，通常情况下，也要设计出以下功能：

* 统一设置公共参数
* 统一设置请求头
* 统一的设置加载指示器
* 统一解析数据
* 等等

我根据以上要求，花了两天的空闲时间，写了一个轻量级的网络库[LightNetwork](https://github.com/lengain/LightNetwork)，抛砖引玉。
该库使用面向对象的封装逻辑，下面是它的介绍。

## 发起请求

比如发起一个修改用户名的请求，外部暴露参数userName即可，方法内部指定path和parameter。调用时直接使用类方法调用。

```swift
class ExampleRequest : ExampleBaseRequest {
    class func modify(userName:String,success: @escaping LNRequestSuccess, failure:@escaping LNRequestFailure) {
        self.post(path: "/modify", parameters: ["userName":userName], success: success, failure: failure)
    }
}
//use
ExampleRequest.modify(userName: "Light") { request, responseData in
    print("Success:\(responseData)")
} failure: { request, errorDescription in
    print("Failure:\(errorDescription)")
}
```

如果觉得统一管理URL更好，也可以使用静态字符串。

```
struct URLPath {
    static let query : String = "/query"
    static let goods : String = "/goods"
    static let modify : String = "/modify"
}

class func modify(userName:String,success: @escaping LNRequestSuccess, failure:@escaping LNRequestFailure) {
    self.post(path: URLPath.modify, parameters: ["userName":userName], success: success, failure: failure)
}
```

## 全局配置

设置BaseURL：

```swift
var config = LNNetworkConfiguration(baseURL: URL(string: "https://example.com/"))
config.networkInterceptor = ExampleLightInterceptor.init()
LNNetworkManager.default.configuration = config
```

其中`config.networkInterceptor`是对所有网络请求的拦截器，可在拦截器中统一的添加参数，请求头。
配置全局拦截器：

```swift
class ExampleLightInterceptor: LNNetworkInterceptor {
    /// 添加公共参数
    func interceptor(_ request: LNBaseRequest, parameter: Parameters?) -> Parameters? {
        var para : Dictionary<String, Any> = parameter ?? Dictionary<String, Any>.init()
        para["public"] = "test"
        return para
    }
    /// 添加公共请求头
    func interceptor(_ request: LNBaseRequest, headerFields: Alamofire.HTTPHeaders?) -> Alamofire.HTTPHeaders? {
        var header = HTTPHeaders();
        headerFields?.dictionary.forEach { header.add(name: $0.key, value: $0.value) }
        header.add(name: "publicHeader", value: "test")
        return header
    }
    //请求开始。可配置显示加载指示器
    func interceptor(start request: LNBaseRequest) {
        print("Request start: \(request.url)")
    }
    //请求结束。可配置隐藏加载指示器
    func interceptor(end request: LNBaseRequest) {
        print("Request end: \(request.url)")
    }
}
```

配置统一的响应处理

```swift
class ExampleBaseRequest: LNRequest {
   //自定义error code，并使用LNRequestFailure返回
    var errorCode : Int = 0
    var responseData : Any?
    // 自定义统一处理响应结果
    override func process(response: AFDataResponse<Data?>, success: LNRequestSuccess?, failure: LNRequestFailure? = nil) {
        switch response.result {
        case let .success(data):
            guard let sourceData = data else { return }
            do {
                let jsonData = try JSONSerialization.jsonObject(with: sourceData, options: .allowFragments)

                let code : Int = (jsonData as! [String : Any])["code"] as! Int
                if code == 200 {
                    success?(self, jsonData)
                }else {
                    failure?(self, ExampleServerError.invalidParameter)
                }

            } catch {
                let error = AFError.responseSerializationFailed(reason: .jsonSerializationFailed(error: error))
                failure?(self, error)
            }
        case let .failure(error):
            failure?(self, error)
        }
    }
}
```

经过上述的配置，基本上满足的日常网络请求的需要，同时支持很方便的下载，上传，进度监控，设置缓存逻辑，超时时长等。详细的配置可以参考[示例代码](https://github.com/lengain/ExampleForLightNetwork).

## 兼容性

LightNetwork中的请求方法，本身就是调用Alamofire的请求方法，LightNetwork所做的只是Alamofire多参数的方法进行类化。即将Alamofire请求方法的参数，写成LightNetwork LNBaseRequest类的属性，这样即方便了统一配置，也便于Alamofire方法的简化。同时，返回参数保持和Alamofire一致，保留了Alamofire方法的链式调用。

```swift
//Alamofire
open func request(_ convertible: URLConvertible,
                      method: HTTPMethod = .get,
                      parameters: Parameters? = nil,
                      encoding: ParameterEncoding = URLEncoding.default,
                      headers: HTTPHeaders? = nil,
                      interceptor: RequestInterceptor? = nil,
                      requestModifier: RequestModifier? = nil) 
-> DataRequest
//LightNetwork
open class LNBaseRequest: NSObject {
    open var path: String = ""
    open var method: HTTPMethod = .get
    open var parameters: Parameters?
    open var encoding: ParameterEncoding = URLEncoding.default
    open var headers: HTTPHeaders?
    open var interceptor: RequestInterceptor?
    open var requestModifier: Alamofire.Session.RequestModifier?
    open var cachePolicy: URLRequest.CachePolicy = .useProtocolCachePolicy
    open var timeoutInterval: TimeInterval = 60

    open class func request(path: String,
                     method: HTTPMethod = .get, 
                     parameters: Parameters? = nil, 
                     success: LNRequestSuccess?, 
                     failure: LNRequestFailure?) 
-> DataRequest? 
}
```

以上~
