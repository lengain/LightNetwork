//
//  File.swift
//
//
//  Created by 童玉龙 on 2024/3/9.
//
import Foundation
import Nimble
import Quick
#if canImport(OHHTTPStubs)
    import OHHTTPStubs
#elseif canImport(OHHTTPStubsSwift)
    import OHHTTPStubsCore
    import OHHTTPStubsSwift
#endif

import Alamofire
import LightNetwork


class ExampleInterceptor : LNNetworkInterceptor {
    
    func interceptor(allow request: LightNetwork.LNBaseRequest) -> Bool {
        return true
    }
    
    func interceptor(start request: LightNetwork.LNBaseRequest) {
        
    }
    
    func interceptor(end request: LightNetwork.LNBaseRequest) {
        
    }
    
    func interceptor(_ request: LightNetwork.LNBaseRequest, parameter: Alamofire.Parameters?) -> Alamofire.Parameters? {
        var para : Alamofire.Parameters = parameter ?? Alamofire.Parameters.init()
        para["common"] = "nb"
        return para
    }
    
    func interceptor(_ request: LightNetwork.LNBaseRequest, headerFields: Alamofire.HTTPHeaders?) -> Alamofire.HTTPHeaders? {
        var headers :  Alamofire.HTTPHeaders = headerFields ?? Alamofire.HTTPHeaders.init()
        headers.add(name: "public", value: "nb")
        return headers
    }
}


final class InterceptorSpec: QuickSpec {
    
    override func spec() {
        RequestUtil.mockServer()
        LNNetworkManager.default.configuration.networkInterceptor = ExampleInterceptor()
        
        describe("intercept and add element") {
            it("Add common parameters") {
                
                var request : URLRequest?
                waitUntil { done in
                    
                    LNRequest.request(path: LNURLApi.goods, success: nil, failure: nil)?.response(completionHandler: { response in
                        request = response.request
                        done()
                    })
                }
                expect(request!.url?.absoluteString.contains("common")).to(equal(true))
            }
            
            it("Add common Headers") {
                var request : URLRequest?
                waitUntil { done in
                    
                    LNRequest.request(path: LNURLApi.goods, success: nil, failure: nil)?.response(completionHandler: { response in
                        request = response.request
                        done()
                    })
                }
                expect(request!.allHTTPHeaderFields?.contains(where: { key, value in
                    key == "public" && value == "nb"
                })).to(equal(true))
            }
            
            
        }
    }
}
