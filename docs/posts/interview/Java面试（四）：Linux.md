# Java面试（四）：Linux

## 内核

内核从本质上看是一段管理计算机硬件设备的程序，管理 `CPU` 、内存空间、硬盘接口、网络接口等，所有指令都需要通过内核传递给硬件。内核通过提供系统调用接口供上层访问。

## 常用指令

### 查找文件

```bash
find path [options] params
find / -name "a.txt"
```

### 文本检索

- 查找目标是否包含指定文本：

```bash
grep [options] pattern file
grep "abc" a.txt
```

- 管道操作符

通过使用管道操作符（`|`）可以将前一个指令的输出作为下一个指令的输入：

```bash
ps -ef | grep tomcat
```

### 文本统计

```bash
awk [options] 'cmd' file
```

`awk` 命令一次读取一行文本，按输入分隔符（默认为空格）进行切片，切成多个组成部分。切片保存在多个内建变量中（`$0（整行切片）`、`$1`、`$2` …）。

### 文本行替换

- 对每行文本进行替换操作：

```bash
sed -i 's/pattern/target/' file
```