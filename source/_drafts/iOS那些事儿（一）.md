---
title: iOS那些事儿（一）
date: 2019-03-29 09:52:58
tags: 技术
---

### 前言

最近准备往iOS底层开发学习，因此，查找了一些资料，对一些有用的技术知识，记录在此。

### dyld（the dynamic link editor）

苹果的动态链接器，是苹果操作系统一个重要组成部分。开源地址：[http://opensource.apple.com/tarballs/dyld](http://opensource.apple.com/tarballs/dyld)。

dyld作为一个动态链接器，会在程序启动后，将程序所需要的动态库，加载到内存中。

#### 共享缓存机制

dyld在加载动态库时，为了防止每个程序运行时动态库的反复加载，iOS会默认的将动态链接库合并成一个大的缓存文件，放到/System/Library/Caches/com.apple.dyld/目录下，按不同的架构保存分别保存着。

若要分析每个系统库，可从com.apple.dyld中提取分析。

##### 1. dyld_cache_extract提取

dyld_cache_extract（[https://github.com/macmade/dyld_cache_extract](https://github.com/macmade/dyld_cache_extract)）是一个可视化的工具，使用极其简单，把dyld_shared_cache载入即可解析出来。

##### 2. jtool提取

以提取CFNetwork为例，使用如下命令即可：

```text
$ jtool -extract CFNetwork ./dyld_shared_cache_arm64
Extracting /System/Library/Frameworks/CFNetwork.framework/CFNetwork at 0x147a000 into dyld_shared_cache_arm64.CFNetwork
```

##### 3. dsc_extractor提取

在dyld源代码的launch-cache文件夹里面找到dsc_extractor.cpp，将653行的“#if 0”修改为“#if 1”,然后用如下命令编译生成dsc_extractor，并使用它提取所有缓存文件：

```text
$ clang++ dsc_extractor.cpp dsc_iterator.cpp  -o dsc_extractor
$ ./dsc_extractor ./dyld_shared_cache_arm64 ./
```

【参考文献】

\[1] dyld详解 https://www.dllhook.com/post/238.html \[EB/OL].
