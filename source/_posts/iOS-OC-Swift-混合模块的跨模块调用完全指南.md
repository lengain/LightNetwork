---
title: iOS OC-Swift 混合模块的跨模块调用完全指南
date: 2026-06-14 23:27:04
tags: 技术
categories: 技术
---

# iOS OC-Swift 混合模块的跨模块调用完全指南

---

## 一、问题的提出

组件化架构下，一个模块可能同时包含 OC 和 Swift 代码。当下游模块需要同时调用这个混合模块的 OC 类和 Swift 类时，四种调用路径会产生截然不同的技术挑战：

| 调用方     | 被调用方    | 难度        |
| ------- | ------- | --------- |
| Swift → | OC 类    | 容易        |
| Swift → | Swift 类 | 最容易       |
| OC →    | OC 类    | 容易        |
| OC →    | Swift 类 | ⚠️ 最容易出问题 |

本文将逐一拆解这四条路径的原理和配置，并给出完整的 Podspec 最佳实践。

<!--more-->

---

## 二、OC-Swift 互操作的核心机制

### 2.1 Framework 模块的构成

CocoaPods 启用 `use_frameworks!` 后，每个 pod 被编译为独立的动态 framework。每个 framework 包含一个 Clang module map，定义了模块的边界和接口。

一个典型的 module map 如下：

```objc
framework module MyModule {
    umbrella header "MyModule-umbrella.h"
    export *
    module * { export * }
}
```

### 2.2 两个自动生成的关键头文件

理解下面两个头文件，就理解了 OC-Swift 互操作的 90%。

#### `<Module>-umbrella.h`（由 CocoaPods 生成）

位于 `Pods/Target Support Files/<Pod>/` 目录，负责聚合该 pod 中**所有公开的 OC 头文件**：

```objc
#ifdef __OBJC__
#import <UIKit/UIKit.h>
#endif

#import "MyOCCalculator.h"   // 所有公开的 OC 头文件被自动导入
#import "MyOCCacheManager.h"
```

#### `<Module>-Swift.h`（由 Swift 编译器自动生成）

这是最关键的文件。**Swift 编译器读取该模块中所有 `@objc public` 的 Swift 类**，生成对应的 OC `@interface` 声明。

例如一个 Swift 类：

```swift
@objc public class MyService: NSObject {
    @objc public func fetchData() -> String {
        return "data"
    }
}
```

会在 `MyModule-Swift.h` 中生成：

```objc
SWIFT_CLASS("_TtC8MyModule9MyService")
@interface MyService : NSObject
- (NSString * _Nonnull)fetchData;
- (nonnull instancetype)init OBJC_DESIGNATED_INITIALIZER;
@end
```

### 2.3 模块导入：`@import` vs `import`

这两种导入语法本质相同，都导入模块的**全部公开接口**：

| 语言          | 语法                  | 效果                               |
| ----------- | ------------------- | -------------------------------- |
| Objective-C | `@import MyModule;` | = 所有 OC 公开头 + `<Module>-Swift.h` |
| Swift       | `import MyModule`   | = 所有 OC 公开头 + 所有 Swift 公开类       |

**关键结论**：`@import MyModule;` 等价于 `#import <MyModule/MyOCCalculator.h>` + `#import <MyModule/MyModule-Swift.h>` 的总和。这是 OC 代码跨模块访问 Swift 类的**唯一通道**。

---

## 三、四种跨模块调用路径详解

假设两个模块：

- **ModuleA**：混合模块，包含 `OCCalculator`（OC 类）和 `SwiftService`（Swift 类，`@objc` 暴露）
- **ModuleB**：下游模块，需要调用 ModuleA 的两种类

### 路径 1：Swift (in B) → OC (in A)

```swift
// ModuleB/SwiftConsumer.swift
import ModuleA

let calculator = OCCalculator()          // OC 类通过模块接口桥接到 Swift
let result = calculator.calculate() ?? 0
```

**原理**：ModuleA 的 Umbrella Header 导入了 `OCCalculator.h`，Swift 编译器编译 ModuleA 的模块接口时，将该 OC 类桥接为 Swift 可用的类型。OC 中的 `NSString *` 返回类型会被桥接为 Swift 的 `String?`。

**无需额外配置**，只要 `OCCalculator.h` 是公开头文件即可。

### 路径 2：Swift (in B) → Swift (in A)

```swift
// ModuleB/SwiftConsumer.swift
import ModuleA

let service = SwiftService()              // 直接访问
let result = service.fetchData()
```

**原理**：同模块内 Swift 类互相可见，跨模块通过 `import ModuleA` 直接导入。最顺畅的路径。

