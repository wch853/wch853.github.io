---
sidebarDepth: 2
date: 2019-12-14
desc: Elasticsearch Search API。
tags: Elasticsearch
---

# Elasticsearch（二）：SearchAPI

## URI Search

`URI Search` 通过 `url query` 参数来实现搜索。

- `q` 参数指定查询语句，如果不指定字段，会查询所有字段。
- `df` 参数指定 `q` 中不指定字段时默认查询的字段。
- `sort` 参数用于排序。
- `from`、`size` 参数用于分页。
- `timeout` 参数用于指定超时时间。

### term 与 phrase

`term` 查询指定单词，`q=alfred way` 等效于 `q=alfred OR way`。

`phrase` 查询指定词语，要求按先后顺序，`q="alfred way"`。

### 泛查询

泛查询即在 `q` 语句中不指定查询字段，等效于在所有字段匹配。

### 指定字段

通过 `:` 分隔的形式指定字段查询，如 `term:value`。

### 分组查询

通过 `()` 来分组查询，括号内的查询具有更高优先级。

### 布尔操作符

- `AND`：且
- `OR`：或
- `NOT`：非
- `+`：对应 `must`，即必须包含的内容
- `-`：对应 `must_not`，即必须不包含的内容

### 范围查询

- `[]`：开区间查询，`term:[1 TO 10]` 等效于 `1<=term<=10`
- `{}`：闭区间查询，`term:{1 TO 10}` 等效于 `1<term<10`

### 通配符查询

- `?`：通配任意字符。
- `*`：通配任意多个字符。

### 模糊匹配

通过 `~` 来指定模糊查询。

## Request Body Search

`Request Body Search` 是将查询语句通过 `http request body` 发送到 `es` 的查询方式。

### 字段类查询

字段类查询主要包括以下两类：

- 全文匹配：针对 `text` 类型的字段进行全文检索，会对查询语句先进行分词处理，如 `match`、`match_phrase` 等类型。
- 单词查询：不会对查询语句做分词处理，直接去匹配字段的倒排索引，如 `term`、`terms`、`range` 等类型。

### match

`match` 查询首先会对查询语句进行分词，随后查询相关字段的倒排索引进行匹配算分，汇总得分后根据得分排序返回匹配的文档。

```js
GET /test/_search
{
  "query": {
    "match": {
      "user": "alfred"
    }
  }
}
```

`match` 查询还提供其它参数控制查询：

```js
GET /test/_search
{
  "query": {
    "match": {
      "user": {
        "query": "alfred way",
        "operator": "or",
        "minimum_should_match": 1
      }
    }
  }
}
```

- `operator`：指定分词后查询关系是且还是或，可选 `and`、`or`。
- `minimum_should_match`：指定召回文档最少匹配的词数。

### match_phrase

`match_phrase` 用于按顺序检索字段：

```js
GET /test/_search
{
  "query": {
    "match_phrase": {
      "job": "junior engineer"
    }
  }
}
```

通过 `slop` 参数可以控制字段之间的间隔：

```js
GET /test/_search
{
  "query": {
    "match_phrase": {
      "job": {
        "query": "java engineer",
        "slop": 1
      }
    }
  }
}
```

### query_string

`query_string` 类似 `URI Search` 中的 `q` 查询，查询语句放在 `query` 参数中，可以通过 `default_field`、`fields` 参数来指定检索的字段。

```js
GET /test/_search
{
  "query": {
    "query_string": {
      "default_field": "job",
      "query": "junior engineer"
    }
  }
}
```

### simple_query_string

`simple_query_string` 的用法与 `query_string` 类似，区别在于 `simple_query_string` 仅能通过 `fields` 参数来指定检索字段，并且 `AND`、`OR`、`NOT` 等关键词在 `query` 中会被解析为字段，需要用 `+`、`|`、`-` 来代替。

```js
GET /test/_search
{
  "query": {
    "simple_query_string": {
      "fields": [
        "job"
      ],
      "query": "junior engineer"
    }
  }
}
```

### term

`term` 查询不会对查询语句进行分词：

```js
GET /test/_search
{
  "query": {
    "term": {
      "job": {
        "value": "engineer"
      }
    }
  }
}
```

使用 `terms` 查询可以指定多值 `term` 查询：

```js
GET /test/_search
{
  "query": {
    "terms": {
      "job": [
        "engineer",
        "java"
      ]
    }
  }
}
```

### range

`range` 查询主要针对数值或日期进行范围查询：

```js
GET /test/_search
{
  "query": {
    "range": {
      "age": {
        "gte": 20,
        "lte": 30
      }
    }
  }
}
```

对于日期的范围查询，支持使用 `Date Math` 简化查询：

```js
GET /test/_search
{
  "query": {
    "range": {
      "birth": {
        "gte": "now-25y",
        "lte": "2000-01-01||-1d"
      }
    }
  }
}
```

### bool

`bool` 查询由一个或多个布尔查询组成。

- `filter`：仅通过过滤获得符合条件的文档，不会进行相关性算分。`es` 针对 `filter` 有智能缓存，因此执行效率很高。做简单匹配查询不考虑算分时，推荐使用 `filter` 替代`query` 等。
- `must`：不仅通过过滤获得符合条件的文档，还会累加各个子查询的相关性得分作为文档得分。
- `must_not`：过滤符合条件的文档，不会影响得分。
- `should`：会对符合条件的文档进行加分，提供 `minimum_should_match` 参数限制需要匹配的最小数量。

```js
GET /test/_search
{
  "query": {
    "bool": {
      "filter": {
        "term": {
          "job": "engineer"
        }
      },
      "must": [
        {
          "term": {
            "job": {
              "value": "java"
            }
          }
        }
      ],
      "must_not": [
        {
          "term": {
            "job": {
              "value": "senior"
            }
          }
        }
      ],
      "should": [
        {
          "term": {
            "user": {
              "value": "wch"
            }
          }
        },
        {
          "term": {
            "job": {
              "value": "engineer"
            }
          }
        }
      ],
      "minimum_should_match": 1
    }
  }
}
```

### _count

`_count` 端点用于查询查询语句命中的文档数：

```js
GET /test/_count
```

### _source

`_source` 参数用于指定召回文档的哪些字段。

```js
GET /test/_search
{
  "_source": "user"
}
```
