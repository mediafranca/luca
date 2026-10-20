// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "luca",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(name: "luca", path: "Sources/luca")
    ]
)
