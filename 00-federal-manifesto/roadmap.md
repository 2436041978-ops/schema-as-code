# Schema-As-Code 演进路线图

> 本文档定义 Schema-As-Code 联邦自治架构从概念到落地的五阶段演进路径，以及各阶段与语雀知识库、GitHub 仓库的交付映射关系。

---

## 演进哲学

Schema-As-Code 不是一次性发布的框架，而是**渐进显化**的治理基础设施。每一阶段在前一阶段的约束显化基础上，增加新的工程能力，最终形成"控制平面 + 数据平面 + 观测闭环"的完整网格。

**核心原则**：
- **先立宪，后通电**：先定义协议本体（YAML），再建设编译/校验/拦截能力
- **先显化，后执行**：先让约束被看见（Git Diff），再让约束被执行（CLI/CI）
- **先单域，后联邦**：先在一个产品验证闭环，再推广为多域自治网格

---

## 五阶段路线图总览

| 阶段 | 名称 | 核心命题 | 语雀交付 | GitHub 交付 | 关键 DEMO |
|:---|:---|:---|:---|:---|:---|
| **Phase 0** | 理论奠基 | 设计意图断裂与组织经济学 | 第 1-3 篇文章 | 无 | 无 |
| **Phase 1** | 立宪期 | Schema-As-Code 命名与定义 | 📁00 总纲 + 📁01 概念与架构 | `schema-as-code` 初始化 + `docs/00` + `docs/01` | 架构拓扑大图 |
| **Phase 2** | 机制期 | 约束编译与四层推演 | 📁02 机制规范 | `packages/compiler` + `packages/validator` | 编译产物对比 + Validator CLI 录屏 |
| **Phase 3** | 节点期 | 运行时拦截与观测闭环 | 📁03 节点实现 | `packages/registry` + `packages/runtime` + `packages/bridge` | React HOC 拦截录屏 + Bridge 反哺 PR |
| **Phase 4** | 示例期 | 端到端可交互演示 | 📁04 端到端示例 | `examples/alert-card/` + Vercel 部署 | 🔥 Vercel 在线告警卡片 |
| **Phase 5** | 治理期 | 组织级联邦自治运营 | 📁05 联邦落地 | `docs/05` + `scripts/` + `v1.0.0` tag | 治理仪表盘（可选） |

---

## Phase 1：立宪期（Schema-As-Code 定义）

**目标**：完成 Schema-As-Code 的命名占领与架构定义，建立控制平面载体。

### 语雀交付
- **📁00 总纲**
  - 《引言：从设计意图到工程化契约》
  - 《Schema-As-Code 术语表》
  - 《演进路线图》（即本文档）
- **📁01 概念与架构**
  - 《声明式语义治理网格》
  - 《Schema-As-Code 联邦自治顶层架构设计方案》
  - 《语义契约层：控制平面与数据平面交互架构》
  - 《基础设施层适配规范》

### GitHub 交付
```
schema-as-code/
├── README.md                              # 联邦自治总入口
├── docs/assets/
│   ├── topology-governance-mesh.png       # 语义治理网格拓扑
│   ├── topology-federal-contract.png      # 联邦契约拓扑
│   └── topology-node-mesh.png             # 节点网格拓扑
├── 00-federal-manifesto/
│   ├── README.md
│   ├── architecture-manifesto.md          # 架构宣言与核心原则
│   ├── governance-topology.md             # 联邦治理拓扑
│   ├── glossary.md                        # 术语表
│   └── roadmap.md                         # 演进路线图（本文）
└── 01-architecture-contract/
    ├── README.md
    ├── top-level-design.md                # 顶层架构设计方案
    ├── meta-rules.md                      # 联邦元规则清单
    ├── version-migration.md               # 版本管理与迁移拓扑
    └── organizational-economics.md        # 组织经济学价值论证
```

### 关键 DEMO
- **架构拓扑大图**：一张可放大阅读的双轴正交模型图（控制平面-数据平面-基础设施层），作为语雀附件挂载。

### 里程碑
- `schema-as-code` 仓库创建
- `v0.1.0` 标签：控制平面载体定义完成

---

## Phase 2：机制期（编译与推演通电）

**目标**：让"机器查清单"真正跑起来——YAML 协议可被编译为可执行规则，LLM 输出可被四层推演安检。

### 语雀交付
- **📁02 机制规范**
  - 《Schema-As-Code 编译与推演机制规范》
  - 《意图协议编写指南》

