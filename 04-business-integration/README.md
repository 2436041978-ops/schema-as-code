# 04 业务接入

> 面向前端 / 设计 / AI 工程师的黑盒接入层。  
> 你不需要理解 YAML 协议细节，只需按约定使用标签、插件或 SDK，即可让业务界面自动纳入语义治理网格。

## 目录

| 文档 | 说明 | 面向角色 |
|:---|:---|:---|
| [前端黑盒接入指南：标签约定式](./frontend-blackbox-guide.md) | React/Vue 组件标签约定 + withIntentGuard 快速接入 | 前端工程师 |
| [设计黑盒接入指南：Figma 插件](./design-blackbox-guide.md) | Figma 插件读取语义令牌 + 设计稿合规检查 | 设计师 |
| [AI 黑盒接入指南：SDK 自动拉取](./ai-blackbox-guide.md) | LLM 调用时自动注入 Prompt 约束 + 输出校验 | AI 工程师 |
| [端到端示例：告警卡片全链路](./end-to-end-alert-card.md) | 从设计稿 → 组件 → API → LLM 的完整治理链路 | 全栈参考 |
| [DEMO](./demo/) | 可交互演示与绑定配置示例 | 所有人 |

## 快速开始（30 秒判断你是否需要接入）

**Q1：你的项目里有 LLM 生成的内容直接展示给用户吗？**  
→ 有 → 请阅读 [AI 黑盒接入指南](./ai-blackbox-guide.md)

**Q2：你的设计稿里使用了"严重/紧急/危急"等自然语言描述告警级别吗？**  
→ 有 → 请阅读 [设计黑盒接入指南](./design-blackbox-guide.md)

**Q3：你的前端代码里有"删除/支付/修改配置"等高危操作按钮吗？**  
→ 有 → 请阅读 [前端黑盒接入指南](./frontend-blackbox-guide.md)

**Q4：以上都没有？**  
→ 请先阅读 [端到端示例](./end-to-end-alert-card.md)，理解语义治理网格如何工作，再决定是否接入。

## 黑盒原则

业务接入层遵循**黑盒原则**：
- **不修改业务逻辑**：接入方式仅为标签、插件、SDK 包装器，不侵入现有代码
- **不学习 YAML**：语义协议由平台团队维护，业务方只消费编译后的产物（npm 包 / Figma 插件 / SDK）
- **渐进式**：可先接入单个组件或单个页面，无需全量改造

## 语雀文档

详细图文指南与视频演示见语雀：[Schema-As-Code 业务接入](https://www.yuque.com/u222739/draddi)

## 控制平面载体

意图协议 YAML 本体（白盒）见：[intent-schema-compiler](https://github.com/2436041978-ops/intent-schema-compiler)
