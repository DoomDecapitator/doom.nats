# doom.nats — 原版自然生成复刻（数据包）

[![最新版本](https://img.shields.io/github/v/release/DoomDecapitator/doom.nats?include_prereleases&label=%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC)](https://github.com/DoomDecapitator/doom.nats/releases)
[![Minecraft](https://img.shields.io/badge/Minecraft-1.21.6-3C8527)](docs/25-兼容与版本.md)
[![许可](https://img.shields.io/badge/%E8%AE%B8%E5%8F%AF-All%20Rights%20Reserved%20%C2%B7%20Beta-c0392b)](docs/26-致谢与许可.md)

<!-- 首屏效果图位（还没放图）：按 docs/图-首屏效果位.md 的说明截一张，存成 docs/assets/首屏效果.png，
     然后把下面这行的注释去掉即可。在那之前不要留半张破图。 -->
<!-- <p align="center"><img src="docs/assets/首屏效果.png" width="720" alt="doom.nats 在存档里跑起来的样子"></p> -->

> **一句话**：用**纯数据包**复刻 Minecraft 原版的自然刷怪（NaturalSpawner 那一整套）—— 容量、区块计数、光照与逐实体规则、结构覆盖、消失层全都在，而且**规则归你改**。
> **下哪个**：`dist/doom.nats-v4.28.zip`（默认变体，复刻原版刷怪，推荐）。只有想要 `near` / `on_spawn` / 预设 / 自定义外观，才下 `dist/doom.nats-v4x-experimental-v4.28.zip` —— 它**需要世界开启对应实验性玩法**，否则装不上。（其中**自定义外观（AJ 桥接）未随本版成品发布**：源码在 `src/tools/gen_exp_aj.mjs`，要自备非空 `rules/rigs.json` 并 `DOOM_EXP=1` 重生成，详见 [`docs/18-配置手册.md`](docs/18-配置手册.md) 附录。）
> **怎么装**：解压 zip → 得到 `doom.nats/` 文件夹 → 整个丢进 `saves/<你的存档>/datapacks/`（服务器：`world/datapacks/`）→ 进游戏 `/reload`。
> **怎么验**：下载后先对一下校验值 —— 见下面「校验下载的文件」。
> **改规则**看 [`docs/24-玩家能改动的一切.md`](docs/24-玩家能改动的一切.md) 与 [示例库](docs/wiki/示例库.md)；版本/变体对照看 [`docs/25-兼容与版本.md`](docs/25-兼容与版本.md)。

> ## 当前状态：**v4.28 正式发布（Latest）**
> v4.28 已设为 **Latest**（2026-10-04 发布）—— 本版是 **Minecraft 1.21.6 的稳定版**；超出原版的实验性能力（`near` / `on_spawn` / 预设）在 `v4x` 变体里，装它要开对应实验性玩法（**自定义外观（AJ 桥接）源码在、未随本版成品发布**）。
> 已跑过完整的真机验收（数字见 [CHANGELOG](CHANGELOG.md)；逐轮报告 `reports/` **不在本仓库**）；**已知偏差仍逐条留档**。
> **可以装进存档玩，但请先备份存档。**


### 源码在哪（直接点开就能看）

- **数据包本体（mcfunction 源码，可直接点开看）**：[`doom.nats/`](doom.nats/data/doom.nats/function) —— 里面就是这只包实际装入游戏的每个函数文件；成品 zip 在 `dist/`，JavaScript 生成器在 `src/`。
- **生成器源码（JavaScript）**：[`src/`](src/) —— JavaScript 生成器 + 规则层 + 生成输入；不想读代码的话，直接下 `dist/` 的 zip 即可。
- **成品（玩家下载）**：[`dist/`](dist/) —— `doom.nats-v4.28.zip`（默认）与 `doom.nats-v4x-experimental-v4.28.zip`（实验性）。
- **同一份源码**就是本仓库顶层的 [`src/`](src/)（生成器 `tools/` + 规则层 `rules/` + 生成输入 `_work/generated/`）；[Releases](https://github.com/DoomDecapitator/doom.nats/releases) 页上 GitHub 自动生成的 **Source code (zip)** 是那个 tag 的整仓快照（含 `src/`）。真机测试台与验收报告是作者本机的东西，不随本仓库分发。

## 30 秒：下载 → 装 → 看它是否跑起来

| 步 | 做什么 |
|---|---|
| ① | 下载 [`dist/doom.nats-v4.28.zip`](dist)（默认变体），校验值见 `dist/SHA256SUMS.txt` |
| ② | 解压，把 `doom.nats/` 整个放进 `<存档>/datapacks/`；服务器放 `world/datapacks/` |
| ③ | 进世界 `/reload`，然后 `/function doom.nats:debug/env` 看环境快照 |

装好会在聊天栏（和服务器日志）看到一句就绪提示；没看到就去 `logs/latest.log` 找加载报错。

**怎么自证它真的在工作**（比"看到就绪提示"硬）：装好后跑 `/function doom.nats:debug/all`，看两行 ——
`$spawned.total` **持续增长**，且 `$cnt.monster` **稳定停在上限**（默认变体 70；实测装机后 30 秒内从 48 爬到 70）。

**要卸载**：删掉 `datapacks/doom.nats/` → `/reload` → `/function doom.nats:mode/auto` 把 `doMobSpawning` 还回原版。

## 校验下载的文件（一行）

`dist/SHA256SUMS.txt` 里是**当前发布物**的 sha256（每次发版重新生成）。在**仓库根目录**跑：

```
Linux / macOS / Git Bash:   sha256sum -c dist/SHA256SUMS.txt
Windows PowerShell:         Get-Content dist/SHA256SUMS.txt | ForEach-Object { $h,$f = $_ -split '\s+'; "$f => " + $(if ((Get-FileHash "dist/$f" -Algorithm SHA256).Hash.ToLower() -eq $h) {'OK'} else {'MISMATCH'}) }
```

全部输出 `OK` 就是完整下载；出现 `MISMATCH` 就别用，重新下。

> ⚠️ 旧版 README 曾在表格里**写死过两个哈希值** —— 那是**过期值**（对应更早的构建）。校验一律以 `dist/SHA256SUMS.txt` 为准（实测与 zip 一致）。


## 我该下载哪个（变体对照）

| 下载这个 | 它是什么 | 适合谁 |
|---|---|---|
| **`dist/doom.nats-v4.28.zip`**（默认变体） | 用**纯数据包**复刻 Minecraft 原版的自然生成：全局/本地容量、区块可生成计数、光照与逐实体规则、结构 `spawn_overrides`（要塞/前哨站/沼泽小屋/海底神殿/远古城市/试炼密室）、`finalizeSpawn` 组数据层（婴儿率、共享变体、蜘蛛组效果…）、消失层（128 格硬消失、32 格掷骰）、情形引擎（昼夜/天气/月相/维度/多人） | 绝大多数人：要"原版刷怪的手感"，同时规则随便改 |
| `dist/doom.nats-v4x-experimental-v4.28.zip`（实验性变体） | 默认变体的全部内容 **+ 超出原版的能力**：`near`（附近有什么才刷）、`on_spawn`（出生演出）、预设包（血月、雷暴季、深渊） | 想玩花样、且**愿意在创建世界时开启对应实验性玩法**的人 |

两个变体**别同时装**（同一命名空间，只能有一个生效）。

## 兼容与版本（速查）

| 你的环境 | 用哪个 | 要开实验性玩法吗 |
|---|---|---|
| Minecraft **1.21.6**（`pack_format` 80） | 两个变体都可以 | 默认变体：不用 · 实验性变体：**要**（创建世界时开「矿车改进」实验性玩法） |
| 其它版本 | **不支持**（包会被判版本不符） | — |
| 单人存档 / 服务器 | 都行；服务器用 `world/datapacks/` | — |

完整的版本矩阵、`pack_format` 对照、升级/降级与"为什么实验性变体要借一个原生旗标"见 [`docs/25-兼容与版本.md`](docs/25-兼容与版本.md)。

## 我能改什么（三条路）

| 改法 | 生效时机 | 入口 |
|---|---|---|
| **A · 在游戏里改**（推荐） | 改完**下一拍**就生效，不用重启、不用重装 | 存储 `doom.nats:author`：`/function doom.nats:author/show` 看现状、`author/reset` 一键回原版 |
| **B · 运行时刻旋钮** | 立刻 | 计分板开关（密度、批次、调试报告…），清单见 [`docs/21-玩家可改清单.md`](docs/21-玩家可改清单.md) |
| **C · 构建期规则**（要重新生成包） | 重新生成 + 换包 | 本仓库 `src/rules/*.json`：字段表见 [`src/rules/README.md`](src/rules/README.md) |

两条例子（复制就能用，全部示例见 [示例库](docs/wiki/示例库.md)）：

```
# 让僵尸也能刷在树叶上（原版树叶不算能站的地方）
/data modify storage doom.nats:author entityRules."minecraft:zombie".belowAny set value ["#minecraft:leaves"]

# 雷暴时，深海多出一种僵尸（权重 40，跟原有物种一起抽）
/data modify storage doom.nats:author entries append value {id:"storm",biome:"#minecraft:is_deep_ocean",category:"monster",mob:"minecraft:zombie",weight:40,when:{thundering:true}}
```

> ⚠ **字段名分两层，别写串**：条目里的群系是 `biome`（**单数**，一个群系 id 或 `#标签`；要多个群系就加多条），一次几只写 `min` / `max`。
> `biomes`（数组）/ `group` / `place` / `light` / `tag` / `cluster` / `coins` / `ySea` 这些是**构建期** `rules/*.json`（路径 C）的写法 —— 写进 storage **不会报错，但也不会生效**。
> 清单与对照表：[`docs/24-玩家能改动的一切.md`](docs/24-玩家能改动的一切.md)。

### 实验性变体 `v4x`：超出原版的能力

`near`（附近有什么才刷，例如"狼群附近才出羊"）、`on_spawn`（出生特效：粒子/音效/播报/额外 NBT）、预设包（血月、雷暴季、深渊）属于**非原版**能力，只在**实验性变体**里，并且带**引擎门**：世界必须在创建时开启对应实验性玩法，否则包会被拒绝加载（详见 [`docs/wiki/实验性变体-v4x.md`](docs/wiki/实验性变体-v4x.md)）。

### 明确做不到的（免得你白试）

全新的模型/贴图/AI/寻路（数据包管不了客户端资源与实体行为）；给"原本没有这一类别的群系"加怪（那要改世界生成）；让生物之间产生因果关系（例如"蜘蛛吃虫"，那是行为层的事）。

## 文档在哪

| 想看什么 | 去哪 |
|---|---|
| 安装/升级/卸载全过程 | [`docs/wiki/安装与升级.md`](docs/wiki/安装与升级.md) · [`docs/16-生存直用手册.md`](docs/16-生存直用手册.md) |
| 在游戏里改规则（示例库 + 字段参考） | [`docs/wiki/示例库.md`](docs/wiki/示例库.md) · [`docs/wiki/规则字段参考.md`](docs/wiki/规则字段参考.md) |
| 全清单（能改的一切） | [`docs/24-玩家能改动的一切.md`](docs/24-玩家能改动的一切.md) |
| 逐实体与原版的差异核对 | [`docs/17-逐实体刷怪规则核对.md`](docs/17-逐实体刷怪规则核对.md) |
| 版本 / 变体 / 兼容 | [`docs/25-兼容与版本.md`](docs/25-兼容与版本.md) · [CHANGELOG](CHANGELOG.md) |
| 许可、致谢、第三方边界 | [`docs/26-致谢与许可.md`](docs/26-致谢与许可.md) |
| 全部文档索引 | [`docs/README.md`](docs/README.md) |

> Wiki（图文版）：<https://github.com/DoomDecapitator/doom.nats/wiki> —— 若打不开，`docs/wiki/` 里就是那 9 页的 Markdown 源，内容完全一致。

## 许可（一句话）

**All Rights Reserved · Beta** —— 自用/游玩/原样转发可以；**二次发布修改版或商用请先取得许可**。本包不含 Minecraft/Mojang 资产，也不含反编译产物；随包发布的只有数据包本体。全文与致谢见 [`docs/26-致谢与许可.md`](docs/26-致谢与许可.md) 与 [LICENSE](LICENSE)。

## 仓库结构

```
README.md  LICENSE  CHANGELOG.md   说明 / 许可 / 变更日志
dist/                              唯一下载物：两个变体的 zip + 各自 sha256
src/                               源码：生成器 tools/ + 规则层 rules/ + 生成输入 _work/generated/
docs/                              玩家向文档 + docs/wiki/（Wiki 的 9 页 Markdown 源）
.github/ISSUE_TEMPLATE/            报 bug / 提功能的固定表单（要求版本 + 日志 + 截图）
```

另有两个隐藏文件：`.gitignore`（本地产物不进仓库）与 `.gitattributes`（产物按字节比对，不做 EOL 转换）。

想自己改包就照 [`src/README.md`](src/README.md) 的「三步构建」（跑生成器 → `check_static` → 装包/打包）走。

**怎么报问题**：走 [Issues](https://github.com/DoomDecapitator/doom.nats/issues/new/choose) 的表单 —— 会问你要版本、变体、`logs/latest.log` 片段和截图；按表单填，定位快很多。

真机测试台 `tests/`、逐轮验收报告、CI 是作者本机的东西
（作者本机的测试台与验收报告，不随仓库分发） —— 验收口径与每个版本的真机数字都在那里。

> **源码在哪**：生成器是 JavaScript，就在**本仓库顶层** [`src/`](src/) —— 生成器 `tools/` + 规则层 `rules/` + 生成输入 `_work/generated/`。玩家不需要读它，只想要成品就下 `dist/` 的 zip；真机测试台与验收报告不随本仓库分发。
