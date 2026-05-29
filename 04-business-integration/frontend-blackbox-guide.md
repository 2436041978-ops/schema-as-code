# 前端黑盒接入指南：标签约定式

> 面向前端工程师（React / Vue / Angular / 原生 JS）。无需理解 YAML 协议，通过标签约定让组件自动绑定语义契约。

---

## 一、定位：黑盒意味着什么

| 维度 | 白盒视角（平台团队） | 黑盒视角（前端工程师） |
|------|---------------------|----------------------|
| 需要理解 YAML 协议 | ✅ 必须 | ❌ 不需要 |
| 需要理解意图令牌 | ✅ 必须 | ❌ 不需要 |
| 需要修改组件代码 | ❌ 不需要 | ✅ 只需加标签/属性 |
| 需要关心编译管线 | ✅ 必须 | ❌ 不需要 |
| 需要关心版本管理 | ✅ 必须 | ❌ 自动跟随 |

**核心约定**：前端工程师只需在组件上标注 `data-intent` 或 `intent-contract` 标签，其余语义校验、运行时拦截、观测上报由平台自动完成。

---

## 二、前置条件

### 2.1 安装运行时包

```bash
npm install @schema-as-code/runtime
# 或
yarn add @schema-as-code/runtime
```

### 2.2 项目根目录配置

在应用入口（如 `App.jsx` / `main.ts` / `app.vue`）引入一次即可：

```javascript
// React: App.jsx
import { IntentRuntimeProvider } from '@schema-as-code/runtime/react';

function App() {
  return (
    <IntentRuntimeProvider registryEndpoint="https://your-registry.cdn/v1.1.0">
      <YourApp />
    </IntentRuntimeProvider>
  );
}
```

```javascript
// Vue: main.ts
import { createIntentRuntime } from '@schema-as-code/runtime/vue';

const intentRuntime = createIntentRuntime({
  registryEndpoint: 'https://your-registry.cdn/v1.1.0',
});

app.use(intentRuntime);
```

> 平台团队会提供具体的 `registryEndpoint`。前端工程师只需复制粘贴，无需关心该地址背后的版本管理逻辑。

---

## 三、接入方式：标签约定式

### 3.1 方式 A：HTML data-* 属性（推荐，框架无关）

适用于 React、Vue、Angular、原生 JS 以及服务端渲染（SSR）场景。

```html
<!-- 高危操作按钮：自动绑定 destructive-action 意图契约 -->
<button
  data-intent="destructive-action"
  data-intent-context="alert-card"
>
  立即删除
</button>

<!-- 告警卡片：自动绑定 alert-card 意图契约 -->
<div
  data-intent="alert-card"
  data-intent-level="P0"
>
  <span data-intent-field="alert_level">P0</span>
  <span data-intent-field="root_cause">CPU 使用率超过阈值</span>
</div>
```

**运行时行为**：
- 页面加载时，Runtime 自动扫描 `data-intent` 属性
- 从 Registry 拉取对应意图契约（缓存 5 分钟）
- 自动执行语义推演：若字段缺失或越界，控制台报错 + 可选阻断渲染

### 3.2 方式 B：React 高阶组件（HOC）

适用于需要 Props 类型收窄的场景。

```jsx
import { withIntent } from '@schema-as-code/runtime/react';

// 原始组件
function DangerButton({ onClick, children }) {
  return <button onClick={onClick}>{children}</button>;
}

// 绑定意图契约（一行代码）
const DestructiveButton = withIntent(DangerButton, {
  intentId: 'destructive-action',
  requiredFields: ['humanConfirmed'],
});

// 使用
<DestructiveButton
  onClick={handleDelete}
  humanConfirmed={userExplicitlyChecked}  // 类型提示：必填
>
  立即删除
</DestructiveButton>
```

**类型提示效果**：

```typescript
// 绑定后，TypeScript 会自动提示缺少必填字段
<DestructiveButton onClick={handleDelete} /> 
// ❌ TS 报错：Property 'humanConfirmed' is missing
```

### 3.3 方式 C：Vue 指令（Directive）

```vue
<template>
  <button v-intent="{ id: 'destructive-action', context: 'alert-card' }">
    立即删除
  </button>

  <div v-intent="{ id: 'alert-card', level: 'P0' }">
    <span v-intent-field="'alert_level'">P0</span>
  </div>
</template>
```

---

## 四、意图标签速查表

平台团队预置的常用意图标签，前端工程师直接复制使用：

| 业务场景 | 标签值 | 自动约束 |
|---------|--------|---------|
| 高危删除操作 | `data-intent="destructive-action"` | 必须二次确认、禁止 AI 直接执行 |
| 告警卡片 | `data-intent="alert-card"` | 字段必须含 `alert_level`、`root_cause` |
| 支付确认 | `data-intent="payment-confirm"` | 金额字段不可为空、必须人工确认 |
| 表单提交 | `data-intent="form-submit"` | 校验失败阻断提交 |
| 导航跳转 | `data-intent="navigation"` | 外链必须二次确认 |

