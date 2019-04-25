---
layout: 
title: Mac Pro 2015 硬盘扩容升级记录
date: 2019-04-24 11:14:47
tags: 随笔
---

配置：Mac Pro 2015 13英寸

型号：A1502

内存：8G

硬盘：128G Apple SSD

#### 起因

我是2015年下半年买的这款Mac，如今19年四月份，已经将近四年了，电脑一般的寿命是五年左右，超过五年的电脑，一般都有各种元器件老化的问题，要换零件才能继续使用。我这电脑坚挺了近四年，没有坏过一次。想着明年准备换台新电脑，在换电脑以前，也想让它发挥一下余热。我这款Mac的硬盘是128G，作为iOSer，Xcode的一个软件，占用将近60G左右，还不包扩各种工程文件，其他软件。所以，内存紧张的问题困扰我也有一段时间了，因此这次准备换一下硬盘。

其实也想加一个内存条，但是这款Mac的内存条已经焊接在主板上了，无法增加。

#### 资料整理

硬盘的选择还是综合下价格和性能的考虑。

- 最优的是原装配件的Apple SSD，厂家是三星的。512G硬盘的淘宝价格大概1800软妹币。支持双系统。

- 东芝XG5 M.2 PCIE NVMe M2系列固态硬盘，512G硬盘价格大概在1100软妹币。支持双系统（[案例]([https://bbs.feng.com/read-htm-tid-11795599.html](https://bbs.feng.com/read-htm-tid-11795599.html)）。需要硬盘转接卡。

- 三星SM951 PCIE NVMe M2系列固态硬盘，512G硬盘大概750软妹币左右。论坛有人说不支持双系统。需要硬盘转接卡。

- Intel 760P PCIE NVMe M2系列固态硬盘。512G硬盘大概600软妹币左右。论坛有人说不支持双系统。需要硬盘转接卡。

- 其他NVME硬盘也可以。但是尽量选择大厂硬盘，质量有所保障。

我不需要安装双系统，东芝XG5，三星951和英特尔760P性能相差不大，我对三星无感，因此选择了Intel 760P。

因为Apple SSD硬盘卡接口和NVMe硬盘卡接口不一致，所以只能使用硬盘转接卡。英特尔760P装上硬盘转接卡后，长度和Apple SSD一样。

我在买硬盘转接卡的时候，看到商品详情里表明了一些可以更换硬盘的mac版本，如下：

2013 version MacBook Pro retina A1398 A1502 (ME864 ME865 ME866 ME293 ME294)

2014 version MacBook Pro retina A1502 A1398 (MGX72 MGX82 MGX92 MGXA2 MGXC2)

2015 version MacBook Pro retina A1502 A1398(MF839 MF840 MF841 MJLU2 MJLT2 MJLQ2)

2013-2014 version MacBook Air A1465 A1466(MD711 MD712 MD760 MD761)

2015 version MacBook Air A1465 A1466(MJVM2 MJVP2 MJVE2 MJVG2)

2017 version MacBook Air A1466(MQD32 MQD42 MQD52 EMC3178)

Mac Pro ME253 MD878,iMAC A1419(Late 2013 and newer).

2014版Mac mini A1347

2013版苹果一体机iMAC A1418

2017版iMAC A1418

2013 2014 2015 1016 2017版27寸iMAC A1419

#### 准备

将128G硬盘，换为512G硬盘

更换的过程主要是参考网友`late哥哥`的[MacBook Pro 2015 mid ssd存储升级扩容需求以及解决方案](https://blog.csdn.net/qq_28029345/article/details/85262542)

Mac OS最近几年的版本，都不支持安装包的直接下载，而是直接调起App Stroe，因此只能在网上找资源了，这是我找到的一个Install macOS Mojave 10.14的下载地址，直接打开安装，或者制作启动U盘安装，都可以。

Install macOS Mojave 10.14.dmg软件下载[https://pan.baidu.com/s/1Tz86rXPTLjaHid1tsPx_MA](https://pan.baidu.com/s/1Tz86rXPTLjaHid1tsPx_MA)密码d5n2

安装成功之后，可以首先升级一下系统。目前最新版是 `macOS Mojave10.14.4`

#### 步骤

###### 1.拆机

###### 1.拆机

###### 1.拆机

###### 1.拆机

###### 1.拆

#### 问题

如果遇到翻盖启动时，重新启动加载或休眠问题，可以试试重置了smc或nvram。

又重新重置了smc

关机，按下键盘左侧的shift + control +  option，然后同时按下电源按钮，按住10秒钟，松开所有案件，然后重启。

以及nvram（pram）将mac关机，然后按下 option + command + p + r ，按住大约20秒松开，期间大致会重启两次，然后松开。
