---
title: Dart ...展开操作符
date: 2023-08-08 16:30:18
tags: Dart
categories: 
---

Dart支持展开操作符(**spread operator**)`...`和空感展开操作符(**null-aware spread operator**)`...?`。

展开操作符支持所有的集合(Collections)类型，包括Set，List，Map。

##### 展开操作符(**spread operator**)

展开操作符`...`可以将一个列表的所有值，插入到另一个列表中。

```dart
var list = [1, 2, 3];
var list2 = [0, ...list];
assert(list2.length == 4);
// list2 = [0, 1, 2, 3]
```

##### 空感展开操作符(**null-aware spread operator**)

如果展开操作符右边的表达式可能为空，为了避免程序出问题可以使用空感展开操作符(**null-aware spread operator**)`...?`。



```dart
List<int>? list;
var list2 = [0, ...?list];
assert(list2.length == 1);
```
