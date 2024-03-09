// swift-tools-version: 5.10
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "LightNetwork",
    platforms: [
        .iOS(.v13),
        .macOS(.v10_15),
        .tvOS(.v13),
        .watchOS(.v6)
    ],
    products: [
        // Products define the executables and libraries a package produces, making them visible to other packages.
        .library(
            name: "LightNetwork",
            targets: ["LightNetwork"]),
    ],
    dependencies: [
           .package(url: "https://github.com/Alamofire/Alamofire.git", .upToNextMajor(from: "5.0.0")),
           .package(url: "https://github.com/Quick/Quick.git", .upToNextMajor(from: "4.0.0")), // dev
           .package(url: "https://github.com/Quick/Nimble.git", .upToNextMajor(from: "9.0.0")), // dev
           .package(url: "https://github.com/AliSoftware/OHHTTPStubs.git", .upToNextMajor(from: "9.0.0")) // dev
        ],
    targets: [
        // Targets are the basic building blocks of a package, defining a module or a test suite.
        // Targets can depend on other targets in this package and products from dependencies.
        .target(
            name: "LightNetwork",
            dependencies: [
                .product(name: "Alamofire", package: "Alamofire")
            ]
        ),
        .testTarget( // dev
            name: "LightNetworkTests",
            dependencies: [
                "LightNetwork",
                .product(name: "Quick", package: "Quick"), // dev
                .product(name: "Nimble", package: "Nimble"), // dev
                .product(name: "OHHTTPStubsSwift", package: "OHHTTPStubs") // dev
            ]
        ),
    ]
    
)
