//
//  File.swift
//  
//
//  Created by 童玉龙 on 2024/3/9.
//

import Foundation
#if canImport(OHHTTPStubs)
    import OHHTTPStubs
#elseif canImport(OHHTTPStubsSwift)
    import OHHTTPStubsCore
    import OHHTTPStubsSwift
#endif
import LightNetwork

struct LNURLApi {
    static let baseURL = "http://lightnetwork.com"
    static let goods = "/goods"
    static let modify = "/modify"
}


class RequestUtil {
    
    static let expectResponseData : [String : Any] = [
        "code" : 200,
        "message" : "success",
        "data" : [
            "goodsId" : "1234",
            "goodsBrand" : "top"
        ]
    ]
    
    static func mockServer() {
        
        HTTPStubs.stubRequests { requeset in
            return requeset.url?.host == "lightnetwork.com"
        } withStubResponse: { request in
            guard let url = request.url else { return HTTPStubsResponse.init()}
            switch url.path() {
            case LNURLApi.goods, LNURLApi.modify:
                return HTTPStubsResponse(jsonObject: expectResponseData, statusCode: 200, headers: nil)
            default:
                return HTTPStubsResponse.init()
            }
            
        }
        
        LNNetworkManager.default.configuration.baseURL = URL(string: LNURLApi.baseURL)
    }
}
