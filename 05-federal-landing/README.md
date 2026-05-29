# 05 联邦落地

> 面向：联邦治理委员会 + 平台团队 + 各域 TL  
> 目标：将 Schema-As-Code 从"架构设计"推进为"组织级基础设施"

## 定位

本目录是 Schema-As-Code 联邦自治架构的**最终交付层**。当 00-04 已完成概念定义、架构契约、平台实现、域级自治与业务接入后，05 负责回答最后一个问题：**怎么让这套体系在组织中真正运转起来？**

## 核心交付物

| 文档 | 面向 | 解决什么问题 |
|:---|:---|:---|
| [联邦落地手册](./landing-playbook.md) | 委员会 + 各域 TL | 角色分工、决策流程、风险治理、ROI 核算 |
| [Phase 1：语义锚定](./phase-01-semantic-anchor.md) | 试点域 TL + Intent Steward | 联邦宪法制定、首批语义令牌选定、试点域绑定 |
| [Phase 2：契约闭环](./phase-02-contract-closure.md) | 平台团队 + Steward | Compiler 投产、Validator 嵌入 CI、Runtime 试点拦截 |
| [Phase 3：网格治理](./phase-03-mesh-governance.md) | 委员会 + 全域 TL | 全域联邦推广、观测闭环常态化、治理健康度仪表盘 |

## 三阶段渐进路径

```
Phase 1 语义锚定（1-2 个月）
    │
    ├── 联邦宪法：定义语义域划分、元规则、版本策略
    ├── 试点域：选定 1-2 个核心产品（如告警系统、支付流程）
    ├── 首批令牌：定义 10-20 个高频语义令牌（status.critical / action.destructive 等）
    └── 绑定配置：试点域提交 intent-binding.yaml
    │
    ▼
Phase 2 契约闭环（2-3 个月）
    │
    ├── Compiler 投产：YAML → 产物编译流水线接入试点域 CI
    ├── Validator 嵌入：四层推演安检接入 LLM 输出管道
    ├── Runtime 试点：withIntentGuard / apiGuardMiddleware 上线
    └── 人机边界验证：高危操作拦截率、误报率基线建立
    │
    ▼
Phase 3 网格治理（3-6 个月）
    │
    ├── 全域联邦：5+ 产品接入 Registry，跨产品语义一致性可量化
    ├── 观测闭环：Bridge 常态化运行，自动反哺 PR 月均 2-3 条
    ├── 治理仪表盘：语义一致性得分、规则拦截率、人工升级比例可视化
    └── 组织经济学验证：治理成本 vs 熵增成本曲线交叉验证
```

## 与上游目录的衔接

| 上游目录 | 05 如何消费 |
|:---|:---|
| [00 联邦自治总纲](../00-federal-manifesto) | 宪法原则落地为委员会决策依据 |
| [01 架构契约](../01-architecture-contract) | 元规则与版本策略转化为落地检查清单 |
| [02 平台实现](../02-platform-implementation) | 五模块从"可用"推进为"投产" |
| [03 域级自治](../03-domain-autonomy) | Steward 从"手册阅读"推进为"日常运营" |
| [04 业务接入](../04-business-integration) | 工程师从"接入指南"推进为"批量 onboarding" |

## 关键判断：什么时候启动联邦落地？

满足以下任一条件，即进入 Phase 1：

1. **组织规模**：并行产品数 ≥ 5，或 LLM 消费场景 ≥ 10
2. **痛点显性**：已发生因语义漂移导致的生产事故（如 AI 建议自动修复引发数据丢失）
3. **治理负债**：人工走查覆盖率 < 30%，且规范更新滞后于代码迭代 1 个以上周期
4. **战略投入**：管理层明确将"AI 界面一致性"列为 Q3+ OKR

## 成功标准

| 阶段 | 北极星指标 | 达标值 |
|:---|:---|:---|
| Phase 1 | 试点域语义令牌绑定率 | 100%（核心链路全部绑定） |
| Phase 2 | 四层推演拦截率 | ≥ 90%（漂移事件被机器拦截） |
| Phase 3 | 组织级语义一致性得分 | ≥ 85%（跨产品语义合规率） |

---

**项目地址**：https://github.com/2436041978-ops/schema-as-code  
**控制平面载体**：https://github.com/2436041978-ops/intent-schema-compiler  
**语雀知识库**：https://www.yuque.com/u222739/draddi
