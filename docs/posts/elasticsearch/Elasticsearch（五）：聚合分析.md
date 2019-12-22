---
sidebarDepth: 2
date: 2019-12-22
desc: Elasticsearch Search 聚合分析。
tags: Elasticsearch
---

# Elasticsearch（五）：聚合分析

`es` 中的聚合分析主要分为：

- `metric`：指标分析类型，如最值、平均值等等。
- `bucket`：分桶类型，类似 `group by`。
- `pipeline`：管道分析，基于上一级聚合分析结果进行再分析。

## metric

### min / max / sum / avg

`min / max / sum / avg` 分别用于统计最小值、最大值、求和、平均值：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "min_age": {
      "min": {
        "field": "age"
      }
    },
    "max_age": {
      "max": {
        "field": "age"
      }
    },
    "sum_age": {
      "sum": {
        "field": "age"
      }
    },
    "avg_age": {
      "avg": {
        "field": "age"
      }
    }
  }
}
```

### cardinality

`cardinality` 用于获取字段不同数值的个数，即 `distinct count`：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "cardinality_age": {
      "cardinality": {
        "field": "age"
      }
    }
  }
}
```

### stats

`stats` 用于统计一系列指标，包括 `min / max / sum / avg / count`：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "stats_age": {
      "stats": {
        "field": "age"
      }
    }
  }
}
```

### extended_stats

`extended_stats` 相对于 `stats` 提供更多指标，如方差、标准差等：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "stats_age": {
      "extended_stats": {
        "field": "age"
      }
    }
  }
}
```

### percentiles

`percentiles` 用于百分位统计，默认统计 `1,5,25,50,75,95,99` 分位点，通过 `percents` 参数可以指定要计算的分位点：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "percentiles_age": {
      "percentiles": {
        "field": "age",
        "percents": [
          50,
          75,
          95,
          99
        ]
      }
    }
  }
}
```

### percentile_ranks

`percentile_ranks` 用于获取指定数值对应的分位点，通过 `values` 参数指定：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "percentiles_ranks_age": {
      "percentile_ranks": {
        "field": "age",
        "values": [
          19
        ]
      }
    }
  }
}
```

## bucket

### term

`term` 指按词分桶，结果中的 `buckets` 会给出统计出的不同词及对应的文档个数。

```js
GET /test/_search
{
  "size": 0, 
  "aggs": {
    "job": {
      "terms": {
        "field": "job.keyword",
        "size": 10
      }
    }
  }
}

// ...
  "aggregations" : {
    "job" : {
      "doc_count_error_upper_bound" : 0,
      "sum_other_doc_count" : 0,
      "buckets" : [
        {
          "key" : "c++",
          "doc_count" : 2
        },
        {
          "key" : "Java junior engineer",
          "doc_count" : 1
        },
        {
          "key" : "c",
          "doc_count" : 1
        },
        {
          "key" : "js",
          "doc_count" : 1
        }
      ]
    }
  }
// ..
```

通过使用 `top_hits` 能够额外获取每个桶中对应的文档内容，支持排序：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "job": {
      "terms": {
        "field": "job.keyword",
        "size": 10
      },
      "aggs": {
        "top": {
          "top_hits": {
            "size": 10,
            "sort": [
              "birth"
            ]
          }
        }
      }
    }
  }
}
```

### range

`range` 指定数值范围来设定分桶规则，支持使用 `key` 参数指定聚合结果名称：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "age_range": {
      "range": {
        "field": "age",
        "ranges": [
          {
            "key": "lt 20",
            "to": 20
          },
          {
            "from": 20,
            "to": 30
          },
          {
            "key": "gt 30",
            "from": 30
          }
        ]
      }
    }
  }
}
```

