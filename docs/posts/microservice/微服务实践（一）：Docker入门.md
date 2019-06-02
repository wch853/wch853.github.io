---
sidebarDepth: 2
date: 2018-09-23
desc: Docker的基础概念、如何使用Docker、打包镜像、编排服务。
tags: Docker 微服务 容器 服务编排
---

# 微服务实践（一）：Docker 入门

## 虚拟机与容器

相对于传统虚拟机，容器不需要 Guest OS 层，可以直接在本地操作系统之上实现应用的隔离。
![虚拟机与容器](/img/microservice/虚拟机与容器.png)

## 容器的作用

- 简化配置：代码、运行环境、配置可以打包到一个容器中，以简化配置，提高开发效率
- 代码流水线管理
- 提高开发效率
- 隔离应用
- 整合服务器
- 调试能力
- 多租户
- 快速部署

## 容器演变历史

### 传统部署

传统部署需要有物理机设备，在物理机上安装操作系统后部署应用。传统部署存在以下缺点：

- 由于应用依赖各种环境和配置，部署速度慢
- 硬件系统造成部署成本高
- 当应用简单时会造成资源的浪费
- 难以迁移和扩展
- 会被限定硬件厂商

![传统部署](/img/microservice/传统部署.png)

### 虚拟化技术

对物理服务器的资源（CPU、内存、硬盘等）通过 Hypervisor 做虚拟化，在虚拟化之上安装操作系统，构成虚拟机。这样使得一个物理机部署多个 App，每个 App 独立运行在一个 VM 中。

- 资源池：物理机资源分配到了不同虚拟机
- 易扩展：通过虚拟化技术，不需关心物理机，容易对虚拟机扩展
- 易云化：容易结合商用云服务器使用
- 消耗资源：每个虚拟机都是一个完整的操作系统，当虚拟机增多时，操作系统本身消耗的资源势必增多

### 容器技术

- 对软件及其依赖的标准化打包
- 应用之间相互隔离
- 共享同一个 OS Kernel
- 可以运行在很多主流操作系统上
  容器与虚拟机的区别在于容器是应用层面的隔离，而虚拟机是物理资源层面的隔离，同时，容器和虚拟化技术可以结合使用。

![容器与虚拟化的区别](/img/microservice/容器与虚拟化的区别.png)

![虚拟化+容器](/img/microservice/虚拟化+容器.png)

## Docker

### Docker Platform

Docker 提供了一个开发、打包、运行 app 的平台，把 app 和底层设施隔离开来。

![Docker Platform](/img/microservice/DockerPlatform.png)

Docker Engine 分为后台进程（dockerd）和 CLI 接口，是一个 C/S 模式的架构，它们之间通过 REST API 通信。

![Docker Engine](/img/microservice/DockerEngine.png)

Docker client 可以操作 Docker Host 上的镜像和容器，Registry 可以存储用户镜像。

![Docker架构](/img/microservice/Docker架构.png)

### 安装 Docker

```bash
# 安装
yum install docker-io -y
# 查看docker版本
docker version
# 启动Docker
systemctl start docker
# 设置开机启动
chkconfig docker on
# 配置国内镜像源
echo "OPTIONS='--registry-mirror=https://mirror.ccs.tencentyun.com'" >> /etc/sysconfig/docker
systemctl daemon-reload
systemctl restart docker
```

### Docker Image（镜像）

- 文件和 meta data 的集合（root filesystem）
- 分层，每一层都可以通过添加、改变或删除文件，成为新的镜像
- 不同镜像可以共享相同的 layer
- 镜像本身是只读的

![docker分层文件系统](/img/microservice/docker分层文件系统.png)

#### 获取镜像的方式

- 通过 DockerFile 构建
- 通过 Registry（如 Docker hub）拉取

### Docker Container（容器）

- 通过 Image 创建，相当于 Image 的一个实例
- 在 Image layer 之上建立一个 Container layer（可读写）
- Image 负责 App 的存储和分发，Container 负责运行 App

### 构建 Docker 镜像

#### 通过 commit 构建镜像

通过交互命令进入某个镜像，配置后通过 exit 命令退出。再通过 docker commit 创建 image。

```bash
docker commit -m [MARK] [CONTAINER NAMES] [REPOSITORY]
```

### 通过 build 构建镜像

