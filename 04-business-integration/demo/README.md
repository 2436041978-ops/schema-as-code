# DEMO：告警卡片语义治理全链路

> 端到端可交互演示：从意图协议定义到运行时拦截的完整闭环。

## 演示目标

本 DEMO 展示 Schema-As-Code 联邦自治架构在真实业务场景中的落地路径：

1. **意图定义**：通过 `intent-schema-compiler` 定义告警卡片的语义契约
2. **编译生效**：Schema Compiler 将 YAML 协议编译为可执行约束产物
3. **推演安检**：Four-Tier Validator 对 LLM 输出执行四层推演
4. **运行时拦截**：Governance Runtime 在组件渲染层实时阻断语义漂移
5. **观测反哺**：Observability Bridge 采集漂移事件并反向修正协议

## 目录结构

```
demo/
├── README.md                    # 本文件
├── alert-card-binding.yaml      # 产品绑定配置：告警卡片 × 意图契约
├── frontend/                    # 前端演示（React + Ant Design）
│   ├── App.tsx
│   ├── components/
│   │   └── AlertCard.tsx        # 使用 withIntentGuard 的告警卡片组件
│   └── mocks/
│       ├── valid-output.json    # 合规 LLM 输出（预期 PASS）
│       └── invalid-output.json  # 漂移 LLM 输出（预期 BLOCK）
└── backend/                     # 后端演示（Express + API Guard）
    └── server.js                # 带 intent-guard 中间件的 API 服务
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动前端演示

```bash
cd frontend
npm run dev
# 或部署到 Vercel
vercel --prod
```

### 3. 启动后端演示

```bash
cd backend
npm run start
# 服务启动于 http://localhost:3000
```

### 4. 运行推演测试

```bash
npx intent-validate   --input ./frontend/mocks/invalid-output.json   --intent alert-card   --registry v0.1.0
```

预期输出：
```
❌ BLOCK — Found 3 error(s)
  [semantic] "严重" is not in enum ["P0","P1","P2","P3"]
  [safety]   remediation contains prohibited pattern: "自动执行"
  [syntax]   missing required field: human_confirmed
```

## 产品绑定配置

`alert-card-binding.yaml` 演示了如何将业务组件绑定到意图契约：

```yaml
# alert-card-binding.yaml
product_id: "demo-alert-system"
registry_version: "v0.1.0"

components:
  AlertCard:
    intent_contract: "AW-001"
    semantic_tokens:
      - "status.critical"
      - "status.warning"
    required_children:
      - "ConfirmModal"
    prohibited_props:
      color: "primary"  # 禁止将告警卡片设为主要按钮样式

api_endpoints:
  POST /api/v1/alerts:
    intent_contract: "AW-001"
    required_fields:
      - "human_confirmed"
```

## 交互演示场景

### 场景 A：合规渲染（PASS）

1. 打开前端页面
2. 选择「模拟合规 LLM 输出」
3. 页面正常渲染红色脉冲告警卡片
4. Validator 输出：`✅ No errors found`

### 场景 B：语义漂移（BLOCK）

1. 打开前端页面
2. 选择「模拟漂移 LLM 输出」（使用"严重"替代 `status.critical`）
3. `withIntentGuard` 拦截渲染，显示红色阻断提示：
   - 「语义令牌不匹配：预期 `status.critical`，收到 "严重"」
   - 「建议检查 synonym-mapping.yaml 的同义词防火墙」
4. 同时触发 Bridge 事件，记录漂移日志

### 场景 C：高危操作拦截（ESCALATE）

1. 在告警卡片点击「自动修复」
2. Runtime 检测到 `ai_prohibited` 命中
3. 按钮自动禁用，弹出强制人工确认弹窗
4. 未携带 `human_confirmed` 时，API 返回 `422 Unprocessable Entity`

## 控制平面载体

本 DEMO 消费的意图协议 YAML 本体来自控制平面：

👉 [intent-schema-compiler](https://github.com/2436041978-ops/intent-schema-compiler)

## 相关文档

- [前端黑盒接入指南](../frontend-blackbox-guide.md)
- [端到端示例：告警卡片全链路](../end-to-end-alert-card.md)
- [Schema-As-Code 编译与推演机制规范](../../02-platform-implementation/compilation-inference-spec.md)
- [模块 4：Governance Runtime](../../02-platform-implementation/module-04-runtime.md)

## 许可

MIT License
