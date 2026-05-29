# 域级适配器开发注册指南

> 本文档面向 Intent Steward 与域级技术负责人，规范自定义平台适配器的开发、沙盒验证与注册流程。沙盒域与豁免通道统一在适配器生命周期内管理。

---

## 一、适配器概述

适配器（Adapter）是 Schema-As-Code 编译器（Compiler）的插件单元，负责将意图协议（YAML）翻译为特定技术栈可消费的约束产物。

| 层级 | 典型适配器 | 输出产物 |
|------|-----------|---------|
| L1 Token | `antd-token-plugin` | `ConfigProvider` 扩展 / CSS 变量 |
| L2 组件 | `react-component-plugin` | TS 类型定义 / ESLint 规则 |
| L3 API | `openapi-plugin` | OpenAPI 扩展字段 / JSON Schema |
| L4 容器 | `opa-plugin` | Rego 策略 / WASM JSON |
| L5 数据库 | `mysql-plugin` | DDL 注释 / CHECK 约束 |

---

## 二、开发规范

### 2.1 目录结构

```
packages/
└── plugins/
    └── {platform-name}/
        ├── README.md
        ├── package.json
        ├── src/
        │   ├── index.js          # 插件入口
        │   ├── transformer.js    # AST/模板转换
        │   └── template/
        │       └── output.hbs  # Handlebars 模板
        └── tests/
            └── fixture/
                └── input.yaml  # 测试用例
```

### 2.2 接口契约

每个适配器必须实现以下标准接口：

```typescript
interface CompilerPlugin {
  name: string;
  version: string;
  targetLayer: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

  // 接收语义令牌或意图契约，返回编译产物
  compile(input: IntentProtocol): Artifact[];

  // 产物元数据
  getArtifactManifest(): ArtifactManifest;
}
```

### 2.3 命名规范

- 插件包名：`intent-{layer}-{platform}`，如 `intent-l2-antd`
- 文件命名：kebab-case，如 `token-transformer.js`
- 版本锁定：与 Registry 的 `schema_version` 对齐

---

## 三、沙盒域机制（Sandbox Domain）

> 沙盒域是适配器的"安全试验区"，允许未注册的新意图在隔离环境中快速迭代，成熟后再晋升到正式域。

### 3.1 沙盒声明

在适配器配置中显式声明沙盒支持：

```yaml
# adapter-manifest.yaml
sandbox:
  enabled: true
  isolation_level: "domain"      # domain / product / component
  max_retention_days: 30       # 沙盒数据保留期限
  auto_promote: false          # 是否自动晋升（需人工审批）

  allowed_experiments:
    - "new_semantic_token"
    - "relaxed_synonym_rule"
```

### 3.2 沙盒隔离规则

| 隔离级别 | 影响范围 | 适用场景 |
|---------|---------|---------|
| **domain** | 仅当前域内产品可见 | 域级新意图试点 |
| **product** | 仅指定产品可见 | 单产品灰度 |
| **component** | 仅指定组件可见 | 组件级 A/B 测试 |

### 3.3 沙盒数据流向

```
Intent Steward 提交实验意图
    │
    ▼
Compiler 识别沙盒标记 → 路由到沙盒适配器
    │
    ▼
产物输出到 sandbox/ 目录（不污染正式产物）
    │
    ▼
Validator 执行沙盒专用规则（放宽部分约束，保留安全底线）
    │
    ▼
Bridge 采集沙盒漂移数据（独立指标，不混入正式治理分）
```

---

## 四、豁免通道机制（Exemption Channel）

> 豁免通道允许在极端场景下临时绕过特定约束，但所有豁免必须被记录、被审计、被限时。

### 4.1 豁免类型

```yaml
# exemption-policy.yaml
exemption_types:
  - type: "emergency_hotfix"
    max_duration: "24h"
    approval: "single_steward"     # 单 steward 审批
    requires_post_review: true

  - type: "legacy_migration"
    max_duration: "90d"
    approval: "federal_committee"  # 联邦委员会审批
    requires_migration_plan: true

  - type: "experimental_feature"
    max_duration: "30d"
    approval: "domain_tl"          # 域 TL 审批
    requires_sandbox: true
```

### 4.2 豁免申请与审批流程