> 若业务场景不在上表，联系 Intent Steward（域管理员）新增意图标签。前端工程师无需自行编写 YAML。

---

## 五、验证：如何确认接入成功

### 5.1 开发环境验证

打开浏览器控制台，Runtime 会自动输出日志：

```
[IntentRuntime] ✓ destructive-action bound to <button>
[IntentRuntime] ✓ alert-card bound to <div>
[IntentRuntime] ✓ semantic check passed: 3/3 fields valid
```

若出现红色报错：

```
[IntentRuntime] ✗ BLOCK: alert-card missing required field "root_cause"
[IntentRuntime] ✗ HINT: Add <span data-intent-field="root_cause">...</span>
```

### 5.2 CI 验证（可选）

平台团队可配置 ESLint 插件，在构建时扫描 `data-intent` 标签的合法性：

```bash
npm run lint
# 输出：
# ✓ data-intent="destructive-action" found in registry v1.1.0
# ✗ data-intent="unknow-action" not found in registry (did you mean "unknown-action"?)
```

---

## 六、故障排查

| 现象 | 原因 | 解法 |
|------|------|------|
| 控制台无 `[IntentRuntime]` 日志 | 未引入 `IntentRuntimeProvider` | 检查 App 入口是否包裹 Provider |
| `data-intent 标签无效` | 意图 ID 拼写错误 | 对照第四节速查表，或联系 Steward 确认 |
| 页面渲染被阻断 | 触发了安全推演（如缺少 humanConfirmed） | 按控制台提示补充必填字段 |
| 类型提示不生效 | TS 类型未正确推导 | 确认 `withIntent` 的泛型参数已传入 |
| 意图契约版本过旧 | Registry 缓存未刷新 | 清除浏览器缓存，或等待 5 分钟自动更新 |

---

## 七、示例：告警卡片完整接入

### 7.1 目标

实现一个告警卡片，满足以下约束：
- 告警等级必须是 `P0/P1/P2/P3`
- 根因描述不少于 10 字符
- 高危操作按钮必须人工确认

### 7.2 代码

```jsx
import { withIntent } from '@schema-as-code/runtime/react';

// 1. 绑定告警卡片意图
const AlertCard = ({ level, rootCause, confidence, onRepair }) => {
  return (
    <div data-intent="alert-card" data-intent-level={level}>
      <div className="alert-header">
        <span data-intent-field="alert_level">{level}</span>
        <span data-intent-field="confidence_score">{confidence}</span>
      </div>
      <div data-intent-field="root_cause">{rootCause}</div>

      {/* 2. 绑定高危操作意图 */}
      <RepairButton onRepair={onRepair} />
    </div>
  );
};

// 3. 修复按钮绑定 destructive-action
const RepairButton = withIntent(
  ({ onRepair, humanConfirmed }) => (
    <button
      onClick={onRepair}
      disabled={!humanConfirmed}
    >
      执行修复
    </button>
  ),
  { intentId: 'destructive-action' }
);

// 4. 使用
<AlertCard
  level="P0"
  rootCause="CPU 使用率超过阈值，导致服务响应延迟"
  confidence={0.85}
  onRepair={handleRepair}
/>
```

### 7.3 验证结果

```
[IntentRuntime] ✓ alert-card: alert_level="P0" valid
[IntentRuntime] ✓ alert-card: root_cause length=24 >= 10
[IntentRuntime] ✓ alert-card: confidence_score=0.85 in [0,1]
[IntentRuntime] ⚠ destructive-action: humanConfirmed=false, button disabled
```

---

## 八、边界与免责

| 事项 | 说明 |
|------|------|
| 性能影响 | Runtime 扫描为异步操作，不影响首屏渲染；首次拉取 Registry 约 50ms |
| 离线可用 | 意图契约缓存至 `localStorage`，断网时仍可使用上次版本 |
| 版本锁定 | 默认跟随 `latest`，如需锁定版本，联系平台团队配置 `intent-lock.json` |
| 沙盒豁免 | 实验性功能可添加 `data-intent-sandbox="true"` 跳过校验（需 Steward 审批） |

---

## 九、联系

- **Intent Steward（域管理员）**：负责新增/修改意图标签
- **平台团队**：负责 Runtime 升级、Registry 运维
- **Issue 反馈**：`https://github.com/your-org/schema-as-code/issues`

---

> **核心原则**：前端工程师只需关心 `data-intent="xxx"` 这一个标签。语义校验、版本管理、观测上报——全部黑盒化。
