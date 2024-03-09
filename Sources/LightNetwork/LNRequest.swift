//
//  LNRequest.swift
//  LightNetwork
//
//  Created by 童玉龙 on 2024/3/5.
//

import Alamofire
import Foundation

open class LNRequest: LNBaseRequest {
    @discardableResult
    open class func get(path: String, parameters: Parameters? = nil, success: LNRequestSuccess?, failure: LNRequestFailure? = nil) -> DataRequest? {
        self.request(path: path, parameters: parameters, success: success, failure: failure)
    }
    
    @discardableResult
    open class func post(path: String, parameters: Parameters? = nil, success: LNRequestSuccess?, failure: LNRequestFailure? = nil) -> DataRequest? {
        self.request(path: path, method: .post, parameters: parameters, success: success, failure: failure)
    }
    
    /// Creates a `DataRequest` with path, method and parameters
    /// - Parameters:
    ///   - path: `path` for concatenating request  url.
    ///   - method: `HTTPMethod` for the `URLRequest`. `.get` by default.
    ///   - parameters: `Parameters` (a.k.a. `[String: Any]`) value to be encoded into the `URLRequest`. `nil` by default.
    ///   - success: call back when request success
    ///   - failure: call back when request failure
    /// - Returns: The created `DataRequest`.
    @discardableResult
    open class func request(path: String, method: HTTPMethod = .get, parameters: Parameters? = nil, success: LNRequestSuccess?, failure: LNRequestFailure?) -> DataRequest? {
        // init with class object
        let req: LNRequest = self.init(path: path)
        if req.prepareRequest(path: path, method: method, parameters: parameters) == false {
            return nil
        }
        return req.manager.request(req.url,
                                   method: req.method,
                                   parameters: req.parameters,
                                   encoding: req.encoding,
                                   headers: req.headers,
                                   interceptor: req.interceptor,
                                   requestModifier: { request in
                                       try req.modify(request: &request)
                                   }).response { response in
            req.process(response: response, success: success, failure: failure)
            req.config.networkInterceptor?.interceptor(end: req)
        }
    }
    
    open func prepareRequest(path: String, method: HTTPMethod = .get, parameters: Parameters? = nil) -> Bool {
        self.method = method
        let allow: Bool = self.config.networkInterceptor?.interceptor(allow: self) ?? true
        if allow == false || self.allowRequest == false {
            return false
        }
        
        let para: Parameters? = self.config.networkInterceptor?.interceptor(self, parameter: parameters) ?? parameters
        self.parameters = para
        
        let headers: HTTPHeaders? = self.config.networkInterceptor?.interceptor(self, headerFields: self.headers) ?? self.headers
        self.headers = headers
        
        config.networkInterceptor?.interceptor(start: self)
        return true
    }
    
    /// Process the response for all of `DataRequest`
    /// Override this method when you want to handle the response, you have to call the success and failure closure manually
    /// - Parameters:
    ///   - response: the response of the `DataRequest`
    ///   - success: call back when request success
    ///   - failure: call back when request failure
    open func process(response: AFDataResponse<Data?>, success: LNRequestSuccess?, failure: LNRequestFailure? = nil) {
        switch response.result {
        case let .success(data):
            guard let sourceData = data else { return }
            do {
                let jsonData = try JSONSerialization.jsonObject(with: sourceData, options: .allowFragments)
                success?(self, jsonData)
            } catch {
                let error = AFError.responseSerializationFailed(reason: .jsonSerializationFailed(error: error))
                failure?(self, error)
            }
        case let .failure(error):
            failure?(self, error)
        }
    }
    
    /// Creates a `UploadRequest` with path, method, parameters, and multipartFormData
    /// - Parameters:
    ///   - path: `path` for concatenating request  url.
    ///   - method: `HTTPMethod` for the `URLRequest`. `.get` by default.
    ///   - parameters: `Parameters` (a.k.a. `[String: Any]`) value to be encoded into the `URLRequest`. `nil` by default.
    ///   - multipartFormData: `MultipartFormData` building closure.
    ///   - success: call back when request success
    ///   - failure: call back when request failure
    /// - Returns: The created `UploadRequest`.
    @discardableResult
    open class func upload(
        path: String,
        method: HTTPMethod = .get,
        parameters: Parameters? = nil,
        multipartFormData: @escaping (MultipartFormData) -> Void,
        success: LNRequestSuccess?,
        failure: LNRequestFailure? = nil) -> UploadRequest?
    {
        // init with class object
        let req: LNRequest = self.init(path: path)
        if req.prepareRequest(path: path, method: method, parameters: parameters) == false {
            return nil
        }
        return req.manager.upload(multipartFormData: multipartFormData,
                                  to: req.url,
                                  method: req.method,
                                  headers: req.headers,
                                  interceptor: req.interceptor,
                                  requestModifier: { request in
                                      try req.modify(request: &request)
                                  })
                                  .response { response in
                                      req.process(response: response, success: success, failure: failure)
                                      req.config.networkInterceptor?.interceptor(end: req)
                                  }
    }
    
    /// Creates a `DownloadRequest` with path, method, parameters, and destination
    /// - Parameters:
    ///   - path: `path` for concatenating request  url.
    ///   - method: `HTTPMethod` for the `URLRequest`. `.get` by default.
    ///   - parameters: `Parameters` (a.k.a. `[String: Any]`) value to be encoded into the `URLRequest`. `nil` by default.
    ///   - success: call back when request success
    ///   - failure: call back when request failure
    ///   - destination: `DownloadRequest.Destination` closure used to determine how and where the downloaded file should be moved. `nil` by default.
    /// - Returns: The created `DownloadRequest`.
    @discardableResult
    open class func download(path: String, method: HTTPMethod = .get, parameters: Parameters? = nil, success: LNRequestSuccess?, failure: LNRequestFailure? = nil, to destination: DownloadRequest.Destination? = nil) -> DownloadRequest? {
        // init with class object
        let req: LNRequest = self.init(path: path)
        if req.prepareRequest(path: path, method: method, parameters: parameters) == false {
            return nil
        }
        let destination2 = destination ?? DownloadRequest.suggestedDownloadDestination()
        return req.manager.download(req.url,
                                    method: req.method,
                                    parameters: req.parameters,
                                    encoding: req.encoding,
                                    headers: req.headers,
                                    interceptor: req.interceptor,
                                    requestModifier: { request in
                                        try req.modify(request: &request)
                                    },
                                    to: destination2)
            .response { response in
                req.processDownload(response: response, success: success, failure: failure)
                req.config.networkInterceptor?.interceptor(end: req)
            }
    }
    
    /// Process the response for all of `DownloadRequest`
    /// Override this method when you want to handle the response, you have to call the success and failure closure manually
    /// - Parameters:
    ///   - response: the response of the `DownloadRequest`
    ///   - success: call back when request success
    ///   - failure: call back when request failure
    open func processDownload(response: AFDownloadResponse<URL?>, success: LNRequestSuccess?, failure: LNRequestFailure? = nil) {
        switch response.result {
        case let .success(data):
            success?(self, data?.absoluteString as Any)
        case let .failure(error):
            failure?(self, error)
        }
    }
}
