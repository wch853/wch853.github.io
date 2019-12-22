---
sidebarDepth: 2
date: 2019-12-08
desc: Elasticsearch 概念与基本API。
tags: Elasticsearch
---

# Elasticsearch（一）：概念与基本API

## 安装 Elasticsearch

```bash
# 创建 es 网络
docker network create es
# 启动单点 es
docker run -d --name elasticsearch --net es -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" --restart=always elasticsearch:7.4.2
# 启动 kibana
docker run -d --name kibana --net es -p 5601:5601 --restart=always kibana:7.4.2
# 启动 es 集群监控工具 cerebro
docker run -d --name cerebro -p 9000:9000 --restart=always lmenezes/cerebro
```

## 常用 API

### index

```js
// 创建索引
PUT /test
// 查看已有索引
GET /_cat/indices
// 删除索引
DELETE test
```

### Document

```js
// 指定 id 创建文档
PUT /test/_doc/1
{
  "username": "wch"
}

// 不指定 id 创建文档
POST /test/_doc
{
  "username": "wch"
}

// 查询指定文档
GET /test/_doc/1

// 查询所有文档
GET /test/_search
{
  "query": {
    "term": {
      "_id": {
        "value": "1"
      }
    }
  }
}

// 删除指定文档
DELETE /test/_doc/1

// 批量执行
POST _bulk
{"index":{"_index":"test"}}	
{"username":"123"}	// 指定索引新增
{"delete":{"_index":"test","_id":"wAKA5G4B6QyCVohhC0Yn"}}	// 指定索引删除
{"update":{"_index":"test","_id":"1"}}
{"doc":{"username":"wch1"}}	// 指定索引更新

// 指定 index、id 批量查询
GET /_mget
{
  "docs": [
    {
      "_index": "test",
      "_id": 1
    },
    {
      "_index": "test",
      "_id": 2
    }
  ]
}
```

## 倒排索引与分词

### 倒排索引

#### 倒排索引与正排索引

- 正排索引：从文档 `id` 到文档内容单词的关联关系。
- 倒排索引：从单词到文档 `id` 的关联关系。

#### 倒排索引组成

- 单词词典：记录文档单词和单词到倒排列表的关联信息。
- 倒排列表：记录了单词对应的文档集合，由倒排索引项组成。倒排索引项包括文档 `id`、单词词频、单词位置、单词偏移。

### 分词

分词是指将文本转换成一系列单词的过程，也可以叫做文本分析。

#### 分词器组成

- `Character Filters`：针对原始文本做预处理，如去增加、删除、替换字符等。
- `Tokenizer`：将原始文本按照一定规则切分为单词。
- `Token Filters`：针对切分单词再加工，如转小写、删除或新增等处理。

#### 验证分词

```js
// 指定分词器验证分词
GET /_analyze
{
  "analyzer": "standard",
  "text": [
    "Hello World"
  ]
}

// 指定索引、文档字段验证分词
GET /test/_analyze
{
  "field": "username",
  "text": "Hello World"
}
```

#### 自带分词器

##### standard

默认分词器，按词切分，支持多语言，小写处理。

##### simple

按照非字母切分，小写处理。

##### whitespace

按空格切分。

##### stop

按照非字母切分，小写处理，去除停用词。

##### keyword

不分词，直接作为一个单词输出。

##### pattern

通过正则表达式（默认为 `\W+`）切分，小写处理。

## mapping

`mapping` 类似数据库中的表结构定义，主要作用为：

- 定义索引字段名
- 定义索引字段类型
- 定义倒排索引相关配置，如是否索引、索引配置等

`mapping` 中的字段类型禁止直接修改（`lucene` 实现的倒排索引生成后不允许修改），如果修改需要建立新的索引，然后做 `reindex` 操作。

### mapping 配置

```js
PUT /test
{
  "mappings": {
    "dynamic": "true",
    "properties": {
      "name": {
        "type": "text",
        "fields": {
          "pinyin": {
            "type": "keyword",
            "analyzer": "pinyin"
          }
        }
      },
      "age": {
        "type": "integer",
        "null_value": 0
      },
      "desc": {
        "type": "keyword",
        "index": false
      },
      "address": {
        "type": "text",
        "index_options": "positions"
      }
    }
  }
}
```

#### dynamic

`mapping` 中的 `dynamic` 参数用来控制字段的新增：

- `true`：默认配置，允许字段新增。
- `false`：不允许字段新增字段，但是文档可以正常写入，但无法对字段进行查询等操作。
- `strict`：文档不允许写入新字段，强行写入会抛出异常。

#### properties

`properties` 参数用来定义各个具体的字段。

#### index

`index` 参数用于控制字段是否索引。

#### index_options

`index_options` 用于控制倒排索引记录内容：

- `docs`：仅记录 `doc id`。
- `freqs`：记录 `doc id` 和 `term frequencies`。
- `positions`：记录 `doc id`、`term frequencies` 和 `term position`。
- `offsets`：记录 `doc id`、`term frequencies`、`term position` 和 `character offsets`。

`text` 类型默认为 `positions`，其它默认为 `docs`。选择记录的内容越多，占用空间越大。

#### null_value

`null_value` 字段用于指定字段为 `null` 时的处理策略，默认 `es` 会忽略该字段。可以通过该值来设定字段的默认值。

#### multi-fields

`es` 允许对一个字段采用不同的配置，只需要在字段配置中增加 `fields` 参数，成为当前字段的子字段。

### dynamic mapping

如果 `mapping` 配置允许直接写入新字段，`es` 会对新字段的类型进行推测并写入 `mapping`。推测是基于 `json` 类型的：

| JSON 类型 | Elasticsearch 类型                                           |
| --------- | ------------------------------------------------------------ |
| null      | 忽略                                                         |
| boolean   | boolean                                                      |
| float     | float                                                        |
| integer   | long                                                         |
| object    | object                                                       |
| array     | 基于数组第一个非 `null` 值的类型                             |
| string    | 会对日期、浮点、整型做推断，否则设置为 `text` 类型并包含 `keyword` 子字段 |

### dynamic templates

通过定义 `dynamic templates` 可以介入 `dynamic mapping` 的映射逻辑，

```js
PUT /test
{
  "mappings": {
    "dynamic_templates": [
      {
        "string_as_keyword": {
          "match_mapping_type": "string",
          "mapping": {
            "type": "keyword"
          }
        }
      }
    ]
  }
}
```

`match_mapping_type` 参数对应推断出来的 `json` 类型，当写入字段匹配到该类型，会自动转为配置的类型。

