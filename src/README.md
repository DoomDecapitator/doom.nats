# 这是什么

**本包的源码**：JavaScript 生成器（把规则生成成数据包函数）+ 规则层（`rules/`）+ 生成输入（`_work/generated/`）。

- 只想玩：**不要用这个目录**，去下载 `dist/` 里的 zip（解压后丢进 `saves/<存档>/datapacks/`）。
- 想改包 / 想看实现：从这里开始，照着下面「三步构建」走。
- 想看更完整的开发环境（测试台、验收报告、CI）：那是作者本机的东西，不随本仓库分发。

---

# src/ —— 这个仓库的源码（生成器 + 规则层 + 生成输入）

> **一句话**：这里是**源码** —— 生成数据包的那套生成器（`tools/`）、作者规则层（`rules/`）、以及生成器的输入数据（`_work/generated/`）。
> **想改包**（改数值、改规则、加条目）就照下面的「三步构建」走；**想参与开发**（真机验收台、逐轮报告、CI）需要作者本机的测试环境（不随本仓库分发）。

先把两处东西分清 —— 这也是最多人问的那件事：

| 位置 | 是什么 | 给谁 |
|---|---|---|
| [`dist/`](../dist) | **成品**：`doom.nats-v4.29.zip`（默认变体）+ `doom.nats-v4x-experimental-v4.29.zip`（实验性变体），校验值见 `dist/SHA256SUMS.txt` | 只想装进存档玩的玩家 —— **你多半只要这个** |
| `src/`（本目录） | **源码**：生成器 + 规则层 + 生成输入。**不能直接丢进存档**，要先跑生成器变成 `pack/` | 想改包的人、想知道"它到底怎么算的"的人 |

## 三步构建

前置：**Node.js 18+**（不需要联网，不需要 Minecraft，不需要装任何依赖）。

```
# ① 生成数据包（产物落在仓库根的 pack/ 下；pack/ 不进仓库，每次生成覆盖）
cd <仓库根>

node src/tools/gen_pack.mjs
node src/tools/gen_pos.mjs
node src/tools/gen_check.mjs
node src/tools/gen_mobs.mjs
node src/tools/gen_spawn.mjs
node src/tools/gen_despawn.mjs
node src/tools/gen_effects.mjs
node src/tools/gen_debug.mjs
node src/tools/gen_group.mjs
node src/tools/gen_author.mjs
#   实验性变体（多一层 exp/*）= 上面这 10 个再加 gen_exp / gen_exp_aj，全部带 DOOM_EXP=1 再跑一遍；
#   或者偷懒：直接跑 ②，check_static 会自己把实验性变体建出来。

# ② 静态门（生成器漂移 + lint + 引用闭包）—— 这一步就是"我改的东西没写坏"的答案
node src/tools/check_static.mjs          # 默认 + 实验性两个变体；只查实验性：加 --exp
#   期望输出：默认变体 0 error / 2 warning · 实验性变体 0 error / 2 warning

# ③ 装包 / 打包
#   装进存档：把 pack/doom.nats 整个复制到 <存档>/datapacks/（服务器 world/datapacks/）→ 进游戏 /reload
#   打包分发：把 pack/doom.nats 压成 zip，**zip 内顶层必须是 doom.nats/**（与 dist/ 里的成品同形）
```

路径是怎么解析的：生成器一律走 [`tools/lib/packdir.mjs`](tools/lib/packdir.mjs)，
`src/` 的上一级就是仓库根，产物落在 `<仓库根>/pack/doom.nats`（`DOOM_EXP=1` ⇒ `pack/doom.nats-experimental`）；
想写到别处就设 `DOOM_OUTDIR=<目录>`（验收脚本就是这么做隔离构建的）。

## 目录里有什么

> 范围：本目录带的是 **v4 线（这个数据包）的完整源码** —— 12 个生成器 + 共用的 `lib/` + 三道静态门 + 真机测试台 + 规则层 + 生成输入。
> 历史线（v1–v3 / 移植 / 优化）的工具不在里面，原因见下面「哪些能直接跑」那张表。

| 路径 | 内容 |
|---|---|
| `tools/gen_*.mjs` | **生成器**：一个生成器负责一层（包骨架 / 取点 / 判定 / 物种 / 生成链 / 消失 / 效果 / 调试 / 组数据 / 作者层）。**改包 = 改生成器再重跑**；不要手改 `pack/` 里的产物（`--check` 会逐字节比对，手改必被抓） |
| `tools/lib/` | 生成器共用的库：路径解析、原版规则表、作者层解析、SNBT、AABB 插值、实验性 rig 校验…… |
| `tools/check_static.mjs` | **静态总门**：两变体的生成器 `--check` + `lint_pack` + `check_closure` |
| `tools/lint_pack.mjs` · `check_closure.mjs` · `check_leak.mjs` | 单点门：产物 lint（L1–L14）· 函数/storage/计分板引用闭包 · 泄漏与仓库顶层结构 |
| `rules/` | **作者规则层**（构建期输入）：`entity-rules.json` / `entries.json` / `counts.json` / `rigs.json`，**默认全空 = 原版行为**。字段手册与四个用例见 [`rules/README.md`](rules/README.md) 与 `rules/examples/` |
| `_work/generated/*.json` | **生成器的输入数据**（从原版 1.21.6 jar 导出的群系刷怪表、群系标签、碰撞盒、逐实体规则、分类表……）。它们**是源码的一部分，别删** —— 少了它们生成器跑不起来 |
| `tools/_root.mjs`、`install.mjs`、`mcauto.mjs`、`mcrcon.mjs`、`collect.mjs`、`regress.mjs`… | 真机测试台那一套：代码在这儿能读能改，但**要用起来需要一台跑着的服务器 / 一个存档**（测试台本体不随本仓库分发） |

