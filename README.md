# dsh-sdd-progress-xc

[![npm version](https://img.shields.io/npm/v/dsh-sdd-progress-xc.svg)](https://www.npmjs.com/package/dsh-sdd-progress-xc)
[![license](https://img.shields.io/npm/l/dsh-sdd-progress-xc.svg)](https://github.com/xchannel1987/dsh-sdd-progress-xc/blob/main/LICENSE)
[![downloads](https://img.shields.io/npm/dm/dsh-sdd-progress-xc.svg)](https://www.npmjs.com/package/dsh-sdd-progress-xc)
[![DSH](https://img.shields.io/badge/DeepSeek-Harness-blue)](https://github.com/deepseek-ai/DeepSeek-Harness)

[中文](README.md) | [English](README_EN.md)

**DSH SDD 进度插件** —— 在右侧边栏展示当前会话的 Subagent-Driven Development 任务进度（todos）和进度台账（progress.md），支持实时刷新和 Markdown 渲染。

## ✨ 核心特性

### 📋 任务进度（Tasks Tab）
- **实时统计**：显示已完成 / 进行中 / 待办任务数量
- **状态图标**：✓ 完成 / ⏳ 进行中 / ○ 待办，一目了然
- **自动刷新**：5 秒轮询，任务状态变化即时反映
- **会话绑定**：自动关联当前会话的 todo 数据

### 📖 进度台账（Progress Ledger Tab）
- **Markdown 渲染**：使用 DSH 官方 `MarkdownText` 组件，支持 GFM / KaTeX 数学 / 代码高亮 / 代码复制
- **自动定位**：从会话内容提取 `sdd/progress.md` 路径，无需手动配置
- **根目录无关**：支持任意目录结构（如 `/projects/foo/aiAssistant/sdd/progress.md`）
- **安全渲染**：禁用 raw HTML / 相对链接 / 危险协议，防止 XSS

### 🔄 实时刷新
- **页头刷新按钮**：Tasks 和 Ledger 共用，一次刷新全部数据
- **自动轮询**：5 秒间隔，无需手动操作
- **手动兜底**：点击刷新按钮立即生效

### 🎯 会话绑定
- **自动识别**：通过会话内容中的路径引用定位需求目录
- **多需求支持**：同一 DSH 实例可同时查看不同需求的进度
- **会话切换**：切换会话时自动加载对应进度

### 📝 Markdown 渲染
- **官方组件**：使用 `@deepseek-ai/dsh-client-ui-primitives` 的 `MarkdownText`
- **完整能力**：GFM 语法 / KaTeX 数学公式 / 代码高亮 + 复制按钮 / 脚注
- **流式优化**：增量解析，冻结已稳定块，仅重解析尾部
- **安全沙箱**：面向不可信内容的渲染器，自动处理 XSS

## 🔧 工作原理

```
用户打开 SDD Progress tab
    ↓
客户端请求 /api/dsh-sdd-progress-xc/progress?sessionId=...
    ↓
服务端读取 session.v3.jsonl.zstd（多帧 zstd）
    ↓
解析会话内容：
  - 提取 cwd + sessionId
  - 提取最新 todo/write 事件
  - 扫描路径引用，匹配 sdd/progress.md
    ↓
返回 { requirementName, todos, ledger }
    ↓
客户端渲染：
  - Tasks tab：统计 + 任务列表
  - Ledger tab：MarkdownText 渲染台账
```

**zstd 多帧解码**：DSH 会话日志是多帧 zstd 拼接，单帧 `zstdDecompressSync` 只解码首帧。插件实现 `scanZstdFrames` 扫描帧边界，逐帧解码拼接，完整还原会话内容。

**需求名提取**：正则匹配会话内容中的 `((?:盘符)?任意根/<name>/sdd/progress.md)` 路径，提取 `<name>` 作为需求名。支持 Windows 路径（`D:\\workspace\\requirements\\aiAssistant\\sdd\\progress.md`）和 Unix 路径（`/projects/foo/aiAssistant/sdd/progress.md`）。

## 📦 安装

```bash
# 使用 DSH CLI
dsh plugin --profile web add dsh-sdd-progress-xc

# 或使用 npm
npm install dsh-sdd-progress-xc
```

安装后重启 DSH，右侧边栏将出现「SDD Progress」tab。

## ⚙️ 配置

| 选项 | 默认值 | 说明 |
|------|--------|------|
| requirementsRoot | ''（空） | 可选：当会话内容只有相对路径时，作为根目录兜底。通常无需设置 |

**为什么默认不需要配置？**  
插件从会话内容直接提取完整路径（如 `D:/workspace/requirements/aiAssistant/sdd/progress.md`），不依赖固定根目录。只要会话中引用过该路径，就能自动定位。

## 🎮 使用

### 查看任务进度
1. 打开右侧边栏
2. 点击「SDD Progress」tab
3. 默认显示「Tasks」tab：统计 + 任务列表
4. 点击「Progress Ledger」tab 查看台账

### 刷新数据
- **自动**：5 秒轮询，无需操作
- **手动**：点击页头右侧「↻ Refresh」按钮

### 切换会话
- 切换到其他会话时，SDD Progress 自动加载该会话的进度
- 每个会话独立，互不干扰

## 🔒 安全设计

- **Markdown 渲染**：使用官方 `MarkdownText`，禁用 raw HTML / 相对链接 / 危险协议
- **路径提取**：仅从会话内容提取路径，不扫描文件系统
- **zstd 解码**：逐帧解码，跳过损坏帧，不崩溃
- **会话隔离**：每个会话独立，不跨会话污染

## 📄 许可证

[MIT](LICENSE)

## 🔗 链接

- [GitHub](https://github.com/xchannel1987/dsh-sdd-progress-xc)
- [npm](https://www.npmjs.com/package/dsh-sdd-progress-xc)
- [问题反馈](https://github.com/xchannel1987/dsh-sdd-progress-xc/issues)
- [DSH 官方仓库](https://github.com/deepseek-ai/DeepSeek-Harness)
