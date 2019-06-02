# Apache Storm
[Apache Storm](http://storm.apache.org) 是一个开源分布式实时计算系统，能够实现高频数据和大规模数据的实时处理。
其应用场景包括：
- 实时数据分析
- 在线机器学习
- 持续性计算
- 分布式RPC
- ETL(Extract-Transform-Load)

Storm的特点：
- 计算速度快：单节点每秒可处理百万条数据
- 可扩展
- 容错
- 保证数据都能被处理
- 易于设置和操作
## Storm 和 Hadoop 的区别

| | Storm | Hadoop | Spark Streaming
| --- | --- | --- | ---
| 处理领域 | 实时计算 | 批处理计算 | 时间窗口计算
| 数据处理方式 | 内存级计算 | 磁盘级计算 | 内存级计算
| 处理过程 | 用户定义处理流程 | Map到Reduce |
| 是否结束 | 没有结束状态 | 到最后一定要结束 | 
| 处理速度 |只处理增加的数据，速度快 | 为了处理大量数据，速度慢 | 
| 适用场景 | 处理新增数据，时效性要求高 | 处理一批数据，对时效性要求不高 | 

## Storm 核心概念
- `Topologies`：拓扑，串起整个流程
- `Streams`：数据流
- `Spouts`：数据产生源
- `Bolts`：数据处理器
- `Tuple`：数据
Stream groupings
Reliability
Tasks
Workers