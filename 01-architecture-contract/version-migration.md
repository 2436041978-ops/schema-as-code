# 版本管理与迁移策略

> 本文档定义 Schema-As-Code 联邦自治架构中的语义协议版本管理规范、迁移拓扑与回滚策略，面向联邦治理委员会、平台团队及各域 Intent Steward。

---

## 一、版本管理哲学

Schema-As-Code 体系的版本管理遵循 **"宪法修正案"** 模型：

- **意图协议（Intent Protocol）** 是组织的语义宪法，其变更必须可追溯、可审计、可协商
- **版本不是标签，是契约**——下游产品通过版本号锁定语义边界，平台通过版本号管理编译产物生命周期
- **Breaking Change 必须走联邦修宪程序**，非 Breaking Change 可由平台自动分发

---

## 二、语义版本规范（SemVer for Schema）

Schema-As-Code 采用扩展的语义版本规范，格式为：

```
MAJOR.MINOR.PATCH[-prerelease][+build]
```

### 2.1 版本号定义

| 层级 | 变更类型 | 示例 | 下游影响 | 审批层级 |
|:---|:---|:---|:---|:---|
| **MAJOR** | 意图契约 Breaking Change | 删除语义令牌、修改 `immutable` 边界定义、变更 `violation_action` 默认值 | 所有绑定产品必须手动升级 | 联邦治理委员会 |
| **MINOR** | 新增语义能力 | 新增语义令牌、新增意图契约、扩展同义词映射 | 向下兼容，产品可选接入 | 平台团队 + 域 Steward |
| **PATCH** | 规则收紧/扩展 | 扩展同义词黑名单、放宽 `minLength`、修正 YAML 语法错误 | 自动热更新，无需人工干预 | 平台团队自动发布 |
| **prerelease** | 沙盒预览 | `2.1.0-alpha.1` | 仅沙盒域可用 | 域 Steward |

### 2.2 关键判定标准

**MAJOR 升级（Breaking Change）的判定清单**：

- [ ] 删除已发布的语义令牌（`canonical_id` 失效）
- [ ] 修改 `immutable: true` 的语义令牌的视觉映射或 LLM 约束
- [ ] 变更意图契约的 `violation_action`（如 `warn` → `block`）
- [ ] 缩小 `enum` 取值范围（如从 `["P0","P1","P2","P3"]` 删除 `"P3"`）
- [ ] 收紧 `required_fields` 增加新的必填项
- [ ] 变更同义词映射的 `standard_token` 指向（如 `"严重"` 从 `critical` 改为 `warning`）

**MINOR 升级（Compatible Addition）的判定清单**：

- [ ] 新增语义令牌（不冲突现有令牌）
- [ ] 新增意图契约（不影响现有契约）
- [ ] 扩展同义词映射的 `allowed_contexts`
- [ ] 新增适配插件（新平台支持）

**PATCH 升级（Patch/Relaxation）的判定清单**：

- [ ] 扩展同义词黑名单（新增 prohibited term）
- [ ] 放宽数值边界（如 `maxLength` 从 200 改为 300）
- [ ] 修正 YAML/JSON Schema 语法错误
- [ ] 优化编译产物格式（不改变语义）

---

## 三、版本隔离与目录拓扑

### 3.1 控制平面版本隔离

```
intent-schema-compiler/
└── schema/
    ├── v1.0.0/              # 冻结版本，只读
    │   ├── semantic/
    │   ├── governance/
    │   └── execution/
    ├── v1.1.0/              # 冻结版本，只读
    │   ├── semantic/
    │   ├── governance/
    │   └── execution/
    ├── v2.0.0/              # 当前最新 Major
    │   ├── semantic/
    │   ├── governance/
    │   └── execution/
    └── latest -> v2.0.0/    # 符号链接，始终指向最新版本
```

**约束**：
- 已发布的版本目录（`vX.Y.Z/`）**永久只读**，任何修改必须发新版本
- `latest` 软链由 Registry 在发布时自动更新
- 下游产品禁止直接引用 `latest`，必须显式锁定版本号

