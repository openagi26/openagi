# OpenAGI 数据库 Schema v1.0

---

## SQLite 表结构（`openagi.db`）

### sessions — 会话表
```sql
CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,          -- UUID
    title       TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,             -- ISO8601
    updated_at  TEXT NOT NULL,
    model       TEXT,
    core_count  INTEGER DEFAULT 2,
    archived    INTEGER DEFAULT 0
);
```

### messages — 消息表
```sql
CREATE TABLE messages (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES sessions(id),
    role        TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
    content     TEXT NOT NULL,
    tokens      INTEGER DEFAULT 0,
    model       TEXT,
    created_at  TEXT NOT NULL
);
CREATE INDEX idx_messages_session ON messages(session_id, created_at);
```

### memory_archive — L2冷记忆
```sql
CREATE TABLE memory_archive (
    id          TEXT PRIMARY KEY,
    session_id  TEXT,
    content     TEXT NOT NULL,
    summary     TEXT,
    tags        TEXT,              -- JSON数组
    importance  REAL DEFAULT 0.5,
    created_at  TEXT NOT NULL,
    archived_at TEXT NOT NULL
);
```

### core_dna — L3 DNA
```sql
CREATE TABLE core_dna (
    id          TEXT PRIMARY KEY,
    key         TEXT NOT NULL UNIQUE,   -- DNA条目名称
    value       TEXT NOT NULL,          -- 内容
    category    TEXT DEFAULT 'general', -- identity/values/skills/preferences
    immutable   INTEGER DEFAULT 0,      -- 1=永不修改
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
```

### skills — 已安装技能
```sql
CREATE TABLE skills (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    input_schema    TEXT,           -- JSON Schema
    output_schema   TEXT,           -- JSON Schema
    permission      TEXT DEFAULT 'L0',
    version         TEXT DEFAULT '1.0.0',
    priority_score  REAL DEFAULT 0.5,
    installed_at    TEXT NOT NULL,
    source          TEXT DEFAULT 'local'
);
```

### token_usage — Token用量
```sql
CREATE TABLE token_usage (
    id          TEXT PRIMARY KEY,
    date        TEXT NOT NULL,      -- YYYY-MM-DD
    model       TEXT NOT NULL,
    input_tok   INTEGER DEFAULT 0,
    output_tok  INTEGER DEFAULT 0,
    cost_usd    REAL DEFAULT 0.0
);
CREATE INDEX idx_usage_date ON token_usage(date);
```

### heart_log — 心绪事件日志
```sql
CREATE TABLE heart_log (
    id          TEXT PRIMARY KEY,
    event_type  TEXT NOT NULL,
    entropy_before REAL,
    entropy_after  REAL,
    state       TEXT,
    created_at  TEXT NOT NULL
);
```

---

## ChromaDB Collections（L1温记忆）

### `recent_memory`
```python
{
    "ids":        ["mem_uuid"],
    "embeddings": [[0.1, 0.2, ...]],   # 1536-dim (text-embedding-3-small)
    "documents":  ["会话内容文本"],
    "metadatas":  [{
        "session_id": "sess_123",
        "created_at": "2026-04-15T10:00:00Z",
        "importance": 0.75,
        "tags": "Python,后端,开发",
        "decay_factor": 1.0   # 随时间衰减，到0时迁移L2
    }]
}
```

---

## JSON 状态文件

### `data/heart_state.json`
```json
{
    "entropy": 0.35,
    "valence": 0.65,
    "state": "calm",
    "last_updated": "2026-04-15T10:00:00Z",
    "event_history": []
}
```

### `data/llm_config.json`
```json
{
    "primary_model": "claude-3-5-sonnet-20241022",
    "fallback_chain": ["gpt-4o-mini", "deepseek/deepseek-chat"],
    "relay_stations": [],
    "last_updated": "2026-04-15T10:00:00Z"
}
```
