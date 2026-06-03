# FLOW - Anthropic ↔ OpenAI 翻译可视化工具

## 概述

`pages/flow.html` 是一个 **Anthropic ↔ OpenAI 协议翻译可视化工具**，用于展示请求从客户端到代理服务器，再到上游 API 的完整转换过程。

主要用途：
- 调试协议转换（Anthropic 格式 ↔ OpenAI 格式）
- 测试模型路由和别名解析
- 监控实时 SSE 事件流
- 分析性能和 token 消耗

---

## 架构图

### 系统架构

```mermaid
flowchart TD
    subgraph "Client (Browser)"
        A["flow.html UI"]
        A1["Preset Selector"]
        A2["Model Selector<br/>gpt-5.5 / gpt-4o / ..."]
        A3["Request Editor<br/>JSON textarea"]
    end

    subgraph "Lane 1: Anthropic IN"
        B["Anthropic format<br/>POST /v1/messages"]
    end

    subgraph "Proxy Server<br/>localhost:4141"
        C1["translateToOpenAI<br/>Anthropic → OpenAI"]
        C2["DispatchChatCompletions<br/>transport routing"]
        C3["translateToAnthropic<br/>OpenAI → Anthropic"]
    end

    subgraph "Lane 2: OpenAI Upstream"
        D["OpenAI format<br/>POST /v1/chat/completions"]
    end

    subgraph "Lane 3: Anthropic OUT"
        E["Anthropic SSE events<br/>Streaming response"]
    end

    subgraph "Upstream API"
        F["GitHub Copilot API<br/>or OpenAI Compatible"]
    end

    A -->|"1. User selects preset<br/>& sends request"| B
    B -->|"2. JSON body"| C1
    C1 -->|"3. OpenAI payload"| D
    D -->|"4. HTTP POST"| F
    F -->|"5. SSE stream"| C3
    C3 -->|"6. Anthropic events"| E
    E -->|"7. Display"| A

    style A fill:#bbf,stroke:#333
    style F fill:#f9f,stroke:#333
    style C1 fill:#ff9,stroke:#333
    style C3 fill:#ff9,stroke:#333
```

---

## 请求流程时序图

```mermaid
sequenceDiagram
    participant User as User
    participant UI as flow.html
    participant Proxy as Proxy Server<br/>:4141
    participant Upstream as Copilot API

    Note over User,Upstream: User selects "simple" preset with gpt-5.5 model

    User->>UI: Click "▶ send"
    UI->>UI: Build Anthropic request JSON<br/>model: gpt-5.5

    rect rgb(240, 230, 210)
        Note over UI: Lane 1: Anthropic IN<br/>shows raw Anthropic payload
    end

    UI->>Proxy: POST /v1/messages<br/>Anthropic format

    Proxy->>Proxy: translateToOpenAI()<br/>model, messages, tools...

    rect rgb(200, 240, 230)
        Note over Proxy: Lane 2: OpenAI Upstream<br/>shows translated OpenAI payload
    end

    Proxy->>Upstream: POST /v1/chat/completions<br/>OpenAI format

    Upstream-->>Proxy: SSE stream events

    Proxy->>Proxy: translateToAnthropic()<br/>convert back to Anthropic events

    rect rgb(255, 220, 200)
        Note over Proxy,User: Lane 3: Anthropic OUT<br/>shows Anthropic SSE events
    end

    Proxy-->>UI: SSE stream
    UI-->>User: Live display in events panel
```

---

## UI 组件说明

### 顶部配置栏 (Top Bar)

| 组件 | 功能 | 示例值 |
|------|------|--------|
| **Proxy endpoint** | 代理服务器地址 | `http://localhost:4141/v1/messages` |
| **Target model** | 选择上游模型 | `gpt-5.5`, `gpt-4o-2024-11-20`, `gpt-4o-mini-2024-07-18` |
| **Stream** | 启用/禁用流式响应 | `enabled`, `disabled` |
| **Status Pill** | 显示当前状态 | `idle`, `sending`, `streaming`, `done`, `error` |

### 预设面板 (Presets)

| Preset | 用途 | 关键字段 |
|--------|------|----------|
| `simple` | 基础文本对话 | `claude-sonnet-4-20250514`, 纯文本消息 |
| `tools` | 函数调用 | 包含 `get_weather` tool 定义 |
| `image` | 图片理解 | base64 编码的 PNG 图片块 |
| `thinking` | 扩展思考 | `thinking: {type: "enabled", budget_tokens: 2048}` |
| `alias` | 模型别名解析 | 测试 `claude-sonnet-4-20251022` → `claude-sonnet-4` |

### 三栏 Flow 可视化

```mermaid
graph LR
    subgraph "Lane 1: Anthropic IN"
        L1A["Protocol: Anthropic"]
        L1B["Endpoint: POST /v1/messages"]
        L1C["Direction: client → proxy"]
        L1D["curl 命令"]
    end

    subgraph "Connector 1"
        C1A["translateToOpenAI"]
    end

    subgraph "Lane 2: OpenAI Upstream"
        L2A["Protocol: OpenAI"]
        L2B["Endpoint: POST /v1/chat/completions"]
        L2C["Direction: proxy → Copilot API"]
        L2D["curl 命令"]
    end

    subgraph "Connector 2"
        C2A["translateToAnthropic"]
    end

    subgraph "Lane 3: Anthropic OUT"
        L3A["Protocol: Anthropic"]
        L3B["Response: SSE events"]
        L3C["Direction: proxy → client"]
        L3D["curl 命令 (测试用)"]
    end

    L1A -->|"JSON transform"| L2A
    L2A -->|"JSON transform"| L3A
```

