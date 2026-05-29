# 模块 5：Observability Bridge 观测闭环与组织级治理指标

> 定位：连接运行时观测与控制平面，实现"观测 → 归因 → 约束 → 验证"的闭环。Bridge 是语义治理网格的"监察与反馈"节点。

---

## 一、核心命题

设计时语义标准化（Schema-As-Code）解决了"漂移发生前如何约束预防"的问题。但约束是否有效、规则是否过松、哪些语义边界被频繁突破，需要运行时数据来回答。

Observability Bridge 的核心命题：**让运行时漂移事件自动归因到意图协议的具体规则，并反向驱动控制平面的迭代修正。**

---

## 二、架构定位：网格的闭环接口

```
┌─────────────────────────────────────────┐
│              控制平面（Control Plane）      │
│         intent-schema-compiler            │
│  ┌──────────────┐    ┌──────────────┐  │
│  │ 语义层/       │    │ 治理层/       │  │
│  │ 语义令牌       │    │ 约束规则       │  │
│  └──────────────┘    └──────────────┘  │
└─────────────────────────────────────────┘
                    ▲
                    │ 自动 PR 反哺
                    │
┌─────────────────────────────────────────┐
│            Bridge（本模块）               │
│  ┌──────────┐  ┌──────────┐            │
│  │ 归因引擎  │→│ 自动 PR  │────────────┘
│  └──────────┘  └──────────┘
                    │
┌───────────────────┴─────────────────────┐
│  ┌──────────┐  ┌──────────┐            │
│  │ 语义归一化│  │ 治理指标  │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
                    │
                    │ 消费运行时数据
                    ▼
┌─────────────────────────────────────────┐
│  Runtime / Validator / LoongSuite      │
│  拦截事件 / Trace / Log                 │
└─────────────────────────────────────────┘
```

---

## 三、数据流：五步闭环

### Step 1：采集（Collect）

Bridge 不存储原始 Trace/Log，只消费现有可观测平台的查询 API。

支持的平台适配器：

| 平台 | 采集器 | 数据格式 |
|------|--------|---------|
| OpenTelemetry | `collectors/otel-trace.js` | OTLP / Span Attributes |
| LoongSuite GenAI SemConv | `collectors/otel-trace.js`（复用） | `gen_ai.response.*` / `invoke_skill` |
| 阿里云 SLS | `collectors/aliyun-sls.js` | SLS SDK 查询 |
| AWS CloudWatch | `collectors/aws-cloudwatch.js` | CloudWatch Logs Insights |
| Grafana Loki | `collectors/loki.js` | Loki HTTP API |
| 本地日志文件 | `collectors/file-log.js` | JSON Lines（兜底） |

**采集原则**：只读取，不写入；只消费查询 API，不维护独立数据库。

### Step 2：语义归一化（Normalize）

将原始运行时数据映射为意图协议 ID。

```yaml
# 归一化事件示例
normalized_event:
  raw_event_id: "trace_abc123"
  intent_contract: "AW-001"              # 映射到意图契约
  semantic_tokens_detected: ["status.critical"]
  semantic_drift_detected:
    - synonym: "严重"
      should_be: "status.critical"
      confidence: 0.95
  llm_temperature: 0.85                   # 用于归因分析
  product_id: "product-a"
  timestamp: "2026-05-22T11:48:00Z"
```

### Step 3：归因（Attribute）

定位漂移根因：是哪条契约规则失效？哪条同义词映射过松？

```javascript
// 归因逻辑伪代码
function rootCauseAnalysis(drift) {
  // 归因 1：同义词映射规则过松
  if (synonymRule.allowed_contexts.includes(drift.intent_contract)) {
    return {
      type: 'synonym_rule_too_loose',
      rule_ref: `rules/semantic/synonym-mapping.yaml#${drift.synonym}`,
      suggestion: `收紧 ${drift.synonym} 的置信度阈值，或从 ${drift.intent_contract} 的 allowed_contexts 中移除`
    };
  }

  // 归因 2：Prompt 约束未生效
  if (!promptConstraint.includes(drift.synonym)) {
    return {
      type: 'prompt_constraint_gap',
      rule_ref: `schema/${drift.intent_contract}/llm-constraints.yaml`,
      suggestion: `在 Prompt 约束中显式禁止同义词 ${drift.synonym}`
    };
  }

  // 归因 3：LLM 温度参数过高
  if (drift.llm_temperature > 0.8) {
    return {
      type: 'llm_parameter_drift',
      rule_ref: 'runtime/llm-config.yaml',
      suggestion: '降低 temperature 或增加 top_p 约束'
    };
  }
}
```

### Step 4：治理指标聚合（Metrics）

四大组织级治理指标：

| 指标 | 定义 | 目标值 | 消费方 |
|------|------|--------|--------|
| **语义一致性得分** | 跨产品界面中语义令牌合规率 | ≥ 90% | 联邦治理委员会 |
| **规则拦截率** | 四层推演引擎拦截的漂移事件占比 | ≥ 95% | 平台团队 |
| **人工升级比例** | 无法自动处理、需人工介入的事件占比 | < 5%（随成熟度递减） | 域 TL |
| **治理健康度** | 综合得分 = 一致性×0.4 + 拦截率×0.3 + (100-升级比例)×0.3 | ≥ 75（B级） | 管理层 |

### Step 5：反哺（Feedback）

将归因结果自动转化为控制平面的规则修正。

**自动 PR 示例**：

```yaml
# Bridge 生成的 PR 标题
[Auto] 治理观测反哺：收紧"严重"同义词规则

# PR 正文
## 漂移事件
- 产品：product-a
- 意图契约：AW-001
- 漂移类型：同义词替代
- 原始输出："严重"
- 应为令牌：status.critical