```
工程师提交豁免申请（PR 到 intent-schema-compiler）
    │
    ├── 在 YAML 中添加 exemption 标记
    │   └── exemption:
    │       type: "emergency_hotfix"
    │       reason: "P0 故障修复需临时跳过二次确认"
    │       expires_at: "2026-05-30T00:00:00Z"
    │
    ▼
Intent Steward / 联邦委员会审批（GitHub PR Review）
    │
    ▼
Runtime 读取豁免标记 → 放行但记录审计日志
    │
    ▼
Bridge 监控豁免使用率 → 到期前 24h 告警
```

### 4.3 沙盒与豁免的合一管理

沙盒域与豁免通道共享同一套生命周期管理：

| 阶段 | 沙盒域 | 豁免通道 | 统一动作 |
|------|--------|---------|---------|
| **申请** | 提交实验意图 | 提交豁免 PR | 统一走 GitHub PR |
| **审批** | Steward 审批 | Steward/委员会审批 | 统一看板 |
| **生效** | 产物输出到 sandbox/ | Runtime 读取 exemption 标记 | Compiler 统一处理 |
| **观测** | 沙盒专用指标 | 豁免审计日志 | Bridge 统一采集 |
| **到期** | 自动清理或晋升 | 自动失效或续期 | Registry 统一调度 |
| **审计** | 实验影响报告 | 豁免使用报告 | 联邦委员会季度审阅 |

---

## 五、注册流程

### 5.1 注册前置条件

1. 适配器通过沙盒验证（至少 1 个域内产品运行 7 天）
2. 单元测试覆盖率 ≥ 80%
3. 产物通过 Validator 四层推演（语法/语义/安全/美感）
4. 文档齐全（README + 使用示例 + 故障排查）

### 5.2 注册步骤

```bash
# 1. Fork schema-as-code 仓库
# 2. 在 packages/plugins/ 下提交适配器代码
# 3. 提交注册申请 PR，附带以下信息：
```

PR 模板：

```markdown
## 适配器注册申请

- **适配器名称**: intent-l2-antd
- **目标平台**: Ant Design React
- **目标层级**: L2（组件层）
- **沙盒验证**: ✅ 已完成，验证域：支付域（7 天）
- **测试覆盖率**: 85%
- **产物示例**: 见 PR 附件 `dist/artifacts/`
- **维护者**: @xxx（Intent Steward）
```

### 5.3 注册后义务

- 跟随 Registry 主版本升级，30 天内完成适配器兼容
- 每季度提交治理健康报告（拦截率、误报率）
- 接受联邦委员会的 Breaking Change 通知

---

## 六、示例：Ant Design 适配器注册全链路

### 6.1 沙盒申请

```yaml
# 支付域的实验配置
sandbox:
  domain: "payment"
  adapter: "intent-l2-antd"
  experiment: "new-destructive-button-pattern"
  duration: "14d"
```

### 6.2 豁免申请（紧急场景）

```yaml
# 故障期间的临时豁免
exemption:
  type: "emergency_hotfix"
  target_rule: "human-ai-boundary.destructive-action"
  bypass: "human_mandatory"
  reason: "P0 支付故障，需自动降级止损"
  expires_at: "2026-05-30T00:00:00Z"
  approver: "steward-payment@company.com"
```

### 6.3 正式注册

沙盒验证通过 + 无未关闭豁免 → 提交注册 PR → 联邦委员会 Merge → 产物进入 `dist/latest/`。

---

## 七、附录

### A. 适配器开发检查清单

| 检查项 | 要求 |
|--------|------|
| 接口实现 | 符合 `CompilerPlugin` 接口 |
| 沙盒支持 | 配置 `sandbox.enabled` |
| 豁免兼容 | 不硬编码拒绝 exemption 标记 |
| 版本声明 | `package.json` 中有 `peerDependencies.intent-schema` |
| 产物校验 | 提供 `fixture/` 测试用例 |

### B. 术语

- **沙盒域（Sandbox Domain）**: 隔离的实验环境，意图协议可在此快速迭代而不影响正式域
- **豁免通道（Exemption Channel）**: 限时、可审计的约束绕过机制
- **适配器（Adapter）**: Compiler 的平台插件，负责 YAML → 特定产物

---

> 本文档与 `sandbox-exemption.md` 合并维护，沙盒与豁免统一在适配器生命周期内管理。
