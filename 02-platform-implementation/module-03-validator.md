# 模块 3：Four-Tier Validator 四层推演引擎

> 定位：LLM 输出 / 组件 Props / API 响应进入生产链路前的"安检门"。
> 核心命题：不是 Prompt Engineering（让 LLM 答得更好），而是契约注入（不管怎么生成，这些红线不能突破）。

---

## 一、总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Four-Tier Validator                      │
│                    四层推演引擎（安检门）                      │
│                                                              │
│   输入：Compiler 产物（JSON Schema / YAML 规则库）            │
│   输入：待校验对象（LLM 输出 / 组件 Props / API 响应）         │
│                                                              │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│   │  T1 语法 │───►│  T2 语义 │───►│  T3 安全 │            │
│   │  推演    │    │  推演    │    │  推演    │            │
│   │  P0      │    │  P0      │    │  P0      │            │
│   │  BLOCK   │    │  BLOCK   │    │  BLOCK   │            │
│   └──────────┘    └──────────┘    └──────────┘            │
│         │               │               │                    │
│         └───────────────┴───────────────┘                    │
│                         │                                    │
│                         ▼                                    │
│                  ┌──────────┐                               │
│                  │  T4 美感 │                               │
│                  │  推演    │                               │
│                  │  P1      │                               │
│                  │  WARN    │                               │
│                  └──────────┘                               │
│                                                              │
│   输出：推演报告（PASS / BLOCK / WARN）                      │
│   输出：拦截事件（上报 Bridge + 升级人工）                    │
└─────────────────────────────────────────────────────────────┘
```

**核心策略**：阻断优于修正。校验失败不触发 LLM 自动重试（避免概率漂移），直接阻断并升级人工。

---

## 二、四层推演详细设计

### 2.1 T1 语法推演（Syntax Tier）

**目标**：JSON 结构完整性、字段类型、必填项。

**实现**：直接使用 `ajv`（Another JSON Schema Validator），零自研逻辑。

```javascript
// src/tiers/syntax-tier.js
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true });

