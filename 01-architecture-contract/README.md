# 01 架构契约

> 面向架构师与联邦治理委员会的白盒契约层。

本目录定义 Schema-As-Code 联邦自治架构的顶层契约、元规则与治理边界。所有文档均为白盒视角，面向需要理解系统整体拓扑、决策权限分配与版本演进策略的架构决策者。

---

## 目录导航

| 文档 | 说明 | 关键读者 |
|:---|:---|:---|
| [联邦自治顶层架构设计方案](./top-level-design.md) | 双轴正交模型、联邦自治拓扑、五层穿透与平台-域-业务三级治理边界 | 首席架构师、联邦治理委员会 |
| [联邦元规则清单](./meta-rules.md) | 不可变的架构元规则：自治边界、契约优先级、冲突仲裁与豁免机制 | 架构师、平台 TL、域架构代表 |
| [版本管理与迁移拓扑](./version-migration.md) | SemVer 联邦扩展、Breaking Change 判定、蓝绿迁移窗口与回滚策略 | 平台工程师、发布负责人 |
| [组织经济学价值论证](./organizational-economics.md) | 治理熵增公式、ROI 拐点模型、联邦自治的边际成本递减论证 | 技术 VP、工程总监、委员会 |

---

## 阅读路径建议

1. **首次阅读**：先读《联邦自治顶层架构设计方案》，建立整体拓扑认知
2. **决策评审**：参考《联邦元规则清单》进行架构决策与冲突仲裁
3. **发布规划**：依据《版本管理与迁移拓扑》制定域级投产节奏
4. **资源申请**：使用《组织经济学价值论证》作为治理基础设施的预算依据

---

## 与语雀知识库的对应关系

本目录对应语雀知识库 **📁01 架构契约**：
- [Schema-As-Code 联邦自治顶层架构设计方案](https://www.yuque.com/u222739/draddi/genscvxnb61hmeog)
- [联邦元规则清单](https://www.yuque.com/u222739/draddi/auuo93h3h9nq7ngg)
- [版本管理与迁移拓扑](https://www.yuque.com/u222739/draddi/aghi4l9beai8ymzh)
- [组织经济学价值论证](https://www.yuque.com/u222739/lxcrw1/pgkz9yged49dz3fi)

语雀提供更完整的图文阅读体验与评论互动，本仓库保留 Markdown 源文件用于版本追踪与 Diff 审阅。

---

## 附件

本目录引用的架构图与拓扑图原文件统一存放于仓库根目录 `docs/assets/`：
- `topology-federal-contract.png` — 联邦契约拓扑图
- `topology-governance-mesh.png` — 语义治理网格拓扑图

---

## 控制平面载体

意图协议 YAML 本体（语义层 / 治理层 / 执行层）见：
👉 [intent-schema-compiler](https://github.com/2436041978-ops/intent-schema-compiler)
