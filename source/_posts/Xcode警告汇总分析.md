---
title: Xcode警告汇总分析
date: 2019-01-05 20:10:47
tags: 技术
categories:
---

Xcode工程警告在我们工作中经常遇到，却又常常忽略的。正确的处理Xcode警告可以使得我们开发出优秀的程序。而在实际开发过程中，我们有可能因为项目紧，开发周期短而忽视掉一些警告。本文旨在分析Xcode工程中的各种警告，并根据警告部分的程序对工程影响程度的大小，进行排序，然后提醒开发者，及时处理对工程影响较大的警告。

<!--more-->

我会按照10分（严重）到1分（可忽略）的顺序，对各种警告进行打分。分数说明：严重（10）、较严重（8）、建议处理（5）、一般（3）、可忽略（1）。其中>=5分的，建议立即处理，其他可稍后处理，但是一定要去处理，除非该处警告经观察后，无需处理。

我的Xcode版本：`Version 10.1 (10B61)`

这里从`Run/Build`时和 `Analyze`时两种情况来分析。

#### Xcode Run/Build警告

##### Dependency Analysis Warning（依赖分析警告）

通常是工程配置不正确引起。

例如：Mutiple build commands for output file xxx。解决方法：通常是由于重复引用文件导致。在`Build Phases` `Copy Bundle Resources`中删除重复文件就可以了。

分析：本警告在Xcode10之前，无需处理，但是，Xcode10之后，会报错，导致无法运行程序，虽然可以切换Xcode 的Build System为`Legncy Build System`，但这其实是避开问题不去解决的鸵鸟心态。因此这里定此警告为6分，建议碰到即处理。

##### Documentation Issue（文档问题）

通常是方法的文档里，方法的参数未写文档或文档的参数与方法的参数不匹配引起的问题。

分析：文档警告对要求比较高的程序员，可能不能忍受。看见的话还是会改一下，但是有些参数真的是没什么好写的。这里定为2分。

扩展：工程里可以禁用Documentation Issue，参照这里[Disable “Documentation Comments” warning for selected files](https://stackoverflow.com/questions/24453188/disable-documentation-comments-warning-for-selected-files)

##### Lexical or Preprocessor Issue（词汇或预处理程序问题）

通常是宏重复定义，引用文件名大小写不匹配等警告。

例如：

non-portable path to file .h,specified path differs in case from file name on disk 解决方法：检查文件名，修改正确

'xxx' macro redefined 解决方法：重新定义新的宏或删除宏

分析：当宏重复定义，但是值不一样时，有可能会造成错误。因此词汇或预处理程序问题建议碰到后，立即修改。这里定为5分。

##### Semantic Issue（语义问题）

这种问题在工程中经常见到，通常情况并不会影响程序的运行，通常是由于程序员的编码习惯所致，程序员在注意到这个问题后，应尽量避免这种问题。而且代码里一堆警告，也不美观。

例如：

Block implicitly retains 'self'; explicitly mention 'self' to indicate this is intended behavior 解决方法：指定全局变量为`self.iVar`或`self->_iVar`，同时，也可以禁掉这个提示，参照[这里](https://stackoverflow.com/questions/21577711/block-implicitly-retains-self-explicitly-mention-self-to-indicate-this-is-i)。

Method definition for 'custom method' not found 解决方法：删除或定义方法

Incompatible pointer types initializing 'xxx' with an expression of type 'yyy' Format String Issue 解决方法：类型强转

Class 'xxx' does not conform to protocol 'yyy' 解决方法：实现协议中的方法或声明协议中的方法为`@optional`。

等。

分析：语义问题很常见，通常不会引起什么错误。这里定为4分。在了解是那种警告并且确认不改不会造成问题之后可以放任不管。

##### User-Defined Issue（用户自定义问题）

分析：使用`#warning`之后引发的warning，为User-Defined Issue。这中警告一般是用户自定义或是系统预先定义的，警告级别，可高可低，因此这里不打分。

##### Format String Issue（格式化字符串问题）

分析：该问题通常是基本数据类型转`NSString`时，出现这样的问题。点击问题后，再次点击问题框上的`fix`按钮，就可以修复。这里打2分。

##### Unused Entity Issue（未使用的实体）

分析：项目中有声明后未使用的实体（变量，常量）会报这个警告。有用的话可以注释掉，没用删除掉就可以了。这里打1分。

##### Value Conversion Issue（值转换问题）

当函数中传的参数和定义的参数类型不一致时，会报值转换错误，例如：

Implicit conversion loses integer precision

implicit conversion from enumeration type等，解决方法：传入正确的类型

分析：当传入函数的参数为类型不正确的参数时，容易引发未知问题。这里打7分。

##### ARC Retain Cycle（自动内存管理循环引用）

分析：循环引用时OC开发中经常遇到的问题。当Xcode提示循环引用时，一般是比较明显的循环引用。循环引用导致内存泄漏，严重的情况，会导致内存暴增，App Crash。因此，遇到循环引用，应及时解决。这里打10分。

##### Deprecations（过期不推荐使用）

分析：使用过期的方法会报`Deprecations`问题。过期方法都不推荐使用，一本情况，过期的方法又能正常运行。这里打6分，推荐遇到`Deprecations`问题改为合适的方法。

##### Asset Catalog Compiler Warning（资源文件编译警告）

当`Assets.xcassets`中的文件，编译时出现异常，会报这个警告。例如：

The image set name "xxx" is used by multiple image sets.

app icon is required for iPad/iPhone apps targeting IOS 7.0 and later

解决方法：正确的使用放入图片，包括尺寸，名字不能重复。

分析：当图片使用不当时，会直观的显示在UI上，这对App的美观时致命的。这里打8分。

##### 总结

经过排序结果如下：

| Name                                      | Score  |
| ----------------------------------------- | ------ |
| ARC Retain Cycle（自动内存管理循环引用）              | 10     |
| Asset Catalog Compiler Warning（资源文件编译警告）  | 8      |
| Value Conversion Issue（值转换问题）             | 7      |
| Dependency Analysis Warning（依赖分析警告）       | 6      |
| Deprecations（过期不推荐使用）                     | 6      |
| Lexical or Preprocessor Issue（词汇或预处理程序问题） | 5      |
| Semantic Issue（语义问题）                      | 4      |
| Documentation Issue（文档问题）                 | 2      |
| Format String Issue（格式化字符串问题）             | 2      |
| Unused Entity Issue（未使用的实体）               | 1      |
| User-Defined Issue（用户自定义问题）               | 根据情况而定 |

建议遇到五分及以上的警告，及时处理，以免造成无法预料的错误。

希望开发者（包括我）在编码时，就顺手解决警告，尽量做到零警告。

#### Xcode Analyze警告

当使用Xcode `Analyze`进行分析工程时，也会分析出一些警告。而且分析的警告，大都是必须修复的，这里不在分级，遇到应及时解决。大概有这几中类型：

* API Misuse（API滥用）

* Logic error（逻辑错误）

*  Dead Store（无作用存储体）

* Leak（内存泄漏）

* Memory error（内存错误）

[这里](https://blog.csdn.net/it_liuchengli/article/details/52948031)有更详细的解释，有兴趣可以再看看。

谢谢观看！
