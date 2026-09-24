# Changelog

All notable changes to this project will be documented in this file.

## [0.1.8] - 2026-09-24

### Fixed
- **修复 `pnpm run typecheck` 失败（`tsc --noEmit` 报 3 个错）**——仓库此前有一个红的 typecheck
  脚本，CI 也因此不敢开构建/类型门禁：
  - `TS2393 Duplicate function implementation`（`src/index.ts`）：文件尾多出一份
    `extractRequirementFromContent` 的**完整重复实现**（与正本逐字节相同，属误粘贴的死代码，
    且因 JS 函数声明后者覆盖前者的语义而实际生效）。已删除重复副本，行为不变。
  - `TS2322`（`extractRequirementName`）：`tsconfig` 开了 `noUncheckedIndexedAccess`，
    正则捕获组 `m[1]` 类型为 `string | undefined`，补 `?? null` 显式收敛。
- `/health` 的 `version` 字段不再硬编码（原为 `'0.1.7'`，会随发版漂移），改为经
  `createRequire` 从 `package.json` 读取（对齐同族的 `dsh-power-xc`）。

### Chore
- **工程化规范化**：
  - CI（`.github/workflows/ci.yml`）此前只校验 `lib/` 文件存在，现补齐 `pnpm run build` 与
    `pnpm run typecheck`（对齐同族的 `dsh-mobile-xc`），防止 `src/` 改坏或忘记构建提交 `lib/`。
  - 补充 `CLAUDE.md`（此前缺失）：**TS 族**（`src/` 权威、`lib/` 为构建产物）与 JS 族的差异、
    构建/安装/CI 流程，以及 `strict` + `noUncheckedIndexedAccess` 下的注意事项。

## [0.1.7] - 2026-09-13

### Changed
- 刷新按钮移至页头（header），Tasks 和 Ledger 共用，一次刷新全部数据
- 页头改为 flex 行布局：左侧 Requirement/Session 信息，右侧刷新按钮
- 删除底部刷新按钮，减少视觉干扰

## [0.1.6] - 2026-09-13

### Refactored
- 改用 DSH 官方 `@deepseek-ai/dsh-client-ui-primitives` 的 `MarkdownText` 组件渲染台账
- 删除手写的 137 行 markdown 渲染器（renderMarkdown/escapeHtml/renderInline）
- Client bundle 从 11.9KB 降至 7.6KB（MarkdownText 由平台模块提供，不打进 bundle）
- 传入中文 codeLabels（复制/已复制），与 DSH 消息渲染观感一致

## [0.1.5] - 2026-09-13

### Added
- Tasks 和 Progress Ledger 分为两个独立 tab，点击切换
- 手写 markdown 渲染器（按行解析）：支持标题/列表嵌套/代码块/引用/段落/行内格式
- 列表支持缩进嵌套（`  - Minor(...)` 子项正确缩进）
- 代码块围栏（```）支持，等宽字体 + 背景色 + 自动换行

## [0.1.4] - 2026-09-13

### Changed
- 需求名解析彻底泛化：不再限制 `/requirements/` 目录，从会话内容提取任意根路径
- 正则匹配 `((?:盘符)?任意根/<name>/sdd/progress.md)`，提取 `<name>` 作为需求名
- 支持 Windows 路径（`D:\\workspace\\...`）和 Unix 路径（`/projects/foo/...`）
- `config.requirementsRoot` 降级为可选兜底（默认空），仅在会话里只有相对路径时使用

### Removed
- 移除硬编码的 `D:\\workspace\\requirements` 默认值
- 移除目录扫描兜底（`findLatestLedger`），台账路径完全来自会话内容

## [0.1.3] - 2026-09-13

### Fixed
- 修复 zstd 多帧解码：单帧 `zstdDecompressSync` 只解码首帧，导致 todo 为空
- 实现 `scanZstdFrames` 扫描帧边界，逐帧解码拼接，完整还原会话内容
- 支持损坏帧跳过（try/catch），不崩溃

## [0.1.2] - 2026-09-13

### Added
- 从会话内容提取需求名：扫描 `sdd/progress.md` 路径引用
- 自动读取台账内容并返回给客户端
- 支持 `config.requirementsRoot` 配置项（可选根目录兜底）

### Fixed
- 修复"most recent session"错误匹配当前插件会话的问题
- 客户端 tab 携带 sessionId，服务端 `findSessionById` 精确定位

## [0.1.1] - 2026-09-13

### Fixed
- 修复 401 unauthorized 问题：`ctx.webServer.app.get` 无效（无 `.app` 属性）
- 改用 `ctx.webServer.register({ kind: 'prefix', path, handler })` 正确挂载路由
- 参考 dsh-power-xc 的路由注册模式

## [0.1.0] - 2026-09-13

### Added
- 初始版本
- 服务端：读取 `~/.dsh/sessions/<project>/<sessionId>/session.v3.jsonl.zstd`
- 服务端：解析会话日志，提取 cwd/sessionId/todo
- 服务端：HTTP API `/api/dsh-sdd-progress-xc/{health,progress}`
- 客户端：右侧边栏 tab 注册（定义 + body + title）
- 客户端：任务列表渲染（状态图标 + 颜色）
- 客户端：5 秒自动轮询
- MIT 许可证
