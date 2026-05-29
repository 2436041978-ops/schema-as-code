# 设计黑盒接入指南：Figma 插件

> **面向对象**：UI/UX 设计师、设计系统负责人  
> **接入模式**：黑盒（无需理解 YAML/JSON，通过 Figma 插件可视化消费语义令牌）  
> **核心能力**：设计稿实时语义校验、意图契约可视化、同义词漂移预警

---

## 一、设计黑盒的定位

在 Schema-As-Code 联邦自治架构中，设计师不需要阅读 `intent-schema-compiler` 仓库中的 YAML 协议，也不需要理解 Compiler/Validator 的编译管线。

**设计师的交互界面只有一个：Figma 插件。**

插件作为 Schema-As-Code 控制平面的**黑盒消费端**，自动完成以下动作：
1. 拉取最新版语义令牌（`semantic-tokens.yaml`）
2. 解析设计稿中的图层语义标签
3. 实时校验颜色/文案/组件是否符合意图契约
4. 对违规设计元素发出视觉警告

---

## 二、插件安装与配置

### 2.1 安装插件

1. 在 Figma 社区搜索 **"Schema-As-Code Intent Guard"**（或组织内部分发链接）
2. 点击 **Install** 安装至个人/团队工作区
3. 在 Figma 右侧插件面板找到 **Intent Guard** 图标

### 2.2 首次配置

打开插件后，填写三项配置：

| 配置项 | 说明 | 示例 |
|:---|:---|:---|
| **Registry Endpoint** | 语义注册表地址 | `https://raw.githubusercontent.com/your-org/intent-schema-compiler/main/schema/latest/` |
| **Domain ID** | 当前设计稿所属的语义域 | `experience-design` |
| **Product ID** | 当前产品绑定标识 | `product-a` |

> **黑盒原则**：设计师只需选择产品和域，YAML 版本管理、影响面分析由平台团队负责。

---

## 三、核心功能：三层语义校验

插件对设计稿执行三层实时校验，对应 Schema-As-Code 协议的三层结构：

### 3.1 语义层校验（Semantic Tier）

**校验目标**：设计稿中的颜色、文案、图标是否使用了正确的语义令牌。

**示例场景**：
- 告警卡片的背景色使用了 `#FF0000`，但语义令牌要求 `status.critical` 映射为 `#D32F2F`
- 插件提示：⚠️ **颜色偏离语义令牌 12%，建议同步为 `status.critical` 定义值**

**操作路径**：
1. 选中设计稿中的任意图层
2. 插件面板显示该图层绑定的语义令牌（如 `status.critical`）
3. 若手动修改了色值，插件在属性面板显示黄色警告徽章

### 3.2 治理层校验（Governance Tier）

**校验目标**：复杂组件（如告警卡片、支付流程）是否满足意图契约的强制组合规则。

**示例场景**：
- 设计师绘制了"删除按钮"，但未搭配"二次确认弹窗"
- 插件提示：🚫 **违反意图契约 `destructive-action`：缺少必填子组件 `ConfirmModal`**

**操作路径**：
1. 选中"删除按钮"组件实例
2. 插件读取该组件绑定的 `intent_contract_id`（如 `destructive-action`）
3. 扫描当前页面/画板，检查是否包含契约要求的子组件（`ConfirmModal`、`RiskHint`）
4. 缺失时在设计稿边缘显示红色虚线框 + 悬浮提示

### 3.3 执行层校验（Execution Tier）

**校验目标**：设计稿是否满足场景测试中的 Edge Case 约束。

**示例场景**：
- 设计师在告警卡片中写文案"严重故障，建议自动修复"
- 插件提示：🚫 **违反安全推演 `SAF-001`：禁止模式 "自动修复" 命中，建议改为 "人工排查后修复"**

**操作路径**：
1. 选中文案图层
2. 插件提取文本内容，与 `synonym-blacklist.yaml` 和 `prohibited-patterns.yaml` 比对
3. 命中禁止模式时，文案下方显示红色波浪线（类似拼写检查）

---

## 四、具体接入流程：以告警卡片为例

### Step 1：绑定语义令牌

设计师在 Figma 中绘制告警卡片：

1. 选中卡片背景图层
2. 打开插件面板 → **Bind Semantic Token**
3. 下拉选择 `status.critical`（插件从 Registry 拉取的最新令牌列表）
4. 插件自动将该图层的 `fill` 锁定为 `#D32F2F`，并添加元数据标签 `intent-token: status.critical`

> **黑盒体验**：设计师只需知道"这是系统故障级别"，不需要知道 `#D32F2F` 的色值或 YAML 定义。

### Step 2：绑定意图契约

1. 选中整个告警卡片（Frame/Component）
2. 插件面板 → **Bind Intent Contract**
3. 选择 `alert-card`（契约要求包含 `alert_level`、`root_cause`、`remediation` 三个子区域）
4. 插件扫描卡片内部图层结构，检查是否包含这三个命名区域
5. 若缺少 `remediation` 区域，插件提示：⚠️ **意图契约 `alert-card` 缺少必填区域 `remediation`**

