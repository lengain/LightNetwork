---
title: 如何做一个CALayer 自定义属性CAAnimation动画
date: 2018-12-27 17:38:37
tags: 技术
---

最近在做CALayer自定义属性(`@property`修饰)动画。之前没有深究过，现在有很多有意思的发现，写出来分享给大家。

首先把[Demo LNLoadingLayer](https://github.com/lengain/LNLoadingLayer)分享给大家，这是一个loading动画。

在做CALayer自定义属性动画之前，要先了解一个概念，即CALayer是一个`符合键值编码的容器类（Key-Value Coding Compliant Container Classes）`。

#### 符合键值编码的容器类

CALayer和CAAnimation都是符合键值编码的容器类（Key-Value Coding Compliant Container Classes），

这意味着你可以用任意`key`来设置值，即使这个`key`没有声明为CALayer的property。

<!--more-->

以下是苹果[Core Animation 编程指南](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/CoreAnimation_guide/Key-ValueCodingExtensions/Key-ValueCodingExtensions.html#//apple_ref/doc/uid/TP40004514-CH12-SW2)的介绍：

> The[CAAnimation](https://developer.apple.com/documentation/quartzcore/caanimation)and[CALayer](https://developer.apple.com/documentation/quartzcore/calayer) classes are key-value coding compliant container classes, which means that you can set values for arbitrary keys. Even if the key`someKey`is not a declared property of the`CALayer`class, you can still set a value for it as follows:
> 
> \[ theLayer setValue:\[NSNumber numberWithInteger:50] forKey:@"someKey"];
> 
> You can also retrieve the value for arbitrary keys like you would retrieve the value for other key paths. For example, to retrieve the value of the`someKey`path set previously, you would use the following code:
> 
> someKeyValue = \[theLayer valueForKey:@"someKey"];

因此，在CALayer中，用@dynamic修饰的属性，即使没有实现setter getter也不会崩溃。

```objectivec
@interface DynamicTest : CALayer
@property NSString *title;
@end

@implementation DynamicTest
@dynamic title;

@end

DynamicTest *test = [[DynamicTest alloc] init];
test.title = @"title";//正常工作，不会崩溃。
//另外，CALayer和CAAnimation，会自动为@dynamic修饰的属性添加NSCoding协议的支持。不用@dynamic修饰，则不支持。
NSData *data = [NSKeyedArchiver archivedDataWithRootObject:test];
DynamicTest *unarchiveTest = [NSKeyedUnarchiver unarchiveObjectWithData:data];
NSLog(@"unarchiveTest.title=%@",unarchiveTest.title);
//输出 unarchiveTest.title=title
```

#### @dynamic在CALayer中的特殊表现

CALayer中，用@synthesize修饰的属性，可以正常使用getter/setter，而@dynamic修饰的属性，也可以实现getter/setter。但是**在自定义属性动画时，就必须使用@dynamic修饰**，因为`Core Animation`框架对@dynamic修饰的的属性做了一些特殊操作，使得CALayer能够在监控到属性变化时，调用相应的方法，实现动画。

这个特殊操作，我目前没有查到，如果谁知道，可以联系我告知一下，我给补上。多谢。

#### -(id)initWithLayer:(id)layer方法

我们知道，所谓动画，只不过是一帧帧静止的图片，以一定的速度（比如每秒60张）连续播放，肉眼因为视觉残象产生错觉，便以为画面是活动的。

Core Animation动画也是这个原理，在Core Animation动画过程中，不断的有副本图层（或表示图层`copied-layer` or `presentation layer`）被初始化，连续播放，形成动画。`-initWithLayer:`就是Core Animation为CALayer创建副本对象的初始化方法。

**注意：**

1.此方法会被自动调用。

2.@dynamic修饰的属性，`-initWithLayer:`后会被自动复制给副本Layer。方法中必须调用`[super initWithLayer:layer]`

3.@synthesize修饰或不加修饰词的@property属性，需要重写`-initWithLayer:`方法，手动将属性赋值给副本对象。如果没有这样的属性，或属性不影响显示，此方法不重写也可以。

```objectivec
/* This initializer is used by CoreAnimation to create shadow copies of
 * layers, e.g. for use as presentation layers. Subclasses can override
 * this method to copy their instance variables into the presentation
 * layer (subclasses should call the superclass afterwards). Calling this
 * method in any other situation will result in undefined behavior. */
-(id)initWithLayer:(id)layer {    
    if (self = [super initWithLayer:layer]) {
        if ([layer isKindOfClass:[CGCustomPropertyLayer class]]) {
            CGCustomPropertyLayer *cpLayer = layer;
            // Copy across ...
            self.nonDynamicProperty = cpLayer.nonDynamicProperty;    
        }
    }    
    return self;
}
```

#### 现在开始自定义属性动画

在添加过自定义属性后，设置一下@dynamic，如果还有额外的属性，记得重写`-initWithLayer:`。

接下来要添加一个很重要的类方法`+needsDisplayForKey:`

```objectivec
//Layer初次加载时，会调用此方法，用来判断属性的值改变时，是否需要重新绘制。因此自定义属性动画必须实现此方法且返回YES
//实现此方法后，自定义属性的值一旦改变,便会自动调用setNeedsDisplay，触发重绘。
+ (BOOL)needsDisplayForKey:(NSString *)key {
    return [key isEqualToString:CustomPropertyName] ? YES : [super needsDisplayForKey:key];
}
```

接下来，就可以写绘制的代码了，绘制时，一般写在`drawInContext:`或`drawLayer: inContext:`方法之中，当然，也可以写在`display`方法之中，但是应注意和CALayer的delegate是否会冲突。

> layer方法响应链有两种:
> 
> 1. \[layer setNeedDisplay] -> \[layer displayIfNeed] -> \[layer display] -> \[layerDelegate displayLayer:]
> 
> 2. \[layer setNeedDisplay] -> \[layer displayIfNeed] -> \[layer display] -> \[layer drawInContext:] -> \[layerDelegate drawLayer: inContext:]
>    
>    如果layerDelegate实现了displayLayer:协议，之后layer就不会再调用自身的重绘代码

[示例代码](https://github.com/lengain/LNLoadingLayer/blob/master/LNLoadingLayer/LNLoadingExplicitLayer.m)写在`drawInContext:`中。

**注意**：绘制的CALayer图形，在默认情况下，会很糊，因此使用时要设置`layer.contentsScale = [UIScreen mainScreen].scale;`contentsScale属性，默认为1.

绘制代码完成后，就可以使用动画了，添加[动画代码](https://github.com/lengain/LNLoadingLayer/blob/master/LNLoadingLayer/ViewController.m)

```objectivec
    LNLoadingExplicitLayer *loadingLayer = [[LNLoadingExplicitLayer alloc] init];
    loadingLayer.frame = frame;
    loadingLayer.progressLineWidth = 6.f/[UIScreen mainScreen].scale;
    loadingLayer.contentsScale = [UIScreen mainScreen].scale;
    [self.view.layer addSublayer:loadingLayer];

    CABasicAnimation *animation = [CABasicAnimation animationWithKeyPath:@"progress"];
    animation.fromValue = @(0);
    animation.toValue = @(200);
    animation.duration = 2.0;
    animation.repeatCount = MAXFLOAT;
    animation.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionLinear];
    [loadingLayer addAnimation:animation forKey:@"progressKey"];;
```

此时，自定义属性动画已经可以动起来了。

下面来介绍隐式动画。

#### 隐式动画（implicit animation）

没有指定任何动画类型的动画叫隐式动画。即属性平滑过渡到新的值的默认行为。

在demo的`LNLoadingExplicitLayer`类中，只实现了基本的显式动画。当我们想要在改变属性值自动有个过渡动画时，便要再添加一个方法`actionForKey:` ,这里是[示例代码](https://github.com/lengain/LNLoadingLayer/blob/master/LNLoadingLayer/LNLoadingLayer.m)，当layer属性改变时，layer都会寻找合适的action来实行这个改变，`actionForKey:`便是指定属性默认隐式动画的方法。

```objectivec
- (id)actionForKey:(NSString *)event {
    if ([event isEqualToString:LNProgressKey]) {
        CABasicAnimation *actionAnimation = [CABasicAnimation animationWithKeyPath:CustomPropertyName];
        actionAnimation.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionLinear];
        actionAnimation.fromValue = @(self.progress);
        return actionAnimation;
    }
    return [super actionForKey:event];
}
```

[这里](http://sindrilin.com/2017/12/14/bottleeneck_of_transacation.html)有一个介绍隐式动画很好的博文，感兴趣可以看看。更多内容可以搜索iOS隐式动画。

谢谢观看！

参考：

1.[Core animation of custom properties](https://gist.github.com/toriaezunama/9174945#file-core-animation-of-custom-properties)
2.[Core Animation 编程指南](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/CoreAnimation_guide/Key-ValueCodingExtensions/Key-ValueCodingExtensions.html#//apple_ref/doc/uid/TP40004514-CH12-SW2)

3.[Animating Custom Layer Properties](https://www.objc.io/issues/12-animations/animating-custom-layer-properties/)

4.https://blog.csdn.net/sinat_27706697/article/details/49738957