## 哪些能直接跑、哪些不能（实测）

下表的"能直接跑"是在**一个干净的克隆**里逐条跑过的（Node 18+，除本目录外没有任何额外文件）：

| 能直接跑 | 说明 |
|---|---|
| `node src/tools/gen_*.mjs`（12 个生成器） | 生成与 `--check` 都行；只读 `src/rules/` 与 `src/_work/generated/` |
| `node src/tools/check_static.mjs` | **在克隆里实跑通过**：默认变体 0 error / 2 warning · 实验性变体 0 error / 2 warning（`--exp` 同） |
| `node src/tools/lint_pack.mjs <产物目录>` | 单独跑产物 lint |
| `node src/tools/check_closure.mjs` | 函数 / storage / 计分板引用闭包 |
| `node src/tools/check_leak.mjs` | 泄漏 + 顶层结构门（本机 git 不在 PATH 时：`DOOM_GIT=<git 完整路径> node src/tools/check_leak.mjs`；不在 git 仓库里时加 `DOOM_TOP=off`） |
| `node src/tools/sim_v4.mjs 400` | 无头解释器跑 v4 本体。**能跑，但汇总会有 3 个 FAIL**：日志汇 `harness/doom.log` 属于测试台，不随本仓库发布 |

| 不能直接跑（要作者本机环境或外部环境） | 为什么 |
|---|---|
| `install.mjs` / `mcauto.mjs` / `mcrcon.mjs` / `collect.mjs` / `regress.mjs` | 真机类：要一台开着 RCON 的服务器、一个存档、以及 `harness/` 测试台（都不随本仓库分发；普通玩家也不该去碰） |
| `export_biomes.mjs` / `export_rosters.mjs` / `export_biome_tags.mjs` / `export_mobs.mjs` | 要**原版 1.21.6 jar** 才能重新导出群系刷怪表（导出结果已经躺在 `_work/generated/` 里，日常改包不需要重导） |
| `export_hitboxes.mjs` | 要**反编译产物** `_work/decomp/named.jar`；反编译产物不随任何仓库发布 |
| 历史线（v1–v3 / 移植 / 优化）的那套工具 | **没随源码发布**（`doomify.mjs` · `port.mjs` · `optimize.mjs` · `verify.mjs` · `sim.mjs` · `viz.mjs` 及它们专用的 `tools/rules/`、`lib/exttag.mjs`、`lib/simrun.mjs`、`lib/snbt.mjs`）：它们处理的是 `original/` `ported/` `optimized/` `v3/` 这四个**不在本仓库**的目录，其中还带着旧项目名（玩家向仓库不许出现）。它们不随本仓库分发 —— 本目录带的是 **v4 线的完整源码** |
| `propose_tags.mjs` | 要一个真实存档的地形文件（`.mca`）才能统计落点方块分布 |
| `lint_spyglass.mjs` | 要本机装过 Spyglass；它是可选工具，不是生成依赖 |

## 怎么改包（三种典型）

1. **调数值**：改 `src/rules/counts.json`（按 Y 段的数量曲线）或 `tools/lib/entity-rules.mjs` 里的原版词表 → 重跑生成器 → 跑 `check_static`。
2. **加条目**：改 `src/rules/entries.json`（条件刷怪条目，可带 NBT）；四个用例见 `src/rules/examples/full/`。
3. **改实现**：只改 `tools/gen_*.mjs`，然后**整套按 ① 的顺序重跑**（层与层之间有依赖：pack → pos → check → mobs → spawn → despawn → effects → debug → group → author）。

`rules/` 改完一定要重跑生成器 —— 它是**构建期**输入，只改文件不重生成＝没生效。
游戏里能当场改的那一层（`storage doom.nats:author`）见 [`../docs/24-玩家能改动的一切.md`](../docs/24-玩家能改动的一切.md)。

## 已知差异（诚实清单）

- 你在克隆里重新生成出的 `pack/doom.nats`（**693** 文件）与 `dist/doom.nats-v4.29.zip`（**694** 项）**只差一份手写文件**：
  zip 里多一份**手写的**编辑器提示 `mcdoc/doom.nats/config.mcdoc`（见 [`../docs/21-玩家可改清单.md`](../docs/21-玩家可改清单.md)；
  **没有生成器负责它**，由打包脚本补进去）。生成器产物本身仍是 693 / 实验性 770。
- 仓库顶层的 [`doom.nats/`](../doom.nats)（可直接点开看的包本体）与 zip **逐项一致**（**694/694**，0 缺 0 多 0 内容不同；实验性变体 **771/771**）。
- 两个 zip 的 sha256 见 [`dist/SHA256SUMS.txt`](../dist/SHA256SUMS.txt)。

## 参与开发

生成器只算半张桌子。另一张桌子 —— 真机验收台（`tests/`）、逐轮取证报告（`reports/`）、CI、日志汇 `harness/` ——
验收口径、每个版本的真机数字在作者本机留档，不随本仓库分发。

许可见 [`../LICENSE`](../LICENSE)：**All Rights Reserved · Beta** —— 自用 / 游玩 / 原样转发可以；二次发布修改版或商用请先取得许可。
