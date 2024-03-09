//
//  LightConfiguration.swift
//  LightNetwork
//
//  Created by 童玉龙 on 2024/3/4.
//

import Alamofire
import Foundation

/// Global network interceptor of for all of `LNRequest`
public protocol LNNetworkInterceptor {
    
    func interceptor(allow request: LNBaseRequest) -> Bool
    
    /// called when `LNBaseRequest` start
    /// - Parameter request: current `LNBaseRequest`
    func interceptor(start request: LNBaseRequest) -> Void
    
    /// called when `LNBaseRequest` end
    /// - Parameter request: current `LNBaseRequest`
    func interceptor(end request: LNBaseRequest) -> Void
    
    /// intercept parameter for all of `LNRequest`
    /// - Parameters:
    ///   - request: current `LNBaseRequest`
    ///   - parameter: parameter before intercept
    /// - Returns: parameter after intercept
    func interceptor(_ request: LNBaseRequest, parameter: Parameters?) -> Parameters?

    /// intercept HTTPHeaders for all of `LNRequest`
    /// - Parameters:
    ///   - request: current `LNBaseRequest`
    ///   - headerFields: HTTPHeaders before intercept
    /// - Returns: HTTPHeaders after intercept
    func interceptor(_ request: LNBaseRequest, headerFields: HTTPHeaders?) -> HTTPHeaders?
}

extension LNNetworkInterceptor {
    func interceptor(allow request: LNBaseRequest) -> Bool {
        return true
    }
}

public enum LNDebugLevel: Int {
    case none
    case error
    case all
}

public func LNDebugPrint(message: String, level: LNDebugLevel) {
    switch LNNetworkManager.default.configuration.debugLevel {
    case .none: return
    case .error: if level == .error { print(message) }
    case .all: print(message)
    }
}



/// ## Configuration For LNNetworkManager
///
///
/// ## URL Construction Using Relative Paths
/// For HTTP convenience methods, the request serializer constructs URLs from the path relative to the `-baseURL`, using `URL init(string:relativeTo url:)`, when provided. If `baseURL` is `nil`, `path` needs to resolve to a valid `URL` object using `URL init(string:):`.
///
/// Below are a few examples of how `baseURL` and relative paths interact:
///
///  let baseURL : URL = URL(string: "http://example.com/v1/")
///  URL(string: "foo" relativeTo: baseURL)                  // http://example.com/v1/foo
///  URL(string: "foo?bar=baz" relativeTo: baseURL)          // http://example.com/v1/foo?bar=baz
///  URL(string: "/foo" relativeTo: baseURL)                 // http://example.com/foo
///  URL(string: "foo/" relativeTo: baseURL)                 // http://example.com/v1/foo
///  URL(string: "/foo/" relativeTo: baseURL)                // http://example.com/foo/
///  URL(string: "http://example2.com/" relativeTo:baseURL) // http://example2.com/
///
/// Also important to note is that a trailing slash will be added to any `baseURL` without one. This would otherwise cause unexpected behavior when constructing URLs using paths without a leading slash.
public struct LNNetworkConfiguration {
    
    ///  The URL used to construct requests from relative paths
    public var baseURL: URL? {
        didSet {
            processBaseURL()
        }
    }
    
    /// `LNNetworkInterceptor` value to be used by the returned every `LNRequest`. `nil` by default.
    public var networkInterceptor: LNNetworkInterceptor?
    
    /// debug level for LightNetwork. `.all` by default
    public var debugLevel: LNDebugLevel
    
    /// Default memory threshold used when encoding `MultipartFormData`, in bytes. `10_000_000`(approximate 9.54Mb) by default.
    public var encodingMemoryThreshold: UInt64
    
    /// `FileManager` for  upload request
    public var uploadFileManager: FileManager
    
    
    public init(baseURL: URL?, networkInterceptor: LNNetworkInterceptor? = nil, debugLevel: LNDebugLevel = .all, encodingMemoryThreshold: UInt64 = MultipartFormData.encodingMemoryThreshold, uploadFileManager: FileManager = .default) {
        self.baseURL = baseURL
        self.networkInterceptor = networkInterceptor
        self.debugLevel = debugLevel
        self.encodingMemoryThreshold = encodingMemoryThreshold
        self.uploadFileManager = uploadFileManager
        processBaseURL()
    }
    
    mutating func processBaseURL() {
        if let url : URL = baseURL {
            if url.path.count > 0 && !url.absoluteString.hasSuffix("/") {
                baseURL = url.appendingPathComponent("")
            }
        }
    }
}
