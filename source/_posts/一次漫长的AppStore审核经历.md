---
title: 一次漫长的AppStore审核经历
date: 2020-05-06 12:50:38
tags: 其他
categories:
---

最近发布了一款Mac系统环境下的App，名字叫做“[二维码扩展](https://apps.apple.com/us/app/%E4%BA%8C%E7%BB%B4%E7%A0%81%E6%89%A9%E5%B1%95/id1491889350?l=zh&ls=1)”，发布过程比正常的发布过程多花了不少时间，历时一个多月。在此记录一下。

第一次提交审核，第二天就出来审核结果了，是由于App的语言适配除了问题，然后我迅速修复了。

再次提交审核，App审核状态变为审核中`In Review`，然后就开始了漫长的等待。
<!-- more -->

等了大概一周多的时间，我收到了苹果一封邮件，如下

> 发件人 Apple
> 
> Hello,  
> 
> We are unable to continue this app’s review because your Apple Developer Program account is currently under investigation for not following the App Store Review Guidelines’ Developer Code of Conduct.  
> 
> Common practices that may lead to an investigation include, but are not limited to:  
> 
> - Inaccurately describing an app or service  
> - Misleading app content  
> - Engaging in inauthentic ratings and reviews manipulation  
> - Providing misleading customer support responses  
> - Providing misleading responses in Resolution Center  
> - Engaging in misleading purchasing or bait-and-switch schemes  
> - Engaging in other dishonest or fraudulent activity within or outside of the app  
> 
> During our investigation, we will not review any apps you submit. Once we have completed our investigation, we will notify you via Resolution Center.  
> 
> We do not require any additional information from you at this time, nor do we have any additional details to share. We appreciate your continued patience during our investigation.  
> 
> Best regards,  
> 
> App Store Review

简单的来说，就是我的开发者账户`Apple Developer Program account` 可能违反了苹果的某些规定，被审查了，App审核状态变为已拒绝。虽然事实上并没有违反，为什么这么说，继续看就知道了。

收到这封邮件之后，我又开始了漫长的等待，因为邮件中说，不需要我提供什么额外信息，只需要等就行了。

等了两周没有收到苹果的邮件，我实在焦急，便访问了[苹果技术支持](https://developer.apple.com/contact/#!/topic/select)的站点，提交了一个issue。具体选择的是会员资格与问题，然后又选择了其他会员资格与账户问题。

![](https://raw.githubusercontent.com/lengain/LengainGraphBed/master/picture/%E6%88%AA%E5%B1%8F2020-05-06%20%E4%B8%8B%E5%8D%8812.43.30.png)

我详细的描述了我审核的过程，并解释说我这只是个工具类App，并未违反之前苹果邮件中提到的规定，请他们协助调查，帮忙查一下审查两周还没有通过原因。

第二天，我收到了苹果技术支持中心的邮件，邮件中说我的账户是正常的审查状态，要我耐心等待。

不知道是不是联系苹果技术支持起了作用，之后没两天我便收到苹果的调查结果，如下：

> 发件人 Apple
> 
> Hello,  
> 
> We are writing to let you know that we have completed our investigation of your Apple Developer Program account. You may now submit apps for review, and we will continue with the review of this app. If we find any issues during our review, we will communicate them via Resolution Center. Otherwise, your app will be approved.  
> 
> Please note that all apps submitted to the App Store are reviewed against the  [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), including the  [Developer Code of Conduct](https://developer.apple.com/app-store/review/guidelines/#code-of-conduct).  
> 
> You can avoid future investigations by ensuring your apps don't attempt to mislead or harm customers or undermine the review process. Be sure to review the  [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)  and read the  [Developer Code of Conduct](https://developer.apple.com/app-store/review/guidelines/#code-of-conduct)  so you understand our requirements prior to submitting any apps for review.  
> 
> Best regards,  
> 
> App Store Review

说了半天，其实我也没有违反规定，就被审查了二十天。然后状态变为正在审核，又等了一个星期，审核通过。
审核通过后，App并没有直接发布到AppStore，当时是搜索不到的，苹果会在24小时之内传到各个国家地区的AppStore。
完结，手动撒花~



