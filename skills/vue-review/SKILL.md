---
name: vue-review
description: Vue.js 代码审查规范。当审查 .vue 文件、含 Vue 导入的 .ts/.js 文件或 Vue 生态代码（Pinia、Vue Router、Nuxt）时激活此 skill。
---

# Vue.js Code Review Checklist

> 此 skill 覆盖 **Vue-specific** 审查关注点。通用 TypeScript 类型安全、async 正确性、Node.js 安全由 reviewer 自身或 `ts-review` 覆盖。
> 
> 对于 `.vue` 文件的 PR，应同时加载此 skill。对于纯 `.ts` 且无 Vue 导入的改动，不要加载此 skill。

## CRITICAL（阻断合并）

### 安全

- **`v-html` 使用未净化的用户输入**：用户控制的 HTML 未经 DOMPurify 或等效 allowlist 净化直接渲染。要求在同一调用点提供文档和净化。
- **`:href` / `:src` 绑定未验证的用户 URL**：`javascript:` 和 `data:` scheme 会执行代码。要求对所有动态属性绑定做 URL scheme 验证。
- **SSR（Nuxt）密钥泄露**：`useRuntimeConfig().public` 中包含密钥或令牌。客户端可访问的 composable 访问了服务端数据。
- **API 路由缺少输入验证（Nuxt Nitro）**：`server/api/` 或 `server/routes/` 中的服务端点未使用 schema（zod/valibot）验证 body/query/params。
- **`localStorage`/`sessionStorage` 存储会话令牌**：任何 XSS 都可访问。要求使用 httpOnly cookie。

### 响应式

- **解构 reactive props（Vue < 3.5）**：`const { title } = defineProps(...)` 捕获的是快照拷贝，解构后的值不是响应式的。使用 `toRefs()` 或通过 `props.xxx` 访问。**Vue 3.5+**：响应式解构已稳定并默认启用，但不能直接 `watch()` 解构出的 prop 变量，必须包装在 getter 中：`watch(() => count, ...)`。
- **`ref()` 包裹对象但在 `<script>` 中缺少 `.value`**：`<script setup>` 在模板中自动解包 ref，但在 `<script>` 中 `.value` 是必须的。
- **用 `reactive()` 创建原始值**：`reactive()` 只对对象/数组生效。原始值使用 `ref()`。
- **替换整个 `reactive()` 对象**：`state = newState` 破坏响应式 — 改为修改属性或使用 `Object.assign(state, newState)`。
- **Watcher source 是返回 reactive 数据的 getter 但缺少 `.value`**：`watch(() => myRef, ...)` 观察的是 ref 对象本身（不会变），而不是其值。必须用 `watch(() => myRef.value, ...)`。
- **直接 watch 解构出的 prop（Vue 3.5+）**：`watch(count, ...)` 对解构出的 prop 会导致编译错误。使用 `watch(() => count, ...)`。

## HIGH（应修复）

### Composables

- **Composable 在模块作用域有副作用**：在 `setup` / 组件生命周期外初始化状态、启动定时器或订阅，副作用会跨组件实例持久化。
- **缺少清理**：composable 内的 `watch`、`watchEffect`、事件监听、定时器和 fetch 请求必须在返回的 teardown 函数或 `onUnmounted` 中清理。
- **Composable 接收 reactive 状态但存储了快照**：接受 `ref` 参数但读取 `.value` 一次后存储展开的值，源变化不会传播。
- **Composable 返回非 reactive 数据**：应使用 `ref()`/`reactive()`/`computed()` 但返回了普通对象或原始值。
- **Composable 未以 `use` 开头**：破坏了 lint 检测和 Vue 约定 — 重命名为 `useFoo`。

### 模板安全与正确性

- **`v-for` 缺少 `:key`**：Vue 无法追踪元素身份，导致 DOM 复用错误和重新渲染时的状态不匹配。
- **`v-for` 使用 `:key={index}`**：重排序、插入或删除会将状态/子元素附加到错误的行。使用稳定的数据库 ID。
- **同一元素上同时使用 `v-if` + `v-for`**：`v-if` 在 `v-for` 迭代前按元素评估，条件在迭代项上运行而非在迭代上。几乎总是逻辑错误。使用 `<template v-for>` + 内部 `v-if` 或 computed 过滤列表。
- **`v-model` 绑定到没有 setter 的 computed**：用户输入被静默忽略 — 必须同时提供 `get` 和 `set`，或绑定到可写的 ref。
- **`v-bind="$attrs"` 但未设置 `inheritAttrs: false`**：属性同时应用于根元素和转发目标。必须显式禁用继承。

