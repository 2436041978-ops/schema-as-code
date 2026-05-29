# 03 域级自治

> **面向对象**：Intent Steward（意图管家）+ 域 TL（技术负责人）  
> **定位**：在联邦自治架构中，域级自治层是**意图协议的立法与执行单元**。平台团队提供白盒基础设施（02 平台实现），各业务域在此基础之上自主定义、自治管理、自行演进自身的意图契约与约束规则。

---

## 核心职责

| 角色 | 职责 | 权力边界 |
|:---|:---|:---|
| **Intent Steward** | 定义本域语义令牌、维护意图契约、审批同义词映射变更 | 本域 `schema/` 目录的 Merge 审批权 |
| **域 TL** | 推动域内产品接入意图协议、协调 Steward 与平台团队的技术对接 | 本域产品绑定配置（`bindings/`）的写权限 |
| **域工程师** | 消费编译产物（TS 类型/ESLint 规则）、在代码中接入 `withIntentGuard` | 本域代码仓库的接入实施 |

---

## 目录导航

| 文档 | 说明 | 何时阅读 |
|:---|:---|:---|
| [Intent Steward 手册](./steward-handbook.md) | Steward 的完整工作手册：从任命到日常运维 | 新任 Steward 必读 |
| [意图协议编写指南](./intent-protocol-guide.md) | 从自然语言规则到 YAML 语义令牌的标准写法 | 编写或修订意图协议时 |
| [域级规则立法指南](./domain-rule-legislation.md) | 如何在联邦元规则框架下，制定本域特有的约束规则 | 本域需要新增或收紧规则时 |
| [沙盒域与豁免通道操作手册](./sandbox-exemption.md) | 实验性意图的快速迭代路径与转正流程 | 需要突破现有约束进行创新时 |
| [域级适配器开发注册指南](./adapter-dev-guide.md) | 当本域使用非标准技术栈时，如何开发并注册自定义 Compiler/Runtime 适配器 | 本域技术栈与平台默认适配器不匹配时 |

---

## 域级自治与平台实现的关系

```
┌─────────────────────────────────────────┐
│         02 平台实现（平台团队）            │
│  Registry / Compiler / Validator /      │
│  Runtime / Bridge（白盒基础设施）        │
└─────────────────────────────────────────┘
                    │
                    │ 提供编译、校验、拦截、观测能力
                    ▼
┌─────────────────────────────────────────┐
│         03 域级自治（各业务域）            │
│  ┌─────────────┐  ┌─────────────┐       │
│  │ 语义令牌定义  │  │ 意图契约立法  │       │
│  │ (Steward)    │  │ (Steward)    │       │
│  └─────────────┘  └─────────────┘       │
│  ┌─────────────┐  ┌─────────────┐       │
│  │ 产品绑定配置  │  │ 沙盒实验    │       │
│  │ (域 TL)      │  │ (工程师)     │       │
│  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────┘
```

**关键原则**：
- **平台不干预域内语义**：平台提供编译器，但不定义 `status.critical` 在本域代表什么——这是 Steward 的自治权。
- **元规则不可突破**：联邦元规则（如"不可变令牌变更必须发新版本"）是所有域的宪法底线， Steward 只能在此框架内立法。
- **沙盒是安全阀**：当域内需要快速实验未注册意图时，走 `sandbox/` 路径，实验成熟后再晋升到正式语义域。

---

## 快速开始：新任 Intent Steward 的 3 步上手

### Step 1：认领本域命名空间

在 Registry 中注册本域前缀：
```yaml
# 本域所有语义令牌必须以此前缀开头
domain_prefix: "payment"   # 示例：支付域
```

### Step 2：定义首批语义令牌

从本域最核心的 3-5 个业务语义开始，编写 YAML：
```yaml
# schema/payment/semantic-tokens.yaml
semantic_tokens:
  payment.status.failed:
    canonical_id: "PAY-S001"
    description: "支付失败，需用户感知"
    visual_mapping:
      color_token: "status.error"
      motion_token: "shake.horizontal"
    llm_constraints:
      - "必须说明失败原因"
      - "必须提供重试或人工客服路径"
```

### Step 3：提交产品绑定配置

让域内产品接入意图协议：
```yaml
# bindings/product-checkout.yaml
product: "checkout"
domain: "payment"
uses:
  - payment.status.failed
  - payment.action.refund
```

详见 [Intent Steward 手册](./steward-handbook.md) 的"上任首周任务清单"章节。

---

## 与 04 业务接入的衔接

域级自治层定义的规则，通过 Compiler 自动编译为产物，供 04 业务接入层的工程师直接消费：

- **前端工程师**：`npm install @company/intent-runtime` + `withIntentGuard`
- **设计师**：Figma 插件自动读取本域语义令牌
- **AI 工程师**：SDK 自动拉取本域 Prompt 约束前缀

无需理解 YAML 结构，只需按 [模块接入指南](../04-business-integration/README.md) 操作。

---

**上一层**：[02 平台实现](../02-platform-implementation)  
**下一层**：[04 业务接入](../04-business-integration)
