---
title: 一台Mac两套Flutter：我用一个脚本解决鸿蒙/iOS 环境来回切换
date: 2026-03-02 17:34:15
tags:
  - Flutter
  - 跨平台
  - 鸿蒙
categories: 技术
---





> 每次切环境都像拆盲盒：`flutter` 到底指向哪个 SDK？`pub get` 为什么又超时了？

> 这篇文章分享一个可落地的工程化解法：用一个 Shell 脚本，把鸿蒙与 iOS 的 Flutter 环境切换做成“可重复、可追溯、可持久化、可自愈”的标准流程。

---

## 先说痛点：为什么“手动 export”迟早出事

如果你和我一样，一台 Mac 同时做两类 Flutter 开发：

- **鸿蒙开发**：常用定制 SDK / 镜像源；

- **iOS 开发**：常用官方 Flutter / 官方源。

那你大概率踩过这些坑：

1. `PATH` 被来回覆盖，`which flutter` 指向不稳定；

2. `PUB_HOSTED_URL` 和 `FLUTTER_STORAGE_BASE_URL` 没成套切换，`pub get` 时灵时不灵；

3. 终端重启后环境丢失，要再手动配置一遍；

<!-- more -->

4. 团队成员各自“本地秘方”，问题难复现。

一句话总结：**问题不在 Flutter，而在“环境切换没有工程化”。**

---

## 目标：把“人肉操作”变成“标准命令”

这个工程给出的思路很简单，但很有效：

- 用 `bash flutter_env_switch.sh harmony|ios` 执行切换；

- 把最终结果写入 `~/.flutter_env`；

- 自动把加载配置写入 shell 启动文件（`~/.zshrc` 或 `~/.bash_profile`，支持块级去重）。

这相当于建立了一个单一事实来源（Single Source of Truth）：

- 当前环境是什么，不靠记忆，靠文件；

- 下次开终端自动恢复，不靠手动再 export。

---

## 核心原理拆解（带代码）

下面是脚本里最关键的 5 个设计点，也是这个方案稳定的原因。

### 1) 先自动“准备环境”，缺啥补啥

现在不是只“检查目录”，而是先自动准备：

- 自动创建 `~/flutter/harmony`、`~/flutter/ios`；
- 自动检测并创建两个 `PUB_CACHE` 目录；
- 检测到 Flutter 缺失时自动 `git clone`；
- 关键下载步骤失败自动重试 3 次。

这一步把“环境准备”从手工操作变成了脚本内建能力，尤其适合新机器初始化或重装后的恢复。

### 2) 先校验 SDK，再允许切换

切环境前，脚本会检查目标 SDK 目录和 `bin/flutter` 是否存在，避免“切换成功但命令不可用”的假成功。

```bash
check_flutter_path() {

local env=$1

local flutter_path=""



case $env in

"harmony") flutter_path="$HOME/flutter/harmony/flutter_flutter" ;;

"ios") flutter_path="$HOME/flutter/ios/flutter" ;;

esac



if [ ! -d "$flutter_path" ]; then

echo "错误：Flutter SDK路径不存在: $flutter_path"

return 1

fi



if [ ! -f "$flutter_path/bin/flutter" ]; then

echo "错误：Flutter可执行文件不存在: $flutter_path/bin/flutter"

return 1

fi

}
```

**为什么重要？**

因为环境问题最怕“静默失败”。提前失败，问题定位成本会低很多。

### 3) 配置按环境模板化，保证“成组切换”

脚本通过 `get_env_config()` 输出整套变量，而不是零散改一两个：

```bash
get_env_config() {

local env=$1



case $env in

"harmony")

cat << 'EOF'

export PUB_CACHE=$HOME/flutter/harmony/pub

export PUB_HOSTED_URL=https://pub-web.flutter-io.cn

export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn

export FLUTTER_OHOS_STORAGE_BASE_URL=https://flutter-ohos.obs.cn-south-1.myhuaweicloud.com

export FLUTTER_GIT_URL=https://gitcode.com/openharmony-tpc/flutter_flutter.git

export PATH=$HOME/flutter/harmony/flutter_flutter/bin:$PATH

EOF

;;

"ios")

cat << 'EOF'

export PUB_CACHE=$HOME/flutter/ios/pub

export PUB_HOSTED_URL=https://pub.dev

export FLUTTER_STORAGE_BASE_URL=https://storage.googleapis.com

export FLUTTER_GIT_URL=https://github.com/flutter/flutter.git

export PATH=$HOME/flutter/ios/flutter/bin:$PATH

EOF

;;

esac

}
```

**为什么重要？**

环境变量本质上是“组合关系”，必须原子化切换，不能只改 `PATH` 不改镜像源。

### 4) 持久化到 `~/.flutter_env`，终端重启不丢状态

```bash
cat > ~/.flutter_env << EOF

# Flutter环境配置

# 最后更新时间: $(date)

$config

EOF



source ~/.flutter_env
```

**为什么重要？**

这一步把“临时会话变量”变成“可审计配置文件”。你可以随时打开 `~/.flutter_env` 看当前状态。

### 5) 自动写入 shell 配置 + 可观测自检

- 脚本会自动识别并写入 `~/.zshrc` 或 `~/.bash_profile`；
- 写入使用“块级去重”，不会重复追加；
- `show`：查看当前关键变量与 Flutter 版本；

- `check`：执行自动检查与修复（目录、下载、shell 加载配置）。

这两个命令让脚本不仅能“切”，还能“证明确实切对了”。

---

## 实际使用方式（可直接复制）

### 1. 切换到鸿蒙环境

```bash
bash ./flutter_env_switch.sh harmony
```

### 2. 切换到 iOS 环境

```bash
bash ./flutter_env_switch.sh ios
```

### 3. 查看当前环境

```bash
bash ./flutter_env_switch.sh show
```

### 4. 检查 shell 是否正确加载

```bash
bash ./flutter_env_switch.sh check
```

> 提示：请使用 `bash` 执行脚本，不要用 `sh`。脚本会检查 `BASH_VERSION`。

---

## 这套方案解决了什么

从工程角度看，它解决的不是“写命令麻烦”，而是这三个核心问题：

- **一致性**：团队使用统一入口，减少口口相传的本地配置；

- **稳定性**：自动准备 + 先校验再切换 + 失败重试，降低失败概率；

- **可维护性**：状态持久化、shell 配置自动化且去重，可回溯

---

## 常见现象说明（避免误判）

- 首次切到某个环境时，`flutter --version` 可能先触发工具链初始化下载，这是正常行为；
- 日志里出现 `Downloading...` 不一定是错误，脚本会自动重试并提取最终版本行；
- 若网络不稳定，脚本会给出重试与后续操作指引（例如执行 `check`、清理缓存后重试）。

---

## 结尾

很多团队在多环境开发时，卡住的不是业务代码，而是“环境不可控”。

把环境切换做成工程能力，收益往往比想象的大：少踩坑、少沟通、少返工。

如果你正在同时维护鸿蒙与 iOS Flutter 研发链路，这种“轻量脚本 + 持久化配置”的方法，几乎是成本最低、收益最高的一步。