async function syntaxTier(input, rules) {
  const schema = rules.schema;        // 来自 Compiler 产物
  const validate = ajv.compile(schema);
  const valid = validate(input);

  return {
    tier: 'syntax',
    passed: valid,
    errors: valid ? [] : validate.errors.map(e => ({
      rule_id: 'SYN-001',
      field: e.instancePath,
      message: e.message,
      action: 'block'
    }))
  };
}
```

**失败动作**：`BLOCK`（P0，短路终止后续层级）。

**示例**：
- 输入缺少 `alert_level` 字段 → BLOCK
- `confidence_score` 类型为字符串而非数字 → BLOCK

---

### 2.2 T2 语义推演（Semantic Tier）

**目标**：语义令牌引用正确性、同义词黑名单命中、语义漂移检测。

**实现**：基于 Compiler 产物中的 `semantic-token-whitelist.yaml` 和 `synonym-blacklist.yaml`。

```javascript
// src/tiers/semantic-tier.js
async function semanticTier(input, rules) {
  const errors = [];

  for (const rule of rules.rules) {
    const value = get(input, rule.target_field);

    // 白名单检查
    if (rule.allowed_tokens && !rule.allowed_tokens.includes(value)) {
      errors.push({
        rule_id: rule.rule_id,
        field: rule.target_field,
        message: `语义令牌 "${value}" 不在白名单中`,
        action: rule.severity
      });
    }

    // 同义词黑名单检查（防 LLM 漂移）
    if (rule.prohibited_synonyms && rule.prohibited_synonyms.includes(value)) {
      errors.push({
        rule_id: rule.rule_id,
        field: rule.target_field,
        message: `命中同义词黑名单 "${value}"，应替换为规范令牌`,
        action: 'block'
      });
    }
  }

  return { tier: 'semantic', passed: errors.length === 0, errors };
}
```

**失败动作**：`BLOCK`（P0，短路终止）。

**示例**：
- `alert_level: "严重"` → 命中同义词黑名单，应使用 `status.critical` → BLOCK
- `alert_level: "P0"` → 命中白名单 → PASS

---

### 2.3 T3 安全推演（Safety Tier）

**目标**：禁止模式命中、高危操作确认标记、人机边界越权。

**实现**：正则匹配 + 条件触发 + 必填字段检查。

```javascript
// src/tiers/safety-tier.js
async function safetyTier(input, rules) {
  const errors = [];

  for (const rule of rules.rules) {
    // 条件触发：如 intent_id 匹配才执行
    if (rule.condition && !evaluateCondition(input, rule.condition)) continue;

    const values = getAll(input, rule.target_field);

    for (const value of values) {
      for (const pattern of rule.prohibited_patterns || []) {
        const regex = new RegExp(pattern);
        if (regex.test(value)) {
          errors.push({
            rule_id: rule.rule_id,
            field: rule.target_field,
            message: `命中安全禁止模式 "${pattern}"`,
            action: rule.action
          });
        }
      }
    }

    // 人机边界：必填字段检查
    if (rule.required_fields) {
      for (const field of rule.required_fields) {
        if (!get(input, field)) {
          errors.push({
            rule_id: rule.rule_id,
            field,
            message: `人机边界：${field} 必须由人工确认`,
            action: rule.action
          });
        }
      }
    }
  }

  return { tier: 'safety', passed: errors.length === 0, errors };
}
```

**失败动作**：`BLOCK`（P0，短路终止）。

**示例**：
- `remediation: [{ description: "自动执行修复" }]` → 命中禁止模式 → BLOCK
- `destructive-action` 缺少 `human_confirmed` → 人机边界缺失 → BLOCK

---

### 2.4 T4 美感推演（Aesthetic Tier）

**目标**：文案长度边界、信息密度、可读性评分。

**实现**：轻量文本分析，不阻断，只告警。

```javascript
// src/tiers/aesthetic-tier.js
async function aestheticTier(input, rules) {
  const warnings = [];

  for (const rule of rules.rules) {
    const value = get(input, rule.target_field);
    if (!value) continue;

    if (rule.max_length && value.length > rule.max_length) {
      warnings.push({
        rule_id: rule.rule_id,
        field: rule.target_field,
        message: `文案长度 ${value.length} 超过阈值 ${rule.max_length}`,
        action: 'warn'
      });
    }

    // 中文可读性简化：句子长度检测
    const sentences = value.split(/[。！？.!?]/);
    const longSentences = sentences.filter(s => s.length > 40);
    if (longSentences.length > 0) {
      warnings.push({
        rule_id: rule.rule_id,
        field: rule.target_field,
        message: `存在 ${longSentences.length} 个超长句子，影响可读性`,
        action: 'warn'
      });
    }
  }

  return { tier: 'aesthetic', passed: true, errors: warnings };
}
```

**失败动作**：`WARN`（P1，不阻断，记录告警）。

**示例**：
- `root_cause` 长度 250 字，超过 maxLength 200 → WARN
- 存在 3 个超过 40 字的超长句子 → WARN

---

## 三、主调度器与短路策略

```javascript
// src/index.js
const syntaxTier = require('./tiers/syntax-tier');
const semanticTier = require('./tiers/semantic-tier');
const safetyTier = require('./tiers/safety-tier');
const aestheticTier = require('./tiers/aesthetic-tier');

async function validate(input, context) {
  const tiers = [
    { name: 'syntax', fn: syntaxTier, shortCircuit: true },
    { name: 'semantic', fn: semanticTier, shortCircuit: true },
    { name: 'safety', fn: safetyTier, shortCircuit: true },
    { name: 'aesthetic', fn: aestheticTier, shortCircuit: false }
  ];

  const report = {
    passed: true,
    overall_action: 'pass',
    tiers: [],
    metadata: {
      validated_at: new Date().toISOString(),
      intent_contract: context.intent_contract_id,
      registry_version: context.registry_version
    }
  };

  for (const tier of tiers) {
    const rules = loadRules(tier.name, context.registry_version);
    const result = await tier.fn(input, rules);

    report.tiers.push(result);

    if (!result.passed && tier.shortCircuit) {
      report.passed = false;
      report.overall_action = 'block';
      break;
    }
  }

  return report;
}
```

**短路原则**：T1/T2/T3 任意一层失败，立即终止，不执行后续层级。避免无意义的计算，也避免美感层对阻断结果的干扰。

---

## 四、规则库格式（纯 YAML，零代码写规则）

Validator 的核心层只读配置，不写死规则。规则以 YAML 形式存放在 `rules/` 目录。

### 4.1 语义规则

```yaml
# rules/semantic/token-whitelist.yaml
tier: semantic
severity: block