### GitHub 交付
```
schema-as-code/
└── packages/
    ├── compiler/                          # 模块 2：契约编译器
    │   ├── README.md
    │   ├── package.json                   # CLI: intent-compile
    │   └── src/
    │       ├── index.js                   # 6 步编译管线
    │       └── plugins/                   # 平台适配插件占位
    │           ├── ant-design.js
    │           ├── carbon.js
    │           └── openapi.js
    └── validator/                         # 模块 3：四层推演引擎
        ├── README.md
        ├── package.json                   # CLI: intent-validate
        ├── src/
        │   ├── index.js                   # 调度器 + 短路逻辑
        │   └── tiers/
        │       ├── syntax.js              # T1: JSON Schema 校验
        │       ├── semantic.js            # T2: 令牌白名单 + 同义词黑名单
        │       ├── safety.js              # T3: 正则 + 人机边界
        │       └── aesthetic.js           # T4: 文案长度 + 可读性
        └── rules/                         # YAML 规则库
            ├── semantic-token-whitelist.yaml
            └── synonym-blacklist.yaml
```

### 关键 DEMO
1. **编译产物对比**：左侧 `semantic-tokens.yaml`，右侧生成的 `tokens.ts` + `eslint-rules.json`，证明"声明即产物"。
2. **Validator CLI 录屏**：
   ```bash
   # 合法输入（PASS）
   intent-validate --input ./examples/valid-alert.json
   # 输出：✅ No errors found

   # 非法输入（BLOCK）—— LLM 用了"严重"而非 status.critical
   intent-validate --input ./examples/invalid-alert.json --intent alert-card
   # 输出：❌ BLOCK [semantic-tier] "严重" 命中同义词黑名单
   ```

### 里程碑
- `packages/compiler` 可运行：YAML → 多平台产物
- `packages/validator` 可运行：四层推演 + 短路终止
- 语雀挂载 2 张新图：三阶段编译状态机、四层推演流程图

---

## Phase 3：节点期（五模块组网）

**目标**：补齐 Registry、Runtime、Bridge，形成完整数据平面，覆盖组件 → API → LLM 全链路。

### 语雀交付
- **📁03 节点实现**
  - 《Schema-As-Code 语义治理节点架构》总览
  - 模块 1：Intent Schema Registry 语义注册表
  - 模块 2：Schema Compiler 契约编译器（已填，链接引用）
  - 模块 3：Four-Tier Validator 四层推演引擎（已填，链接引用）
  - 模块 4：Governance Runtime 权限契约运行时拦截
  - 模块 5：Observability Bridge 观测闭环与组织级治理指标

### GitHub 交付
```
schema-as-code/
└── packages/
    ├── registry/                          # 模块 1：语义注册表
    │   ├── README.md
    │   └── src/
    │       ├── version-manager.js         # SemVer + 不可变性校验
    │       └── impact-analyzer.js         # Git Diff → 影响面报告
    ├── runtime/                           # 模块 4：治理运行时
    │   ├── README.md
    │   └── src/
    │       ├── guards/
    │       │   ├── react-hoc.js           # withIntentGuard
    │       │   ├── express-middleware.js  # apiGuardMiddleware
    │       │   └── llm-tool-guard.js      # toolGuard
    │       └── policy-loader.js           # 热加载 + 版本哈希校验
    └── bridge/                            # 模块 5：观测桥接器
        ├── README.md
        └── src/
            ├── normalizer.js              # 语义归一化
            ├── root-cause.js              # 归因引擎
            └── feedback/
                └── github-pr.js           # 自动创建 Registry PR
```

### 关键 DEMO
1. **Runtime HOC 拦截录屏**：React 页面渲染告警卡片，AI 输出"严重"时，按钮自动变禁用态 + 弹出人工确认弹窗。
2. **API 拦截录屏**：`POST /api/destructive` 不带 `human_confirmed` 返回 `422`。
3. **Bridge 反哺录屏**：GitHub Actions 自动创建 PR `[Auto] 收紧"严重"同义词规则`，附带归因报告。

### 里程碑
- 5 个 packages 均有独立 README 与使用说明
- 语雀挂载 1 张新图：节点拓扑图（Registry-Compiler-Validator-Runtime-Bridge 关系）

---

## Phase 4：示例期（端到端跑通）

**目标**：提供可交互的端到端演示，让面试官/用户能亲手点出一次"语义阻断"。

### 语雀交付
- **📁04 端到端示例**
  - 《端到端示例：告警卡片全链路》
  - 《模块接入指南》

### GitHub 交付
```
schema-as-code/
└── examples/
    └── alert-card/                        # 端到端示例
        ├── README.md                      # 独立说明 + Vercel 链接
        ├── package.json
        ├── intent-protocol/
        │   └── binding.yaml               # 产品绑定配置
        ├── frontend/
        │   ├── App.jsx                    # React + withIntentGuard
        │   └── mock-llm.js                # 模拟合法/非法输出
        └── backend/
            └── server.js                  # Express + apiGuardMiddleware
```