**前提**：SwiftService 必须声明为 `public`（Swift 的访问控制级别）。

### 路径 3：OC (in B) → OC (in A)

```objc
// ModuleB/OCConsumer.m
@import ModuleA;

@implementation OCConsumer

- (NSString *)callOCFromA {
    OCCalculator *calc = [[OCCalculator alloc] init];
    return [calc calculate];
}

@end
```

**原理**：`@import ModuleA;` 导入后，Umbrella Header 中包含的 `OCCalculator.h` 立即可用，和同 target 内的使用体验一致。

### 路径 4：OC (in B) → Swift (in A) ⚠️

```objc
// ModuleB/OCConsumer.m
@import ModuleA;

- (NSString *)callSwiftFromA {
    SwiftService *service = [[SwiftService alloc] init];
    return [service fetchData];
}
```

**这是最隐蔽、最容易踩坑的路径**。OC 代码要成功访问另一模块的 Swift 类，必须**同时满足**四个条件：

1. **Swift 类继承 `NSObject`**（或用 `@objc` 标记整个类）
2. **所有被调用方法标记 `@objc`**
3. **OC 代码使用 `@import ModuleA;`**（而不是 `#import <ModuleA/ModuleA-Swift.h>`）
4. **podspec 中声明了 `s.dependency 'ModuleA'`**

```swift
// ✅ 正确姿势
@objc public class SwiftService: NSObject {
    @objc public func fetchData() -> String { ... }
}
```

> ⚠️ 致命误区：`#import <ModuleA/ModuleA-Swift.h>` 只在**同一 target 内**有效。跨模块调用必须使用 `@import ModuleA;`，因为 `<Module>-Swift.h` 是构建产物，位于 DerivedData 中，不在源文件目录。

---

## 四、Podspec 配置详解

### 4.1 纯 Swift Pod → Mixed Pod

```ruby
# ❌ 仅 Swift
s.source_files = 'Sources/**/*.swift'

# ✅ 混合 OC + Swift
s.source_files = 'Sources/**/*.{h,m,swift}'
s.public_header_files = 'Sources/**/*.h'
```

`source_files` 必须包含 `h`、`m`、`swift` 三种扩展名，缺一不可。`public_header_files` 显式声明哪些头文件公开——不声明时，CocoaPods 默认所有 `.h` 都是公开的。

### 4.2 HEADER_SEARCH_PATHS 配置（容易遗漏）

CocoaPods 生成的 Umbrella Header 位于 `Pods/Target Support Files/<Pod>/` 目录，它使用 `#import "FileName.h"`（引号导入）引用源文件头。编译器需要 HEADER_SEARCH_PATHS 来定位这些文件：

```ruby
s.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => '${PODS_TARGET_SRCROOT}/Sources/**'
}
```

**不配置的后果**：编译时报 `'MyHeader.h' file not found`，因为 Umbrella Header 找不到同目录下的 OC 头文件。

### 4.3 跨模块依赖声明

```ruby
s.dependency 'ModuleA'
```

这条声明实际做了三件事：

| 效果                | 说明                                          |
| ----------------- | ------------------------------------------- |
| 添加 Framework 搜索路径 | 编译器能找到 `ModuleA.framework`                  |
| 添加链接器标志           | `-framework "ModuleA"` 自动加入 `OTHER_LDFLAGS` |
| 保证构建顺序            | ModuleA 先构建，当前模块后构建                         |

### 4.4 完整 Podspec 模板

```ruby
Pod::Spec.new do |s|
  s.name             = 'MyMixedModule'
  s.version          = '1.0.0'
  s.swift_version    = '5.0'
  s.ios.deployment_target = '13.0'

  s.source_files         = 'Sources/**/*.{h,m,swift}'
  s.public_header_files  = 'Sources/**/*.h'

  s.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => '${PODS_TARGET_SRCROOT}/Sources/**'
  }

  # 如果被其他模块依赖
  # s.dependency 'SomeOtherModule'
end
```

下游模块的 podspec：

```ruby
Pod::Spec.new do |s|
  s.name             = 'DownstreamModule'
  s.source_files     = 'Sources/**/*.{h,m,swift}'
  s.public_header_files = 'Sources/**/*.h'
  s.dependency 'MyMixedModule'          # 核心依赖
end
```

---

## 五、最佳实践与防坑指南

### 5.1 `@objc` 暴露的三种方式

| 方式             | 用法                                     | 适用场景        |
| -------------- | -------------------------------------- | ----------- |
| 类级 `@objc`     | `@objc public class MyClass: NSObject` | 整体暴露给 OC，推荐 |
| 方法级 `@objc`    | `@objc public func myMethod()`         | 只暴露特定方法     |
| `@objcMembers` | `@objcMembers public class MyClass`    | 所有成员自动暴露    |

