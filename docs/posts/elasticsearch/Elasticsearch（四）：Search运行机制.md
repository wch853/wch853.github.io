---
sidebarDepth: 2
date: 2019-12-21
desc: Elasticsearch Search 运行机制。
tags: Elasticsearch
---

# Elasticsearch（四）：Search运行机制

## Search 执行

`Search` 执行时分为 `Query` 和 `Fetch` 两个阶段。

### Query 阶段

- `coordinating node` 接受请求后在所有主副分片中随机选择 `shard` 数个分片发送 `search` 请求。

- 被选中的分片会分别执行请求并排序，返回 `from + size` 个文档 `id` 和排序值给 `coordinating node`。

### Fetch 阶段

- `coordinating node` 获取到文档 `id` 后向相关分片发送 `multi_get` 请求。
- 各分片返回文档给 `coordinating node`。
- `coordinating node` 将排序和分页后的结果返回给客户端。

## 相关性算分

`es` 的每个 `shard` 对应一个 `lucene index`，即一个独立的算分单位。当设置多个分片时，查询的文档在不同分片上会分别计算相关性得分，可能会导致最终的得分是不准的。`es` 提供参数 `search_type=dfs_query_then_fetch` 使得 `es` 能够在获得所有文档后重新计算相关性得分，此种方式会消耗较多 `cpu` 和内存。

```js
GET /test/_search?search_type=dfs_query_then_fetch
```

## 排序

`sort` 参数用于指定排序的字段和方式。`_doc` 排序使用文档内部 `id`，即使用索引顺序作为排序规则。

```js
GET /test/_search
{
  "sort": [
    {
      "age": {
        "order": "desc"
      }
    },
    {
      "_doc": {
        "order": "desc"
      }
    }
  ]
}
```

### doc values 与 fielddata

`es` 不允许直接对 `text` 类型字段进行排序。由于排序是使用的是文档内容，无法用到倒排索引，而是需要通过文档 `id` 获取文档字段的原始内容。`es` 对此提供两种实现方式

#### doc values

`es` 中除了 `text` 字段（不支持）都默认开启了`doc values`，其在写入文档时与倒排索引一起生成并写入磁盘，其结构为文档 `id` 到文档指定字段的 `value`。这样在聚合分析时就不会占用内存，但是索引时会减慢索引的速度，占用额外的磁盘资源。如果一个字段明确不会被聚合分析，可以在 `mapping` 中通过 ` doc_values ` 参数关闭：

```js
PUT /test
{
  "mappings": {
    "properties": {
      "hobby": {
        "type": "keyword",
        "doc_values": false
      }
    }
  }
}
```

#### fielddata

`doc values` 是不支持对 `text` 类型使用的，如果需要对能够分词的 `text` 类型进行排序，就需要使用 `fielddata`。`fielddata` 在搜索时于内存中创建，其不会额外占用磁盘资源，但是当文档较多时即时创建会花费过多时间、占用较多内存。`fielddata` 默认时关闭的，可以通过修改 `mapping` 的 `fielddata` 参数使得字段的 `fielddata` 特性立即可用：

```js
PUT /test
{
  "mappings": {
    "properties": {
      "hobby": {
        "type": "text",
        "fielddata": true
      }
    }
  }
}
```

使用 `fielddata` 不代表能够真正对 `text` 类型的值进行排序，其结果为文档 `id` 到每个分词，即仅支持对分词结果的一部分进行排序。

```js
GET /test/_search
{
  "sort": [
    {
      "hobby": {
        "order": "desc"
      }
    }
  ]
}

// ...
    "hits" : [
      {
        "_index" : "test2",
        "_type" : "_doc",
        "_id" : "myi4Bm8BVyg6ro4E7nPl",
        "_score" : null,
        "_source" : {
          "hobby" : "play games"
        },
        "sort" : [
          "play"
        ]
      }
    ]
// ...
```

`fielddata` 会首先对分词结果进行排序，来选择用作文档排序的词，召回结果中会通过 `sort` 字段说明用作排序的词。

#### docvalues_fields

使用 `docvalue_fields` 参数可以指定召回 `fielddata` 或 `doc values` 存储的值：

```js
GET /test2/_search
{
  "docvalue_fields": [
    "hobby"
  ]
}

// ...
    "hits" : [
      {
        "_index" : "test2",
        "_type" : "_doc",
        "_id" : "myi4Bm8BVyg6ro4E7nPl",
        "_score" : 1.0,
        "_source" : {
          "hobby" : "play games"
        },
        "fields" : {
          "hobby" : [
            "games",
            "play"
          ]
        }
      }
    ]
// ...
```

## 深度分页

`es` 提供 `from`、`size` 来指定分页，但是每次执行分页并非直接获取 `size` 个数据，而是从每个分片获取 `from+size` 个数据后再排序选取。页数越深，占用的内存越多，耗时越长。`es` 通过 `index.max_result_window` 限定最多取 `10000` 数据。

### scroll

`es` 提供 `scroll` 用来生成数据快照。当使用 `scroll` 请求返回单页结果时，可以检索出大量结果（甚至全部）生成快照。请求结果返回 `_scroll_id` 是进行下一页查询的参数，通过 `scroll` 可以完成对快照的遍历。

指定使用 `scroll` 即其保留的时间，如 `1m` 代表快照保留一分钟。

```js
GET /test/_search?scroll=1m
{
  "size": 2
}

{
  "_scroll_id" : "DXF1ZXJ5QW5kRmV0Y2gBAAAAAAAB_2MWbmFUODhqSGVRZldTQzk4OTRQaUVvdw==",
// ...
}
```

使用返回的 `_scroll_id` 作为参数进行下一次迭代，直到返回的结果为空：

```js
GET /_search/scroll
{
  "scroll": "1m",
  "scroll_id" : "DXF1ZXJ5QW5kRmV0Y2gBAAAAAAAB_2MWbmFUODhqSGVRZldTQzk4OTRQaUVvdw=="
}
```

`scroll` 生成的是一份数据快照，因此不能用作实时搜索，尽量只使用 `_doc` 排序的方式。`scroll` 会占用内存，可以选择删除 `scroll`：

```js
// 指定删除 scroll
DELETE /_search/scroll
{
  "scroll_id" : "DXF1ZXJ5QW5kRmV0Y2gBAAAAAAACABAWbmFUODhqSGVRZldTQzk4OTRQaUVvdw=="
}

// 删除所有 scroll
DELETE /_search/scroll/_all
```

### search after

`search after` 是通过前次查询指定的排序值对当前查询进行定位，使得各分片返回的文档数控制在 `size` 个内。`search after` 是实时的，使用的排序值必须能够唯一排序定位，不支持通过 `from` 参数指定查询页数，并且只能往后翻页。

```js
GET /test/_search
{
  "size": 1,
  "sort": [
    {
      "_id": {
        "order": "desc"
      }
    }
  ]
}

// ...
    "hits" : [
		// ...
        "sort" : [
          "rCdxA28BVyg6ro4EWU8p"
        ]
// ...
```

使用上次返回结果的排序定位值指定 `search_after` 参数：

```js
GET /test/_search
{
  "size": 1,
  "sort": [
    {
      "_id": {
        "order": "desc"
      }
    }
  ],
  "search_after": [
    "rCdxA28BVyg6ro4EWU8p"
  ]
}
```