### Step 3：文案语义校验

1. 设计师在 `alert_level` 区域输入文案"严重"
2. 插件实时校验：发现"严重"在 `synonym-mapping.yaml` 中被映射为 `status.critical`，但当前区域已绑定 `status.critical` 令牌
3. 插件提示：✅ **同义词映射正确，已自动替换为标准令牌引用**
4. 若设计师输入"紧急"且该词不在当前意图的 `allowed_contexts` 中，插件提示：⚠️ **"紧急"在当前上下文 `alert-card` 中未注册，建议改用 `status.critical` 或提交语义注册申请**

### Step 4：导出设计稿元数据

1. 点击插件面板 **Export Intent Metadata**
2. 生成 `design-intent.json` 文件，包含：
   - 所有图层绑定的语义令牌
   - 意图契约的组件组合关系
   - 文案的同义词映射记录
3. 该文件随设计稿交付给前端工程师，前端 `withIntentGuard` 直接消费

```json
// design-intent.json 示例（自动生成）
{
  "schema_version": "v1.1.0",
  "product_id": "product-a",
  "frames": [
    {
      "frame_id": "alert-card-001",
      "intent_contract": "alert-card",
      "semantic_tokens": {
        "background": "status.critical",
        "motion": "pulse.red.urgent",
        "sound": "alert.high"
      },
      "children": [
        { "layer_id": "alert-level", "token": "status.critical", "text": "P0" },
        { "layer_id": "root-cause", "constraints": { "min_length": 10 } },
        { "layer_id": "remediation", "human_mandatory": true }
      ]
    }
  ]
}
```

---

## 五、与 DESIGN.md 的协同

Figma 插件与 DESIGN.md 构成设计师的**双层工作流**：

| 层级 | 工具 | 设计师动作 | 输出 |
|:---|:---|:---|:---|
| **描述层** | DESIGN.md | 用 Markdown 写设计意图（"告警卡片用红色脉冲，需人工确认"） | 自然语言设计文档 |
| **约束层** | Figma 插件 | 用语义令牌绑定设计稿，实时校验边界 | 机器可读元数据 + 合规设计稿 |

**协同流程**：
1. 设计师在语雀/Notion 写 DESIGN.md 描述创意
2. 在 Figma 中绘制时，插件自动提示 DESIGN.md 中提到的语义约束（如"需人工确认" → 自动检查 `human_mandatory` 标记）
3. 设计稿交付时，同时输出：
   - `.fig` 设计文件
   - `design-intent.json`（插件生成）
   - `DESIGN.md`（设计描述文档）

前端工程师同时消费两份输入：DESIGN.md 理解意图，Schema-As-Code 约束执行。

---

## 六、黑盒原则：设计师不感知的内容

以下全部由平台团队通过 Compiler/Registry 自动维护，设计师**零感知**：

| 平台侧动作 | 设计师侧表现 |
|:---|:---|
| Registry 发布 `v1.1.0`，收紧 `status.critical` 的同义词防火墙 | 插件面板提示："语义令牌已更新，请重新校验设计稿" |
| Compiler 重新编译，生成新的 Figma 插件配置 | 插件自动静默更新，设计师无操作 |
| Validator 发现某同义词误用率上升 | 插件提升该词的警告级别（黄色 → 红色） |
| Bridge 创建 PR 新增 `status.warning` 令牌 | 插件下拉列表次日出现新选项 |

---

## 七、常见问题

### Q1：设计师必须学习 Schema-As-Code 吗？
**不需要。** 黑盒接入的设计目标是：设计师的交互界面与常规设计工具无异，只在属性面板多了一层语义标签。

### Q2：没有绑定的设计稿会怎样？
插件显示 **灰色状态**："未绑定意图契约，建议绑定以启用校验"。不阻断设计，但提示最佳实践。

### Q3：创意探索期不想被约束怎么办？
使用 **沙盒模式（Sandbox Mode）**：插件 → Settings → Enable Sandbox。此时所有校验降为灰色提示，不显示红色阻断。设计定稿后再关闭沙盒，执行正式校验。

### Q4：自定义颜色不在语义令牌中怎么办？
插件提供 **语义注册申请** 入口：点击颜色 → **Request New Token** → 填写业务语义描述 → 提交后自动创建 Registry PR（由 Intent Steward 审批）。

---

## 八、下阶段预告

设计黑盒接入只是 Schema-As-Code 联邦自治的**体验层入口**。下一阶段将发布：
- **前端黑盒接入指南**：React/Vue 的 `withIntentGuard` HOC，自动消费 `design-intent.json`
- **AI 黑盒接入指南**：LLM SDK 自动拉取语义约束，生成时即合规

---

**相关文档**：
- 控制平面载体：[intent-schema-compiler](https://github.com/2436041978-ops/intent-schema-compiler)
- 前端黑盒接入指南：[frontend-blackbox-guide.md](./frontend-blackbox-guide.md)
- 端到端示例：[end-to-end-alert-card.md](./end-to-end-alert-card.md)
