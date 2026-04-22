---
title: 在Flutter已有工程适配鸿蒙开发指南
date: 2026-04-15 09:04:12
tags:
categories:
---

在真实的业务场景中，绝大多数Flutter项目都已完成iOS和Android双平台的开发与落地，承载着核心业务逻辑、用户交互及多端一致性体验的需求。随着鸿蒙（HarmonyOS）生态的快速崛起，覆盖手机、平板、穿戴设备等全场景的终端布局，将已有的Flutter 3.x工程适配到鸿蒙平台，成为许多企业拓展生态覆盖、触达更多用户的必然选择。本文提供将已有的 Flutter 3.x (iOS/Android 双平台) 工程适配到鸿蒙（HarmonyOS）的详细技术方案。

---

## 一、环境准备

### 1.1 安装鸿蒙 flutter_flutter

Flutter鸿蒙需要使用社区版本维护的适配鸿蒙的 Flutter分支flutter_flutter：

```bash
# 方式一：从 Gitcode 克隆
git clone https://gitcode.com/openharmony-tpc/flutter_flutter.git

# 编辑 ~/.zshrc 或 ~/.bashrc
export PATH="$PATH:/path/to/flutter_flutter/bin"
export FLUTTER_ROOT=/path/to/flutter_flutter

# 使配置生效
source ~/.zshrc

# 方式二：使用开源脚本flutter_env_switch，自动添加环境变量
# 1. 复制脚本到本地
git clone https://github.com/lengain/flutter_env_switch.git
cd flutter_env_switch
cp flutter_env_switch.sh ~/
# 2. 添加执行权限
chmod +x ~/flutter_env_switch.sh

# 3. 执行环境检查（首次运行会自动初始化）
sh ~/flutter_env_switch.sh harmony
```

<!--more-->

### 1.2 切换鸿蒙flutter版本

```bash
# 推荐使用3.x版本的flutter
git checkout 3.35.8-ohos-0.0.3
```

### 1.3 验证安装

```bash
flutter doctor
flutter doctor -v  # 查看详细输出，确认鸿蒙支持状态

#输出
Flutter 3.35.8-ohos-0.0.3 • channel [user-branch] • unknown source
Framework • revision 65cbbee1fa (4 weeks ago) • 2026-03-14 19:06:02 +0800
Engine • hash 6b24e1b529bc46df7ff397667502719a2a8b6b72 (revision 035316565a) (5 months ago) • 2025-10-21
14:28:01.000Z
Tools • Dart 3.9.2 • DevTools 2.48.0
```

### 1.4 安装鸿蒙开发工具

确保已安装以下工具：

- DevEco Studio（鸿蒙应用开发IDE）
- HarmonyOS SDK
- 配置好环境变量

---

## 二、项目配置

### 2.1 在已存在的项目中添加鸿蒙平台支持

```bash
# 进入项目目录
cd your_flutter_project

# 为现有 Flutter 项目添加鸿蒙（OpenHarmony/HarmonyOS）平台支持的代码
flutter create --platforms=ohos .
```

### 2.2 新建项目添加鸿蒙平台支持

```bash
flutter create --platforms=ohos,android,ios --org com.example. my_project
```

### 2.3 常用命令

#### 运行

```bash
# 调试前务必进入ohos目录，用DevEco打开工程，配置鸿蒙证书
# 运行
flutter run

# 或指定设备
# 先获取device id
flutter devices 
# 再运行
flutter run -d 6CS9K25B327084xxx

#flavor多目标run命令
flutter run --flavor apple
flutter run --flavor apple -d 6CS9K25B327084xxx
```

#### 打包构建

```bash
# 构建
flutter build hap
# 带日志输出
flutter build hap --debug -v
# Release 构建
flutter build hap --release
#flavor多目标build命令
flutter build hap --flavor apple
```

---

## 三、关键适配步骤

### 3.1 第三方插件兼容性适配

根据三方插件的功能，部分是不需要适配鸿蒙的。如果调用

```bash
flutter pub get
```

调用`flutter run`，后报错，如果是由于三方库未适配鸿蒙可以做以下尝试。

#### 3.1.1 进入 Flutter Packages 查找

