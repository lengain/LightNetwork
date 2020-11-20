---
title: iOS Category源码探究
date: 2020-11-19 10:08:21
tags: 技术
---

Objective-C的Category特性，使的开发者在处理某些问题时，简单而又方便。理解Category的源码，对OC编程的理解会有很大的帮助。

Category的处理源码在libobjc.A.dylib中，苹果已经[开源](https://opensource.apple.com/tarballs/objc4/)，但是下载后直接使用Xcode编译，会报很多错误。网上有很多帖子，介绍如何解决libobjc编译错误，这里就不介绍了。在github上有个开源项目[objc4](https://github.com/xdxu1126/objc4)，提供了可编译版本的objc工程，可按需索取。

<!--more-->

### category_t

 首先从源码层面来看一下Category有什么样的结构。Category在objc中的结构体为`category_t`，该结构体中有实例方法，类方法，协议，属性，类属性等成员。Category的结构体决定了我们在使用Category时，可以为Category添加哪些代码。

```c
struct category_t {
    const char *name;//类名
    classref_t cls;
    struct method_list_t *instanceMethods;//实例方法
    struct method_list_t *classMethods;//类方法
    struct protocol_list_t *protocols;//协议
    struct property_list_t *instanceProperties;//属性
    // Fields below this point are not always present on disk.
    struct property_list_t *_classProperties;//类属性

    method_list_t *methodsForMeta(bool isMeta) {
        if (isMeta) return classMethods;
        else return instanceMethods;
    }

    property_list_t *propertiesForMeta(bool isMeta, struct header_info *hi);
    
    protocol_list_t *protocolsForMeta(bool isMeta) {
        if (isMeta) return nullptr;
        else return protocols;
    }
};
```

程序初始化时，libobjc会将每个Category中的添加的属性，方法等合并到当前类的属性列表方法列表中。

### 入口

objc-os.mm中的_objc_init函数是objc初始化的方法。从_objc_init出发，可以找到加载Category的方法。

```c
// _objc_init objc-os.mm
// Bootstrap initialization. Registers our image notifier with dyld.
// Called by libSystem BEFORE library initialization tim
void _objc_init(void)
{
    static bool initialized = false;
    if (initialized) return;
    initialized = true;
    
    // fixme defer initialization until an objc-using image is found?
    environ_init();
    tls_init();
    static_init();
    runtime_init();
    exception_init();
    cache_init();
    _imp_implementationWithBlock_init();
    //map_images是个方法，用来处理被dyld映射过来的镜像
    _dyld_objc_notify_register(&map_images, load_images, unmap_image);

#if __OBJC2__
    didCallDyldNotifyRegister = true;
#endif
}

// map_images objc-runtime-new.mm
// Process the given images which are being mapped in by dyld.
// Calls ABI-agnostic code after taking ABI-specific locks.
// Locking: write-locks runtimeLock
void
map_images(unsigned count, const char * const paths[],
           const struct mach_header * const mhdrs[])
{
    mutex_locker_t lock(runtimeLock);
    //map_images_nolock方法就是map_images的内部实现
    return map_images_nolock(count, paths, mhdrs);
}

//map_images_nolock objc-os.mm
void 
map_images_nolock(unsigned mhCount, const char * const mhPaths[],
                  const struct mach_header * const mhdrs[])
{
    ...
    // Find all images with Objective-C metadata.
    //找到元数据中所有的镜像数量
    hCount = 0;
    ...
    if (hCount > 0) {
        //读取镜像
        _read_images(hList, hCount, totalClasses, unoptimizedTotalClasses);
    }
    ...
}


// _read_images objc-runtime-new.mm
// Perform initial processing of the headers in the linked 
// list beginning with headerList. 
// Called by: map_images_nolock
// Locking: runtimeLock acquired by map_images
// _read_images中执行的大量的操作，比如加载类，cagetory，协议等信息到内存中
void _read_images(header_info **hList, uint32_t hCount, int totalClasses, int unoptimizedTotalClasses) {
    //定义header_info，读取hList中的镜像头信息
    //header_info中存着镜像的信息
    uint32_t hIndex;
    ...
    // Discover categories. Only do this after the initial category
    // attachment has been done. For categories present at startup,
    // discovery is deferred until the first load_images call after
    // the call to _dyld_objc_notify_register completes. rdar://problem/53119145
    if (didInitialAttachCategories) {
        for (hIndex = 0;hIndex < hCount && (hi = hList[hIndex]); hIndex++) {
            //加载分类信息
            load_categories_nolock(hi);
        }
    }
    ...
    
}

static void load_categories_nolock(header_info *hi) {
     ....
                // First, register the category with its target class.
                // Then, rebuild the class's method lists (etc) if
                // the class is realized.
                if (cat->instanceMethods ||  cat->protocols
                    ||  cat->instanceProperties)
                {
                    if (cls->isRealized()) {
                        attachCategories(cls, &lc, 1, ATTACH_EXISTING);
                    } else {
                        objc::unattachedCategories.addForClass(lc, cls);
                    }
                }

                if (cat->classMethods  ||  cat->protocols
                    ||  (hasClassProperties && cat->_classProperties))
                {
                    if (cls->ISA()->isRealized()) {
                        attachCategories(cls->ISA(), &lc, 1, ATTACH_EXISTING | ATTACH_METACLASS);
                    } else {
                        objc::unattachedCategories.addForClass(lc, cls->ISA());
                    }
                }
    ...
}

```