1.编写 Dockerfile 文件

```bash
# base image
FROM centos
# install vim
RUN yum install -y vim
```

2.构建镜像

```bash
docker build -t wch/centos-vim .
```

### Dockerfile 使用

```bash
# 制作base image
FROM scratch
# 使用base image
FROM centos

# 定义Metadata
LABEL maintainer="wch853@163.com"
LABEL version="1.0"
LABEL description="This is description"

# 执行命令并创建新的Image Layer，使用&&合并多条命令，使用\换行
RUN yum update && yum install -y vim \
    python-dev

# 设置容器启动时运行的命令；让容器以应用程序或者服务的形式运行；不会被忽略，一定会执行；可以运行一个shell脚本
COPY docker-entrypoint.sh /usr/local/bin
ENTRYPOINT ["docker-entrypoint.sh"]

# 设置容器启动后默认执行的命令和参数；如果docker run指定了其它命令，CMD忽略；如果定义了多个CMD，只有最后一个会执行
CMD echo "Hello docker!"

# 设定当前工作目录，没有会自动创建
WORKDIR /demo

# 添加本地文件到指定目录
COPY file /
# 添加本地文件到指定目录并解压缩
ADD file.tar /

# 设置常量
ENV MYSQL_VERSION 5.7
RUN apt-get install -y mysql-server="${MYSQL_VERSION}"

```

#### Shell 与 Exec 格式

- Shell 格式

```bash
RUN apt-get install -y vim
CMD echo "Hello Docker!"
ENV param Docker
ENTRYPOINT echo "Hello $name!"
```

- Exec 格式

```bash
RUN ["apt-get", "install", "-y", "vim"]
CMD ["/bin/echo", "Hello Docker!"]
ENV param Docker
ENTRYPOINT ["/bin/bash", "-c", "echo Hello $name!"]
```

### 发布 Docker 镜像

```shell
# 登录docker hub
docker login
# 上传docker image
docker [image] push [REPOSITORY:TAG]
# 拉取docker image
docker pull [REPOSITORY:TAG]
```

### Docker 网络

使用 Docker Network 可以实现容器间的网络连接和隔离。

![Docker Network](/img/microservice/DockerNetwork.png)

#### bridge

bridge 是 docker 默认的网络类型，通过 docker network inspect bridge 命令查看该网络的详细信息。
docker 启动后在 linux 宿主机上生成名为 docker0 的网桥，docker 容器通过 veth-pair 连接到 docker0 上，不同的 docker 网络因此能够通信。容器通过 docker0 进行 NAT 转换为 eth0 的地址，就能够访问外部网络
。
![Bridge Network](/img/microservice/BridgeNetwork.png)

#### 容器间 link

容器间可以通过 link 的方式相互依赖，被依赖容器的 name 可以当做容器的 host。

```shell
docker run -d --name os2 --link os1 [REPOSITORY]
```

#### 端口映射

```shell
# 建立指定端口的映射关系
docker run -d -p 80:80 nginx
# 建立随机端口映射关系
docker run -d -P nginx
```

#### Docker 数据持久化

- 基于本地文件系统的 Volume，容器启动时通过-v 参数将主机目录作为容器的数据卷。
- 基于 plugin 的 Volume，支持第三方的存储方案，比如 NAS，aws。

##### Volume 类型

- 受管理的 data Volume，由 docker 后台自动创建，名称显示不友好。
- 绑定挂载的 Volume，具体挂载位置由用户指定。

```shell
# 将mysql配置文件和数据目录挂载到指定文件和目录
docker run -d -e MYSQL_ROOT_PASSWORD=pass -e MYSQL_ROOT_HOST=% -p 3307:3306 -v d:/docker/mysql/conf/my.cnf:/etc/mysql/my.cnf -v d:/docker/mysql/data:/var/lib/mysql --name=mysql mysql:5.7
```

## Docker 常用命令

