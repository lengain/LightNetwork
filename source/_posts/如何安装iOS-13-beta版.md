---
title: 如何安装iOS 13 beta版
date: 2019-06-14 14:24:26
tags: 技术
---

最近，[Apple发布iOS 13 预览版](https://www.apple.com/cn/newsroom/2019/06/apple-previews-ios-13/) 支持深色模式，优化了照片与相机功能，还有输入法的升级等。

想尝鲜的同学可以参考本文进行升级。苹果系统每个版本的前几个beta版，都会有很多bug，因此心里面要有准备。如果想要新系统的开发做出贡献，可以使用Feedback反馈自己使用中遇到的bug，Feedback会在新系统安装后自动出现。

升级前，请参照如下表格，查看机型是否支持新系统的安装。也可以去官网查看[苹果开发者官网](https://developer.apple.com/download/#ios-restore-images-ipad-new)

| iOS                         | iPad OS                     |
|:---------------------------:|:---------------------------:|
| iPhone XS/XS Max            | iPad Pro 12.9-inch/9.7-inch |
| iPhone XR                   | iPad Pro 10.5-inch          |
| iPhone X                    | iPad Pro 12.9-inch 2nd/3rd  |
| iPhone 8/8 Plus             | iPad Pro 11-inch            |
| iPhone 7/7 Plus             | iPad Mini 4/5th             |
| iPhone 6s/6s Plus           | iPad 5th/6th                |
| iPhone SE                   | iPad Air 2/3rd              |
| iPod touch (7th generation) |                             |

<!-- more -->

##### 升级前准备

升级需要Mac电脑，以及符合上表中列出的设备。

目前iOS13 Beta版还不支持使用OTA 文件辅助安装，因此只能手动下载安装包手动安装。

###### 1.首先备份自己的设备数据。

任何时候，数据保护是最重要的。因此，在升级之前，务必先备份自己的设备。

###### 2.去[苹果开发者官网](%5Bhttps://developer.apple.com/download/#ios-restore-images-ipad-new%5D(https://developer.apple.com/download/#ios-restore-images-ipad-new)下载与手机对应的安装包

##### 升级安装

安装之前，首先要升级Mac安装环境，目前有三种途径，以下任何一种都可以。

2. 安装MacOS 10.15 Catalina beta

3. 安装Xcode 11 beta，打开并安装好component

4. 下载并安装[MobileDevice.pkg](%5Bhttp://alirezakhoddam.com/wwdc19/MobileDevice.pkg%5D(http://alirezakhoddam.com/wwdc19/MobileDevice.pkg)，如果安装前已打开iTunes，请重启以下iTunes。

我使用的是第三种方法。

然后打开 iTunes，把 iPhone / iPad 连接到 Mac，按住 Option，同时点击「检查更新」，选择下载好的固件，点击打开，进行安装。

##### 恢复到iOS12

下载最新的[iOS12系统固件](https://developer.apple.com/download/release/)，然后用上面的安装步骤，使用iTunes进行安装即可。如果数据损坏，可以用之前的备份，进行恢复。