rules:
  - rule_id: SEM-001
    description: "告警等级必须引用语义令牌"
    target_field: "alert_level"
    allowed_tokens:
      - status.critical
      - status.warning
      - status.info
    validation: exact_match

  - rule_id: SEM-002
    description: "根因描述必须引用语义令牌"
    target_field: "root_cause"
    validation: semantic_token_reference
```

### 4.2 安全规则

```yaml
# rules/safety/destructive-patterns.yaml
tier: safety
severity: block

rules:
  - rule_id: SAF-001
    description: "禁止建议自动执行"
    target_field: "remediation[].description"
    prohibited_patterns:
      - "自动执行"
      - "无需确认"
      - "(?i)ignore.*warning"
    action: block

  - rule_id: SAF-002
    description: "destructive 操作必须携带 human_confirmed"
    condition: "intent_id == 'destructive-action'"
    required_fields:
      - human_confirmed
    action: block
```

### 4.3 美感规则

```yaml
# rules/aesthetic/readability-rules.yaml
tier: aesthetic
severity: warn

rules:
  - rule_id: AES-001
    description: "根因描述长度超限"
    target_field: "root_cause"
    min_length: 10
    max_length: 200

  - rule_id: AES-002
    description: "信息密度评分"
    target_field: "root_cause"
    max_info_density: 0.8
```

---

## 五、技术中立适配方案

### 5.1 三层隔离

```
Validator 节点
├── interface/                    # 接口层：协议不变
│   ├── inference-input-schema.json
│   └── inference-report-schema.json
├── core/                         # 核心层：四层引擎 + 调度器
│   ├── tiers/
│   │   ├── syntax-tier.js
│   │   ├── semantic-tier.js
│   │   ├── safety-tier.js
│   │   └── aesthetic-tier.js
│   └── scheduler.js              # 短路策略 + 优先级管理
└── adapter/                      # 适配层：场景引擎
    ├── engines/
    │   ├── llm-openai.js
    │   ├── llm-anthropic.js
    │   ├── component-props.js
    │   └── api-http.js
    └── reporters/
        ├── console.js
        ├── github-pr.js
        ├── junit.js
        └── otel.js
```

### 5.2 场景引擎适配

| 校验场景 | 适配文件 | 说明 |
|---------|---------|------|
| OpenAI GPT-4 | `engines/llm-openai.js` | 提取 `response.choices[0].message.content` |
| Claude 3 | `engines/llm-anthropic.js` | 提取 `content` 中的结构化输出 |
| 自研模型 | `engines/llm-generic.js` | 约定统一输出格式（JSON Schema） |
| React 组件 | `engines/component-props.js` | 校验传入的 Props 对象 |
| Vue 组件 | `engines/component-props.js`（复用） | Vue Props 本质也是对象 |
| Express API | `engines/api-http.js` | 校验 `res.body` |
| GraphQL | 扩展 `engines/api-http.js` | 校验 `data` 字段 |

**核心层零框架依赖**：所有引擎最终都把待校验内容转为统一 JSON，四层引擎只消费标准 JSON。

---

## 六、轻量部署模式

### 模式 A：npm CLI（推荐）

```bash
# 安装
npm install -g @your-org/intent-validator

# 校验 LLM 输出文件
intent-validate --input ./llm-output.json --intent alert-card --registry v1.1.0

# 校验组件目录（批量扫描）
intent-validate --component-dir ./src/components --binding ./bindings/product-a.yaml