### 3.2 编译产物版本拓扑

```
schema-as-code/
└── dist/
    ├── v1.0.0/
    │   ├── tokens.json          # 语义令牌索引
    │   ├── intents.json         # 意图契约索引
    │   ├── rules/               # 校验规则产物
    │   ├── types/               # TypeScript 类型产物
    │   └── impact-report.json   # 影响面报告
    ├── v1.1.0/
    │   └── ...
    ├── v2.0.0/
    │   └── ...
    └── latest -> v2.0.0/
```

---

## 四、迁移拓扑：从旧版本到新版本

### 4.1 迁移触发条件

| 场景 | 触发方 | 动作 |
|:---|:---|:---|
| MAJOR 发布 | 联邦治理委员会 | 发布迁移公告，设定迁移窗口期 |
| MINOR 发布 | 平台团队 | 自动分发，产品可选接入 |
| PATCH 发布 | 平台团队 | 自动热更新，无感知 |
| 安全紧急收紧 | 平台团队 | 强制 PATCH 更新，缩短窗口期 |

### 4.2 迁移窗口期（Migration Window）

```
MAJOR 版本发布
    │
    ▼ Day 0: 发布公告 + 影响面报告
    │
    ▼ Day 1-7: 并行期（旧版本 + 新版本同时可用）
    │   • Compiler 同时编译新旧两版产物
    │   • 产品团队本地验证新版本兼容性
    │
    ▼ Day 8-14: 灰度期（强制 CI 告警，不阻断）
    │   • 未迁移的产品在 CI 中收到 deprecation warning
    │   • Bridge 观测旧版本使用比例
    │
    ▼ Day 15-30: 过渡期（强制阻断新功能开发）
    │   • 旧版本禁止新增绑定（只读）
    │   • 存量产品必须完成迁移才能发版
    │
    ▼ Day 31: 退役期
        • 旧版本编译产物停止维护
        • 紧急安全补丁不再回溯
```

**例外**：`immutable: true` 的语义令牌变更不受窗口期保护，必须立即升级。

### 4.3 产品绑定配置迁移示例

```yaml
# 产品绑定配置（bindings/product-a.yaml）
# 迁移前 v1.1.0
product:
  name: "product-a"
  registry_version: "1.1.0"
  semantic_tokens:
    - "status.critical"
    - "status.warning"
  intent_contracts:
    - "destructive-action"

# 迁移后 v2.0.0
product:
  name: "product-a"
  registry_version: "2.0.0"          # ← 显式升级
  semantic_tokens:
    - "status.critical"             # ← 不变，直接继承
    - "status.warning"
    - "status.info"                 # ← MINOR 新增，可选接入
  intent_contracts:
    - "destructive-action"
    - "data-export-action"          # ← 新增契约
```

---

## 五、Breaking Change 修宪程序

### 5.1 提案阶段（Proposal）

1. **提案人**：域 Intent Steward 或联邦治理委员会成员
2. **提交物**：
   - 变更的 YAML Diff（`git diff`）
   - 影响面分析报告（由 Registry 自动生成）
   - 迁移成本评估（受影响产品清单）
   - 回滚预案
3. **提交至**：`schema-as-code/01-architecture-contract/breaking-change-proposals/`

### 5.2 评审阶段（Review）

| 评审方 | 关注点 | 时限 |
|:---|:---|:---|
| 联邦治理委员会 | 语义一致性、跨域冲突、经济学影响 | 3 个工作日 |
| 平台团队 | 编译可行性、产物兼容性、CI 影响 | 2 个工作日 |
| 受影响域 Steward | 域内迁移成本、业务中断风险 | 5 个工作日 |

### 5.3 表决与发布

- **通过条件**：委员会 2/3 多数通过 + 无平台团队技术否决 + 受影响域 Steward 无强烈反对
- **发布动作**：
  1. Registry 创建新版本目录 `v{MAJOR}.0.0/`
  2. Compiler 生成全量产物
  3. Bridge 发送迁移通知至受影响产品
  4. 更新 `latest` 软链
  5. 归档提案至 `proposals/archive/`

