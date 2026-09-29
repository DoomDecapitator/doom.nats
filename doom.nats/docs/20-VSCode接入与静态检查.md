# 20 · VS Code 接入与静态/真机检查的分工

> 结论：编辑器里的红波浪线来自你已装的 **Spyglass**（`spgoding.datapack-language-server` 4.13.0）。
> 我能把"不依赖编辑器"的检查接成 VS Code 任务、让它们进同一个「问题」面板；但**读不到**你当前编辑器会话的诊断，
> 也**还没打通** headless Spyglass（第 3 节有红→绿对照实测，不假装成功）。

## 1. 已接好：Ctrl+Shift+B 的 VS Code 任务（`.vscode/tasks.json`）

| 任务 | 跑什么 | 产物 |
| --- | --- | --- |
| 静态检查（默认 build） | `tools/check_static.mjs --vscode` = 9 生成器 `--check` + lint L1–L12 + 语义闭包 | `file:line:col: error: msg`，配 `$gcc` ⇒ 直接进「问题」面板 |
| Spyglass 诊断（实验性） | 同上 + `--spyglass` | 见第 3 节，**目前不可信** |
| 一键回归 | `tools/regress.mjs --reuse --minutes 1 --curve 1` | `doom.nats/reports/回归-<时间戳>.md`（16 步 + 曲线图） |
| 组数据层专项 | `_work/verify_group.mjs` | 14 条断言；自起 mineflayer 机器人，不需你开客户端 |

命令行等价物：`node doom.nats/tools/check_static.mjs`（人类可读）/ 加 `--vscode`（gcc 风格）。

## 2. 为什么"我们的检查"比语法高亮更管用

mcfunction 的致命错误几乎都是**加载期整文件被拒**，高亮看不出来：

- `No variables in macro`：宏行没有 `$(name)` ⇒ 整个函数不可用（v4.15 实测；lint L12 已兜）
- 行尾注释 / 连续两空格 / `~+N` / `${name}` ⇒ 整条命令甚至整函数加载失败（lint L9/L11/L7）
- 引用不存在的函数、宏派发前缀为空、storage/计分板拼错 ⇒ 静默空转（闭包检查 C1–C4）
- 产物与生成器漂移 ⇒ 下次重生成就回退（`--check`）

最硬的一道门是**游戏自己的加载器**：装包 + `/reload` + `grep "Failed to load function"`（只看本轮，带行数锚点），
已内建在 `mcauto.mjs` / `regress.mjs`。

## 3. headless Spyglass：做了但没打通（诚实记录）

`tools/lint_spyglass.mjs`：找扩展 → `node <ext>/dist/server.js --stdio` → `initialize`/`initialized` →
整包 562 文件 `didOpen` → 收 `publishDiagnostics` → 输出 `file:line:col: severity: [Spyglass] msg`，有 error 退出码 1。

**红→绿对照未通过**：探针包 `_work/spyglass-probe`（内容 `frobnicate @s`）在两种工作区根下都是「（无诊断）」⇒
说明我这边收不到诊断，**不能**据此宣称"包是干净的"。所以：

- 别把 `--spyglass` 结果当证据（任务已标注实验性）；
- 想在编辑器里看真波浪线：正常打开工作区即可（Spyglass 已装）；
- 想继续打通：从 `dist/extension.js` 抄它的 `initialize`（`initializationOptions`/`capabilities`/`didChangeConfiguration`，
  可能还有 `spyglass/*` 自定义请求）；探针包可随时重建，改完立刻能验红。

## 4. 环境事实（2026-09-28）

- VS Code 装在 `%LOCALAPPDATA%\Programs\Microsoft VS Code`；`code` 的 bash 包装脚本在本机 Git Bash 下不可用（缺 `realpath`），
  用 `Code.exe` 或 PowerShell 的 `code.cmd`。
- 已装数据包相关扩展：`spgoding.datapack-language-server`、`minecraftcommands.syntax-mcfunction`、`misodee.vscode-nbt`、
  `misodee.worldgen-tools`、`thesalt.datapack-optimization`、`nobuwu.mc-color`、`superant.mc-dp-icons`。
- 本工作区此前无 `.vscode/`；现在只加了 `tasks.json`（未改你的其它设置）。