`range` 同样支持日期类的范围统计，通过 `format` 参数指定返回的日期格式：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "birth_range": {
      "range": {
        "field": "birth",
        "format": "yyyy",
        "ranges": [
          {
            "to": 1990
          },
          {
            "from": 1990,
            "to": 2000
          },
          {
            "from": 2000
          }
        ]
      }
    }
  }
}
```

### historgram

`historgram` 用以指定间隔分隔数据，`interval` 参数指定间隔大小，`extended_bounds` 参数指定间隔分隔的范围：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "age_histogram": {
      "histogram": {
        "field": "age",
        "interval": 5,
        "extended_bounds": {
          "min": 0,
          "max": 100
        }
      }
    }
  }
}
```

### date_histogram

`date_histogram` 是针对日期间隔的统计：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "birth_date_histogram": {
      "date_histogram": {
        "field": "birth",
        "calendar_interval": "year",
        "format": "yyyy"
      }
    }
  }
}
```

## pipeline

`pipeline` 针对聚合统计结果进行再分析，通过 `buckets_path` 参数指定需要再分析的指标：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "job": {
      "terms": {
        "field": "job.keyword",
        "size": 10
      },
      "aggs": {
        "avg_age": {
          "avg": {
            "field": "age"
          }
        }
      }
    },
    "max_avg_age_by_job": {
      "max_bucket": {
        "buckets_path": "job>avg_age"
      }
    }
  }
}
```

## 作用范围

聚合分析默认作用范围是 `query` 查询语句的结果集，`es` 提供一系列方式改变聚合分析的作用范围。

### 为某个聚合分析设定过滤条件

先使用 `filter` 指定当前聚合分析的过滤条件，在子查询中输入真正的聚合语句：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "age_over20_job": {
      "filter": {
        "range": {
          "age": {
            "gte": 20
          }
        }
      },
      "aggs": {
        "job": {
          "terms": {
            "field": "job.keyword",
            "size": 10
          }
        }
      }
    }
  }
}
```

### 聚合分析后过滤

如果需要在聚合分析出全部结果后控制返回的文档结果，可以使用 `post_filter` 来做过滤。

```js
GET /test/_search
{
  "size": 10,
  "aggs": {
    "job": {
      "terms": {
        "field": "job.keyword",
        "size": 10
      }
    }
  },
  "post_filter": {
    "match": {
      "age": "18"
    }
  }
}
```

### 忽略 query

如果需要忽略 `query` 对聚合分析的影响，通过 `global` 参数指定无视 `query` 过滤条件，基于全部文档进行分析，并在子查询中输入真正的聚合语句。

```js
GET /test/_search
{
  "query": {
    "match": {
      "job.keyword": "js"
    }
  }, 
  "size": 10,
  "aggs": {
    "all": {
      "global": {},
      "aggs": {
        "job": {
          "terms": {
            "field": "job.keyword",
            "size": 10
          }
        }
      }
    }
  }
}
```

## 排序

聚合分析中的排序默认是按各统计结果的数量倒序排序的，同时可以指定子查询结果作为排序依据：

```js
GET /test/_search
{
  "size": 0,
  "aggs": {
    "job": {
      "terms": {
        "field": "job.keyword",
        "size": 10,
        "order": {
          "avg_age": "asc"
        }
      },
      "aggs": {
        "avg_age": {
          "avg": {
            "field": "age"
          }
        }
      }
    }
  }
}
```

## 聚合精准度问题

对于 `terms` 类型的聚合，每个分片会按数量倒序排序后返回前 `size` 个结果，在整合时可能会导致不准确。聚合分析结果有两个指标说明潜在的遗漏问题：

- `doc_count_error_upper_bound`：各分片被遗漏的 `term` 的最大值的总和。
- `sum_other_doc_count`：各分片返回的未被最终结果使用的其它聚合统计总数。

### shard_size

`shard_size` 参数用于指定分片实际返回的统计指标数量，默认为 `size * 1.5 + 10`。通过调整 `shard_size` 可以尽量减小聚合统计的误差。
