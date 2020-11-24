---
title: iOS Category源码探究
date: 2020-11-19 10:08:21
tags: 技术
---

Objective-C的Category特性，使的开发者在处理某些问题时，简单而又方便。理解Category的源码，对OC编程的理解会有很大的帮助。

Category的处理源码在libobjc.A.dylib中，苹果已经[开源](https://opensource.apple.com/tarballs/objc4/)，但是下载后直接使用Xcode编译，会报很多错误。网上有很多帖子，介绍如何解决libobjc编译错误，这里就不介绍了。在github上有个开源项目[objc4](https://github.com/xdxu1126/objc4)，提供了可编译版本的objc工程，可按需索取。目前苹果刚发布macOS Big Sur 11.0.1，适配该系统的Objc还没有开源，`objc4`在这个系统上会有一点错误，不过不影响阅读，各个函数，变量定义之间的跳转也没有问题。

<!--more-->

### category_t

 首先从源码层面来看一下Category有什么样的结构。

使用clang可以将Category的.m文件编译为.cpp文件，文件中有OC对Category的处理。

Category在objc中的结构体为`category_t`，该结构体中有实例方法，类方法，协议，属性，类属性等成员。Category的结构体决定了我们在使用Category时，可以为Category添加哪些代码。

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

### 从入口到详情

以下的代码，会从一个个函数调用帮助我们认识Objc对Category的处理。

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
    //_dyld_objc_notify_register注册三个回调函数，
    // map_images：dyld将image加载到内存时调用 
    // load_images：dyld初始化image，load方法都在此时调用
    // unmap_image：将image移除内存时调用
    // map_images这个方法，用来处理被dyld映射过来的镜像，注册后就会被调用
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
// _read_images中执行了大量的操作，比如加载类，cagetory，协议等信息到内存中
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
                        //添加Categories
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

// Attach method lists and properties and protocols from categories to a class.
// Assumes the categories in cats are all loaded and sorted by load order, 
// oldest categories first.
static void
attachCategories(Class cls, const locstamped_category_t *cats_list, uint32_t cats_count,
                 int flags)
{
    if (slowpath(PrintReplacedMethods)) {
        printReplacements(cls, cats_list, cats_count);
    }
    if (slowpath(PrintConnecting)) {
        _objc_inform("CLASS: attaching %d categories to%s class '%s'%s",
                     cats_count, (flags & ATTACH_EXISTING) ? " existing" : "",
                     cls->nameForLogging(), (flags & ATTACH_METACLASS) ? " (meta)" : "");
    }

    /*
     * Only a few classes have more than 64 categories during launch.
     * This uses a little stack, and avoids malloc.
     *
     * Categories must be added in the proper order, which is back
     * to front. To do that with the chunking, we iterate cats_list
     * from front to back, build up the local buffers backwards,
     * and call attachLists on the chunks. attachLists prepends the
     * lists, so the final result is in the expected order.
     */
    constexpr uint32_t ATTACH_BUFSIZ = 64;
    method_list_t   *mlists[ATTACH_BUFSIZ];
    property_list_t *proplists[ATTACH_BUFSIZ];
    protocol_list_t *protolists[ATTACH_BUFSIZ];

    uint32_t mcount = 0;
    uint32_t propcount = 0;
    uint32_t protocount = 0;
    bool fromBundle = NO;
    bool isMeta = (flags & ATTACH_METACLASS);
    //auto是C++的语法，表示类型根据自动代码自动推断。
    //cls->data()->extAllocIfNeeded()返回的就是class_rw_ext_t *类型
    //class_rw_ext_t中存有方法，属性，协议等信息。
    auto rwe = cls->data()->extAllocIfNeeded();

    for (uint32_t i = 0; i < cats_count; i++) {
        //entry:locstamped_category_t
        auto& entry = cats_list[i];
        //取出分类中的方法
        method_list_t *mlist = entry.cat->methodsForMeta(isMeta);
        if (mlist) {
            if (mcount == ATTACH_BUFSIZ) {
                prepareMethodLists(cls, mlists, mcount, NO, fromBundle);
                rwe->methods.attachLists(mlists, mcount);
                mcount = 0;
            }
            //ATTACH_BUFSIZ=64
            //这句话等于mlists[64- ++mcount] = mlist;
            //倒序合并分类到mlists，后面会将mlists再合并到类的方法列表中
            mlists[ATTACH_BUFSIZ - ++mcount] = mlist;
            fromBundle |= entry.hi->isBundle();
        }

        property_list_t *proplist =
            entry.cat->propertiesForMeta(isMeta, entry.hi);
        if (proplist) {
            if (propcount == ATTACH_BUFSIZ) {
                rwe->properties.attachLists(proplists, propcount);
                propcount = 0;
            }
            proplists[ATTACH_BUFSIZ - ++propcount] = proplist;
        }

        protocol_list_t *protolist = entry.cat->protocolsForMeta(isMeta);
        if (protolist) {
            if (protocount == ATTACH_BUFSIZ) {
                rwe->protocols.attachLists(protolists, protocount);
                protocount = 0;
            }
            protolists[ATTACH_BUFSIZ - ++protocount] = protolist;
        }
    }

    if (mcount > 0) {
        prepareMethodLists(cls, mlists + ATTACH_BUFSIZ - mcount, mcount, NO, fromBundle);
        //将mlists合并到rwe->methods
        rwe->methods.attachLists(mlists + ATTACH_BUFSIZ - mcount, mcount);
        if (flags & ATTACH_EXISTING) flushCaches(cls);
    }
    
    rwe->properties.attachLists(proplists + ATTACH_BUFSIZ - propcount, propcount);

    rwe->protocols.attachLists(protolists + ATTACH_BUFSIZ - protocount, protocount);
}

//attachLists objc-runtime-new.mm
void attachLists(List* const * addedLists, uint32_t addedCount) {
        if (addedCount == 0) return;

        if (hasArray()) {
            // many lists -> many lists
            uint32_t oldCount = array()->count;
            uint32_t newCount = oldCount + addedCount;
            //realloc memmove memcpy三个是C语言方法。
            //realloc 先判断当前的指针是否有足够的连续空间，如果有，扩大mem_address指向的地址，并且将mem_address返回，如果空间不够，先按照newsize指定的大小分配空间，将原有数据从头到尾拷贝到新分配的内存区域，而后释放原来mem_address所指内存区域（注意：原来指针是自动释放，不需要使用free），同时返回新分配的内存区域的首地址。即重新分配存储器块的地址。
            //memmove 用于拷贝字节，如果目标区域和源区域有重叠的话，memmove能够保证源串在被覆盖之前将重叠区域的字节拷贝到目标区域中，但复制后源内容会被更改。但是当目标区域与源区域没有重叠则和memcpy函数功能相同。
            //emcpy 指的是C和C++使用的内存拷贝函数，函数原型为void *memcpy(void *destin, void *source, unsigned n)；函数的功能是从源内存地址的起始位置开始拷贝若干个字节到目标内存地址中，即从源source中拷贝n个字节到目标destin中。
            //增加数组的长度
            setArray((array_t *)realloc(array(), array_t::byteSize(newCount)));
            //重设新数组的长度
            array()->count = newCount;
            //将array()->lists 复制到 array()->lists + addedCount，即先将 array()->lists 后移，空出位置来存放addedLists
            memmove(array()->lists + addedCount, array()->lists, 
                    oldCount * sizeof(array()->lists[0]));
            //将 addedLists 复制到 array()->lists
            //由此可见分类中的方法会被添加到原有方法的前面。在方法查询时，分类中的方法会先被查到并返回。如果分类中定义了和原类中一样的方法，就会只执行分类中的方法。
            memcpy(array()->lists, addedLists, 
                   addedCount * sizeof(array()->lists[0]));
        }
        else if (!list  &&  addedCount == 1) {
            // 0 lists -> 1 list
            list = addedLists[0];
        } 
        else {
            // 1 list -> many lists
            List* oldList = list;
            uint32_t oldCount = oldList ? 1 : 0;
            uint32_t newCount = oldCount + addedCount;
            setArray((array_t *)malloc(array_t::byteSize(newCount)));
            array()->count = newCount;
            if (oldList) array()->lists[addedCount] = oldList;
            memcpy(array()->lists, addedLists, 
                   addedCount * sizeof(array()->lists[0]));
        }
```

以上就是Category在运行时被加载的过程。整理一下流程：

1. `_objc_init()`

2. `map_images(...)`

3. `map_images_nolock(...)`

4. `_read_images(...)`

5. `load_categories_nolock()`

6. `attachCategories(...)`

以上。
