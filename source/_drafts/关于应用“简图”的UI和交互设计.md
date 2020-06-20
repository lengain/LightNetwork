---
title: 关于应用“简图”的UI和交互设计
tags: 软件
---



### 2020年6月19日

上段时间在考虑应用的名字，确定好叫`简图`之后我就开始了开发的工作。

现在卡在第三方账号设置页面的UI设计和交互设计了。我想了很久，但是还没想到好的方案。

先说说主页的设计吧。

#### 主页

主页是仿的苹果相册的设计，长按弹出预览和功能菜单。下面是预览图：

![图1](https://raw.githubusercontent.com/lengain/LengainGraphBed/master/picture/se2longpress.gif)

夸一下苹果的这个交互设计，这个设计其实是两个之前已有设计的合体，长按弹出功能菜单和3DTouch弹出预览图，或者说是对3D Touch的优化。

在iOS 13之前的相册中，带有3D Touch功能的手机的交互是3DTouch轻按弹出预览图，松手消失;只有轻按后上滑预览图才能弹出功能菜单(UIActionSheet)。如下图：

![图2](https://raw.githubusercontent.com/lengain/LengainGraphBed/master/picture/2020-06-19%2023.26.48.gif)



而不带3D Touch的手机则没有任何操作，如果要操作相片，要单击进入详情页操作。如下图：

![图3](https://raw.githubusercontent.com/lengain/LengainGraphBed/master/picture/seno3dtouch.gif)

相比较而言iOS 13的处理比3D Touch更为直观，简便，一次长按即可预览，又可操作。

技术角度来讲iOS13为长按预览提供了全新的API，适配时更加方便。我决定为简图主页适配长按预览功能，低于iOS13的系统版本，则适配为长按弹出UIActionSheet，不再提供预览功能。

### 账号设置页面

这个页面我迟迟没有想好合适的交互，为了理清思路，首先列出我想要的功能。

- 账号显示页面有添加账号按钮

- 点击后弹出选择账号平台（目前只有一个Github，暂时不做）

- 添加后的账号显示页面可直观的显示当前账号，并且易于切换账号。