# 输出格式
intent-validate --input ./llm-output.json --format json   # json / markdown / junit
```

### 模式 B：GitHub Action（CI 集成）

```yaml
# .github/workflows/intent-validate.yml
name: Intent Validation
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Validator
        run: npm install -g @your-org/intent-validator

      # 场景 1：校验 LLM Prompt 模板变更
      - name: Validate LLM Outputs
        if: contains(github.event.pull_request.changed_files, 'prompts/')
        run: |
          intent-validate --batch ./prompts/test-outputs/             --registry v1.1.0             --reporter github-pr             --fail-on block

      # 场景 2：校验前端组件 Props
      - name: Validate Components
        if: contains(github.event.pull_request.changed_files, 'src/components/')
        run: |
          intent-validate --component-dir ./src/components             --binding ./bindings/product-a.yaml             --reporter github-pr
```

### 模式 C：本地开发（ESLint 插件形态）

```javascript
// .eslintrc.js
module.exports = {
  plugins: ['intent'],
  rules: {
    'intent/semantic-token': 'error',    // T2 语义推演
    'intent/safety-boundary': 'error',   // T3 安全推演
    'intent/aesthetic-length': 'warn'      // T4 美感推演
  }
};
```

---

## 七、与 Compiler / Runtime 的衔接

```
Compiler（契约编译器）
    │
    ├──► dist/v1.1.0/rules/syntax/alert-response.schema.json
    ├──► dist/v1.1.0/rules/semantic/token-whitelist.yaml
    ├──► dist/v1.1.0/rules/safety/destructive-patterns.yaml
    └──► dist/v1.1.0/rules/aesthetic/readability-rules.yaml
              │
              ▼
    Validator（四层推演引擎）
              │
              ├──► 语法层：ajv.compile(schema)
              ├──► 语义层：白名单 + 同义词黑名单
              ├──► 安全层：正则 + 人机边界
              └──► 美感层：长度 + 可读性
                        │
                        ├──► PASS → 放行到 Runtime
                        └──► BLOCK → 拦截并上报 Bridge
```

**版本对齐**：Validator 启动时校验规则产物哈希与 Registry 发布版本是否一致，不一致时告警。

---

## 八、风险与缓解

| 风险 | 描述 | 缓解措施 |
|:---|:---|:---|
| **误报率过高** | 规则过于严格，大量合法输出被 BLOCK | 灰度规则：新规则先以 `warn` 模式运行 2 周，收集误报数据后再决定是否升级 `block` |
| **性能瓶颈** | 四层全量扫描 + 正则匹配导致 CI 耗时上升 | 增量校验：只扫描变更文件；规则缓存：已校验过的 Token/Intent 组合缓存结果；T1/T2/T3 并行执行 |
| **规则膨胀与冲突** | 各业务线不断加规则，导致规则库臃肿 | 规则命名空间：`rules/{domain}/{product}/` 隔离；季度清理：由 Validator 维护者牵头评审低命中规则 |
| **与 Compiler 版本不一致** | Validator 加载旧版策略，与 Registry 最新契约脱节 | 版本锁定：Validator 必须显式指定 `--registry-version`，禁止隐式使用 `latest` |

---

## 九、组织架构要求（最低配置）

| 角色 | 人数 | 职责 |
|:---|:---|:---|
| **Validator 维护者** | 1 人（平台/前端工程师兼职） | 维护四层引擎核心（调度器、规则加载器、短路策略）、CLI 工具、CI 集成 |
| **规则库 Owner** | 按领域 2-3 人（兼职） | 维护 YAML 规则文件：语义规则（设计系统工程师）、安全规则（安全/合规工程师）、美感规则（UX 文案/内容设计师） |
| **产品接入负责人** | 每产品 1 人（前端 TL 兼职） | 在产品代码中集成 `withIntent` HOC 或 API 校验中间件；处理 BLOCK 事件的降级 UI |

**启动门槛**：1 个 Validator 维护者 + 2 个规则 Owner。引擎本身只有 4 个 JS 文件，无需专职团队。

---

## 十、一句话总结

> **Four-Tier Validator = 4 个 JS 文件（每层一个推演引擎）+ 1 个 YAML 规则库 + 1 个 CLI 入口。** 输入是 Compiler 编译后的规则产物和待校验对象，输出是 `PASS/BLOCK/WARN` 的推演报告。核心风险是误报率过高导致开发者无视，通过"灰度规则（先 warn 后 block）"和"增量校验"来防控。

---

**项目地址**：`schema-as-code/packages/validator`

