---
title: Flutter Flavorizr 鸿蒙平台适配多目标产物
date: 2026-03-04 23:42:14
tags: 
  - 鸿蒙
  - AI辅助创作
categories: 技术
ai_assisted: true
---

## 项目背景

### Flutter Flavorizr 是什么

[Flutter Flavorizr](https://github.com/AngeloAvv/flutter_flavorizr) 是 Flutter 生态中广泛使用的多环境构建工具，通过一份 YAML 配置自动生成 Android、iOS、macOS 三端的 flavor 工程结构。开发者只需声明各 flavor 的包名、图标、签名等差异化配置，工具即可自动完成 Gradle productFlavors 注入、Xcode scheme/build configuration 创建、资源文件分发等繁琐工作。

该项目在 pub.dev 上拥有较高使用量，是 Flutter 多环境管理的事实标准方案之一。

### 为什么要做鸿蒙适配

随着 HarmonyOS 生态的持续推进，越来越多的 Flutter 应用需要同时支持 Android、iOS 和鸿蒙三端。Flutter 社区已提供鸿蒙版 SDK（如 `Flutter 3.35.8-ohos`），但在构建工具层面，flavorizr 尚未支持鸿蒙平台的多产品（multi-product）构建。

鸿蒙平台的构建体系与 Android/iOS 有本质差异：

| 维度    | Android           | iOS/macOS                    | HarmonyOS                   |
| ----- | ----------------- | ---------------------------- | --------------------------- |
| 构建系统  | Gradle            | Xcode                        | hvigor                      |
| 多环境机制 | productFlavors    | scheme + build configuration | product + target            |
| 配置格式  | Groovy/Kotlin DSL | .xcodeproj + .xcconfig       | JSON5 (build-profile.json5) |
| 签名管理  | signingConfigs    | Provisioning Profile         | signingConfigs in JSON5     |

这意味着不能简单复用已有的 Android 或 iOS 处理器逻辑，需要为鸿蒙平台设计全新的配置模型和处理器链路。

<!--more-->

## 核心问题分析

适配过程中需要解决以下几个核心问题：

### 鸿蒙构建配置的双层结构

鸿蒙工程的多产品配置分布在两个层级：

- **项目级** `ohos/build-profile.json5`：定义 `app.products[]`（产品列表）和 `modules[].targets`（模块目标映射）
- **模块级** `ohos/entry/build-profile.json5`：定义 `targets[]`（构建目标的源码和资源配置）

这两个文件必须保持一致——每个 product 需要对应一个 target，target 的 `applyToProducts` 需要引用正确的 product name。

### product name 与 `flutter run --flavor` 的对齐

Flutter 鸿蒙版执行 `flutter run --flavor apple` 时，内部调用链如下：

```
flutter run --flavor apple
  → hvigor_utils.dart: getFlavor(buildProfileFile, "apple")
    → 遍历 build-profile.json5 的 products，查找 name == "apple" 的条目
    → 找到则使用该 product 构建，否则 fallback 到 "default"
  → hvigorw assembleHap -p product=apple -p buildMode=debug
```

这意味着 `build-profile.json5` 中的 `product.name` 必须与 `flutter run --flavor` 传入的 flavor 名**完全一致**。如果不一致，会静默回退到 default product，使用错误的签名和配置构建。

### 已有配置的非破坏性合并

用户的 `build-profile.json5` 中可能已存在手动配置的 products、signingConfigs、buildModeSet 等内容。处理器不能简单覆盖整个文件，必须实现**增量合并**——仅更新 flavorizr 管理的条目，保留其他内容不变。

### 跨平台工程目录的容错

实际项目中，并非所有平台目录都存在。例如一个主要面向鸿蒙和 Android 的项目可能没有 `macos/` 目录。原有代码只检查 flavorizr.yaml 中是否配置了对应平台的 flavor，不检查目录是否存在，导致 Xcode 相关处理器在缺少 `.xcodeproj` 时崩溃。

## 技术方案设计

### 整体架构

适配方案遵循 flavorizr 的处理器（Processor）架构，新增三个鸿蒙处理器：

```
ohos:products  →  OhosProductsTargetFileProcessor
                    └── OhosProductsProcessor (生成/合并 products)

ohos:targets   →  OhosTargetsTargetFileProcessor
                    └── OhosTargetsProcessor (生成/合并 targets)
                    └── _prepareResources (创建资源目录脚手架)

ohos:icons     →  OhosIconsProcessor (分发图标)
```

### 配置模型：Ohos 数据类

新增 `Ohos` 模型类继承 `OS`，使用 `json_serializable` 自动生成反序列化代码：

```dart
@JsonSerializable(anyMap: true, createToJson: false)
class Ohos extends OS {
  final String? bundleName;
  final String? name;
  final Map<String, dynamic>? target;

  @JsonKey(name: 'product', readValue: _readProduct, defaultValue: {})
  final Map<String, dynamic> product;

  final Map<String, ResValue> resValues;
  final Map<String, BuildConfigField> buildConfigFields;
  final AdaptiveIcon? adaptiveIcon;

  // product 字段支持 'product' 和 'customConfig' 两种 key
  static Object? _readProduct(Map json, String _) =>
      json['product'] ?? json['customConfig'];
}
```

`product` 字段采用 `Map<String, dynamic>` 而非强类型，以支持鸿蒙 build-profile 中任意的扩展字段（如 `buildOption.strictMode`），避免配置项频繁变更导致模型过时。

### 核心逻辑：product name = flavor key

这是本次适配的最关键设计决策。`OhosProductsProcessor.buildProducts()` 中：

```dart
List<Map<String, dynamic>> buildProducts() =>
    config.ohosFlavors.entries.map((entry) {
      final productName = entry.key;  // 始终使用 flavor key
      rawProduct.remove('name');       // 忽略用户配置的 name
      rawProduct.remove('productName');
      // ...
    }).toList();
```

将 product name 硬绑定为 flavor key（如 `apple`、`banana`），确保与 `flutter run --flavor <key>` 完全对齐。这消除了用户因配置 `ohos.name: "apple_debug"` 而导致 flavor 匹配失败的问题。

### JSON5 增量合并算法

鸿蒙使用 JSON5 格式的配置文件，合并算法需要处理以下场景：

**products 合并**：按 `name` 字段匹配，同名条目用新配置替换，非 flavorizr 管理的条目原样保留。

```dart
List<Map<String, dynamic>> _mergeProducts({
  required dynamic existing,
  required List<Map<String, dynamic>> generated,
}) {
  final pendingByName = <String, Map<String, dynamic>>{
    for (final product in generated) product['name'] as String: product,
  };

  final merged = <Map<String, dynamic>>[];
  // 遍历已有条目，同名替换，否则保留
  for (final item in existing) {
    final name = existingProduct['name']?.toString();
    if (name != null && pendingByName.containsKey(name)) {
      merged.add(pendingByName.remove(name)!);
    } else {
      merged.add(existingProduct);
    }
  }
  // 追加全新条目
  for (final gen in generated) {
    if (pendingByName.containsKey(gen['name'])) {
      merged.add(pendingByName.remove(gen['name'])!);
    }
  }
  return merged;
}
```

**modules.targets 联动更新**：当 products 更新后，自动在 `modules[].targets` 中创建对应的 target 引用：

```json5
modules: [{
  name: 'entry',
  targets: [
    { name: 'default', applyToProducts: ['default'] },
    { name: 'apple', applyToProducts: ['apple'] },     // 自动生成
    { name: 'banana', applyToProducts: ['banana'] },   // 自动生成
  ]
}]
```

**targets 深度合并**：使用递归 `mergeNode` 算法处理嵌套对象，`source` 和 `resource` 整体替换（因为它们是由 flavorizr 完全管控的），其他字段递归合并。

### 资源目录脚手架生成

`OhosTargetsTargetFileProcessor` 在写入 targets 后，会为每个 target 创建必要的资源目录结构：

```
ohos/entry/src/main/apple_debug/resources/
├── base/element/
├── base/media/
├── en_US/element/
└── zh_CN/element/
```

这确保 hvigor 构建时不会因找不到资源目录而报错。同时跳过 `./src/main/resources`（主资源目录），避免干扰默认 target 的资源。

文件夹生成后，因资源文件默认缺省，资源文件需要手动创建。

## 使用方式

### 配置 flavorizr.yaml示例

```yaml
flavors:
  apple:
    app:
      name: "Apple App"
    android:
      applicationId: "com.example.apple"
    ohos:
      bundleName: "com.example.apple.ohos"
      product:
        compatibleSdkVersion: "5.1.0(18)"
        runtimeOS: "HarmonyOS"
        bundleType: "app"
        signingConfig: "apple"
      target:
        source:
          sourceRoots: ["./src/apple_files"]
        resource:
          directories:
            - "./src/main/apple_debug/resources"
            - "./src/main/resources"
    ios:
      bundleId: "com.example.apple"
```

product 和 target 的 `name` 无需手动指定，始终自动取 flavor key（`apple`）。

### 运行 flavorizr

```bash
flutter pub run flutter_flavorizr
```

### 在鸿蒙真机上运行

```bash
# 安装 ohpm 依赖
cd ohos
ohpm install --all

# 同步工程
node hvigorw.js \
  --sync -p product=apple -p buildMode=debug \
  --analyze=normal --parallel --incremental --daemon

# 运行
cd ..
flutter run --flavor apple -d <device_id>
```

## 总结

本次适配的核心成果：

1. **零配置对齐**：product name 自动绑定 flavor key，彻底消除与 `flutter run --flavor` 的名称不一致问题
2. **非破坏性合并**：增量更新 JSON5 配置。
3. **完整工具链覆盖**：从 YAML 声明到 build-profile 生成、资源目录创建、图标分发，一条命令完成鸿蒙多产品工程搭建

项目地址：[GitHub - lengain/flutter_flavorizr: A flutter utility to easily create flavors in your flutter application ](https://github.com/lengain/flutter_flavorizr)
