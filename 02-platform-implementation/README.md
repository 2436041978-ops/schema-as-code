# 02 平台实现

> **面向：平台团队（白盒基础设施）**
>
> 声明式语义治理网格的工程化实现——从控制平面协议到数据平面节点的完整技术规范。

---

## 目录定位

本目录面向**平台团队**与**基础设施工程师**，提供 Schema-As-Code 联邦自治架构的**白盒实现规范**。内容涵盖：

- 语义治理网格的拓扑与交互协议
- 控制平面与数据平面的分层架构
- 五层穿透模型与基础设施适配
- 编译与推演机制的状态转换规范
- 五大治理节点的详细设计与接口定义

---

## 架构总览

```
控制平面（intent-schema-compiler）
    │
    ▼ 声明式同步（GitOps）
┌─────────────────────────────────────────┐
│           数据平面（Data Plane）          │
│                                          │
│  Registry ──► Compiler ──► Validator   │
│     │           │            │          │
│     │           │            │          │
│     └───────────┴────────────┘          │
│                   │                      │
│                   ▼                      │
│  Runtime ◄────── Bridge（闭环反哺）     │
└─────────────────────────────────────────┘
    │
    ▼ 正交穿透
基础设施层（Token → 组件 → API → 容器 → DB / LLM）
```

---

## 文档清单

### 架构规范

| 文档 | 说明 | 面向 |
|:---|:---|:---|
| [声明式语义治理网格](./semantic-governance-mesh.md) | 网格拓扑、双轴正交模型、声明式治理原理 | 架构师 + 平台 TL |
| [语义契约层：控制平面与数据平面交互架构](./semantic-contract-layer.md) | 控制平面-数据平面协议、版本同步、影响面分析 | 平台架构师 |
| [基础设施层适配规范](./infrastructure-adapter.md) | 五层穿透模型（L1-L5）、Ant Design / Carbon / LoongSuite 集成 | 平台工程师 |
| [Schema-As-Code 编译与推演机制规范](./compilation-inference-spec.md) | 三阶段编译架构、四层推演校验机制、动态编译执行 | 编译器/引擎开发 |

### 节点实现

| 模块 | 文档 | 核心职责 |
|:---|:---|:---|
| **模块 1** | [Intent Schema Registry 语义注册表](./module-01-registry.md) | 语义 ID 全局注册、版本管理、影响面分析 |
| **模块 2** | [Schema Compiler 契约编译器](./module-02-compiler.md) | YAML 协议 → 可执行约束产物（TS/ESLint/OpenAPI/OPA） |
| **模块 3** | [Four-Tier Validator 四层推演引擎](./module-03-validator.md) | 语法/语义/安全/美感四层推演，阻断优于修正 |
| **模块 4** | [Governance Runtime 权限契约运行时拦截](./module-04-runtime.md) | 组件 HOC / API 中间件 / LLM Tool Guard 现场拦截 |
| **模块 5** | [Observability Bridge 观测闭环与组织级治理指标](./module-05-bridge.md) | 漂移归因、自动反哺 PR、治理仪表盘 |

---

## 快速导航

- **上层契约**：见 [01 架构契约](../01-architecture-contract)
- **域级自治**：见 [03 域级自治](../03-domain-autonomy)
- **业务接入**：见 [04 业务接入](../04-business-integration)
- **联邦落地**：见 [05 联邦落地](../05-federal-landing)

---

## 技术中立性声明

本目录所有节点设计遵循**接口层 / 适配层 / 核心层**三层隔离：

- **核心层**：零依赖特定框架，纯 Node.js / YAML / JSON 实现
- **适配层**：以独立插件文件存在，新增平台支持 = 新增 1 个适配文件
- **接口层**：输入输出协议（JSON Schema / YAML Schema）保持稳定

---

## 版本

`v0.1.0` — 平台实现骨架立宪

---

## 相关仓库

- **控制平面载体**：[intent-schema-compiler](https://github.com/2436041978-ops/intent-schema-compiler)
- **联邦自治总纲**：见 [00 联邦自治总纲](../00-federal-manifesto)