### 关键 DEMO（🔥 核心 Aha Moment）

**Vercel 在线告警卡片**：
- 用户选择"模拟 AI 输出"：
  1. **合法输出**（`status.critical`）→ 正常渲染绿色通过
  2. **非法输出**（`"严重"`）→ 页面实时阻断，显示红色"语义漂移：同义词黑名单命中"
  3. **非法输出**（建议自动修复）→ 安全层阻断，提示"高危操作需人工确认"

**标准**：打开网页 10 秒内能看到阻断效果，无需登录，手机端可访问。

### 里程碑
- `examples/alert-card` 可独立 `npm install && npm start`
- Vercel 部署链接放在仓库 README 顶部 + 语雀文档首屏
- 语雀挂载 2 张图：DEMO 截图（阻断态 vs 通过态）、接入流程图

---

## Phase 5：治理期（联邦自治运营）

**目标**：从"个人项目"升级为"组织级基础设施"，定义角色、流程、ROI 与风险治理。

### 语雀交付
- **📁05 联邦落地**
  - 《联邦落地手册》
  - 《版本管理与迁移策略》
  - 《Phase 1：语义锚定——联邦宪法与试点域》
  - 《Phase 2：契约闭环——Compiler 投产与 Steward 嵌入》
  - 《Phase 3：网格治理——全域联邦与观测闭环》

### GitHub 交付
```
schema-as-code/
├── docs/05-federal-landing/
│   ├── landing-playbook.md              # 联邦落地手册
│   ├── phase-01-semantic-anchor.md      # Phase 1 落地规范
│   ├── phase-02-contract-closure.md     # Phase 2 落地规范
│   └── phase-03-mesh-governance.md      # Phase 3 落地规范
└── scripts/
    └── governance-health-check.js       # 治理健康度扫描（可选）
```

### 关键 DEMO（可选）
- **治理仪表盘**：静态 HTML 页面展示语义一致性得分、规则拦截率、人工升级比例的模拟面板。

### 里程碑
- 仓库打 `v1.0.0` 标签
- README 更新为正式版宣言
- 语雀知识库结构定型

---

## 版本与里程碑对照

| 版本 | 阶段 | 核心能力 | 标志事件 |
|:---|:---|:---|:---|
| `v0.1.0` | Phase 1 | 控制平面定义 | `intent-schema-compiler` 作为协议载体发布 |
| `v0.2.0` | Phase 2 | 编译 + 推演 | Compiler + Validator npm CLI 可安装 |
| `v0.3.0` | Phase 3 | 运行时 + 观测 | Runtime HOC + Bridge 自动 PR 跑通 |
| `v0.4.0` | Phase 4 | 端到端示例 | Vercel 在线 DEMO 可访问 |
| `v1.0.0` | Phase 5 | 联邦自治 | 组织落地手册发布，网格正式运营 |

---

## 当前状态与下一步

**当前状态**：Phase 0 理论奠基已完成（第 1-3 篇文章已发布），Phase 1 立宪期进行中。

**下一步动作**：
1. 发布第 4 篇文章《Schema-As-Code：意图协议的形式化定义与声明式语义治理网格》
2. 创建 `schema-as-code` 仓库，按 Phase 1 骨架上传文件
3. 语雀 📁00 + 📁01 填满，挂载架构拓扑大图

**长期愿景**：当组织并行产品数超过 5 个、LLM 消费场景超过 10 个时，Schema-As-Code 联邦自治网格的 ROI 由负转正——语义治理从成本中心变为杠杆资产。

---

## 附件清单

| 序号 | 文件名 | 阶段 | 说明 |
|:---|:---|:---|:---|
| 1 | `topology-governance-mesh.png` | Phase 1 | 语义治理网格总拓扑（双轴正交模型） |
| 2 | `topology-federal-contract.png` | Phase 1 | 联邦契约拓扑（控制平面-数据平面-基础设施层） |
| 3 | `topology-node-mesh.png` | Phase 3 | 节点网格拓扑（五模块关系图） |
| 4 | `compilation-pipeline.png` | Phase 2 | 三阶段编译状态机 |
| 5 | `four-tier-inference.png` | Phase 2 | 四层推演流程图 |
| 6 | `demo-screenshot-pass.png` | Phase 4 | DEMO 通过态截图 |
| 7 | `demo-screenshot-block.png` | Phase 4 | DEMO 阻断态截图 |

> 所有附件原文件存放于 `docs/assets/` 目录，语雀文档通过 GitHub 原始链接引用。
