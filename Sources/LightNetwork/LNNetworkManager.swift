//
//  LightManager.swift
//  LightNetwork
//
//  Created by 童玉龙 on 2024/3/4.
//

import Alamofire
import Foundation

open class LNNetworkManager {
    public var configuration: LNNetworkConfiguration
    public var session: Alamofire.Session = Session()
    
    var baseURL: URL {
        assert(configuration.baseURL != nil, "LightNetwork: Please config the baseURL")
        return configuration.baseURL!
    }

    var requestInterceptor: LNNetworkInterceptor? {
        configuration.networkInterceptor
    }
    
    public static let `default` = LNNetworkManager()
    
    public init(configuration: LNNetworkConfiguration) {
        self.configuration = configuration
    }
    
    convenience init() {
        self.init(
            configuration: LNNetworkConfiguration(baseURL: nil)
        )
    }
    
    /// clear request cache
    class func clearRequestCache() {
        URLCache.shared.removeAllCachedResponses()
    }
    
    @discardableResult
    func request(
        _ convertible: URLConvertible,
        method: HTTPMethod = .get,
        parameters: Parameters? = nil,
        encoding: ParameterEncoding = URLEncoding.default,
        headers: HTTPHeaders? = nil,
        interceptor: RequestInterceptor? = nil,
        requestModifier: Alamofire.Session.RequestModifier? = nil
    ) -> DataRequest {
        return session.request(convertible, method: method, parameters: parameters, encoding: encoding, headers: headers, interceptor: interceptor, requestModifier: requestModifier)
    }
    
    @discardableResult
    func download(
        _ convertible: URLConvertible,
        method: HTTPMethod = .get,
        parameters: Parameters? = nil,
        encoding: ParameterEncoding = URLEncoding.default,
        headers: HTTPHeaders? = nil,
        interceptor: RequestInterceptor? = nil,
        requestModifier: Alamofire.Session.RequestModifier? = nil,
        to destination: DownloadRequest.Destination? = nil
    ) -> DownloadRequest {
        return session.download(convertible, method: method, parameters: parameters, encoding: encoding, headers: headers, interceptor: interceptor, requestModifier: requestModifier, to: destination)
    }
    
    @discardableResult
    func upload(
        multipartFormData: @escaping (
            MultipartFormData
        ) -> Void,
        to url: URLConvertible,
        method: HTTPMethod = .post,
        headers: HTTPHeaders? = nil,
        interceptor: RequestInterceptor? = nil,
        requestModifier: Alamofire.Session.RequestModifier? = nil
    ) -> UploadRequest {
        return session.upload(multipartFormData: multipartFormData, to: url, usingThreshold: configuration.encodingMemoryThreshold, method: method, headers: headers, interceptor: interceptor, fileManager: configuration.uploadFileManager, requestModifier: requestModifier)
    }
}
