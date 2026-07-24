---
name: react-review
description: React 代码审查规范。当审查 .tsx/.jsx 文件或 React 组件逻辑时激活此 skill，覆盖 hooks 规则、RSC 边界、状态管理、a11y 和性能。
---

# React Code Review Checklist

> 此 skill 覆盖 **React-specific** 审查关注点。通用 TypeScript 类型安全、async 正确性、Node.js 安全由 reviewer 自身或 `ts-review` 覆盖。
> 
> 对于 JSX/TSX 文件的 PR，应同时加载此 skill。对于纯 `.ts` 且无 React 导入的改动，不要加载此 skill。

## CRITICAL（阻断合并）

### 安全

- **`dangerouslySetInnerHTML` 使用未净化的用户输入**：用户控制的 HTML 未经 DOMPurify 或等效 allowlist 净化。要求在同一调用点提供文档和净化。
- **`href` / `src` 绑定未验证的用户 URL**：`javascript:` 和 `data:` scheme 会执行代码。要求 URL scheme 验证。
- **Server Action 没有输入验证**：`"use server"` 函数接受 `FormData` 或参数时没有 schema（zod/yup/valibot）。将其视为公共 API 端点。
- **密钥在客户端 bundle 中**：`NEXT_PUBLIC_*`、`VITE_*`、`REACT_APP_*` 或任何客户端导入的环境变量持有私钥、令牌或服务端密钥。
- **`localStorage`/`sessionStorage` 存储会话令牌**：任何 XSS 都可访问。要求使用 httpOnly cookie。

### Hook 规则

- **条件 hook 调用**：`if`、`for`、`&&`、三元表达式或早返回后的 hook。`eslint-plugin-react-hooks` 应已检出；如果 lint 规则被禁用则标记。
- **Hook 在组件或自定义 hook 外调用**：普通函数中的 `useState`。
- **直接修改 state**：`state.push(x)`、`obj.foo = 1` 后调用 `setObj(obj)`。修改不会触发重新渲染，破坏 memoized 子组件的 `===` 检查。

## HIGH（应修复）

### Hook 正确性

- **`useEffect`/`useMemo`/`useCallback` 缺少依赖**：内部引用的响应式值但不在 deps 数组中。标记每个无理由注释的 `// eslint-disable-next-line react-hooks/exhaustive-deps`。
- **Effect 用于派生状态**：`setX(computed(props.y))` 在 `useEffect([props.y])` 内部。应在渲染期间计算。
- **Effect 缺少清理**：订阅、定时器、监听器、无 `AbortController` 的 fetch。
- **陈旧闭包**：异步处理器或定时器捕获了已变更的值。使用函数式更新或 ref 修复。
- **自定义 hook 未以 `use` 开头**：破坏了 lint 检测 — 重命名。

### Server/Client 边界（Next.js App Router / RSC）

- **Server-only 导入出现在 Client Component 中**：`"use client"` 文件导入标记为 `"server-only"` 的模块或已知 DB 客户端。
- **`"use client"" 传播**：标记为 `"use client"` 的文件导入了一棵树，但其中许多组件不需要成为 Client Component — 指令会传播。
- **通过 props 泄露敏感数据**：Server Component 将完整用户记录（含密码哈希、令牌）传递给 Client Component。
- **Server Action 没有 auth 检查**：`"use server"` 函数未确认当前用户有权执行操作。

### 可访问性

- **交互元素没有键盘可达性**：`<div onClick>` 而非 `<button>`。纯鼠标交互排除键盘和辅助技术用户。
- **表单输入没有 label**：`<input>` 没有关联的 `<label htmlFor>` 或 `aria-label`/`aria-labelledby`。
- **`<img>` 缺少 `alt`**：装饰图需要 `alt=""`，内容图需要描述。
- **`target="_blank"` 没有 `rel="noopener noreferrer"`**：窗口 opener 劫持风险。
- **ARIA 误用**：`aria-label` 在非交互元素上，`role` 覆盖原生语义。
- **标题顺序违反**：跳过级别（`<h1>` 然后 `<h3>`）。
- **颜色作为唯一指示符**：错误仅通过红色文本表示，没有图标或文本标签。

### 渲染与状态正确性

- **动态列表使用 `key={index}`**：重排序、插入或删除将状态附加到错误的行。使用稳定的 ID。
- **重复的 state**：相同数据存储在两个 `useState` 中，或在 state 和计算副本中。
- **`useEffect` 链**：一个 effect 设置 state，触发另一个 effect，再设置更多 state。改为在渲染期间派生或合并。
- **从 prop 初始化 state 但未使用 `key`**：prop 变化时组件不重置；在父组件用 `key={propValue}` 修复。

## MEDIUM（建议）

### 性能

- **过度 memo**：`useMemo`/`useCallback` 没有可衡量的收益 — props 在大多数渲染中变化，或者值没有被 memoized 子组件或其他 hook 的 deps 使用。
- **内联新对象/函数作为 memoized 子组件的 prop**：破坏 `React.memo`。
- **渲染中执行重操作没有 `useMemo`**：同步解析、排序、正则编译每次渲染都执行。
- **仅在路由根节点使用 Suspense**：整体加载状态而非渐进式显示。将边界推近数据。
- **长列表缺少虚拟化**：50+ 可见项且非平凡的行。
- **`useContext` 用于高频更新值**：所有消费者每次变化重新渲染。

### 表单

- **没有语义 `<form>` 元素**：失去原生提交（Enter 键）、浏览器表单集成、可访问性树。
- **`onSubmit` 没有 `preventDefault()`**：页面导航，状态丢失（除非使用 React 19 form actions）。
- **非平凡表单中自己实现验证**：推荐 React Hook Form、TanStack Form 或 React 19 `useActionState`。
- **表单中的 input 缺少 `name` 属性**：无法通过 `FormData` 读取。

### 组合

- **props 穿透超过 3 层**：考虑 Context 或 `children` 组合替代。
- **组件超过 200 行**：提取子组件或自定义 hook。
- **新代码中使用 Class Component**：改为函数组件。

## 常见误报（跳过）

- `useEffect` 空 deps `[]` 用于挂载逻辑（mount only）是正常模式
- `ref` 不需要在 deps 中（`useRef` 返回值稳定）
- `dispatch`（useReducer）和 `setState` 不需要在 deps 中（React 保证稳定）
- 服务端组件不需要 `"use client"`

## 诊断命令

```bash
npx eslint . --ext .tsx,.jsx                         # 确认 eslint-plugin-react-hooks 已配置
npm run typecheck --if-present                        # 使用项目规范命令
tsc --noEmit -p <tsconfig>                            # fallback 类型检查
npx prettier --check .                                # 格式检查
npm audit                                             # 供应链建议
```

## 批准标准

- **Approve**：无 CRITICAL 或 HIGH 问题
- **Warning**：仅有 MEDIUM 问题（谨慎合并）
- **Block**：发现 CRITICAL 或 HIGH 问题
