---
title: 鸿蒙（OpenHarmony）平台C/C++编译打包.so共享库完整指南
date: 2026-03-03 11:40:18
tags:
  - 鸿蒙
  - so
categories: 技术
---

## 背景与动机

在鸿蒙（OpenHarmony / HarmonyOS NEXT）生态持续扩张的背景下，越来越多的开发者需要将现有的 C/C++ 开源库移植到鸿蒙平台。然而鸿蒙的 NDK 工具链与传统 Linux / Android 存在若干关键差异，其中最容易踩坑的就是 **共享库 SONAME 格式**。

本文基于 [Opus 音频编解码库](https://ohpm.openharmony.cn/#/cn/detail/@lengain%2Fopusohos) 的鸿蒙适配实践，参考[官方文档](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-cmake-adapts-to-harmonyos)，系统梳理从工具链配置、CMake 工程改造到最终产物验证的完整流程，帮助开发者少走弯路。

<!-- more -->

---

## 环境准备

### 1. 安装 OpenHarmony SDK / Native SDK

前往 [华为鸿蒙开发者下载中心](https://developer.huawei.com/consumer/cn/download/)下载对应版本的 SDK（已配置的请忽略），解压后得到如下结构：

```
ohos-sdk/

└── openharmony/

└── native/

├── build/

│ └── cmake/

│ └── ohos.toolchain.cmake # ⭐ 工具链文件

├── build-tools/

│ └── cmake/

│ └── bin/

│ └── cmake # ⭐ 配套 CMake

├── llvm/ # Clang/LLVM 编译器

└── sysroot/ # 目标系统根目录
```

### 2. 配置环境变量

```bash
# 推荐写入 ~/.zshrc 或 ~/.bashrc

export OHOS_SDK_PATH="$HOME/ohos-sdk/openharmony"

export PATH="$OHOS_SDK_PATH/native/build-tools/cmake/bin:$PATH"
```

### 3. 验证工具链

```bash
# 验证 cmake 版本（应 >= 3.16）

cmake --version



# 验证工具链文件存在

ls "$OHOS_SDK_PATH/native/build/cmake/ohos.toolchain.cmake"



# 验证 Clang 编译器（鸿蒙 SDK 内置）

ls "$OHOS_SDK_PATH/native/llvm/bin/clang"
```

### 4. 支持的目标架构

| 架构标识          | 适用场景    | 说明                   |
| ------------- | ------- | -------------------- |
| `arm64-v8a`   | 真机（主流）  | 64-bit ARMv8，当前主力架构  |
| `armeabi-v7a` | 真机（旧设备） | 32-bit ARM，兼容老款设备    |
| `x86_64`      | 模拟器     | DevEco Studio 模拟器调试用 |

---

## 核心概念：SONAME 规范差异

这是移植过程中**最关键、最容易踩坑**的地方，务必理解。

### 什么是 SONAME？

SONAME（Shared Object NAME）是 ELF 共享库的一个元数据字段，动态链接器在运行时通过它查找并加载库文件。

### Linux 标准行为 vs OpenHarmony 要求

| 平台              | SONAME 格式 | 示例               |
| --------------- | --------- | ---------------- |
| 标准 Linux        | 带主版本号     | `libopus.so.0`   |
| Android         | 不带版本号     | `libopus.so`     |
| **OpenHarmony** | **不带版本号** | **`libopus.so`** |

### 为什么不一致会出问题？

```
# 错误情形：SONAME 为 libopus.so.0

应用运行 → dlopen("libopus.so") → 动态链接器查找 SONAME=libopus.so.0 的库 → 失败！



# 正确情形：SONAME 为 libopus.so

应用运行 → dlopen("libopus.so") → 动态链接器查找 SONAME=libopus.so 的库 → 成功✓
```

> **结论：** 为 OpenHarmony 构建的共享库，SONAME 必须设置为不带版本号的形式，即 `libxxx.so`。

---

## CMakeLists.txt 配置详解

### 完整配置模板

```cmake
cmake_minimum_required(VERSION 3.16)

project(MyLib VERSION 1.2.3 LANGUAGES C CXX)



# ── 1. 共享库构建开关 ─────────────────────────────────────────────

option(BUILD_SHARED_LIBS "Build shared libraries" ON)

option(MYLIB_BUILD_SHARED "Build MyLib as shared library" ON)



if(MYLIB_BUILD_SHARED OR BUILD_SHARED_LIBS)

set(BUILD_SHARED_LIBS ON)

set(MYLIB_BUILD_SHARED ON)

endif()



# ── 2. 声明库目标 ─────────────────────────────────────────────────

add_library(mylib

src/core.c

src/encoder.c

src/decoder.c

)

add_library(MyLib::mylib ALIAS mylib)



# ── 3. 头文件包含路径 ─────────────────────────────────────────────

target_include_directories(mylib

PUBLIC

$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>

$<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}/mylib>

PRIVATE

${CMAKE_CURRENT_BINARY_DIR}

${CMAKE_CURRENT_SOURCE_DIR}/src

)



# ── 4. 版本信息（标准写法） ───────────────────────────────────────

set_target_properties(mylib PROPERTIES

VERSION ${PROJECT_VERSION} # 完整版本：1.2.3

SOVERSION ${PROJECT_VERSION_MAJOR} # 主版本：1

)



# ── 5. ⭐ 关键：强制 SONAME 不带版本号 ───────────────────────────

#

# 说明：上方 SOVERSION=1 在标准 Linux 下会生成 SONAME=libmylib.so.1

# 下面这行通过 -Wl,-soname 链接器标志直接覆盖此行为

# 确保最终 ELF 文件内嵌的 SONAME = libmylib.so

#

target_link_options(mylib PRIVATE "SHELL:-Wl,-soname,libmylib.so")



# ── 6. 符号可见性控制（推荐） ─────────────────────────────────────

if(BUILD_SHARED_LIBS)

set_target_properties(mylib PROPERTIES

C_VISIBILITY_PRESET hidden

CXX_VISIBILITY_PRESET hidden

VISIBILITY_INLINES_HIDDEN YES

)

# Windows 需要显式导出符号

if(WIN32)

target_compile_definitions(mylib PRIVATE MYLIB_DLL_EXPORT)

endif()

endif()



# ── 7. 编译宏 & 链接依赖 ──────────────────────────────────────────

target_compile_definitions(mylib PRIVATE MYLIB_BUILD)

target_link_libraries(mylib PRIVATE m) # 按需添加依赖



# ── 8. 安装规则 ───────────────────────────────────────────────────

include(GNUInstallDirs)



install(TARGETS mylib

LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}

ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}

PUBLIC_HEADER DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}/mylib

)



install(DIRECTORY include/mylib

DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}

)
```

### 关键配置项说明

#### `target_link_options` 与 SONAME

这是整个移植过程的核心，单独拆解说明：

```cmake
# SHELL: 前缀告诉 CMake 不要对后续内容做 shell 转义

# -Wl, 将后续参数传递给链接器（ld）

# -soname,libmylib.so 设置 ELF SONAME 字段

target_link_options(mylib PRIVATE "SHELL:-Wl,-soname,libmylib.so")
```

> ⚠️ **注意：** 如果项目使用旧式 `set_target_properties` 加 `LINK_FLAGS`，需改为 `target_link_options` 以获得更好的 CMake 现代语法支持。

#### 符号导出宏（推荐在公共头文件中定义）

```c
// include/mylib/export.h

#pragma once



#ifdef _WIN32

# ifdef MYLIB_BUILD

# define MYLIB_API __declspec(dllexport)

# else

# define MYLIB_API __declspec(dllimport)

# endif

#else

# define MYLIB_API __attribute__((visibility("default")))

#endif
```

在需要导出的函数声明前使用：

```c
MYLIB_API int mylib_encode(const float* pcm, int frame_size, unsigned char* data);

MYLIB_API int mylib_decode(const unsigned char* data, int len, float* pcm);
```

---

## 构建脚本编写

### 完整构建脚本：`build/build_ohos.sh`

```bash
#!/bin/bash

# ============================================================

# OpenHarmony C/C++ 共享库构建脚本

# 用法：

# export OHOS_SDK_PATH=/path/to/ohos/sdk

# ./build/build_ohos.sh

# 或：

# ./build/build_ohos.sh /path/to/ohos/sdk

# ============================================================



set -euo pipefail



# ── 路径解析 ────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"



# ── SDK 路径获取 ─────────────────────────────────────────────

if [[ -n "${OHOS_SDK_PATH:-}" ]]; then

echo "[INFO] 使用环境变量 OHOS_SDK_PATH: $OHOS_SDK_PATH"

elif [[ $# -eq 1 ]]; then

OHOS_SDK_PATH="$1"

echo "[INFO] 使用命令行参数: $OHOS_SDK_PATH"

else

echo "[ERROR] 未提供 OpenHarmony SDK 路径"

echo " 用法 1: export OHOS_SDK_PATH=/path/to/sdk && ./build_ohos.sh"

echo " 用法 2: ./build_ohos.sh /path/to/sdk"

exit 1

fi



# ── 工具链路径 ───────────────────────────────────────────────

CMAKE_BIN="$OHOS_SDK_PATH/native/build-tools/cmake/bin/cmake"

TOOLCHAIN_FILE="$OHOS_SDK_PATH/native/build/cmake/ohos.toolchain.cmake"



# ── 前置检查 ─────────────────────────────────────────────────

check_prerequisites() {

local missing=0



if [[ ! -f "$CMAKE_BIN" ]]; then

echo "[ERROR] CMake 未找到: $CMAKE_BIN"

missing=1

fi



if [[ ! -f "$TOOLCHAIN_FILE" ]]; then

echo "[ERROR] 工具链文件未找到: $TOOLCHAIN_FILE"

missing=1

fi



if [[ $missing -ne 0 ]]; then

echo "[ERROR] 请检查 SDK 路径是否正确，或重新下载 SDK"

exit 1

fi



echo "[INFO] 工具链检查通过 ✓"

}



# ── 编译函数 ─────────────────────────────────────────────────

build_arch() {

local arch="$1"

local build_dir="$SCRIPT_DIR/${arch}_harmony_build"



echo ""

echo "════════════════════════════════════════"

echo " 编译架构: $arch"

echo "════════════════════════════════════════"



rm -rf "$build_dir"

mkdir -p "$build_dir"



# CMake 配置阶段

"$CMAKE_BIN" "$PROJECT_ROOT" \

-B "$build_dir" \

-DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN_FILE" \

-DCMAKE_BUILD_TYPE=Release \

-DBUILD_SHARED_LIBS=ON \

-DMYLIB_BUILD_SHARED=ON \

-DOHOS_ARCH="$arch" \

-DCMAKE_INSTALL_PREFIX="$SCRIPT_DIR/${arch}_standard_libs"



# 编译阶段（充分利用多核）

local jobs

jobs=$(sysctl -n hw.logicalcpu 2>/dev/null || nproc 2>/dev/null || echo 4)

cmake --build "$build_dir" --config Release --parallel "$jobs"



echo "[INFO] $arch 编译完成 ✓"

}



# ── 输出整理函数 ─────────────────────────────────────────────

organize_output() {

local arch="$1"

local build_dir="$SCRIPT_DIR/${arch}_harmony_build"

local output_dir="$SCRIPT_DIR/${arch}_standard_libs"



echo ""

echo "[INFO] 整理 $arch 输出文件..."



rm -rf "$output_dir"

mkdir -p "$output_dir"/{lib,include}



# 安装（利用 CMake install 规则）

cmake --install "$build_dir" --prefix "$output_dir"



# 确保主库文件存在

local so_file

so_file=$(find "$output_dir" -name "*.so" | head -1)

if [[ -z "$so_file" ]]; then

echo "[WARN] 未在 $output_dir 中找到 .so 文件，尝试手动复制"

find "$build_dir" -name "*.so" -exec cp {} "$output_dir/lib/" \;

fi



echo "[INFO] $arch 输出目录结构:"

find "$output_dir" -type f | sort | sed 's|^| |'

echo "[INFO] 整理完成 ✓"

}



# ── SONAME 验证函数 ──────────────────────────────────────────

verify_soname() {

local arch="$1"

local output_dir="$SCRIPT_DIR/${arch}_standard_libs"



echo ""

echo "[INFO] 验证 $arch SONAME..."



local so_files

mapfile -t so_files < <(find "$output_dir" -name "*.so")



if [[ ${#so_files[@]} -eq 0 ]]; then

echo "[WARN] 未找到 .so 文件，跳过验证"

return

fi



for so in "${so_files[@]}"; do

local soname

if command -v readelf &>/dev/null; then

soname=$(readelf -d "$so" 2>/dev/null | grep SONAME | awk -F'[][]' '{print $2}')

elif command -v objdump &>/dev/null; then

soname=$(objdump -p "$so" 2>/dev/null | awk '/SONAME/{print $2}')

else

echo "[WARN] 未找到 readelf/objdump，跳过 SONAME 验证"

return

fi



if [[ -z "$soname" ]]; then

echo "[WARN] $so → SONAME 字段为空"

elif [[ "$soname" =~ \.so\.[0-9] ]]; then

echo "[ERROR] $so → SONAME=$soname ← 带版本号，鸿蒙不兼容！"

else

echo "[OK] $so → SONAME=$soname ✓"

fi

done

}



# ── 主流程 ───────────────────────────────────────────────────

main() {

check_prerequisites



local archs=("arm64-v8a" "x86_64")



for arch in "${archs[@]}"; do

build_arch "$arch"

organize_output "$arch"

verify_soname "$arch"

done



echo ""

echo "════════════════════════════════════════"

echo " 全部架构构建完成！"

echo "════════════════════════════════════════"

echo " arm64-v8a (真机): $SCRIPT_DIR/arm64-v8a_standard_libs/"

echo " x86_64 (模拟器): $SCRIPT_DIR/x86_64_standard_libs/"

}



main "$@"
```

---

## 完整示例：从零适配一个 C++ 库

以一个假设的音频处理库 `libmycodec` 为例，演示完整适配步骤。

### 步骤 1：确认项目结构

```
mycodec/

├── CMakeLists.txt

├── include/

│ └── mycodec/

│ ├── mycodec.h

│ └── export.h

├── src/

│ ├── encoder.c

│ └── decoder.c

└── build/

└── build_ohos.sh
```

### 步骤 2：修改 CMakeLists.txt

在已有 `CMakeLists.txt` 的基础上，**只需添加下面两处改动**：

```cmake
# 改动①：确保开启共享库选项

option(BUILD_SHARED_LIBS "Build shared libraries" ON)



# 改动②：在 add_library 之后添加 SONAME 强制设置

# 假设库目标名为 mycodec

target_link_options(mycodec PRIVATE "SHELL:-Wl,-soname,libmycodec.so")
```

### 步骤 3：创建构建脚本

将上方[构建脚本](#构建脚本编写)保存为 `build/build_ohos.sh`，并将脚本内的 `MYLIB_BUILD_SHARED` 替换为你的项目选项名。

```bash
chmod +x build/build_ohos.sh
```

### 步骤 4：执行构建

```bash
# 方式一：环境变量（推荐）

export OHOS_SDK_PATH="/Users/yourname/ohos-sdk/openharmony"

./build/build_ohos.sh



# 方式二：命令行参数

./build/build_ohos.sh /Users/yourname/ohos-sdk/openharmony
```

构建日志示例：

```
[INFO] 工具链检查通过 ✓



════════════════════════════════════════

编译架构: arm64-v8a

════════════════════════════════════════

-- The C compiler identification is Clang 15.0.4

-- Detecting C compiler ABI info

-- Check for working C compiler: .../llvm/bin/clang - works

...

[INFO] arm64-v8a 编译完成 ✓

[INFO] 整理 arm64-v8a 输出文件...

[INFO] arm64-v8a 输出目录结构:

build/arm64-v8a_standard_libs/lib/libmycodec.so

build/arm64-v8a_standard_libs/include/mycodec/mycodec.h

[OK] .../libmycodec.so → SONAME=libmycodec.so ✓
```

### 步骤 5：检查输出产物

```
build/

├── arm64-v8a_harmony_build/ # 编译中间产物

├── arm64-v8a_standard_libs/ # ⭐ 真机用交付物

│ ├── lib/

│ │ └── libmycodec.so

│ └── include/

│ └── mycodec/

│ └── mycodec.h

├── x86_64_harmony_build/

└── x86_64_standard_libs/ # ⭐ 模拟器用交付物

├── lib/

│ └── libmycodec.so

└── include/

└── mycodec/
```

---

## 验证与调试

### 1. 验证 SONAME（最重要）

```bash
# 使用 readelf（推荐）

readelf -d build/arm64-v8a_standard_libs/lib/libmycodec.so | grep SONAME



# 期望输出：

# 0x000000000000000e (SONAME) Library soname: [libmycodec.so]



# 使用 objdump

objdump -p build/arm64-v8a_standard_libs/lib/libmycodec.so | grep SONAME



# 期望输出：

# SONAME libmycodec.so
```

### 2. 查看导出符号表

```bash
# 列出所有导出符号（-D 表示动态符号表）

nm -D build/arm64-v8a_standard_libs/lib/libmycodec.so | grep " T "



# 示例输出：

# 0000000000012340 T mycodec_encode

# 0000000000013a80 T mycodec_decode

# 0000000000014200 T mycodec_version
```

### 3. 检查依赖关系

```bash
# 查看库依赖（NEEDED 字段）

readelf -d libmycodec.so | grep NEEDED



# 期望（尽量减少外部依赖）：

# (NEEDED) Shared library: [libc.so]

# (NEEDED) Shared library: [libm.so]
```

### 4. 检查目标架构匹配

```bash
file build/arm64-v8a_standard_libs/lib/libmycodec.so

# 期望输出：... ELF 64-bit LSB shared object, ARM aarch64 ...



file build/x86_64_standard_libs/lib/libmycodec.so

# 期望输出：... ELF 64-bit LSB shared object, x86-64 ...
```

---

## 项目集成

将编译好的 .so 文件集成到鸿蒙应用工程（DevEco Studio）。

### 目录结构

```
MyHarmonyApp/

└── entry/

└── src/

└── main/

├── cpp/

│ ├── CMakeLists.txt # 应用层 CMake

│ ├── napi_init.cpp # NAPI 胶水代码

│ └── libs/

│ ├── arm64-v8a/

│ │ └── libmycodec.so

│ └── x86_64/

│ └── libmycodec.so

└── ets/

└── pages/
```

### 应用层 CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.16)

project(MyHarmonyApp)



# 指定 .so 搜索路径

set(LIB_DIR ${CMAKE_CURRENT_SOURCE_DIR}/libs/${OHOS_ARCH})



# 声明预构建库目标

add_library(mycodec SHARED IMPORTED)

set_target_properties(mycodec PROPERTIES

IMPORTED_LOCATION "${LIB_DIR}/libmycodec.so"

)



# 主 NAPI 模块

add_library(myapp SHARED napi_init.cpp)



target_include_directories(myapp PRIVATE

${CMAKE_CURRENT_SOURCE_DIR}/../../libs/include

)



target_link_libraries(myapp PRIVATE

mycodec

libace_napi.z.so # 鸿蒙 NAPI

libhilog_ndk.z.so # 鸿蒙日志

)
```

### module.json5 配置

```json5
{

"module": {

"requestPermissions": [],

"deviceTypes": ["default", "tablet"],

"abilities": [...]

}

}
```

### build-profile.json5 配置（确保 .so 打包入 hap）

```json5
{

"buildOption": {

"externalNativeOptions": {

"path": "./src/main/cpp/CMakeLists.txt",

"arguments": "",

"cppFlags": ""

}

}

}
```

---

## 常见问题与排查

### Q1：运行时找不到库，报 `dlopen failed`

**症状：** 应用崩溃，日志显示 `cannot locate symbol` 或 `No such file`

**排查步骤：**

```bash
# 1. 确认 SONAME 格式

readelf -d libmycodec.so | grep SONAME

# 必须是 libmycodec.so，不能是 libmycodec.so.1



# 2. 确认库已正确打包进 .hap

# 解压 .hap 文件

unzip MyApp.hap -d hap_contents

ls hap_contents/libs/arm64-v8a/
```

### Q2：编译报 `undefined reference to 'xxx'`

**原因：** 缺少必要的链接依赖

```cmake
# 检查并添加缺失的依赖

target_link_libraries(mycodec PRIVATE

m # 数学库

pthread # 线程库

dl # 动态链接库

)
```

### Q3：头文件找不到

```cmake
# 确认 include 路径配置正确

target_include_directories(mycodec

PUBLIC

$<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>

)
```

### Q4：工具链找不到 OHOS SDK

```bash
# 检查 SDK 目录结构

ls "$OHOS_SDK_PATH/native/build/cmake/ohos.toolchain.cmake"

ls "$OHOS_SDK_PATH/native/build-tools/cmake/bin/cmake"



# 常见错误：SDK 版本不匹配，native 目录层级不同

# 尝试：

find "$OHOS_SDK_PATH" -name "ohos.toolchain.cmake" 2>/dev/null
```

### Q5：arm64-v8a 和 x86_64 的库是否可以混用？

**不可以。** 架构完全不同，必须分别编译、分别打包。DevEco Studio 会根据运行环境自动选择正确的架构库。

### Q6：如何支持 `armeabi-v7a`（兼容旧设备）？

在构建脚本中增加该架构：

```bash
build_arch "armeabi-v7a"

organize_output "armeabi-v7a"

verify_soname "armeabi-v7a"
```

同时在应用工程的 `libs/` 目录下新增 `armeabi-v7a/` 子目录。

---

## 最佳实践

### 1. 最小化公共头文件暴露

只在公共 API 头文件中使用 `MYLIB_API` 宏标记需要导出的符号，配合 `C_VISIBILITY_PRESET hidden` 默认隐藏内部符号：

```cmake
set_target_properties(mylib PROPERTIES

C_VISIBILITY_PRESET hidden

CXX_VISIBILITY_PRESET hidden

VISIBILITY_INLINES_HIDDEN YES

)
```

**好处：** 减少库体积、降低符号冲突风险、保护内部实现。

### 2. Release 构建优化

```cmake
if(CMAKE_BUILD_TYPE STREQUAL "Release")

target_compile_options(mylib PRIVATE

-O3

-ffast-math # 浮点优化（确认数值精度可接受）

-fomit-frame-pointer

)

# 链接时优化（LTO）

set_target_properties(mylib PROPERTIES

INTERPROCEDURAL_OPTIMIZATION TRUE

)

endif()
```

### 3. 版本管理：生成版本头文件

```cmake
# CMakeLists.txt

configure_file(

${CMAKE_CURRENT_SOURCE_DIR}/include/mylib/version.h.in

${CMAKE_CURRENT_BINARY_DIR}/include/mylib/version.h

)
```

```c
// include/mylib/version.h.in

#define MYLIB_VERSION_MAJOR @PROJECT_VERSION_MAJOR@

#define MYLIB_VERSION_MINOR @PROJECT_VERSION_MINOR@

#define MYLIB_VERSION_PATCH @PROJECT_VERSION_PATCH@

#define MYLIB_VERSION_STRING "@PROJECT_VERSION@"
```

### 4. CI/CD 自动化配置（GitHub Actions 示例）

```yaml
# .github/workflows/ohos_build.yml

name: Build for OpenHarmony



on: [push, pull_request]



jobs:

build-ohos:

runs-on: ubuntu-latest

steps:

- uses: actions/checkout@v4



- name: Download OHOS SDK

run: |

wget -q https://your-sdk-mirror/ohos-sdk.tar.gz

tar -xzf ohos-sdk.tar.gz -C $HOME



- name: Build

env:

OHOS_SDK_PATH: ${{ github.workspace }}/ohos-sdk/openharmony

run: |

chmod +x build/build_ohos.sh

./build/build_ohos.sh



- name: Upload artifacts

uses: actions/upload-artifact@v4

with:

name: ohos-libs

path: |

build/arm64-v8a_standard_libs/

build/x86_64_standard_libs/
```

### 5. 静态库 + 共享库同时输出

```cmake
# 静态库版本

add_library(mylib_static STATIC ${SOURCES})

set_target_properties(mylib_static PROPERTIES OUTPUT_NAME mylib)



# 共享库版本

add_library(mylib_shared SHARED ${SOURCES})

set_target_properties(mylib_shared PROPERTIES

OUTPUT_NAME mylib

VERSION ${PROJECT_VERSION}

SOVERSION ${PROJECT_VERSION_MAJOR}

)

target_link_options(mylib_shared PRIVATE "SHELL:-Wl,-soname,libmylib.so")
```

---

## 参考资料

| 资源                                                                                                         | 说明          |
| ---------------------------------------------------------------------------------------------------------- | ----------- |
| [OpenHarmony 官方文档](https://docs.openharmony.cn/)                                                           | 官方开发指南      |
| [OpenHarmony NDK 文档](https://docs.openharmony.cn/pages/v4.1/zh-cn/application-dev/napi/napi-guidelines.md) | NAPI 接口开发规范 |
| [CMake 官方文档](https://cmake.org/documentation/)                                                             | CMake 完整文档  |
| [CMake target_link_options](https://cmake.org/cmake/help/latest/command/target_link_options.html)          | 链接选项参考      |
| [ELF SONAME 详解](https://tldp.org/HOWTO/Program-Library-HOWTO/shared-libraries.html)                        | 共享库原理       |
| [Opus 鸿蒙适配参考项目](https://ohpm.openharmony.cn/#/cn/detail/@lengain%2Fopusohos)                               | 本文实践来源      |

---

> **许可证：** 本文档采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 协议授权，转载请注明来源。