```shell
# 查看docker版本
docker version
# 查看docker image列表
docker image ls
docker images
# 删除Image
docker image rm [REPOSITORY] / [IMAGE ID]
docker rmi [REPOSITORY] / [IMAGE ID]
# 查看容器列表
docker ps [OPTIONS]
docker container ls
# 创建容器
docker build -t [NAME] [LOCATION]
# 查看Image分层
docker history [IMAGE ID]
# 运行Image
docker run [REPOSITORY]
# Container交互式运行
docker run -it [REPOSITORY]
# Container后台运行
docker run -d [REPOSITORY]
# 以指定NAME运行容器
docker run --name [REPOSITORY]
# 删除Container
docker container rm [CONTAINER ID]
docker rm [CONTAINER ID]
# 删除全部Container
docker rm $(docker ps -aq)
# 进入正在运行的容器
docker exec -it [CONTAINER ID] /bin/bash
# 停止正在运行的容器
docker stop [CONTAINER ID]
# 启动容器
docker start [CONTAINER ID]
# 在容器中修改配置，提交后成为新镜像
docker commit -m [MARK] [CONTAINER NAMES] [REPOSITORY]
# 查看docker网络
docker network inspect bridge
# 端口映射
docker run -d -p 80:80 [REPOSITORY]
# 查看容器端口隐射情况
docker port [OPTIONS] CONTAINER [PRIVATE_PORT[/PROTO]]
# 查看容器日志
docker logs [OPTIONS] CONTAINER
# 查看docker数据卷
docker volume ls
# 删除未使用数据卷
docker volume prune
# 查看docker文件系统
docker system df
# 清除docker缓存
docker system prune
# 目录挂载
docker run -d - v /var/logs:/var/lib/logs [REPOSITORY]
```

## 容器编排

多容器的应用启动仅靠手工输入命令是非常困难的，一方面需要根据具体需求创建不同版本、不同数量的容器，另一方面要管理这些容器。这就需要容器编排工具对容器管理实现批处理。

### docker-compose

docker-compose 是一个命令行工具，通过定义的 YAML 文件可以管理多个容器。

- services：一个 service 代表一个容器，这个容器可以使用 Docker Hub 的镜像来创建，也可以使用本地镜像创建。service 启动类似 docker run 命令，可以指定运行参数。
- networks：docker-compose 启动后会生成一个自定义网络。通过 networks 自定义网络，使得不同容器的网络相连接和隔离。
- volumes：定义挂载空间。

#### docker-compose 配置文件

```bash
version: '3'

services:
  zookeeper:
    image: zookeeper:3.4.13
    networks:
      # 定义连接网络
      - rpc-bridge

  redis:
    image: redis:latest
    command:
      # 持久化配置
      - "--appendonly yes"
    volumes:
      # 数据目录挂载
      - d:/docker/redis:/data
    networks:
      - component-bridge

  mysql:
    image: mysql:5.7
    environment:
      # 配置环境参数
      MYSQL_ROOT_PASSWORD: admin
      # 不限制host远程连接
      MYSQL_ROOT_HOST: "%"
    volumes:
      - d:/docker/mysql/data:/var/lib/mysql
      - d:/docker/mysql/conf/my.cnf:/etc/mysql/my.cnf
    networks:
      - data-bridge

  server:
    image: my-server:1.0
    links:
      # 关联服务
      - mysql
    command:
      - "--mysql.address=mysql:3306"
    networks:
      - rpc-bridge
      - data-bridge

  web:
    image: my-web:1.0
    links:
      - redis
      - zookeeper
      - server
    volumes:
      - d:/docker/app/logs/course-web:/var/app/logs/course-web
    command:
      - "--server.port=8080"
      - "--server.host=server"
      - "--redis.host=redis"
      - "--redis.port=6379"
      - "--registry.address=zookeeper:2181"
    networks:
      - rpc-bridge
      - component-bridge
      - net-bridge

  api-gateway:
    image: my-api-gateway:1.0
    links:
      - web
    command:
      - "--web.host=web"
      - "--web.port=8080"
    ports:
      # 映射宿主机端口
      - 80:80
    networks:
      - net-bridge

# 定义容器网络
networks:
  net-bridge:
    driver: bridge
  component-bridge:
    driver: bridge
  data-bridge:
    driver: bridge
  rpc-bridge:
    driver: bridge
```

#### docker-compose 命令

```bash
# 使用docker-compose后台启动容器
docker-compose -f [FILENAME] up -d
# 查看容器状态
docker-compose ps
# 停止并删除容器
docker-compose down
# 进入容器终端
docker-compose exec [SERVICE] bash
# 扩容/缩容
docker-compose up --scale [SERVICE]=[NUM] -d
```
