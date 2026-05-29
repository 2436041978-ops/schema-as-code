# 联邦元规则清单（Federal Meta-Rules）

> 面向：架构师 + 联邦治理委员会  
> 定位：Schema-As-Code 体系的"宪法之上的宪法"——定义意图协议如何被制定、如何被编译、如何被校验、如何被修正的顶层约束。  
> 版本：v1.0.0  
> 状态：immutable（变更需走联邦修宪流程）

---

## 一、什么是元规则

元规则（Meta-Rules）是**规则之上的规则**。它不定义"告警卡片应该用什么颜色"（这是意图协议），而是定义：

- 一个意图协议**怎样才能被接受**进入联邦注册表
- 一次语义变更**怎样才能被判定**为 Breaking Change
- 一条漂移事件**怎样才能被闭环**修正回控制平面

如果把 `intent-schema-compiler` 中的 YAML 文件比作各州的"地方法律"，那么本文档就是联邦的"立宪程序"。

---

## 二、联邦元规则清单

### 规则 1：语义域自治边界（Domain Autonomy Boundary）

**声明**：每个业务域（Domain）拥有独立的意图协议立法权，但必须在联邦契约框架内自治。

**约束**：
- 1.1 域级意图协议必须存放在 `schema/{domain}/` 命名空间下，禁止跨域直接引用其他域的私有语义令牌
- 1.2 域间共享语义必须通过 `federal.shared.` 前缀的公共命名空间注册，经联邦治理委员会审批后生效
- 1.3 每个域必须指定唯一的 **Intent Steward**（意图管家），对域内协议的合规性负最终责任

**违规动作**：`escalate` —— 提交联邦治理委员会仲裁

---

### 规则 2：版本冻结与不可变性（Version Immutability）

**声明**：语义令牌的版本一旦发布，其 `canonical_id` 与核心语义定义永久冻结，禁止原地修改。

**约束**：
- 2.1 标记 `immutable: true` 的语义令牌，任何字段变更（包括 `description`、`llm_constraints`、`synonym_firewall`）必须发布新版本（SemVer Major/Minor），旧版本保持只读
- 2.2 未标记 `immutable` 的实验性令牌（`experimental: true`）可在沙盒域内修改，但不得被其他正式域引用
- 2.3 版本发布必须通过 Registry 的 `impact-analysis` 校验，确认下游绑定影响面可控后方可 Merge

**违规动作**：`block` —— Compiler 拒绝编译，CI 阻断交付

---

### 规则 3：引用闭环完整性（Reference Closure Integrity）

**声明**：意图协议、语义令牌、约束规则、场景测试之间必须形成可验证的引用闭环，禁止出现"悬空引用"。

**约束**：
- 3.1 意图契约（`intent-schema.json`）必须显式引用至少一个语义令牌的 `canonical_id`
- 3.2 语义令牌（`semantic-tokens.yaml`）必须显式引用至少一条约束规则的 `rule_ref`
- 3.3 约束规则（`governance/*.yaml`）必须被至少一个场景测试（`scenario-tests.yaml`）的 `intent_binding` 覆盖
- 3.4 场景测试必须包含至少一个 Happy Path 和一个预期失败的 Edge Case

**违规动作**：`block` —— Resolver 阶段报错，中断编译管线

---

### 规则 4：编译门控（Compilation Gate）

**声明**：任何意图协议在进入联邦注册表前，必须通过 Compiler 的六步编译管线且产物验证 100% 通过。

**约束**：
- 4.1 编译管线必须按顺序执行：Load → Parse → Derive → Generate → Verify → Analyze，不可跳过阶段
- 4.2 产物验证（Verify）阶段，所有 Happy Path 必须 PASS，所有 Edge Case 必须按预期 BLOCK 或 WARN
- 4.3 影响分析（Analyze）阶段，若检测到 Breaking Change，必须附带下游产品影响面报告（`impact-report.json`）
- 4.4 未通过编译门控的协议，Registry 拒绝版本化注册，Runtime 拒绝加载

**违规动作**：`block` —— 编译失败，产物不生成，版本不注册

---

### 规则 5：四层推演强制执行（Four-Tier Enforcement）

**声明**：Validator 的四层推演（语法/语义/安全/美感）必须按优先级和短路策略严格执行，禁止人为绕过。

**约束**：
- 5.1 语法推演（T1）与语义推演（T2）与安全推演（T3）为 **P0 级**，失败时必须 `block` 并短路终止后续层级
- 5.2 美感推演（T4）为 **P1 级**，失败时仅 `warn`，不阻断交付，但需记录日志进入 Bridge 观测
- 5.3 安全推演中的 `human_mandatory` 字段，若缺失或伪造（如前端绕过 `humanConfirmed`），Runtime 必须返回 `403 INTENT_VIOLATION`
- 5.4 任何 `block` 事件不得触发自动重试（避免概率漂移），必须升级人工或进入降级策略（`fallback`）

**违规动作**：`block` + `escalate` —— 运行时拦截，人工介入

---

### 规则 6：人机边界不可逾越（Human-AI Boundary Inviolability）

**声明**：涉及不可逆操作（destructive action）的意图契约，AI 被绝对禁止直接执行，必须由人类确认。

**约束**：
- 6.1 `destructive-action` 语义域内的所有意图契约，必须包含 `human_mandatory` 字段，且至少有一项为"是否触发自动修复"
- 6.2 `ai_prohibited` 列表必须包含"直接执行修复操作""修改告警阈值配置""关闭或忽略告警"三项底线
- 6.3 Runtime 的 Actor Resolver 必须能够区分 `human`、`ai`、`human_via_ai` 三种身份，其中 `human_via_ai` 触发更严格的二次确认
- 6.4 任何人机边界规则的变更，必须经联邦治理委员会全票通过（不可仅由 Intent Steward 审批）

