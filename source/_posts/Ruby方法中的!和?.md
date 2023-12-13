---
title: Ruby方法中的!和?
date: 2023-12-11 20:26:24
tags: Ruby
---

##### 方法名后缀为"!"的方法

在Ruby中，方法名后缀为"!"的方法通常表示该方法会修改调用它的对象。这种约定起源于Smalltalk语言，在Ruby中广泛使用。

当一个方法后面带有"!"符号时，这个方法通常会修改调用它的对象的状态。例如，如果我们对一个数组调用`sort!`方法，这个方法会对数组进行排序，并返回排序后的数组，而原始数组将被修改。

<!--more-->

下面是一个例子：

```ruby
rubynumbers = [3, 1, 2]
sorted_numbers = numbers.sort! 
# 修改原始数组，并返回排序后的数组  
# puts numbers 
# 输出: [1, 2, 3]  
# puts sorted_numbers 
# 输出: [1, 2, 3]
```

在这个例子中，`sort!`方法修改了原始数组`numbers`的状态，并返回了排序后的数组。

需要注意的是，有些方法同时有带"!"和不带"!"的版本。例如，`sort`方法不会修改原始数组，而是返回一个新的排序后的数组。因此，我们需要仔细查看方法的文档来了解它们的行为。

##### 方法名后缀为"?"的方法

在Ruby中，以"?"结尾的方法通常表示该方法返回一个布尔值（true或false）。这种约定使得代码更加可读和易于理解。

例如，Ruby中有很多方法以"?"结尾，如`nil?`、`empty?`、`blank?`等。这些方法通常用于条件判断，根据给定的条件返回true或false。

以下是一些示例：

```ruby
# 使用nil?方法判断变量是否为nil  
if my_variable.nil?    
    puts "my_variable is nil"  
else
    puts "my_variable is not nil"
end    
# 使用empty?方法判断字符串是否为空  
if my_string.empty?
    puts "my_string is empty"  
else
    puts "my_string is not empty"  
end    
# 使用blank?方法判断字符串是否为空白（只包含空格、制表符等空白字符）
if my_string.blank?
    puts "my_string is blank"  
else
    puts "my_string is not blank"  
end
```

在这些示例中，通过调用以"?"结尾的方法，我们可以根据条件判断得到相应的结果。这些方法通常用于控制程序流程，根据条件执行相应的操作。

##### 反引号

在Ruby中，反引号用于执行shell命令，并将执行结果作为字符串返回。以下是反引号的使用方法：

1. 反引号包围一个shell命令，Ruby会执行该命令，并将执行结果作为字符串返回。
2. 使用`puts`方法打印该变量的值。

例如：

```ruby
output=`ls -l`  
puts output
```

在上述代码中，`ls -l`命令会在shell中执行，并返回结果。然后，将结果赋值给变量output，并使用puts方法打印该变量的值。