---

## 六、回滚策略

### 6.1 产物级回滚（编译产物错误）

```bash
# 场景：Compiler v2.0.0 生成的 TypeScript 类型有 bug
# 动作：回滚 Compiler 版本，重新编译 v2.0.0 产物

# 1. 标记产物版本为 deprecated
npm deprecate @company/intent-schema@v2.0.0 "TS 类型生成错误，请使用 v2.0.1"

# 2. 发布 PATCH v2.0.1（修复 Compiler，不改变 Schema 语义）
# 3. 下游产品自动获取 PATCH，无需修改绑定配置
```

### 6.2 协议级回滚（Schema 定义错误）

```bash
# 场景：v2.0.0 的 synonym-mapping 误将 "重大" 映射到 critical
# 动作：发布 PATCH v2.0.1 修正映射，但 Schema 版本保持 v2.0.0

# 关键：PATCH 可以修正 YAML 内容，但版本号必须递增
# 因为已编译产物可能被下游锁定，不能原地修改
```

### 6.3 紧急回滚（安全边界被突破）

```yaml
# 场景：发现某条 ai_prohibited 规则存在绕过漏洞
# 动作：Runtime 热补丁 + Registry 紧急 PATCH

runtime_hotfix:
  target_version: ">=2.0.0 <2.1.0"
  patch_rule:
    intent_id: "destructive-action"
    add_ai_prohibited: "POST:/api/v1/destructive/bypass"
  effective_immediately: true
```

**约束**：紧急热补丁必须在 24 小时内转化为正式 PATCH 版本，并补全场景测试。

---

## 七、版本兼容性矩阵

| 下游产品锁定版本 | Compiler 最新版本 | Validator 最新版本 | Runtime 最新版本 | 兼容性 |
|:---|:---|:---|:---|:---|
| v1.0.0 | v2.0.0 | v2.0.0 | v2.0.0 | ✅ 完全兼容（产物独立） |
| v1.1.0 | v2.0.0 | v2.0.0 | v2.0.0 | ✅ 完全兼容 |
| v2.0.0 | v2.0.0 | v2.0.0 | v2.0.0 | ✅ 完全兼容 |
| v2.0.0 | v3.0.0 | v3.0.0 | v3.0.0 | ⚠️ 需迁移（MAJOR 变更） |

**核心原则**：Compiler/Validator/Runtime 的最新版本必须保留最近 **2 个 MAJOR 版本** 的编译能力。

---

## 八、组织职责

| 角色 | 版本管理职责 |
|:---|:---|
| **联邦治理委员会** | MAJOR 版本审批、Breaking Change 修宪、退役决策 |
| **平台团队** | MINOR/PATCH 发布、Compiler 版本兼容、产物维护 |
| **域 Intent Steward** | 域内产品版本绑定管理、迁移计划制定、沙盒预览审批 |
| **产品接入工程师** | 显式锁定版本号、CI 版本校验、迁移执行 |

---

## 九、结语：版本即契约

在 Schema-As-Code 体系中，版本号不是装饰，而是**组织级语义契约的法律效力声明**。

- `v1.0.0` 意味着："这些语义边界已被冻结，你可以安全地依赖它们"
- `v2.0.0` 意味着："宪法已修正，请查阅影响面报告并在窗口期内完成迁移"
- `latest` 意味着："前沿版本，仅供沙盒验证，生产环境禁止直接引用"

**版本管理的终极目标**：让语义一致性从"人的记忆"转化为"系统的契约"，让每一次意图变更都有迹可循、有章可依、有工具可执行。

---

**关联文档**：
- [联邦自治顶层架构设计方案](./top-level-design.md)
- [Schema-As-Code 编译与推演机制规范](../02-platform-implementation/compilation-inference-spec.md)
- [Intent Schema Registry 语义注册表](../02-platform-implementation/module-01-registry.md)
