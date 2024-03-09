//
//  File.swift
//  
//
//  Created by 童玉龙 on 2024/3/8.
//

import Quick
import Nimble
#if canImport(OHHTTPStubs)
    import OHHTTPStubs
#elseif canImport(OHHTTPStubsSwift)
    import OHHTTPStubsCore
    import OHHTTPStubsSwift
#endif

@testable import LightNetwork

class LNNetworkGroup {
    
    public static let `default` = LNNetworkGroup()
    var managerA : LNNetworkManager?
    var managerB : LNNetworkManager?
    var managerC : LNNetworkManager?
    var managerD : LNNetworkManager?
    
    init() {
        
        self.managerA = manager(url: "https://github.com/")
        self.managerB = manager(url: "https://github.com")
        self.managerC = manager(url: "https://github.com/child")
        self.managerD = manager(url: "https://github.com/child/")
    }
    
    func manager(url:String) -> LNNetworkManager {
        var config = LNNetworkConfiguration(baseURL: URL(string: url))
        return LNNetworkManager.init(configuration: config)
    }
}



class LNConcatenateARequet: LNRequest {
    override var manager: LNNetworkManager {
        LNNetworkGroup.default.managerA!
    }
}

class LNConcatenateBRequet: LNRequest {
    override var manager: LNNetworkManager {
        LNNetworkGroup.default.managerB!
    }
}

class LNConcatenateCRequet: LNRequest {
    override var manager: LNNetworkManager {
        LNNetworkGroup.default.managerC!
    }
}

class LNConcatenateDRequet: LNRequest {
    override var manager: LNNetworkManager {
        LNNetworkGroup.default.managerD!
    }
}

final class URLConcatenateSpec : QuickSpec {
    
    override func spec() {

        if #available(OSX 10.15, iOS 13.0,tvOS 13.0, watchOS 6.0, *) {
            
            let test : (LNRequest.Type) -> Void = { cla  in
                let expectURL1 : String = "https://github.com/path"
                let expectURL2 : String = "https://github.com/next/path"
                let expectURL3 : String = "https://github.com/next/#/path"
                
                it("/path") {

                    let request = cla.init(path: "/path")
                    expect(request.url.absoluteString).to(equal(expectURL1))
                }
                
                it("path") {
                    let request = cla.init(path: "path")
                    expect(request.url.absoluteString).to(equal(expectURL1))
                }
                
                it("next/path") {
                    let request = cla.init(path: "next/path")
                    expect(request.url.absoluteString).to(equal(expectURL2))
                }
        
                it("/next/path") {
                    let request = cla.init(path: "/next/path")
                    expect(request.url.absoluteString).to(equal(expectURL2))
                }
                
                it("next/#/path") {
                    let request = cla.init(path: "next/#/path")
                    expect(request.url.absoluteString).to(equal(expectURL3))
                }
            }
            
            let test2 : (LNRequest.Type) -> Void = { cla  in
                let expectURL1 : String = "https://github.com/child/path"
                let expectURL2 : String = "https://github.com/child/next/path"
                
                let expectURL3 : String = "https://github.com/path"
                let expectURL4 : String = "https://github.com/next/path"

                it("path") {
                    let request = cla.init(path: "path")
                    let a = request.manager.baseURL
                    let b = URL(string: request.path, relativeTo: a)
                    print(b?.absoluteString ?? "")
                    expect(request.url.absoluteString).to(equal(expectURL1))
                }
                
                it("/path") {
                    let request = cla.init(path: "/path")
                    expect(request.url.absoluteString).to(equal(expectURL3))
                }
                
                it("next/path") {
                    let request = cla.init(path: "next/path")
                    expect(request.url.absoluteString).to(equal(expectURL2))
                }
                
                it("/next/path") {
                    let request = cla.init(path: "/next/path")
                    expect(request.url.absoluteString).to(equal(expectURL4))
                }
                
            }
            
            describe("URL concatenate1") {
                test(LNConcatenateARequet.self)
            }
            
            describe("URL concatenate2") {
                test(LNConcatenateBRequet.self)

            }
            
            describe("URL concatenate1") {
                test2(LNConcatenateCRequet.self)
            }
            
            describe("URL concatenate2") {
                test2(LNConcatenateDRequet.self)
            }

            
        }
    }
    
}

