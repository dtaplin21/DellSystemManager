// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "GeoSynthQC",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "GeoSynthQC",
            targets: ["GeoSynthQC"]),
    ],
    dependencies: [
        // Add dependencies here if needed
        // Example: .package(url: "https://github.com/...", from: "1.0.0")
    ],
    targets: [
        .target(
            name: "GeoSynthQC",
            dependencies: []),
        .testTarget(
            name: "GeoSynthQCTests",
            dependencies: ["GeoSynthQC"]),
    ]
)

