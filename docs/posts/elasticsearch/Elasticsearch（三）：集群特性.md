---
sidebarDepth: 2
date: 2019-12-15
desc: Elasticsearch 集群特性。
tags: Elasticsearch
---

# Elasticsearch（三）：集群特性

## cluster state

`es` 集群相关的数据称为 `cluster state`，主要记录：

- 节点信息，如节点名称、连接地址等。
- 索引信息，如索引名称、配置等。

能够修改 `cluster state` 的节点称为 `master` 节点，`master` 节点维护 `cluster state` 并将最新版本的数据同步给其它结点。`master` 节点是通过选举产生的，可以被选举的节点称为 `master-eligible` 节点。

## coordinating node

处理请求的节点即为 `coordinating node`，是所有节点的默认角色，不可取消。`coordinating node` 负责路由请求到正确的节点处理。

## data node

存储数据的节点即为 `data node`，默认节点均为 `data node`。

## 副本

`es` 引入副本（`replica`）提高了服务可用性和数据可用性，创建索引时使用 `number_of_replicas` 参数指定副本数。

- 应对部分节点停止服务问题。
- 在不同节点上进行数据备份。

## 分片

- 通过分片（`shard`）使得数据可以进行拆分，分布在任意节点上。创建索引时使用 `number_of_shards` 参数指定分片数。
- 分片是 `es` 支持 `PB` 级数据的基石。
- 分片数在索引创建时指定并且后续不允许修改。
- 分片有主分片和副本分片之分，副本分片的数据由主分片同步。副本分片可以有多个，用以提高吞吐量。

```js
PUT /test
{
  "settings": {
    "number_of_shards": 5, 
    "number_of_replicas": 3
  }
}
```

## cluster health

通过 `GET /_cluster/health` 可以查看 `es` 集群状态，包括以下三种：

- `green`：健康状态，所有主副分片都正常分配。
- `yello`：所有主分片都分配正常，但有副本分片未正常分配。
- `red`：有主分片未分配完成。

## 故障转移

非 `master` 节点会不停查看 `mater` 节点的状态，如果发现 `master` 节点无法提供服务，会重新选举 `master` 节点，选举规则为当前集群可选举结点数大于 `quorom` 时才可以选举，`quorom = 所有可选举结点数 / 2 + 1`。

## 分布式存储

`coordinating node` 收到请求后会通过文档映射算法用文档 `id` 计算文档所在的分片，如果是查询请求会获取该分片的主副分片列表，然后以轮询的机制到某个分片上执行查询，然后将结果返回给 `coordinating node`；如果是写入请求，在计算文档的分片后会将写入请求转发给主分片，主分片成功执行后会将请求转发给副本分片，主分片收到副本分片返回结果后通知 `coordinating node`。

## 倒排索引不可变特性

倒排索引一旦生成，不能修改，好处如下：

- 不用考虑并发写文件的问题，杜绝了锁机制带来的性能问题。
- 由于文件不再更改，可以充分利用文件系统缓存，只需载入一次，在内存足够的情况下对该文件的读取都会从内存读取，性能更高。
- 利于生成缓存数据。
- 利于对文件进行压缩存储，节省磁盘和内存存储空间。

## 倒排索引维护

`lucene` 针对倒排索引不可变问题的解决方案是生成新的倒排索引文件，查询时同时查询所有的倒排索引文件，然后汇总结果。这样构建的单个倒排索引称为 `segment`，专门记录 `segment` 信息的文件称为 `commit point`，`segment` 和 `commit point` 构成了 `lucene index`。

### refresh

`segement` 写入磁盘的过程耗时较长，可以借助文件系统的缓存特性，先将 `segement` 在缓存中创建并开放查询来进一步提升实时性。该过程在 `es` 中称为 `refresh`。

### index buffer

在 `refresh` 之前文档会先存储在一个内存 `buffer` 中，`refresh` 时将 `buffer` 中的所有文档清空并在内存中生成 `segment`。由于 `index buffer` 的存在，`refresh` 可以等待一段时间来生成 `segement`，`es` 默认每 `1` 秒执行一次 `refresh`，这就是 `近实时` 的由来。

 ### translog

`translog` 机制是为了应对内存中的 `index buffer` 或 `segement` 还未写进磁盘时发生宕机等事故导致数据丢失的问题。

- 当变更写入 `buffer` 时 `es` 会将操作同步写入 `translog`，`translog` 文件会即时写入磁盘（通过 `fsync`）。
- `es` 启动时会检查 `translog` 文件，并从中恢复数据。

### flush

`flush` 负责将内存中的 `segment` 写入磁盘：

- 将 `translog` 写入磁盘。
- 将 `index buffer` 清空，其中的文档生成一个新的 `segement`，相当于 `refresh` 操作。
- 执行 `fsync`，将内存中的 `segement` 写入磁盘。
- 更新 `commit point` 文件，记录新增的 `segment`。
- 删除旧的 `translog` 文件。

`flush` 默认间隔时间是 `30` 分钟，当 `translog` 超过一定大小时也会触发 `flush`。

### 删除文档

`lucene` 专门维护了一个 `.del` 文件，记录已删除的文档（文档在 `lucene` 内部的 `id`），查询时会通过 `.del` 文件进行过滤。更新文档也是通过先删除文档再创建新的文档来实现的。

### segment merging

随着 `segment` 的增多，`es` 会定期在后台执行合并操作来减少 `segment` 的数量。通过 `force_merge` 可以手动强制做 `segement merge` 操作。 
