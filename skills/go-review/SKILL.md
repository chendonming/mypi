---
name: go-review
description: Go 代码审查规范。当审查 .go 文件时激活此 skill，覆盖 Go 惯用法、并发安全、错误处理和接口设计。
---

# Go Code Review Checklist

> 此 skill 覆盖所有 Go 审查关注点，包括安全、错误处理、并发、代码质量和性能。

## CRITICAL（阻断合并）

### 安全

- **SQL 注入**：`database/sql` 查询中使用字符串拼接。
- **命令注入**：`os/exec` 中使用未验证的输入 — 使用参数化命令而非 shell 字符串。
- **路径遍历**：用户控制的文件路径没有 `filepath.Clean` + 前缀检查。
- **竞态条件**：没有同步的共享状态 — 使用互斥锁或 channel。
- **`unsafe` 包**：使用没有合理说明。
- **硬编码密钥**：源码中的 API 密钥、密码、令牌。
- **不安全的 TLS**：`InsecureSkipVerify: true` 在生产环境中。
- **`crypto/md5` / `crypto/sha1` 用于安全目的**：使用 SHA-256 或更高版本。

### 错误处理

- **忽略错误**：使用 `_` 丢弃错误。
- **缺少错误包装**：`return err` 没有 `fmt.Errorf("context: %w", err)` — 失去错误链。
- **对可恢复错误使用 panic**：使用错误返回替代。
- **缺少 `errors.Is`/`As`**：`err == target` 不展开错误链 — 使用 `errors.Is(err, target)`。
- **`defer` 中调用 `recover()` 但未记录**：无输出的静默恢复隐藏了 bug。

## HIGH（应修复）

### 并发

- **goroutine 泄漏**：没有取消机制（使用 `context.Context`）。
- **无缓冲 channel 死锁**：发送时没有接收者。
- **缺少 `sync.WaitGroup`**：goroutine 没有协调。
- **Mutex 误用**：未使用 `defer mu.Unlock()` — 可能死锁。
- **向已关闭的 channel 发送数据**：会导致 panic。
- **从 channel 接收但未检查关闭状态**：使用 `v, ok := <-ch` 惯用法。

### 代码质量

- **大函数（> 50 行）**：提取小函数。
- **深层嵌套（> 4 层）**：使用早返回和守卫子句。
- **非惯用写法**：`if/else` 而非早返回。
- **包级可变变量**：可变全局状态。
- **接口污染**：定义未使用的抽象。
- **导出的函数/类型没有 doc comment**：公共 API 应被记录。

### 设计模式

- **`interface{}` / `any` 参数而非泛型**：Go 1.18+ 可用类型参数。
- **接收者类型不一致**：同一类型的方法混合值接收者和指针接收者。
- **选程的零值没有意义**：结构体零值应立即可用或构造函数应明确。

## MEDIUM（建议）

### 性能

- **循环中字符串拼接**：使用 `strings.Builder`。
- **缺少 slice 预分配**：`make([]T, 0, cap)` 当容量已知时。
- **N+1 查询**：循环中的数据库查询 — 批量查询。
- **热路径中不必要的分配**：对象在热路径中创建和丢弃。
- **`sync.Pool` 的误用或缺失**：高频对象分配应复用。

### 最佳实践

- **Context 参数位置**：`ctx context.Context` 应是函数第一个参数。
- **表驱动测试**：测试应使用表驱动模式。
- **错误消息格式**：小写开头，无标点。
- **包命名**：简短、小写、无下划线。
- **循环中使用 defer**：资源累积风险 — 在循环中延迟释放资源。
- **魔法数字**：使用 `iota` 常量或命名常量替代。

## 常见误报（跳过）

- `context.Background()` 在 `main()` 和测试中是正常的
- 短变量名在局部范围内可接受（`r io.Reader`、`w io.Writer`）
- 小型项目的 `package main` 不需要 doc comment
- 简单的 getter/setter 可跳过 — Go 社区不强制

## 诊断命令

```bash
go vet ./...
staticcheck ./...
golangci-lint run
go build -race ./...
go test -race ./...
govulncheck ./...
```

## 批准标准

- **Approve**：无 CRITICAL 或 HIGH 问题
- **Warning**：仅有 MEDIUM 问题（谨慎合并）
- **Block**：发现 CRITICAL 或 HIGH 问题
