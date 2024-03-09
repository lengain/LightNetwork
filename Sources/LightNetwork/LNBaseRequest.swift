//
//  LNRequest.swift
//  LightNetwork
//
//  Created by 童玉龙 on 2024/3/4.
//

import Foundation
import Alamofire

public typealias LNRequestSuccess = (_ request: LNBaseRequest, _ responseData: Any) -> Void
public typealias LNRequestFailure = (_ request: LNBaseRequest, _ error: Error) -> Void

open class LNBaseRequest: NSObject {
    
    /// A computed property retun the` LNNetworkManager` for initiating a network request
    open var manager: LNNetworkManager { LNNetworkManager.default }
    
    /// A computed property retun the` LNNetworkConfiguration` for manager
    open var config: LNNetworkConfiguration { manager.configuration }

    /// `String` value to be used by the url path
    open var path: String = ""
    
    /// Constructed URL with baseURL and path
    open var url : URL {
        URL(string: path, relativeTo: manager.baseURL) ?? manager.baseURL
    }
    
    ///  `HTTPMethod` for the `URLRequest`. `.get` by default.
    open var method: HTTPMethod = .get
    
    /// `Parameters` (a.k.a. `[String: Any]`) value to be encoded into the `URLRequest`. `nil` by default.
    open var parameters: Parameters?
    
    /// `RequestInterceptor` value to be used by the returned `DataRequest`. `nil` by default.
    open var interceptor: RequestInterceptor?
    
    /// `RequestModifier` which will be applied to the `URLRequest` created from the provided
    open var requestModifier: Alamofire.Session.RequestModifier?
    
    /// `ParameterEncoding` to be used to encode the `parameters` value into the `URLRequest`. `URLEncoding.default` by default.
    open var encoding: ParameterEncoding = URLEncoding.default
    
    /// `HTTPHeaders` value to be added to the `URLRequest`. `nil` by default.
    open var headers: HTTPHeaders?
    
    /// The cache policy of the `URLRequest`.`.useProtocolCachePolicy` by default.
    open var cachePolicy: URLRequest.CachePolicy = .useProtocolCachePolicy

    /// Returns the timeout interval of the receiver.
    /// - discussion: The timeout interval specifies the limit on the idle
    /// interval allotted to a request in the process of loading. The "idle
    /// interval" is defined as the period of time that has passed since the
    /// last instance of load activity occurred for a request that is in the
    /// process of loading. Hence, when an instance of load activity occurs
    /// (e.g. bytes are received from the network for a request), the idle
    /// interval for a request is reset to 0. If the idle interval ever
    /// becomes greater than or equal to the timeout interval, the request
    /// is considered to have timed out. This timeout interval is measured
    /// in seconds.
    open var timeoutInterval: TimeInterval = 60

    /// if allowRequest is false, the request will stop
    open var allowRequest: Bool { true }

    override public required init() {}

    public required convenience init(path: String) {
        self.init()
        self.path = path
        prepare()
    }
    
    /// override it then set the request's properties, it called after init
    open func prepare() {}
    
    internal func modify(request:inout URLRequest) throws  {
        request.timeoutInterval = timeoutInterval
        request.cachePolicy = cachePolicy
        try requestModifier?(&request)
    }

    override public var description: String {
        var des = String(describing: super.description)
        des = des.appendingFormat("\npath : %@", path)
            .appendingFormat("\nabsoluteURL : %@", url.absoluteString)
            .appendingFormat("\nmethod : %@", method.rawValue)
            .appendingFormat("\nparameters : %@", parameters ?? [:])
            .appendingFormat("\nhttpHeaders : %@", headers?.dictionary.description ?? [:])
            
        return des
    }

    deinit {
        LNDebugPrint(message: "deinit Request:" + self.description, level: .all)
    }
}
