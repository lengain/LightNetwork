---
title: 一个NSObject对象占用多少内存
date: 2023-12-13 23:45:27
tags: iOS
categories:
---

OC类型的代码，底层实现都是C/C++语言，可以说，OC语言就是对C/C++语言的封装，比如，任何OC对象，添加`__bridge const void *`修饰，都可以转变为void指针类型。

<!--more-->

### 资料

使用[Clang](https://zhuanlan.zhihu.com/p/656699711?utm_id=0)可以将OC代码，重写为C++代码。
  xcrun 是 Command Line Tools 中的一员。它的作用类似 RubyGem 里的 Bundle ，用于控制执行环境。

```shell
xcrun -sdk iphoneos clang -arch arm64 -rewrite-objc oc文件 -o 输出的cpp文件
```

新建一个Xcode Project，选择macOS->Application->Command Line Tool,打开工程，在main.m文件中改为如下代码

```objective-c
#import <Foundation/Foundation.h>

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        // insert code here...
        NSObject *obj = [[NSObject alloc] init];
    }
    return 0;
}
```

打开终端，cd到main.m目录，根据上面命令，输入

```
xcrun -sdk iphoneos clang -arch arm64 -rewrite-objc main.m -o main.cpp
```

如有报错，请去下文`错误`处查找解决办法。
如无报错，可在文件夹中，找到main.cpp文件，打开，将光标移动到最后，可见以下C++代码。

```
/// An opaque type that represents an Objective-C class.
typedef struct objc_class *Class;

/// Represents an instance of a class.
struct objc_object {
    Class _Nonnull isa;
};
typedef struct objc_object NSObject;

int main(int argc, const char * argv[]) {
    /* @autoreleasepool */ { __AtAutoreleasePool __autoreleasepool; 
        NSObject *obj = ((NSObject *(*)(id, SEL))(void *)objc_msgSend)((id)((NSObject *(*)(id, SEL))(void *)objc_msgSend)((id)objc_getClass("NSObject"), sel_registerName("alloc")), sel_registerName("init"));
    }
    return 0;
}
```

由此可见，一个NSObject对象，它的底层，其实是一个struct, 因此NSObject *其实是一个结构体指针，所以任何OC对象都可以使用`(__bridge const void *)`将其转化为C语言指针。

> 指针类型占据的存储空间取决于编译器和操作系统的实现。在一些32位系统中，一个指针变量通常占据4个字节的空间，而在一些64位系统中，则需要8个字节的空间。这是因为指针是内存地址的数字表示，在32位系统中，一个数字数字占据4个字节的空间，而在64位系统中则需要8个字节。

而在64位机器中，指针占用8个字节。objc_object中的isa，其实是一个class指针，因此，一个NSObject，只需要8个字节就可以存下。

### 验证

objc/runtime.h中，由这样一个方法，返回一个类的实例的大小

```c
/** 
 * Returns the size of instances of a class.
 * 
 * @param cls A class object.
 * 
 * @return The size in bytes of instances of the class \e cls, or \c 0 if \e cls is \c Nil.
 */
OBJC_EXPORT size_t
class_getInstanceSize(Class _Nullable cls) 
    OBJC_AVAILABLE(10.5, 2.0, 9.0, 1.0, 2.0);
```

我们知道，在`malloc/malloc.h`中，有个malloc_size方法

```
extern size_t malloc_size(const void *ptr);
    /* Returns size of given ptr, including any padding inserted by the allocator */
```

返回给定指针的大小，包括分配器插入的填充量。
在 main.m中，输入

```
    NSLog(@"%lu,%zu", class_getInstanceSize([NSObject class]));
    //输出:8
    NSLog(@"%lu", malloc_size((__bridge const void *)(obj)));
    //输出:16
```

出现两种结果。我们查看[Objc4](https://github.com/apple-oss-distributions/objc4/tree/objc4-906)的源码,下载后打开工程，可查到如下源码:

```c
size_t class_getInstanceSize(Class cls)
{
    if (!cls) return 0;
    return cls->alignedInstanceSize();
}

// Class's ivar size rounded up to a pointer-size boundary.
    uint32_t alignedInstanceSize() const {
        return word_align(unalignedInstanceSize());
    }
```

发现class_getInstanceSize实际上返回的是类的成员变量的大小，并且按照指针大小（8个字节）取整。
因此，我们应当用malloc_size返回的结果。这个结果才是系统为obj分配的大小。
经过阅读[libmalloc](https://www.jianshu.com/p/adda1f61a0e8)的源码，发现malloc其实是按照16个字节对齐的，因此，一个对象的内存大小一定是16的倍数。

### Swift

```swift
import Foundation
var obj = NSObject()
print(MemoryLayout.size(ofValue: obj))
print(class_getInstanceSize(NSObject.self))
let objRawPtr = Unmanaged.passUnretained(obj as AnyObject).toOpaque()
print(malloc_size(objRawPtr))
//输出：
//8
//8
//16
```

同样，Swift的底层也是C++代码。将对象转为指针，使用`malloc_size`也能得到Swift对象的大小。

### 错误

1.xcrun error

```
xcrun: error: SDK "iphoneos" cannot be located
xcrun: error: Failed to open property list '/Users/tongyulong/Documents/Test/test01/test01/iphoneos/SDKSettings.plist'
main.m:8:9: fatal error: 'Foundation/Foundation.h' file not found
#import <Foundation/Foundation.h>
        ^~~~~~~~~~~~~~~~~~~~~~~~~
main.m:8:9: note: did not find header 'Foundation.h' in framework 'Foundation' (loaded from '/System/Library/Frameworks')
1 error generated.
```

一般情况，出现上诉错误，就是sdk路径错误。
在命令行输入

```
xcodebuild -showsdks
```

如果出现

```
xcode-select: error: tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance
```

输入以下命令解决。

```
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer/
```

然后继续执行xrcun