## 归因结果
- 根因：synonym_rule_too_loose
- 规则文件：rules/semantic/synonym-mapping.yaml
- 建议：将"严重"的 confidence_threshold 从 0.95 提升至 0.98

## 影响面
- 下游契约：AW-001, AW-002
- 预计拦截率提升：+12%
```

**人工审批强制门**：所有自动 PR 必须由语义架构师（Semantic Architect）审批后方可 Merge。

---

## 四、与 LoongSuite GenAI SemConv 的集成

```yaml
# Bridge 配置：可观测绑定
observability_binding:
  provider: "loongsuite.genai.v1"
  trace_format: "opentelemetry"

  event_mapping:
    - governance_event: "semantic_drift_blocked"
      semconv_span: "invoke_skill"
      attributes:
        - "skill.name: alert_card_generation"
        - "drift.type: synonym_substitution"
        - "intent.schema_version: 2.1.0"
```

**双向数据流**：
- **上游**：Bridge 消费 LoongSuite 的 Trace 数据，提取 `gen_ai.response.*` 字段进行语义归一化
- **下游**：Bridge 将治理事件（拦截/归因/指标）以 Span 形式回写，丰富可观测数据语义

---

## 五、轻量设计方案

### 5.1 物理结构

```
observability-bridge/
├── bin/
│   └── intent-observe              # CLI：归因分析 / 指标生成 / 反哺 PR
├── src/
│   ├── collectors/                 # 采集适配器（只读现有基础设施）
│   │   ├── otel-trace-collector.js
│   │   ├── log-collector.js
│   │   └── validator-event-collector.js
│   ├── normalizers/
│   │   └── intent-normalizer.js   # 语义归一化
│   ├── attribution/
│   │   ├── root-cause-engine.js   # 根因定位
│   │   └── impact-calculator.js   # 影响面计算
│   ├── metrics/
│   │   ├── semantic-consistency.js
│   │   ├── rule-interception-rate.js
│   │   ├── human-escalation-ratio.js
│   │   └── governance-health.js
│   └── feedback/
│       ├── pr-creator.js          # GitHub PR 自动创建
│       └── alert-publisher.js     # 飞书/钉钉/Slack 告警
└── package.json
```

### 5.2 CLI 使用方式

```bash
# 安装
npm install -g @your-org/intent-observability

# 拉取最近 7 天数据并生成治理报告
intent-observe --collect --from 7d --registry v1.1.0 --output ./report.json

# 归因分析：针对某次具体漂移事件
intent-observe --attributize --trace-id abc123 --output ./root-cause.md

# 生成组织级仪表盘（静态 HTML）
intent-observe --dashboard --output ./governance-dashboard.html

# 执行闭环反哺：基于归因结果自动创建 Registry PR
intent-observe --feedback --create-pr --repo intent-schema-compiler
```

### 5.3 CI 集成（GitHub Action 定时任务）

```yaml
# .github/workflows/observability-sync.yml
name: Observability Sync
on:
  schedule:
    - cron: '0 9 * * 1'    # 每周一上午 9 点
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Observability Bridge
        run: npm install -g @your-org/intent-observability

      - name: Collect Metrics
        run: |
          intent-observe --collect             --source otel             --endpoint ${{ secrets.OTEL_COLLECTOR_ENDPOINT }}             --from 7d             --registry v1.1.0

      - name: Generate Report
        run: |
          intent-observe --dashboard             --input ./raw-events.json             --output ./governance-reports/weekly/$(date +%Y-%m-%d).html

      - name: Feedback Loop
        if: env.CONSISTENCY_SCORE < 75
        run: |
          intent-observe --feedback --create-pr             --input ./drift-analysis.json             --repo ${{ github.repository }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Commit Report
        run: |
          git add governance-reports/
          git commit -m "chore: weekly governance report $(date +%Y-%m-%d)"
          git push
```

---

## 六、与其他模块的衔接

| 模块 | 输出 → Bridge | Bridge → 输入 |
|------|--------------|--------------|
| **Registry** | 版本化语义索引 | 自动 PR 修改规则后触发版本 bump |
| **Compiler** | 约束产物包 | 产物格式变更时更新采集解析逻辑 |
| **Validator** | BLOCK/WARN 事件 | 归因结果反馈至规则库优化 |
| **Runtime** | 拦截日志 / 权限越界事件 | 热补丁紧急策略（绕过 Registry 发版） |

---

## 七、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **归因误伤** | 中 | 高 | 人工审批强制门：所有自动 PR 需语义架构师 Merge；灰度规则测试 |
| **闭环延迟** | 高 | 中 | 双速闭环：紧急漂移走人工通道（小时级），常规走自动 PR（周级）；Runtime 支持热补丁 |
| **数据采样偏差** | 中 | 中 | 显式标记覆盖率；小样本时只输出趋势方向，不输出绝对得分 |
| **与可观测平台耦合** | 低 | 中 | 采集器抽象层：切换平台只需重写 1 个 100 行适配器文件；优先消费 OTel 标准格式 |

---

## 八、一句话总结

> **Observability Bridge = 1 个采集适配器 + 1 个语义归一化器 + 1 个归因引擎 + 1 个指标聚合器 + 1 个自动 PR 创建器。** 不建数据库，不搭流计算，借现有可观测平台做数据底座，Bridge 只做"语义翻译 + 根因定位 + 闭环反哺"。组织架构上只需要 **1 个 Bridge 维护者（SRE 兼职）+ 1 个语义架构师审阅人**。核心风险是**归因误伤**和**闭环延迟**，通过**人工审批强制门 + 双速闭环**来防控。

---

**项目地址**：https://github.com/2436041978-ops/intent-schema-compiler
