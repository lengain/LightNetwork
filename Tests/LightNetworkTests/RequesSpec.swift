//
//  File.swift
//  
//
//  Created by 童玉龙 on 2024/3/8.
//

import Foundation
import Quick
import Nimble
#if canImport(OHHTTPStubs)
    import OHHTTPStubs
#elseif canImport(OHHTTPStubsSwift)
    import OHHTTPStubsCore
    import OHHTTPStubsSwift
#endif

import Alamofire
import LightNetwork





final class RequestSpec : QuickSpec {
    
    override func spec() {
        
        describe("Request") {
            RequestUtil.mockServer()
            
            it("Get Success") {
                var jsonData : [String : Any] = [:]
                waitUntil { done in
                    LNRequest.request(path: LNURLApi.goods) { request, responseData in
                        jsonData = responseData as! [String : Any]
                        done()
                    } failure: { request, errorDescription in
                    }
                }
                expect(jsonData["code"] as? Int).to(equal(RequestUtil.expectResponseData["code"] as? Int))
            }
            
            it ("Post Success") {
                var jsonData : [String : Any] = [:]
                waitUntil { done in
                    LNRequest.request(path: LNURLApi.modify, method: .post) { request, responseData in
                        jsonData = responseData as! [String : Any]
                        done()
                    } failure: { request, errorDescription in
                    }
                }
                expect(jsonData["code"] as? Int).to(equal(RequestUtil.expectResponseData["code"] as? Int))
                    
            }
            
        }
        
        
    }
    
}
