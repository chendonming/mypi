---
name: python-review
description: Python 代码审查规范。当审查 .py 文件时激活此 skill，覆盖 PEP 8、Pythonic 惯用法、类型安全、安全性和性能。
---

# Python Code Review Checklist

> 此 skill 覆盖所有 Python 审查关注点，包括安全、错误处理、类型注解、Pythonic 模式和并发。

## CRITICAL（阻断合并）

### 安全

- **SQL 注入**：查询中使用 f-string — 使用参数化查询。
- **命令注入**：shell 命令中使用未验证的输入 — 使用 `subprocess` 列表参数。
- **路径遍历**：用户控制的路径 — 用 `normpath` 验证，拒绝 `..`。
- **`eval`/`exec` 滥用**：除非有备录的安全理由，否则禁止在生产代码中使用。
- **不安全的反序列化**：`pickle.load()`、`yaml.load()`（非 `safe_load`）— 可能执行任意代码。
- **硬编码密钥**：源码中的 API 密钥、密码、令牌。
- **弱加密**：将 MD5/SHA1 用于安全目的。
- **YAML 不安全加载**：`yaml.load(input, Loader=yaml.UnsafeLoader)` — 使用 `yaml.safe_load`。

### 错误处理

- **裸 except**：`except: pass` — 捕获特定异常。
- **吞没异常**：静默失败 — 记录并处理。
- **缺少上下文管理器**：手动文件/资源管理 — 使用 `with`。

## HIGH（应修复）

### 类型注解

- **公共函数没有类型注解**：所有公共 API 应有完整的类型签名。
- **可能指定具体类型时使用 `Any`**：`Any` 破坏类型检查器的有效性。
- **可空参数缺少 `Optional`**：`def f(x: str = None)` → `def f(x: Optional[str] = None)`。
- **返回类型缺失**：函数签名应包含 `-> ReturnType`。

### Pythonic 模式

- **C 风格循环而非列表推导**：`result = []; for x in items: result.append(transform(x))` → `[transform(x) for x in items]`。
- **`type() ==` 而非 `isinstance()`**：`type(x) == str` → `isinstance(x, str)`。
- **魔法数字而非 `Enum`**：`if status == 1` → 使用 `Enum` 命名常量。
- **循环中字符串拼接而非 `"".join()`**：`s += x` 在循环中是 O(n²)。
- **可变默认参数**：`def f(x=[])` → `def f(x=None)`，函数体内 `x = x or []`。

### 代码质量

- **函数超过 50 行或超过 5 个参数**：提取子函数或使用 dataclass。
- **深层嵌套（> 4 层）**：使用早返回或守卫子句减少缩进。
- **重复代码模式**：抽象为共享函数或类。
- **魔法数字没有命名常量**：所有字面量应赋给有意义的名称。

### 并发

- **共享状态没有锁**：使用 `threading.Lock`。
- **async 中混合阻塞调用**：阻塞 API（`time.sleep()`、`requests.get()`）在 async 代码中 — 使用 `asyncio.to_thread` 或 `httpx.AsyncClient`。
- **N+1 查询**：循环中的数据库查询 — 批量查询。

## MEDIUM（建议）

### 最佳实践

- **PEP 8 违反**：导入顺序、命名约定、间距、行长度。
- **公共函数缺少 docstring**：为公共模块、类、函数编写文档。
- **`print()` 而非 `logging`**：生产代码使用 `logging` 模块。
- **`from module import *`**：命名空间污染 — 显式导入。
- **`value == None` 而非 `value is None`**：`==` 可能被重载。
- **遮蔽内置函数**：`list`、`dict`、`str`、`type` 作为变量名。

### 框架特定

- **Django**：`select_related`/`prefetch_related` 处理 N+1，`atomic()` 处理多步操作，迁移检查。
- **FastAPI**：CORS 配置、Pydantic 验证、响应模型、async 函数中无阻塞调用。
- **Flask**：适当的错误处理器、CSRF 保护。

## 常见误报（跳过）

- `assert` 在测试代码中是正常的
- 单字母变量名在短列表推导或 lambda 中可接受（`[x for x in items]`）
- 类型注解在仅限内部的脚本中不是强制要求

## 诊断命令

```bash
mypy .                                     # 类型检查
ruff check .                               # 快速 lint
black --check .                            # 格式检查
bandit -r .                                # 安全扫描
pytest --cov=app --cov-report=term-missing # 测试覆盖率
```

## 批准标准

- **Approve**：无 CRITICAL 或 HIGH 问题
- **Warning**：仅有 MEDIUM 问题（谨慎合并）
- **Block**：发现 CRITICAL 或 HIGH 问题
