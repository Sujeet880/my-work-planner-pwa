// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MyWorkPlannerMiniTimer",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "MyWorkPlannerMiniTimer",
            targets: ["MyWorkPlannerMiniTimer"]
        ),
        .executable(
            name: "MiniTimerTestsRunner",
            targets: ["MiniTimerTestsRunner"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.26.0")
    ],
    targets: [
        .target(
            name: "MyWorkPlannerMiniTimerCore",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift")
            ],
            path: "Sources"
        ),
        .executableTarget(
            name: "MyWorkPlannerMiniTimer",
            dependencies: [
                "MyWorkPlannerMiniTimerCore"
            ],
            path: "AppLauncher"
        ),
        .executableTarget(
            name: "MiniTimerTestsRunner",
            dependencies: [
                "MyWorkPlannerMiniTimerCore"
            ],
            path: "TestsRunner"
        )
    ]
)