### curl 命令显示

每个 Lane 底部都包含完整的 curl 命令，方便直接复制调试：

| Lane | curl 内容 |
|------|----------|
| **Lane 1 (Anthropic IN)** | 发送请求到代理服务器的 curl 命令 |
| **Lane 2 (OpenAI Upstream)** | 代理服务器转发到 Copilot API 的 curl 命令 |
| **Lane 3 (Anthropic OUT)** | 测试代理服务器的示例 curl 命令 |

### Telemetry 遥测栏

| 指标 | 说明 |
|------|------|
| `status` | HTTP 状态码或 error |
| `latency` | 请求总耗时 (ms) |
| `input tokens` | 输入 token 数量 |
| `output tokens` | 输出 token 数量 |
| `cache read` | 缓存命中 token 数 |
| `resolved model` | 解析后的实际模型名 |

---

## 模型路由逻辑

```mermaid
flowchart TD
    S["Start: Request received"] --> A{"model matches alias?"}

    A -->|"claude-sonnet-4-*"| B["resolve: claude-sonnet-4"]
    A -->|"claude-opus-4-*"| C["resolve: claude-opus-4"]
    A -->|"no match"| D["Use original model id"]

    B --> E["dispatchChatCompletions"]
    C --> E
    D --> E

    E --> F{"transport type?"}
    F -->|"copilot"| G["copilotCreateChatCompletions"]
    F -->|"openai_native"| H["openaiNativeCreateChatCompletions"]
    F -->|"openai_compatible_proxy"| I["openaiCompatibleCreateChatCompletions"]

    G --> J["GitHub Copilot API"]
    H --> K["OpenAI Native API"]
    I --> L["OpenAI Compatible Proxy"]
```

### 当前支持的模型别名

| 别名规则 | 解析结果 | 用途 |
|----------|----------|------|
| `claude-sonnet-4-*` | `claude-sonnet-4` | Claude Code subagent IDs |
| `claude-opus-4-*` | `claude-opus-4` | Claude Code subagent IDs |

---

## 代码对应关系

### 前端 (flow.html) ↔ 后端

| flow.html 函数 | 后端对应文件 | 功能 |
|----------------|-------------|------|
| `resolveModelAlias()` | `src/lib/model-routing.ts` | 模型别名解析 |
| `translateToOpenAI()` | `src/routes/messages/non-stream-translation.ts` | Anthropic → OpenAI 转换 |
| Lane 2 OpenAI payload | `src/services/transport/copilot.ts` | 实际 HTTP 请求发送 |
| SSE events | `src/routes/messages/stream-translation.ts` | 流式事件转换 |
| `translateToAnthropic()` | `src/routes/messages/non-stream-translation.ts` | OpenAI → Anthropic 转换 |

### 传输层路由

| Transport | 后端实现 | 用途 |
|-----------|----------|------|
| `copilot` (默认) | `src/services/transport/copilot.ts` | GitHub Copilot API |
| `openai_native` | `src/services/transport/openai-native.ts` | OpenAI 原生 API |
| `openai_compatible_proxy` | `src/services/transport/openai-compatible.ts` | OpenAI 兼容代理 |

---

## 使用场景

### 1. 调试协议转换

选择 `simple` preset，观察：
- **Lane 1** 显示原始 Anthropic 格式请求
- **Lane 2** 显示转换后的 OpenAI 格式
- **Lane 3** 显示最终的 Anthropic SSE 事件

### 2. 测试模型路由

1. 选择 `alias` preset
2. 查看 Lane 1 中的 `alias` 字段显示解析结果
3. 确认 `claude-sonnet-4-20251022` 被解析为 `claude-sonnet-4`

### 3. 监控实时事件

1. 启用 `stream: enabled`
2. 观察 SSE Event Log 面板
3. 查看 `content_block_delta` 事件逐字显示

### 4. 性能分析

通过 Telemetry 栏查看：
- 请求延迟
- 输入/输出 token 数量
- 缓存命中情况

---

## 常见问题

### Q: 发送请求返回 "model_not_supported" 错误

**原因**: 发送的模型名称不被 Copilot API 支持。

**解决**: 在顶部模型选择器中选择 Copilot 支持的模型（如 `gpt-5.5`），而不是 Claude 模型。

### Q: SSE 事件没有显示

**原因**: `stream` 选项被设置为 `disabled`。

**解决**: 在顶部将 Stream 设置为 `enabled`。

---

## 文件位置

- 前端页面: `pages/flow.html`
- 后端代理: `src/routes/messages/handler.ts`
- 协议转换: `src/routes/messages/non-stream-translation.ts`
- 流式转换: `src/routes/messages/stream-translation.ts`
- 模型路由: `src/lib/model-routing.ts`
