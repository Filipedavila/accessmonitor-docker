CREATE DATABASE IF NOT EXISTS observability;

CREATE TABLE IF NOT EXISTS observability.otel_metrics_gauge
(
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    ResourceSchemaUrl String CODEC(ZSTD(1)),
    ScopeName String CODEC(ZSTD(1)),
    ScopeVersion String CODEC(ZSTD(1)),
    ScopeAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    MetricName LowCardinality(String) CODEC(ZSTD(1)),
    MetricDescription String CODEC(ZSTD(1)),
    MetricUnit LowCardinality(String) CODEC(ZSTD(1)),
    Attributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    Timestamp DateTime64(9, 'UTC') CODEC(DoubleDelta, ZSTD(1)),
    Value Float64 CODEC(ZSTD(1)),
    Flags UInt32 CODEC(ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(Timestamp)
ORDER BY (MetricName, Timestamp)
TTL Timestamp + INTERVAL 30 DAY;


CREATE TABLE IF NOT EXISTS observability.otel_metrics_sum
(
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    ResourceSchemaUrl String CODEC(ZSTD(1)),
    ScopeName String CODEC(ZSTD(1)),
    ScopeVersion String CODEC(ZSTD(1)),
    ScopeAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    MetricName LowCardinality(String) CODEC(ZSTD(1)),
    MetricDescription String CODEC(ZSTD(1)),
    MetricUnit LowCardinality(String) CODEC(ZSTD(1)),
    Attributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    Timestamp DateTime64(9, 'UTC') CODEC(DoubleDelta, ZSTD(1)),
    Value Float64 CODEC(ZSTD(1)),
    Flags UInt32 CODEC(ZSTD(1)),
    AggregationTemporality Int32 CODEC(ZSTD(1)),
    IsMonotonic UInt8 CODEC(ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(Timestamp)
ORDER BY (MetricName, Timestamp)
TTL Timestamp + INTERVAL 30 DAY;


-- 3. Tabela para Métricas do tipo HISTOGRAM (ex: latência de requests)
CREATE TABLE IF NOT EXISTS observability.otel_metrics_histogram
(
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    ResourceSchemaUrl String CODEC(ZSTD(1)),
    ScopeName String CODEC(ZSTD(1)),
    ScopeVersion String CODEC(ZSTD(1)),
    ScopeAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    MetricName LowCardinality(String) CODEC(ZSTD(1)),
    MetricDescription String CODEC(ZSTD(1)),
    MetricUnit LowCardinality(String) CODEC(ZSTD(1)),
    Attributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    Timestamp DateTime64(9, 'UTC') CODEC(DoubleDelta, ZSTD(1)),
    Count UInt64 CODEC(ZSTD(1)),
    Sum Float64 CODEC(ZSTD(1)),
    BucketCounts Array(UInt64) CODEC(ZSTD(1)),
    ExplicitBounds Array(Float64) CODEC(ZSTD(1)),
    Flags UInt32 CODEC(ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(Timestamp)
ORDER BY (MetricName, Timestamp)
TTL Timestamp + INTERVAL 30 DAY;

-- 4. Tabela para Métricas do tipo SUMMARY (ex: percentis de latência de requests)

CREATE TABLE IF NOT EXISTS observability.otel_metrics_summary
(
    ResourceAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    ResourceSchemaUrl String CODEC(ZSTD(1)),
    ScopeName String CODEC(ZSTD(1)),
    ScopeVersion String CODEC(ZSTD(1)),
    ScopeAttributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    MetricName LowCardinality(String) CODEC(ZSTD(1)),
    MetricDescription String CODEC(ZSTD(1)),
    MetricUnit LowCardinality(String) CODEC(ZSTD(1)),
    Attributes Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    Timestamp DateTime64(9, 'UTC') CODEC(DoubleDelta, ZSTD(1)),
    Count UInt64 CODEC(ZSTD(1)),
    Sum Float64 CODEC(ZSTD(1)),
    QuantileValues Array(Float64) CODEC(ZSTD(1)),
    Flags UInt32 CODEC(ZSTD(1))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(Timestamp)
ORDER BY (MetricName, Timestamp)
TTL Timestamp + INTERVAL 30 DAY;



CREATE TABLE IF NOT EXISTS observability.accessmonitor_evaluations_log
(
    Timestamp DateTime64(9, 'UTC') CODEC(DoubleDelta, ZSTD(1)),
   
    ClientIp String CODEC(ZSTD(1)),
    OriginHeader String CODEC(ZSTD(1)),
    TargetUrl Nullable(String) CODEC(ZSTD(1)),
    TypeEvaluation LowCardinality(String) CODEC(ZSTD(1)),
    
    Status LowCardinality(String) CODEC(ZSTD(1)), -- 'success', 'failed', 'timeout'
    ErrorCode LowCardinality(String) CODEC(ZSTD(1)), -- ex: 'ERR_CONNECTION_REFUSED', 'TIMEOUT'
    DurationMs UInt32 CODEC(ZSTD(1)),
    
)
ENGINE = MergeTree()
PARTITION BY toYear(Timestamp)
ORDER BY (Status, TargetUrl, Timestamp);