[Flutter Packages](https://gitcode.com/openharmony-tpc/flutter_packages/blob/master/README.md) 是由 OpenHarmony-TPC（OpenHarmony 三方库组件中心）维护的开源项目，基于 Flutter 社区官方插件库（flutter/packages）进行扩展，新增了对 OpenHarmony 平台的兼容适配。通过最小化的业务改动，让开发者能够在 Flutter 应用中无缝集成常用插件，获得完整的 OpenHarmony 原生能力支持。
特性：

- 支持 Flutter 3.7、3.22、3.27、3.35 等多个版本

- 通过 Git 仓库直接引入适配后的插件
  目前已支持不少常用三方库，可以进行依赖的替换。
  
  使用示例：

```yaml
dependencies:
  pigeon:
    git:
      url: https://gitcode.com/openharmony-tpc/flutter_packages.git
      path: packages/pigeon
      ref: br_pigeon-v26.1.5_ohos
```

#### 3.1.2 自主开发

如果在Flutter Packages中，未找到合适的插件，可以进行自主开发，自主开发插件时有以下常用命令：

```bash
# 进入插件工程根目录
# 已有插件，新增鸿蒙平台适配
flutter create --template=plugin --platforms=ios .

# 或完全新建一个新插件
flutter create --template=plugin 插件名称

# 运行鸿蒙示例（需连接鸿蒙设备/模拟器）
flutter run --platform=harmony  
```

新增平台后，需手动编写对应平台的原生代码（如iOS的Swift/OC、鸿蒙的ArkTS代码），命令仅生成基础工程结构，无法自动实现业务逻辑适配。

插件的架构有单包插件架构和联邦插件架构（Federated）。通常联邦插件是Flutter官方推荐的常用架构。比如[url_launcher](https://gitcode.com/openharmony-tpc/flutter_packages/tree/br_url_launcher-v6.3.2_ohos/packages/url_launcher) 就是典型的联邦插件架构，实现自主实现的插件时，可以参考。

```yaml
url_launcher/                # 对外主包（app-facing）
url_launcher_platform_interface/  # 平台接口（抽象契约）
url_launcher_android/        # Android 实现
url_launcher_ios/            # iOS 实现
url_launcher_harmony/        # 鸿蒙实现（你要加的）
url_launcher_web/
url_launcher_windows/
```

依赖时，使用本地依赖：

```yaml
  modal_bottom_sheet:
    path: 'third/modal_bottom_sheet'
```

#### 3.1.3 主工程和鸿蒙双配置文件方案说明

有些读者想要原工程的pubspec.yaml使用的官方插件不变，鸿蒙的pubspec.yaml使用Flutter Packages 中社区维护的插件，这时可以考虑使用双配置文件方案。

核心思路是：通过维护两份独立的 pubspec.yaml配置文件，实现原生平台（iOS/Android）与鸿蒙平台的依赖隔离，配合脚本一键切换。
主要要点如下：

1. 三文件架构
   • pubspec.origin.yaml：保存 iOS/Android 的原始依赖配置。
   • pubspec.ohos.yaml：保存鸿蒙平台专用的依赖配置（将不兼容库替换为鸿蒙版本）
   • pubspec.yaml：当前生效配置，通过切换脚本被上述两个文件之一覆盖。
2. 一键切换机制
   • 使用 switch_platform.sh 脚本进行平台切换。
   • 切到鸿蒙时：备份当前配置为 pubspec.origin.yaml，再将 pubspec.ohos.yaml 复
    pubspec.yaml。
   • 切到原生时：备份当前配置为 pubspec.ohos.yaml，再将 pubspec.origin.yaml 复
    pubspec.yaml。
   • 切换后自动执行 flutter pub get，也可同步切换平台特定代码文件（如通知、蓝牙
    现）。
3. 鸿蒙依赖替换方式 在 pubspec.ohos.yaml 中，将无鸿蒙支持的依赖替换为：
   • Git 仓库：引用 OpenHarmony SIG/TPC 维护的鸿蒙分支。
   • 本地路径：引用自研或本地适配的插件。
   • dependency_overrides：强制覆盖特定版本或路径以解决冲突。
4. 优缺点
   • 优点：平台隔离清晰，切换便捷，不污染原生平台代码。
   • 缺点：需要维护多份配置文件，对依赖变更需同步更新两个文件。

switch_platform.sh 脚本示例：

```bash
#!/bin/bash

  PLATFORM=${1:-usage}
  SKIP_PUBGET=${2:-""}

  if [ "$PLATFORM" = "usage" ]; then
      echo "Usage: $0 [ohos|native] [--skip-pubget]"
      echo "  ohos       - 切换到鸿蒙平台"
      echo "  native     - 切换到原生平台(iOS/Android)"
      echo "  --skip-pubget - 跳过 flutter pub get"
      exit 1
  fi

  # 检查项目根目录
  if [ ! -f "pubspec.yaml" ]; then
      echo "错误: 未找到 pubspec.yaml"
      exit 1
  fi

  # pubspec.ohos.yaml中 设置description: "ohos"
  # pubspec.origin.yaml中 设置description: "native"
  # 读取当前 description 判断平台
  CURRENT_DESC=$(grep "^description:" pubspec.yaml | sed 's/.*description: *["'"
  '"']\?\([^"'"'"']*\)["'"'"']\?/\1/')

  case $PLATFORM in
      "ohos")
          # 备份当前配置
          if [[ ! "$CURRENT_DESC" =~ "ohos" ]]; then
              cp pubspec.yaml pubspec.origin.yaml
          fi
          # 切换到鸿蒙配置
          cp pubspec.ohos.yaml pubspec.yaml
          # 切换平台特定代码
          [ -f "lib/services/notification_ohos.dart" ] && \
              cp lib/services/notification_ohos.dart lib/services/platform_notif
  ication.dart
          echo "已切换到鸿蒙平台"
          ;;
      "native")
          # 备份当前配置
          if [[ "$CURRENT_DESC" =~ "ohos" ]]; then
              cp pubspec.yaml pubspec.ohos.yaml
          fi
          # 切换到原生配置
          cp pubspec.origin.yaml pubspec.yaml
          # 切换平台特定代码
          [ -f "lib/services/notification_native.dart" ] && \
              cp lib/services/notification_native.dart lib/services/platform_not
  ification.dart
          echo "已切换到原生平台"
          ;;
  esac

  # 执行 flutter pub get
  if [ "$SKIP_PUBGET" != "--skip-pubget" ]; then
      flutter pub get
  fi

   echo "切换完成"
```

如果配置CI，执行鸿蒙打包前，执行switch_platform.sh即可。

### 3.2 平台通道 (Platform Channels) 适配

鸿蒙 MethodChannel 适配方案与 Android/iOS 原理一致，仅在平台端实现语言和 API
上有所差异。

Dart 端, 与普通多平台调用无异，Channel 名称需与平台端保持一致：

```dart
import 'package:flutter/services.dart';

const platform = MethodChannel('com.example.app/channel');

Future<String?> getBatteryLevel() async {
     try {
         final String? result = await platform.invokeMethod('getBatteryLevel');
         return result;
     } on PlatformException catch (e) {
         return "Failed: ${e.message}";
     }
}
```

鸿蒙端（ArkTS）在鸿蒙 Flutter 插件或 Entry 模块中，通过 FlutterPlugin 绑定 BinaryMessenger 注册 Channel：

```typescript
import { FlutterPlugin, MethodChannel, MethodCall, MethodResult } from '@ohos/flutter_ohos';
export default class MyPlugin implements FlutterPlugin {
   onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding): void {
     const channel = new MethodChannel(binding.getBinaryMessenger(), 'com.example.app/channel');
     channel.setMethodCallHandler({ onMethodCall(call: MethodCall, result: MethodResult): void {
         if (call.method === 'getBatteryLevel') {
             // 调用鸿蒙系统 API 获取电量
             result.success('100');
         } else {
             result.notImplemented();
         }
      }
     });
 }
  onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding): void {
   // 清理 Channel
  }
}
```

**平台判断**：在Flutter鸿蒙环境下，直接使用`Platform.isOhos`判断。

```dart
import 'dart:io';
Platform.isOhos
```

但是，如果需要在官方Flutter环境兼容，Platform.isOhos是无法使用的，可以实现一个自定义类PlatformOs，利用Platform.operatingSystem判断，这些这个代码在官方Flutter环境或鸿蒙Flutter环境都可使用。

```dart
import 'dart:io';

class PlatformOs {
  static bool get isOhos {
    return Platform.operatingSystem == 'ohos';
  }
}
```

### 3.3 资源文件适配

当使用主工程和鸿蒙双配置文件方案是，可根据不同的平台设置不同的`assets`来适配不同的资源文件。 

---

## 参考资料

- [鸿蒙开发者文档](https://developer.huawei.com/consumer/cn/doc/)
- [Flutter 官方文档](https://docs.flutter.dev)
- [DevEco Studio 下载](https://developer.huawei.com/consumer/cn/deveco-studio/)
- [Flutter Packages](https://gitcode.com/openharmony-tpc/flutter_packages/blob/master/README.md)
