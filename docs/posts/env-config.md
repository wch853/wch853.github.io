#
## 安装docker
### 通过yum安装docker
```bash
# 安装docker
yum install -y docker
# 设置docker开机启动
systemctl enable docker
```

### 设置镜像加速器
[进入阿里云控制台](https://cr.console.aliyun.com/cn-hangzhou/mirrors)，获取加速器地址，编辑 `/etc/docker/daemon.json`，添加加速器配置：
```js
{
  "registry-mirrors": ["https://....mirror.aliyuncs.com"]
}
```

重启 `systemctl`：`systemctl daemon-reload`。

### 启动docker
```bash
# 启动docker
systemctl start docker
```

## 配置vsftp
启动 `vsftpd` 容器：
```bash
# 运行vsftpd容器
docker run -d -v /var/ftp/vsftpd:/home/vsftpd \
-p 20:20 -p 21:21 -p 21100-21110:21100-21110 \
-e FTP_USER=dmall -e FTP_PASS=dmall \
-e PASV_ADDRESS=127.0.0.1 -e PASV_MIN_PORT=21100 -e PASV_MAX_PORT=21110 \
--name vsftpd --restart=always fauria/vsftpd

# 宿主机开启端口
firewall-cmd --zone=public --add-port=21100-21110/tcp --permanent
# 刷新防火墙配置
firewall-cmd --reload

# vsftpd新增用户
docker exec -i -t vsftpd bash
mkdir /home/vsftpd/img
echo -e "user\pass" >> /etc/vsftpd/virtual_users.txt
/usr/bin/db_load -T -t hash -f /etc/vsftpd/virtual_users.txt /etc/vsftpd/virtual_users.db
exit
docker restart vsftpd
```

## 安装Nginx
[下载nginx](https://nginx.org/en/download.html)
```bash
# 安装rpm
rpm -ivh http://nginx.org/packages/centos/7/noarch/RPMS/nginx-release-centos-7-0.el7.ngx.noarch.rpm
# 安装nginx
yum install nginx
# 启动nginx
nginx
# 检查nginx配置文件
nginx -t
# 停止nginx
nginx -s stop
# 重启nginx
nginx -s reload

# 宿主机开启端口
firewall-cmd --zone=public --add-port=80/tcp --permanent
# 刷新防火墙配置
firewall-cmd --reload

# 配置nginx代理静态目录（静态文件根目录为 /var/ftp/vsftpd/dmall/img/）
location /img/ {
    root /;
    rewrite ^/img/(.*)$ /var/ftp/vsftpd/dmall/img/$1 break;
}
```

## 安装MySQL
```bash
# 启动mysql
docker run --name mysql \
-v /var/lib/mysql:/var/lib/mysql \
-p 3306:3306 \
-e MYSQL_ROOT_PASSWORD=passwd \
--restart=always \
-d mysql:5.7

# 宿主机开启端口
firewall-cmd --zone=public --add-port=3306/tcp --permanent
# 刷新防火墙配置
firewall-cmd --reload

# 新用户
# 创建用户
CREATE USER 'mysql_rw'@'%' IDENTIFIED BY 'RW_mysql';
# 全部授权
GRANT ALL PRIVILEGES ON *.* TO 'mysql_rw'@'%'
# 部分授权
GRANT SELECT ON databasename.tablename TO 'mysql_rw'@'%';
# 查看用户权限
SHOW GRANTS FOR 'mysql_rw'@'%';
# 重置用户密码
SET PASSWORD FOR 'mysql_rw'@'%' = PASSWORD('new_passwd');
# 删除用户
DROP USER 'mysql_rw'@'%';
```