# 
## 安装CentOS
下载 `CentOS 7` 镜像，[下载地址](https://www.centos.org/download/)。
下载 `VMware`。
安装新建虚拟机向导安装虚拟机，启动虚拟机。
## 安装GOME桌面
```bash
# 安装 X Window System
yum groupinstall "X Window System"
# 安装 GNOME 桌面
yum groupinstall "GNOME Desktop" "Graphical Administration Tools"
# 设置默认使用图形界面启动
systemctl set-default graphical.target
# 重启进入 GNOME 桌面
reboot
```

## Linux目录结构
`bin`：`usr/bin`、`user/local/bin`，存放经常使用的命令。
`sbin`：`usr/sbin`、`user/local/sbin`，存放系统管理员使用的系统管理命令。
`home`：存放用户目录的目录，用户目录通常以用户名命名。
`root`：超级管理员用户目录。
`lib`：系统开机所需要最基本的动态连接共享库。
`etc`：存放系统配置文件的目录。
`usr`：用户安装的应用程序目录。
`boot`：存放的是启动Linux时使用的一些核心文件，包括一些连接文件以及镜像文件。
`proc`：是一个虚拟目录，是系统内存的映射，访问这个目录可以获取系统信息。
`tmp`：存放临时文件的目录。
`dev`：硬件用文件的形式存储所在的目录，相当于设备管理器。
`media`：识别U盘、光驱后，linux会把识别的目录挂载到此目录下。
`mnt`：临时挂载别的文件系统。
`opt`：额外安装软件所在目录。
`usr/local`：额外安装软件所在目录，一般是通过源码编译安装的程序的目录。
`var`：存放不断扩充的文件，如日志文件。

## Vim命令
```bash
# 进入编辑模式
i
# 退出编辑模式
ESC
# 复制当前行
yy
# 粘贴
p
# 删除当前行
dd
# 进入查找
/
# 查找下一个
n
# 查看行号
:set nu
# 关闭行号显示
:set nonu
# 撤销修改
u
# 定位到文件末尾
G
# 定位到首行
gg
# 定位到某行
# 先输入行号
shift + g
```

## 关机 & 重启
```bash
# 立即关机
shutdow -h now / halt
# 1分钟后关机
shutdown -h 1
# 重新启动
reboot / shutdown -r now
# 将内存数据同步到磁盘
sync
```

## 登录 & 注销
```bash
# SSH登录
ssh root@192.168.83.129
# 注销
logout
```

## 用户管理
```bash
# 添加用户
useradd USER_NAME
# 添加用户到指定组
useradd -g USER_NAME
# 添加用户并指定用户目录
useradd -d /home/user USER_NAME
# 为指定用户添加密码
passwd USER_NAME
# 删除用户
userdel USER_NAME
# 删除用户及用户目录
userdel -r USER_NAME
# 查询用户信息
id USER_NAME
```
`/etc/passwd`：用户信息文件，用户名:口令:用户标识号:组标识号:注释性描述:主目录:登录Shell。
`/etc/shadow`：口令配置文件，登录名:加密口令:最后一次修改时间:最小时间间隔:最大时间间隔:警
告时间:不活动时间:失效时间:标志。
`/etc/group`：组配置文件，组名:口令:组标识号:组内用户列表。

## 文件目录类命令
```bash
# 显示当前目录的绝对路径
pwd
# 查看当前目录信息
ls
# 显示当前目录所有的文件和目录，包括隐藏的
ls -a
# 以列表的方式显示信息
ls -l / ll
# 进入指定目录
cd [DIRECTORY]
# 创建目录
mkdir [DIRECTORY]
# 创建多级目录
mkdir -p [DIRECTORY]
# 删除目录
rmdir [DIRECTORY]
# 强制删除目录
rm -rf [DIRECTORY]
# 创建文件
touch [FILE]
# 复制文件
cp [FILE] [DIRECTORY]
# 递归复制整个文件夹
cp -r [DIRECTORY] [DIRECTORY]
# 移动文件或重命名
mv [DIRECTORY] [DIRECTORY]
# 查看文本
cat [FILE]

# more查看文本相关命令
more [FILE]
# 退出
q
# 向后翻页
Space
# 向后一行
Enter
# 向后滚一屏
Ctrl + F
# 向前滚一屏
Ctrl + B
# 输出当前行号
=

# less查看文本相关命令
less [FILE]
# 退出
q
# 向后翻页
Space / pgdn
# 向前翻页
pgup
# 查找
/
# 向下查找
n
# 向上查找
N

# 输出内容到控制台
echo []
# 输出文本前N行内容
head -n N
# 输出文本后N行内容
tail -n N
# 输出重定向
>
# 追加内容到文件
>>
# 查看历史命令
history
# 查看日期
date
# 查看日历
cal

# 查找文件/目录
find [PARENT_DIRECTORY] -name [FILE / DIRECTORY]
# 定位文件/目录
locate [FILE / DIRECTORY]
# 压缩/解压gz文件
gizp / gunzip
# 压缩/解压zip文件
zip / unzip

# 生产.tar.gz文件
tar -c [FILE / DIRECTORY]
# 显示详细信息
tar -v [FILE]
# 指定压缩后的文件名
tar -f [FILE]
# 打包同时压缩
tar -z [FILE]
# 解压文件
tar -x [FILE]
```

## 权限管理
使用 `ls -l` 命令可以查看文件详细信息，其前缀 `-rwxrwxrwx` 标识权限，`r (read)`、`w (write)`、`x (execute)` 分别表示读、写、执行权限，它们用数字表示分别为4、2、1。
- 第0位确定文件类型（d, - , l , c , b）
- 第1-3位标识文件所有者对该文件的权限（user权限）。
- 第4-6位标识所属组对该文件的权限（group权限）。
- 第7-9位标识其他用户对该文件的权限（other权限）。

```bash
# 修改文件权限
chmod u+x [FILE] / chmod 777 [FILE]
```

## rpm
`rpm (RedHat Package Manager)` 是一种软件包的下载和安装工具。
`yum`是一个shell前端软件包管理器。基于 `rpm` 包管理，能够从指定的服务器自动下载RPM包并且安装，可以自动处理依赖性关系，并
且一次安装所有依赖的软件包。

```bash
# 查询已安装rpm包列表
rpm -qa
# 卸载rpm包
rpm -e [PACKAGE_NAME]
# 从yum服务器查看软件列表
yum list
# 安装软件
yum install [PACKAGE_NAME]
```

## 安装JDK
```bash
# 查询默认安装的openjdk的rpm包
rpm -qa | grep openjdk
# 强制卸载openjdk
rpm -e --nodeps [PACKAGE_NAME]

# 下载jdk
wget [URL]
# 解压jdk压缩包
tar -zxvf jdk-8u191-linux-x64.tar.gz
# 设置Java环境变量
export JAVA_HOME=/opt/jdk1.8.0_191
export PATH=$JAVA_HOME/bin:$PATH

# 检验Java
java -version
# 查看当前java执行路径
which java
```

## 防火墙端口限制
```bash
# 查看防火墙当前状态
systemctl status firewalld
# 开启端口
firewall-cmd --zone=public --add-port=80/tcp --permanent
# 屏蔽端口
firewall-cmd --zone=public --remove-port=80/tcp --permanent
# 重新载入配置
firewall-cmd --reload
# 查看已开启端口
firewall-cmd --zone=public --list-ports
```