**违规动作**：`block` —— 运行时拦截，返回 `HUMAN_CONFIRMATION_REQUIRED`

---

### 规则 7：沙盒晋升机制（Sandbox Promotion）

**声明**：实验性语义域必须经过验证周期，满足晋升条件后方可进入正式联邦注册表。

**约束**：
- 7.1 实验性意图协议必须存放在 `schema/experimental/{domain}/` 命名空间，有效期最长 90 天
- 7.2 晋升正式域需满足：至少被 3 个独立产品绑定使用、通过 Compiler 编译 100 次无失败、Bridge 观测到的漂移率低于 5%
- 7.3 沙盒域内的协议允许 `immutable: false`，但不得被正式域引用；正式域协议一旦降级回沙盒，所有下游绑定必须强制解耦

**违规动作**：`fallback` —— 协议降级回沙盒，下游绑定失效告警

---

### 规则 8：观测反哺闭环（Observability Feedback Loop）

**声明**：运行时观测到的语义漂移必须在规定时间内反向修正控制平面，形成"修宪"闭环。

**约束**：
- 8.1 Bridge 采集的漂移事件，必须在 14 个自然日内通过自动 PR 或人工 PR 修正回 `intent-schema-compiler`
- 8.2 若同一语义令牌在 30 天内被 Bridge 上报超过 10 次漂移，必须触发 `synonym_firewall` 的紧急收紧流程（Confidence Threshold 下调 0.1）
- 8.3 所有反哺 PR 必须附带归因报告（Root Cause Analysis），说明是哪条契约规则失效、哪条同义词映射过松、或哪条 Prompt 约束存在 Gap
- 8.4 联邦治理委员会每季度审查一次反哺闭环的健康度指标（修正率、平均修正时长、重复漂移率）

**违规动作**：`escalate` —— 逾期未修正的漂移事件升级至委员会，相关域 Steward 记违规一次

---

### 规则 9：产物版本契约（Artifact Version Contract）

**声明**：Compiler 生成的约束产物必须与源协议版本严格对齐，禁止产物与源协议版本漂移。

**约束**：
- 9.1 每个产物文件必须携带 `schema_version_hash`（源协议 Git Commit SHA 短哈希），Runtime 加载时校验一致性
- 9.2 产物格式变更（如 OpenAPI 扩展字段增减）必须走 SemVer Major 升级，下游平台适配器同步更新
- 9.3 产物发布渠道（npm / CDN / 私有 Registry）必须与源协议版本一一对应，禁止隐式使用 `latest`

**违规动作**：`warn` —— 版本不匹配时 Runtime 告警，但不阻断（避免过度耦合）

---

### 规则 10：联邦修宪程序（Federal Amendment Procedure）

**声明**：元规则本身的变更，必须比意图协议更严格，确保联邦宪法的稳定性。

**约束**：
- 10.1 元规则变更（即本文档的修改）必须经联邦治理委员会 2/3 多数通过，且公示期不少于 7 天
- 10.2 任何元规则变更必须附带完整的向后兼容性分析（Backward Compatibility Analysis），说明对现有域、现有产物、现有 Runtime 的影响
- 10.3 元规则版本采用独立 SemVer（与意图协议版本解耦），当前版本 `v1.0.0`，变更时升级元规则版本号
- 10.4 元规则冲突时，以版本号更高的规则为准；同版本冲突时，以联邦治理委员会最终裁决为准

**违规动作**：`block` —— 未通过修宪程序的元规则变更，Registry 拒绝合并

---

## 三、元规则与意图协议的关系

| 层级 | 文档 | 内容示例 | 变更审批人 |
|:---|:---|:---|:---|
| **元规则**（Meta-Rules） | 本文档 | "沙盒晋升需 3 个产品验证" | 联邦治理委员会（2/3 多数） |
| **意图协议**（Intent Protocol） | `intent-schema-compiler` 中的 YAML | "`status.critical` 的色值为 #D32F2F" | Intent Steward（域内自治） |
| **约束产物**（Constraint Artifact） | Compiler 生成的 TS/JSON/RegExp | "`alert_level` 的 TypeScript enum" | 自动编译，无需人工审批 |

**关键原则**：元规则定义"怎么立法"，意图协议定义"立什么法"，约束产物定义"法律怎么执行"。

---

## 四、元规则校验清单（Checklist）

在提交新的意图协议到联邦注册表前，Steward 必须确认：

- [ ] 协议存放在正确的域命名空间（`schema/{domain}/`）
- [ ] 若引用共享语义，已通过 `federal.shared.` 前缀注册
- [ ] `immutable` 标记符合预期（正式域为 true，沙盒域可为 false）
- [ ] 引用闭环完整：Intent → Token → Rule → Test → Intent
- [ ] Compiler 六步管线全部通过，产物验证 100% 成功
- [ ] 安全边界包含 `human_mandatory`（如涉及 destructive action）
- [ ] 场景测试包含至少 1 个 Happy Path 和 1 个 Edge Case
- [ ] 影响面报告已生成（如存在 Breaking Change）
- [ ] 产物版本哈希与源协议 Commit SHA 对齐

---

## 五、附录：元规则版本历史

| 版本 | 日期 | 变更内容 | 审批记录 |
|:---|:---|:---|:---|
| v1.0.0 | 2026-05-29 | 初始发布，确立 10 条联邦元规则 | 联邦治理委员会全票通过 |

---

**文档状态**：`immutable: true`  
**变更流程**：需走联邦修宪程序（规则 10）  
**语雀原文**：[Schema-As-Code 联邦自治架构 - 联邦元规则清单](https://www.yuque.com/u222739/draddi)
