# Wiki 源文件（9 页 + 侧栏/页脚）

这 9 个 `.md` 就是本数据包 GitHub Wiki 的页面源，页面标题 = 文件名（去掉 `.md`）；
`_Sidebar.md` 与 `_Footer.md` 是 GitHub Wiki 的全局侧栏与页脚（不占页面标题），推送脚本会一起带上去。

| 文件 | 页面 |
|---|---|
| `Home.md` | Home（一屏上手） |
| `安装与升级.md` | 安装与升级 |
| `快速上手-在游戏里改规则.md` | 快速上手 |
| `规则字段参考.md` | 规则字段参考 |
| `示例库.md` | 示例库 |
| `实验性变体-v4x.md` | 实验性变体 |
| `FAQ.md` | FAQ |
| `版本与验收.md` | 版本与验收 |
| `已知限制.md` | 已知限制 |
| `_Sidebar.md` | 全局侧栏（每页都显示） |
| `_Footer.md` | 全局页脚（字段表口径 + 许可） |

目标地址：<https://github.com/DoomDecapitator/doom.nats/wiki>

## 为什么内容放在这里

GitHub 的 Wiki 有一个平台限制：仓库必须先有一个 Wiki 页面，`<repo>.wiki.git` 才会存在、才能 clone / push；在此之前 `git ls-remote` 会报 `Repository not found`，REST API 也没有创建 Wiki 页面的端点（`/wiki/pages` 返回 404）。

所以内容先以 Markdown 源的形式随仓库分发，两条路任选：

### 路线 A：网页粘贴（零依赖，9 次）

到 <https://github.com/DoomDecapitator/doom.nats/wiki>，点 Create the first page（新建首页，标题填 `Home`，正文可以随便先存一下），之后每页用 New Page 建同名页面，把对应 `.md` 内容整段粘进去保存。

### 路线 B：脚本推送（先做一次路线 A 的第一步）

1. 在网页上点一次 Create the first page（哪怕内容只写"占位"），保存
2. 回到本机克隆本仓库后执行：

```bash
bash docs/wiki/push-wiki.sh
```

脚本会把 9 页一次性推上去（覆盖同名页面），然后删掉临时克隆目录。

## 维护约定

- 页面里的跨页链接用 Wiki 原生语法 `[[页面名]]`，改名时记得同步。
- 字段表若与本仓库 `src/rules/README.md` 冲突，以 `src/rules/README.md` 为准。
- 每页统一口径：先结论、再命令、再注意；命令放代码块；不写仓库内部细节。