### 组件架构

- **大型 SFC（模板 + script 超过 300 行）**：提取子组件或 composable。长 SFC 损害可读性、可测试性和 tree-shaking。
- **修改 props**：直接修改 props（即使是 reactive 对象）是被禁止的 — Vue 在开发模式下会发出警告。使用 `defineEmits` 向上通信，或 `v-model` 实现双向绑定。
- **缺少 prop 验证**：每个 prop 至少应有 `type`，并在适当时有 `required`/`default`。使用完整的 `defineProps` 类型语法或运行时验证器。
- **事件使用驼峰命名**：Vue 约定是 kebab-case（`@update:model-value`）。在模板中优先使用 kebab-case。
- **通过 `document.querySelector` / `ref` 直接操作 DOM**：优先使用模板 ref（`ref="el"`）配合 `useTemplateRef`。原始 DOM 选择器破坏组件封装。

### Vue Router

- **路由守卫返回 `false` 但未提供替代导航**：用户被卡住 — 必须重定向或显示原因。
- **`useRoute().params` 在 setup 顶层解构**：params 在相同组件内路由导航时变化 — 解构只捕获一个快照。通过 `toRefs(useRoute().params)` 或 `computed()` 访问。
- **懒加载路由缺少错误/加载组件**：分包拆分没有 fallback — 显示 fallback UI。

### 状态管理（Pinia）

- **非可序列化数据存储在 Pinia state 中**：保存的状态（SSR hydration、devtools、本地持久化）无法往返。
- **Store action 缺少错误边界**：异步 store action 应处理失败，不留下不一致的 state。

### SSR（Nuxt-specific）

- **浏览器 API 未用 `process.client` 或 `onMounted` 保护**：`window`、`document`、`localStorage` 在服务端构建时崩溃。
- **`useAsyncData` / `useFetch` 缺少 `key`**：重复的服务端请求，缓存去重失效。
- **`<ClientOnly>` 包裹需要 SEO 的内容**：服务端渲染空的包装 — 搜索引擎看不到内容。
- **通过 `useRuntimeConfig().public` 泄露环境变量**：所有 `.public` 运行时配置视为暴露给客户端。

## MEDIUM（建议）

### 性能

- **`computed()` 中有昂贵操作但未用缓存**：每次依赖变化重新计算。数组排序/过滤应改用 watcher 手动控制。
- **大型不可变结构未使用 `shallowRef`**：`ref()` 添加深层响应式，对于整体替换的大型数组/对象开销大。
- **`v-memo` 用于很少变化的列表**：并非普遍优化 — 增加了比较成本。先 profiling。
- **`v-show` vs `v-if` 选择不当**：`v-show` 始终渲染，`v-if` 销毁/重建。
- **`<KeepAlive>` 缺少 `max`**：无界缓存无限增长 — 设置 `:max`。

### 表单

- **表单缺少 `<form>` 元素和 `@submit.prevent`**：失去原生提交（Enter 键）、浏览器自动填充集成和可访问性树。
- **第 3 方表单库使用不当**：非平凡表单使用 VeeValidate、FormKit 或 Vue 原生验证。手动验证易出错。
- **输入防抖使用 `watch` + 手动 `setTimeout` 而非 `useDebounceFn`**：composable 正确处理 teardown、pendding 状态和取消。

### 组合

- **新代码中使用 Options API（Vue 3 项目）**：新组件应使用 `<script setup>` Composition API。
- **Vue 3 项目中使用 Mixin**：Mixin 是源头冲突和不透明数据流。替换为 composable。
- **`defineExpose` 暴露过多**：通过模板 ref 泄露组件内部 — 只暴露预期的公共 API。
- **普通 ref 用于模板引用（Vue 3.5+）**：优先使用 `useTemplateRef('name')`，它支持动态 ref ID 并提供更好的类型安全。

## 常见误报（跳过）

- Vue 3.5+ 中解构 props 是安全的 — 不需要 `toRefs()`
- `<script setup>` 中模板自动解包 ref — 模板中不需要 `.value`
- Options API 在现有 Options API 组件中维护时合理

## 诊断命令

```bash
npx eslint . --ext .vue,.ts,.js         # 确认 eslint-plugin-vue 已配置
vue-tsc --noEmit                         # Vue-specific 类型检查
npm run typecheck --if-present           # 使用项目规范命令
```

## 批准标准

- **Approve**：无 CRITICAL 或 HIGH 问题
- **Warning**：仅有 MEDIUM 问题（谨慎合并）
- **Block**：发现 CRITICAL 或 HIGH 问题