**推荐策略**：对需要跨模块 OC→Swift 调用的类，使用类级 `@objc` + `NSObject` 继承。颗粒度刚好，不过度暴露。

### 5.2 `init()` 的正确写法

```swift
// NSObject 子类的 init 需要用 override 修饰
@objc public class MyService: NSObject {
    @objc override public init() {
        super.init()
    }
}
```

### 5.3 `@import` 放在 `.m` 而非 `.h` 中

```objc
// ===== MyConsumer.h =====
// ❌ 不要在头文件中 @import 其他模块
@import ModuleA;   // 不好：暴露了依赖细节

// ⚠️ 如果头文件确实需要引用其他模块的类型，使用 @class 前向声明
@class SwiftServiceFromA;

@interface MyConsumer : NSObject
- (NSString *)processService:(SwiftServiceFromA *)service;
@end
```

```objc
// ===== MyConsumer.m =====
// ✅ @import 放在实现文件中
@import ModuleA;
#import "MyConsumer.h"

@implementation MyConsumer
// 可以自由使用 ModuleA 的所有公开类型
@end
```

### 5.4 Podfile 显式声明 platform

```ruby
platform :ios, '13.0'     # ⚠️ 必填

target 'MyApp' do
  use_frameworks!
  pod 'MyMixedModule', :path => '../MyMixedModule'
end
```

不声明 platform 会导致 CocoaPods 自动选择，可能与 podspec 的 `deployment_target` 不一致，产生诡异问题。

---

## 六、常见问题与解决方案

### Q1：`No visible @interface for 'SwiftService' declares the selector 'fetchData'`

**原因**：OC 代码调用了 Swift 类的方法，但该方法未用 `@objc` 标记。

**解决**：在方法前加 `@objc`，或整个类加 `@objcMembers`。

### Q2：`'MyHeader.h' file not found`

**原因**：Umbrella Header 无法找到 OC 头文件，HEADER_SEARCH_PATHS 缺失。

**解决**：

```ruby
s.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => '${PODS_TARGET_SRCROOT}/Sources/**'
}
```

### Q3：`No such module 'ModuleA'`

**原因**：缺少 `s.dependency` 声明。

**解决**：

```ruby
s.dependency 'ModuleA'
```

### Q4：`#import <ModuleA/ModuleA-Swift.h>` 跨模块无效

**原因**：`<Module>-Swift.h` 是 Swift 编译器在 DerivedData 中生成的构建产物，不属于源文件，不能通过文件路径跨模块引用。

**解决**：使用 `@import ModuleA;` 代替。

### Q5：`pod install` 后 OC 文件未出现在 Pods 项目中

**原因**：CocoaPods 缓存了旧的 Pods 项目结构。

**解决**：

```bash
rm -rf Pods Podfile.lock
pod install
```

### Q6：Swift 中 OC 类显示为不可用

**原因**：OC 头文件没有被包含在 Umbrella Header 中，或者没有正确标记为 public。

**解决**：检查 `public_header_files` 是否匹配了 OC 头文件路径；检查生成的 `<Pod>-umbrella.h` 是否包含对应的 `#import`。

---

## 七、从零搭建混合模块的检查清单

### 模块提供方（混合模块）

- [ ] `source_files` 包含 `{h,m,swift}` 三种扩展名
- [ ] `public_header_files` 指向所有 OC 头文件
- [ ] `pod_target_xcconfig` 设置了 `HEADER_SEARCH_PATHS`
- [ ] Swift 类用 `@objc public` + `NSObject` 暴露给 OC
- [ ] 需要跨 OC 调用的方法逐个加了 `@objc`

### 模块消费方（下游模块）

- [ ] `s.dependency '提供方模块名'` 已声明
- [ ] OC 文件中使用 `@import 提供方模块名;`（非 `#import` 文件路径）
- [ ] Swift 文件中使用 `import 提供方模块名`
- [ ] Podfile / MainProject 引用了所有依赖

### 构建验证

- [ ] `pod install` 成功，无警告
- [ ] `xcodebuild` 构建成功
- [ ] `nm Framework.framework/Framework | grep ClassName` 确认符号存在
- [ ] 四种跨模块路径均返回预期结果

---

## 八、参考资源

- [Swift and Objective-C in the Same Project - Apple](https://developer.apple.com/documentation/swift/mixing-objective-c-and-swift)
- [CocoaPods Podspec Syntax Reference](https://guides.cocoapods.org/syntax/podspec.html)
- [Clang Module Maps](https://clang.llvm.org/docs/Modules.html)

---

*欢迎转载，请注明出处。*
