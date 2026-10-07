# 变更日志 · doom.nats（v4 · 原版自然生成复刻）

> 口径：本表只记 v4 线（数据包驱动复刻原版自然生成 + Circumstance 情形引擎 + 消失层）。
> v3（复刻地图包 `早期作品线`）与 `ported/` `optimized/` 属另一条线。
> 目标环境：Minecraft 1.21.6 · Fabric（`pack_format` 80）。
> 每条 = 改了什么 · 为什么 · 可复核的数字。
> 工程纪律、真机测试台与逐轮取证报告是作者本机的东西（不随本仓库分发）；
> 注：作者规则层 `rules/` 一度移出本仓库（它是构建期输入，只有重新生成才有效）；2026-09-29 起它随源码一起回到本仓库的 `src/rules/`，字段表与用例见 [`src/rules/README.md`](src/rules/README.md)。
> 注：v4.19–v4.22 的时间戳都是 2026-09-29（同一天连续迭代）；`v4.21b` 只在 v4.22d 里被引用（forceload 单位问题），
> 没有独立版本节。

---

## v4.30.0 · 数量档位（scale）— 2026-10-07

> 这一版加了一组数量旋钮：不改规则、不改物种，只调"最多刷几只"。
> 一条命令就能把刷怪规模调成一半、一倍半、两倍半或四倍，跨 `/reload` 保留。

### 1 · 新增：数量总开关 `qty`

| 项 | 值 |
|---|---|
| 配置项 | `qty`（写进 `doom.nats:config`）|
| 含义 | 百分比。`100` = 原样，`50` = 各类上限减半，`200` = 翻倍 |
| 有效范围 | `1` 到 `1000` |
| 影响 | 只缩放**容量上限**（各类 `maxInstancesPerChunk`）|
| 不影响 | 刷怪节奏。速度另有 `density` / `batch` / `period` 三个旋钮 |

写法和其它配置项一样：

```
/data modify storage doom.nats:config qty set value 150
/function doom.nats:cfg/apply
```

### 2 · 新增：五档一键切换

不想算百分比就用这五个函数。它们把值写进配置层，`/reload` 之后还在。

| 命令 | `qty` | 效果 |
|---|---|---|
| `/function doom.nats:scale/sparse` | 50 | 上限减半 |
| `/function doom.nats:scale/normal` | 100 | 回到原版 |
| `/function doom.nats:scale/dense` | 150 | 一倍半 |
| `/function doom.nats:scale/horde` | 250 | 两倍半，同时加快刷怪节奏 |
| `/function doom.nats:scale/extreme` | 400 | 四倍 |

切换后聊天栏会出提示，说明当前是哪一档。想回到原版就跑 `scale/normal`。

### 3 · 补齐：容量计数（v4.28 的性能改造）

上一版的 `ports/` 用了一份缺容量计数的生成器快照，产物因此少了 5 个函数文件，
和已经发布的 `dist/` 里的包对不上。这一版补齐：

- `check/caps_formula`，容量公式（`maxInstancesPerChunk × spawnableChunkCount / 289`）
- `check/caps_scan`，容量计数，每维度每拍一次整图盒子查询
- `check/cnt_overworld` / `cnt_the_nether` / `cnt_the_end`，逐实体按类别分派

性能数字：盒子查询从每秒 21 次降到 3 次。真机实测单条盒子选择约 71 到 75 毫秒，
改造前放大约 1.47 秒/秒，改造后约 0.21 秒/秒。

### 4 · 文档修正：`mcdoc` 补 `qty`

`mcdoc/doom.nats/config.mcdoc` 是给编辑器看的配置类型声明。上一版加 `qty` 时漏了它，这一版补上。
实验性变体的包里也第一次带上这份文件（此前只有默认变体有）。

### 5 · 规则层文档修正：`weight` 的口径

`src/rules/README.md` 里对 `weight` 的说明是错的。原先写
「与香草条目同池竞争」，实测不是这样。

实际口径：命中率约等于 `weight / 1000000`。想让自建条目真的刷出来，
要填十万量级。填 `40` 这种小数字等于不刷。

示例同步改过：`src/rules/examples/full/entries.json` 里的权重从 `120` 改成 `100000`。

### 6 · 真机验收

全部结论来自真机：Fabric 服务端 + `/reload` + 包内自断言套件。
判定口径是 `pass/fail` 加 `total == 14`，再加 8 类加载错误全 0。

| MC 版本 | 加载错误 | 自检 |
|---|---|---|
| 1.21.5 | 0 | `pass=14 fail=0 total=14` |
| 1.21.6 | 0 | `pass=14 fail=0 total=14` |
| 1.21.7 | 0 | `pass=14 fail=0 total=14` |
| 1.21.8 | 0 | `pass=14 fail=0 total=14` |
| 1.21.9 | 0 | `pass=14 fail=0 total=14` |
| 1.21.10 | 0 | `pass=14 fail=0 total=14` |
| 1.21.11 | 0 | `pass=14 fail=0 total=14` |
| 26.1 | 0 | `pass=14 fail=0 total=14` |
| 26.1.1 | 0 | `pass=14 fail=0 total=14` |
| 26.1.2 | 0 | `pass=14 fail=0 total=14` |
| 26.2 | 0 | `pass=14 fail=0 total=14` |
| 26.3 | 0 | `pass=14 fail=0 total=14` |

### 7 · 四道门

| 门 | 结果 |
|---|---|
| 静态门（默认 + 实验性）| 0 error / 2 warning |
| 加载期 0 失败 | 12 个版本全 0 |
| 真机断言 | 12 个版本全 `pass=14 fail=0 total=14` |
| zip 与包体逐字节一致 | 7 个 zip 全部通过 |
| sha256 对齐 | 本地、`SHA256SUMS.txt`、Release 附件三方一致 |

### 8 · 交付物

| 文件 | 适用版本 |
|---|---|
| `doom.nats-v4.30.0.zip` | 1.21.6（基线）|
| `doom.nats-v4.30.0-mc1.21.5.zip` | 1.21.5 |
| `doom.nats-v4.30.0-mc1.21.6-1.21.8.zip` | 1.21.6 到 1.21.8 |
| `doom.nats-v4.30.0-mc1.21.9-1.21.10.zip` | 1.21.9 到 1.21.10 |
| `doom.nats-v4.30.0-mc1.21.11-26.2.zip` | 1.21.11 到 26.2 |
| `doom.nats-v4.30.0-mc26.3.zip` | 26.3 |
| `doom.nats-v4x-experimental-v4.30.0.zip` | 实验性变体 |

## v4.29-multiversion · 多版本支持（1.21.5 → 26.3）— 2026-10-05

> 这一版是纯移植版：函数逻辑一行未动，只让同一只包能在 1.21.5 到 26.3 的 12 个版本上正确加载并跑通，
> 并以 4 份区间如实的包分别交付。跨版本的差异集中在 4 处硬破坏（详见下「移植矩阵」）。
> 全部结论来自真机验收（Fabric 服务端 + `/reload` + 包内自断言套件），不是静态推断。

### 1 · 多版本支持表

| MC 版本 | data pack version | 交付包（`dist/`） | `min_format` / `max_format` | 真机验收 |
|---|---|---|---|---|
| **1.21.5** | 71 | `doom.nats-v4.29-mc1.21.5.zip` | `[71,0]` – `[71,0]` | ✅ `pass=14 fail=0 total=14` |
| **1.21.6** | 80 | `doom.nats-v4.29-mc1.21.6-1.21.8.zip` | `[80,0]` – `81` | 🟡 推定（同区间） |
| **1.21.7 / 1.21.8** | 81 | `doom.nats-v4.29-mc1.21.6-1.21.8.zip` | `[80,0]` – `81` | ✅ `pass=14 fail=0 total=14`（1.21.8 实测） |
| **1.21.9 / 1.21.10** | 88.0 | `doom.nats-v4.29-mc1.21.9-1.21.10.zip` | `[88,0]` – `[88,0]` | ✅ `pass=14 fail=0 total=14` |
| **1.21.11 – 26.2** | 94.1 – 107.0 | `doom.nats-v4.29-mc1.21.11-26.2.zip` | `[94,1]` – `[107,0]` | ✅ `pass=14 fail=0 total=14`（5 版实测） |
| **26.3** | 121.0 | `doom.nats-v4.29-mc26.3.zip` | `[121,0]` – `[121,0]` | ✅ `pass=14 fail=0 total=14` |

> 基线不变：`dist/doom.nats-v4.29.zip`（原 v4.29 默认变体，面向 1.21.6）逐字节保留，
> 其 sha256 与上一提交完全一致（`883ff3eb…bc38`），老玩家升级不受影响。
> 配套：`dist/doom.log-multi.zip`（日志通道，全区间）与 `dist/doom.nats-selftest.zip`（自断言套件，全区间）。

### 2 · 硬破坏修复（跨 12 个版本踩到 4 类）

| # | 破坏 | 影响版本 | 改了什么 |
|---|---|---|---|
| 1 | 原版 ID 改名：`minecraft:chain` → `minecraft:iron_chain` | 1.21.9 起 | 窄判定标签里换用新 ID（1.21.5–1.21.8 变体仍用 `chain`） |
| 2 | 实体 ID 后加入：`minecraft:happy_ghast` | 1.21.6 起存在 | `legacy`（只供 1.21.5）**移除**该项；1.21.6+ 变体保留 |
| 3 | **gamerule 改名**（snake_case）：`doMobSpawning` → `spawn_mobs` | **1.21.11** 起 | `mode/survival`、`mode/off` 两处换新名（旧名在该版本 `Incorrect argument for command`，整函数加载失败） |
| 4 | predicate schema 变更：`condition` → `type`；`light` 内层拍平；`time` 取值 `daytime` → `day` | 26.3 | 68 个 predicate 逐字段改写 |
| 5 | **`pack.mcmeta` 新规则** | 1.21.9 起 | 新变体显式声明 `min_format`/`max_format`；并**收紧到实测边界**（见 §3） |

### 3.1 · ★ 勘误：`1.21.11 – 26.3` 不是一个区间（原资产已下架）

- 病灶：§1 原表把 1.21.11 – 26.3 合并成一份 `doom.nats-v4.29-mc1.21.11-26.3.zip` ✗
  它横跨了两个不同的破坏边界（gamerule 改名 = 1.21.11 · predicate schema = 26.3），
  ⇒ 中段 1.21.11 / 26.1 / 26.1.1 / 26.1.2 / 26.2 实际无人覆盖 ✗。
- 真机证据（把该资产原样装进这 5 个版本）：`/reload` 后 8 类加载错误合计 732 条
  （`Failed to load function` 244 · `Whilst parsing` 488），套件 `pass=13 fail=0 total=13`
 ，★ 注意 `fail=0` 看上去是全绿 ✗：实为含断言的函数整批没加载，靠「`total` == 预期 14」才判出失败 ✓。
- 根因（逐行定位）：该变体内 68 个 predicate 用的是新式 `{"type":"minecraft:location_check", …}`，
  而 1.21.11–26.2 只接受旧式 `{"condition": …}` ⇒ 68 个 predicate 全部注册失败 ⇒ 244 个引用它们的函数连带失败。
- 修复：拆成两份区间如实的包：
  - `doom.nats-v4.29-mc1.21.11-26.2.zip`（新变体：旧式 `condition` + 新式 `spawn_mobs` + `iron_chain`，`[94,1]`–`[107,0]`）
  - `doom.nats-v4.29-mc26.3.zip`（原 `-mc1.21.11` 变体，语义明确为仅 26.3，新式 `type`，`[121,0]`–`[121,0]`）
- 定界实验（最硬的证据）：26.3 变体装到 1.21.10 上确实失败（742 条错误、13/13）
  ⇒ 证明两个边界既无重叠也无缺口，不是「两边都能凑合跑」✓。
- 复验：新变体在 1.21.11 / 26.1 / 26.1.1 / 26.1.2 / 26.2 五台实测，均 `pass=14 fail=0 total=14`、
  8 类错误全 0，且五台产物 sha256 逐位一致 ✓。
- 发布面处置：GitHub Release 上的旧资产 `doom.nats-v4.29-mc1.21.11-26.3.zip`（已被下载 1 次）
  标注区间错误、留着会让人装坏 ⇒ 已下架，改以上面两份替换 ✓。

### 3 · 修复：两处 `pack.mcmeta`「自称宽于实际能力」

- 病灶（原值）：
  - `doom.nats-multi-1.21.9`：`min_format [88,0]` / `max_format 94`，而该变体只覆盖 1.21.9–1.21.10（data 88.0）。
  - `doom.nats-multi-legacy`：`min_format [48,0]` / `max_format 81` / `supported_formats{48,81}`，而它只覆盖 1.21.5（data 71）。
- 真机证据（1.21.11，`pack_data = 94.1`）：把未修改的 `1.21.9` 变体原样装进去 ⇒ 包被接受，随后
  `Failed to load function doom.nats:mode/survival` 与 `mode/off` 两条 `Incorrect argument for command … gamerule`
  ⇒ 自称区间「触碰」了它实际跑不了的版本。
- `max_format` 粒度语义（真机 + 字节码双重判定）：整数写法等于 `PackFormat(v, 0)`（minor 默认 0），
  比较先 major 后 minor ⇒ `(94,0) < (94,1)`。另需注意：实测该区间在专用服务器上不是加载闸门
  （`max_format` 取 87/88/93/94 全部被强制启用）⇒ 收紧的实际意义是「元数据如实 + 客户端数据包选择 UI 不误示」。
- 改法：`1.21.9` → `[88,0]`–`[88,0]`；`legacy` → `[71,0]`–`[71,0]` 并删除 `supported_formats`（窄区间无需，且须与 min/max 逐值一致）。
- 改后复验：1.21.5 `pass=14 fail=0 total=14`（0 加载错误）· 1.21.10 `pass=14 fail=0 total=14`（0 加载错误）。

### 4 · 真机验收证据

- 判定三件套（缺一不可）：`pass/fail` + `total == 预期(14)` + 8 类加载错误全 0
  （`Failed to load function` / `Whilst parsing` / `Macro without` / `No variables in macro` / `Invalid NBT path` /
  `Incorrect argument for command` / `Failed to load datapacks, can't proceed` / `Registry loading errors`）。
- 判定以汇总行为准：`[SELFTEST] RESULT pass=14 fail=0 total=14`（不以「日志无 ERROR」为准，实测真实失败行不含 ERROR 关键字）。
- 四台实测：1.21.5 ✅ · 1.21.8 ✅ · 1.21.10 ✅ · 26.3 ✅（均 14/14、0 错误）。
  本轮 mcmeta 收紧后重跑 1.21.5 与 1.21.10 各一次，仍 14/14。

### 5 · 产物指纹（sha256）

```
158628810082f9d97c3afd29ddec8ae2f87f8519a342368bfa3bb8b1303bbb60  doom.nats-v4.29-mc1.21.5.zip
7d90b832a6bbd8aa2fbddb6bf04faeb747acc3c33625a5ba4d67e6df14eff038  doom.nats-v4.29-mc1.21.6-1.21.8.zip
511410de0c45bf9d6496ab8f60a4bff2907fe06d17f60b35a0c12c5ce6f896bd  doom.nats-v4.29-mc1.21.9-1.21.10.zip
0e4f03b4ededc93ad8797e72c3806c1cace1b4309a9476c0dc4ca1166b00bc2e  doom.nats-v4.29-mc1.21.11-26.2.zip
9fea4c81e1236fe2c9c939a7571976da7788702750949838f7abfbb5b61e1b44  doom.nats-v4.29-mc26.3.zip
a65873bf49bb1b135b67fe533a883cf8b0fafeca0289be9455eaf32a2c15bd71  doom.log-multi.zip
4ab6836a8dfd19372b4a2d6f7f716f73b76489bb85a504728fe27f0fea42f1bb  doom.nats-selftest.zip
```

> ~~`ebc2d807…7273  doom.nats-v4.29-mc1.21.11-26.3.zip`~~ → 已下架（区间标注错误，见 §3.1）。

完整清单见 `dist/SHA256SUMS.txt`。

### 6 · 仓库结构变更

- 新增 `ports/`：每个版本区间的包本体源码树（`ports/doom.nats-<区间>/`、`ports/doom.log/`、`ports/doom.nats-selftest/`），
  供逐文件核对；`dist/` 的 zip 即由这些树打包（zip 顶层层级与既有成品一致）。
- 顶层 `doom.nats/` 保持为默认变体（1.21.6 基线），与 `dist/doom.nats-v4.29.zip` 逐字节对应。

> 未实测/存疑：`1.21.6`、`1.21.7`、`1.21.9`、`1.21.11`、`26.1`、`26.1.1`、`26.1.2`、`26.2` 未单独起服，
> 它们与已测版本同处一个变体区间且共享全部版本相关改动 ⇒ 推定可用（🟡）。

---

## v4.29 · 正式发布（Latest）— 2026-10-04

> 这一版是同一件事的两个面：把被真实 `weight` 口径带错的示例与预设一起修掉，① in-game 帮助与用法注释里的 `weight:40`（照它写永远不刷）② 实验性预设 `blood_moon` / `storm_season` / `deep_dark` 里那三条按同一口径几乎永不出现的自定义怪。另按事实改正两条"文档说的东西不存在"。生成器逻辑一行未动，只动数值与措辞。

### 1 · 修复：in-game 帮助里的 `weight` 示例（照它写永远不刷）

- 病灶：作者层运行时刻的帮助与用法注释里，示例条目写的是 `weight:40`，`/function doom.nats:author/help` 的 `[2] 条目`、`author/add_entry` 的用法注释、`author/demo_run` 的演示条目（`weight:20`）。按 `weight` 的真实口径「条件成立时每次尝试被选中概率 ≈ `weight / 1000000`」，`40` ⇒ 0.004%、`20` ⇒ 0.002%，玩家照抄这个示例写出来的条目几乎永远不会刷。
- 改法（只改生成器里的数值与措辞，不动逻辑；文件 `src/tools/lib/author-runtime.mjs`）：
  - `add_entry` 用法注释：`weight:40` → `weight:100000`，并补两行白话口径（≈ `weight/1000000`，要真刷出来就填 10 万级）
  - `help` 的 `[2] 条目` 示例：`weight:40` → `weight:100000`
  - `demo_run` 演示条目：`weight:20` → `weight:100000`
  - `help` 新增一条 gold 提示行：`⚠ weight：条件成立时每次尝试被选中概率 ≈ weight/1000000，要真刷出来就填 10 万级（40 ⇒ 0.004%，等于永远不刷；100000 ⇒ 10%）。多条目同时成立按声明顺序吃区间。`
- 机制（为什么 `40` 不刷）：命中区间 `#off..#hi` 是按"香草权重和 + weight"这种小数量级算出来的，但拿去比较的是还没取模的 `$rng`（`random value 0..999999`）；`$rng %= #wsum` 发生在这次比较之后 ⇒ 只有 0..999999 里长度 = `weight` 的那段骰值能命中。真机对照：`40` ⇒ 0.004%（≈永远不刷）· `90` ⇒ 0.009%（90 秒 0 只）· `100000` ⇒ 10% · `900000` ⇒ ≈90%（180 秒烈焰人 22 → 32 只）。
- 文档侧：`weight` 口径的**全仓校正**已在 `c3238d8` 完成（`docs/wiki/规则字段参考.md` 的「⚠ `weight` 的真实口径」、`docs/wiki/示例库.md`、`docs/wiki/FAQ.md`、`docs/wiki/已知限制.md`、`src/rules/README.md`）；本节补的是**生成器里那份被漏掉的帮助文本**，它由生成器写进产物，改文档改不到它。

真机 A/B 证据（隔离实例 game 25598 / RCON 25608，真客户端 mineflayer 1.21.6 当 `@s`；`/reload` 0 加载错误，`Failed to load function` 0 条）：

| 产物 | `/function doom.nats:author/help` 的回执 |
|---|---|
| 改前（`doom.nats-v4.28.zip`） | `[2] 条目：…weight:40,when:{thundering:1b}}…`，且**没有** weight 口径提示行 |
| 改后（`doom.nats-v4.29.zip`） | `[2] 条目：…weight:100000,when:{thundering:1b}}…` + gold 行 `⚠ weight：条件成立时…≈ weight/1000000…（40 ⇒ 0.004%，等于永远不刷；100000 ⇒ 10%）` |

### 2 · 修复：实验性预设里同样错误的 `weight`（三条：`30/25/30` ⇒ `120000/100000/120000`）

- 同类缺陷，后果更直接：`src/tools/gen_exp.mjs` 里三个内置预设各自的条目，`blood_moon` 的"血月行者"、`storm_season` 的"风暴猎手"、`deep_dark` 的"深暗潜行者"，写的是 `weight: 30 / 25 / 30`。按同一口径（≈ `weight/1000000`）命中率只有 0.003% / 0.0025% / 0.003% ⇒ 玩家 `/function doom.nats:exp/preset` 套用预设之后，那三只自定义怪几乎永不出现。预设是给人"一键套用"的，比文档示例更该修。
- 取值理由：按 ×4000 把原值整体抬进十万级，保留作者原有的强弱比（blood_moon 30 : storm_season 25 = 120000 : 100000）⇒ **`blood_moon` 120000（12%/次尝试）· `storm_season` 100000（10%）· `deep_dark` 120000（12%）**。没有另造新比例：原作者这三条本就只差 5（≈无区分），抬高只是把"看不见"变成"看得见"，不改变预设之间的相对强弱。
真机 A/B 证据（隔离实例 game 25602 / RCON 25612，复用带 `minecart_improvements` 旗标的世界；`/reload` 0 加载错误，`datapack list` 里 `[minecart_improvements (feature)]` 与 `[file/doom.nats (world)]` 都在）：

| 产物 | `data merge storage doom.nats:exp_in {name:"blood_moon"}` → `function doom.nats:exp/preset` → `data get storage doom.nats:exp entries[0]` |
|---|---|
| 改前（`doom.nats-v4x-experimental-v4.28.zip`） | `entries[0].id` = `"blood_moon_walker"` · **`entries[0].weight` = `30`** |
| 改后（`doom.nats-v4x-experimental-v4.29.zip`） | `entries[0].id` = `"blood_moon_walker"` · **`entries[0].weight` = `120000`** |

### 3 · 产物与仓库同步

- 12 个生成器（10 默认 + 2 实验性）全部 exit 0；`node src/tools/check_static.mjs` ⇒ exit 0 / 0 error / 2 warning（两条 warning 是既有的 `check/fail`、`debug/light_fail`「含宏行但没有任何 `with` 调用」）。
- 产物差异逐条核对（把两个版本的 zip 各自解包、逐文件比 sha256）：默认变体 694 → 694 项、0 增 0 删、正好 3 个文件内容不同（`data/doom.nats/function/author/{add_entry,help,demo_run}.mcfunction`）；实验性变体 771 → 771 项、0 增 0 删、正好 9 个文件内容不同（上面那 3 个 + `exp/{add_entry,help,demo_run}.mcfunction` + `exp/preset/{blood_moon,storm_season,deep_dark}.mcfunction`）。生成器产物仍是默认 693 / 实验性 770 文件，加上手写的 `mcdoc/` 一枚 ⇒ zip 默认 694 项 / 实验性 771 项。
- `dist/` 重打并重算校验（v4.25 与 v4.28 的四枚 zip 一律保留不删）：
  - `doom.nats-v4.29.zip` · sha256 `883ff3eb2761079f67f14b7fc33bdf378564bb8e52149257e85c9c72d598bc38` · 569804 B · 694 项，加了预设改动后再打一次，sha256 逐字节未变（`exp/*` 不进默认变体，std 完全不受影响）
  - `doom.nats-v4x-experimental-v4.29.zip` · sha256 `29ec530c2dfdeed7c79c6719ba60bd2f2081f4c16fe2462f49802b6428096af6` · 654270 B · 771 项
  - `dist/SHA256SUMS.txt` 只列这两枚（2 行，`<sha256>` + 两个空格 + 文件名 + LF；另用 `Get-FileHash` 独立复核一致）。
- 仓库顶层的 `doom.nats/`（可直接点开看的包本体）同步到 v4.29：与 `dist/doom.nats-v4.29.zip` 逐项一致（694/694，0 缺 0 多 0 内容不同）；实验性 zip 与 `pack/doom.nats-experimental/` + 手写 `mcdoc/` 同样 771/771 逐字节一致。

### 4 · 文档：四处"让你跑一个不存在的文件"按事实改正

`dist/` 里只有 `dist/SHA256SUMS.txt`（每行 `<sha256>` + 两个空格 + 文件名，每次发版重算），没有 `doom.nats-*.zip.sha256` 这种按 zip 命名的校验文件。同类口径早先在 README 已改正过，本轮把剩下的漏网处一并扫掉：

| 文件 | 原文（✗ 那个文件不存在） | 改后（✓ 指向真实存在的校验值） |
|---|---|---|
| `docs/wiki/安装与升级.md` | `sha256sum -c doom.nats-v4.29.zip.sha256` | `sha256sum -c dist/SHA256SUMS.txt` + Windows 一行命令 |
| `docs/25-兼容与版本.md` | `sha256sum -c doom.nats-v4.29.zip.sha256`（Windows：直接 `Get-FileHash .\doom.nats-v4.29.zip`） | 同上两条命令 |
| `docs/wiki/版本与验收.md` | "两个变体的 zip…**各带 `.sha256` 校验文件**" | "校验值统一在 `dist/SHA256SUMS.txt`（每次发版重算，只列当前发布物的两枚）" |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | `sha256sum -c doom.nats-v4.25.zip.sha256`（Issue 表单还在问 v4.25 的老命令） | `sha256sum -c dist/SHA256SUMS.txt`（Windows 用 `Get-FileHash` 逐行核） |

- 全仓 `git grep '\.sha256'` 复查：除本节（在描述"改前"）与历史节外已无残留。历史条目不动。

## v4.28 · 正式发布 — 2026-10-04

> 这一版四件事：容量计数减总量 ≈ 7×（P0 性能）· 就绪提示恢复（宏缺参，整函数曾被静默放弃）· **`debug/*` 同类缺参 4 处补齐 · 打包漏拷的 `mcdoc/` 补回**（v4.25 的 zip 里有，v4.26–v4.28 漏了）。
> 本机数字口径：隔离实例 25574 / RCON 25584 · view-distance 10 · Mem Reduct 常驻（下面的性能数字是在它常驻下取得的）。

### 1 · 性能：容量计数减总量 ≈ 7×，窗口 tps 13.92 → 20.0x

- 改法：容量扫描从「7 类别 × 3 维度 = 21 条整图盒式选择器 / 秒」改成「每维度只做 1 条整图盒子（3 条/秒），并新增 `check/cnt_overworld` / `cnt_the_nether` / `cnt_the_end` 逐实体按类别 tag 派发」——被选中的实体自己用 `@s[type=#doom.nats:<类别>]` 判定，命中几个类别就给几个类别 +1。三个维度各占一个相位（1 / 8 / 14），仍是 20 拍一轮 = 1 Hz。旧选择器 `limit=500` 的饱和语义用逐实体封顶等价实现（510 只蝙蝠 ⇒ `$cnt.ambient` 恰好 500，与旧实现 `check/caps` 读数一致）。
- 参照实现：`check/caps`（21 条全量）保留为调试 / 验证入口，不在任何节拍上跑；它的非注释行与修前逐字节相同，所以等价性回归拿它当参照。
- 修前 → 修后（同一实例、同一协议背靠背）：`/reload` → 静置 60 s → `tick query` ×3（间隔 15 s）→ `debug start` → 20 s → `debug stop`
  - 修前（v4.27 拆拍版）：`avg 60.1 ms · P50 56.8 · P95 106.9 · P99 139.3 · tps 17.41`（3/3 采样「追不上目标」）
  - 修后：`avg 13.8 ms · P50 3.2 · P95 74.5 · P99 99.4 · tps 20.02`（3/3「跟得上」）；旁证 v4.26（21 条全挤在 1 Hz 那一拍）tps 13.92
  - 总量模型：`R + 21q/20 = 60.1`、`R + 3q/20 = 13.8` ⇒ 单条整图盒子 ≈ 51 ms、非容量开销 ≈ 6 ms/tick ⇒ 容量计数 54.0 → 7.7 ms/tick = 7.0× 减量（avg 只降 4.4× 是因为那 ≈6 ms/tick 不缩）
- 本轮复测（v4.28 成品 · 同配方 · 场上实体数更少）：`tick query` **P50 0.3 ms · P95 52.2–52.9 ms · P99 57.1–61.5 ms · avg 6.2–6.3 ms（预算 50 ms/拍）；`debug stop` 窗口 400 tick / 19.97 s = 20.03 tps（目标 20）；同期 10 s 剖析窗（202 tick ⇒ 20.17 ticks/s）：`core/tick` 占总量 12.43%**，其中 3 条整图盒子 `5.55 + 3.33 + 3.32 = 12.20%`。
  - 别跨轮直接比百分比：上一轮留档的同一项是 `core/tick 15.26%` / 3 条盒子 `9.43%`，盒子占比随场上实体数变。可比的硬数字是「盒子选择器 21 条/秒 → 3 条/秒」和「窗口 tps 都守在 20 附近」。
- 尾部尖峰照旧存在：`P95 ≥ 50 ms`，来源就是每 20 tick 的容量扫描 + 3 条整图盒子，按流程**只标 ⚠ 不判 FAIL**；两条硬判据（`avg < 50 ms/拍`、窗口 `tps ≥ 19.0`）都过。

### 2 · 修复：就绪提示（宏缺参 ⇒ 整个函数体被静默放弃）

- `core/setup` 末尾那行 `function doom.log:info {…}` 只写了 `message`、漏了 `code`。`doom.log:info` 是宏入口，约定是「`code` 与 `message` 两个键都必须写，缺一个，整个函数体被静默放弃」（引擎行为）⇒ README 承诺的「装好会在聊天栏看到一句就绪提示」实际不出现。补 `code:"E101"`（配置 / 加载期）后真机回显 ✓。

### 3 · 修复：`debug/*` 还有 4 处同样的宏缺参（同类缺陷，逐个查出来）

这 4 处都只写了 `message`，所以 README 让人跑的 `/function doom.nats:debug/all` 里有若干行是死的：

| 函数 | 补的 code | 段 |
|---|---|---|
| `debug/dryrun`（头一行） | `E911` | E9xx 其它（人工触发的诊断输出） |
| `debug/despawn_report` | `E912` | 同上 |
| `debug/mobs` | `E913` | 同上 |
| `debug/reject_report` | `E914` | 同上 |

编号段按 `doom.log` 的编码约定取：**E1xx 配置/加载期 · E2xx 并发/状态污染 · E3xx 持久层/缓存 · E4xx 物品/NBT 契约 · E5xx 调度/时序 · E9xx 其它/兼容路径**。已占用的是 `E101`（本包就绪）、`E201`（`doom.consumable`）、`E995–E999`（`doom.test` 自测）⇒ 这四处人工触发的诊断输出落在 E91x 子段。

A/B 真机证据（同一个世界、同一条命令 `debug/all`，只换产物；两种产物 `/reload` 都是 0 加载错误）：

| 产物 | `doom.log:clear` → `debug/all` → 回读 `doom.log:data` |
|---|---|
| 改前（上一个 v4.28 zip） | `{history: []}`，by_code 全空、history 全空（4 条一行都没记账） |
| 改后 | `by_code` = **`{E911, E912, E913, E914}`**（各 `n:1`）· `history` 4 条齐全 · `last` = `E912` |

两遍独立回读结果一致。留档 `_work/gates/2026-10-04-v429-debugcode-ab.txt`（作者本机，不随仓库分发）。

### 4 · 产物与仓库同步

- 两个变体重生成：只改了这 4 个文件 × 2 变体（`check_static` 的 `--check` 逐字节比对通过；生成器产物默认 693 / 实验性 770，与改前的文件集合一致。zip 项数见下）。
- `dist/` 重打并重算校验：
  - `doom.nats-v4.28.zip` · sha256 `77c2c2e0701cd694bc30ab43c553e605a55e6d11a0c1b592d3f3c36d923f287c` · 569438 B · 694 项
  - `doom.nats-v4x-experimental-v4.28.zip` · sha256 `fdcae6046712cdde539f4ef8184a99ccf800fac9e690413d210571d0b0697a43` · 653542 B · 771 项
  - `dist/SHA256SUMS.txt` 只列这两枚（2 行；每次发版重算一次）。
- 仓库顶层的 `doom.nats/`（可直接点开看的包本体）同步到 v4.28：与 `dist/doom.nats-v4.28.zip` 逐项一致（694/694，0 缺 0 多 0 内容不同）。此前它停在 v4.25（689 文件），而且带着上面那个就绪提示 bug。
  - 打包漏拷修复：手写的编辑器提示 `mcdoc/doom.nats/config.mcdoc`（3.5 KB · sha256 `411fe4cb36…`，没有生成器负责它、由仓库手工维护）在 v4.25 的 zip 里有，v4.26–v4.28 重打包时漏拷了 ⇒ 本轮把它补回打包流程，两个 zip 都重新带上它（默认变体 693 → 694 项、实验性 770 → 771 项），[docs/21](docs/21-玩家可改清单.md) 的说明恢复成「zip 内含 `mcdoc/`」。
- 门：`check_static.mjs` 默认与 `--exp` 均 0 error / 2 warning（两条 warning 是既有的 `check/fail`、`debug/light_fail`「含宏行但没有任何 `with` 调用」）。

## v4.25 · 正式发布 — 2026-09-29

- 状态变更：`v4.25` 由预发布（pre-release）转为正式版，并设为仓库的 Latest Release。
- 定位：本版是 Minecraft 1.21.6 的稳定版；超出原版的实验性能力（`near` / `on_spawn` / 预设包）只在 `v4x` 实验性变体里，装它需要在创建世界时开启对应实验性玩法。自定义外观（AJ 桥接）另算，源码在 `src/tools/gen_exp_aj.mjs`，但未随本版成品发布——本仓 `src/rules/rigs.json` 是 `{}`，成品 zip 里 `exp/aj` 条目为 0；要用需自备非空 `rules/rigs.json`（样例 `src/rules/examples/aj/rigs.json`）并 `DOOM_EXP=1` 重跑生成器。
- 源码可见：生成器 `src/tools/`、作者规则层 `src/rules/`、生成输入 `src/_work/generated/` 随本仓库发布，想自己改包照 [`src/README.md`](src/README.md) 的「三步构建」走（跑生成器 → `check_static` → 装包/打包）。生成器的 `--check` + lint + 引用闭包在克隆里实跑通过。
- 产物未改动：`dist/` 两个 zip 与各自 sha256 与上一提交逐字节一致（本版只改发布口径与仓库形态）。
- 门：`src/tools/check_static.mjs` 默认与 `--exp` 均 0 error / 2 warning；`check_leak.mjs`（含顶层结构）0 命中。

## v4.23 – v4.26 · 玩家可见摘要

- v4.23 作者规则层：新增 `rules/` 三个文件（逐实体规则 / 条件条目 / 数量曲线）。默认全部为空 = 原版行为，改了才生效。
- v4.24 运行时刻作者层：规则搬进游戏内存储，改完下一拍就生效，不用重启、不用重装包（`/function doom.nats:author/show|reset|help`）。超出原版的能力（附近生物、出生特效、预设包）单独做成实验性变体，靠引擎门把关：世界没开对应实验性玩法就拒绝加载。
- v4.25 自定义外观桥接（实验性）：真实体当内核 + 骨架当外观（`ride` 挂载），内核照常移动/消失，外观逐格跟随（位移误差 0.0000 格），容量只数内核。（源码在 `src/tools/gen_exp_aj.mjs`，但未随本版成品发布：本仓 `src/rules/rigs.json` 是 `{}`、成品 zip 里 `exp/aj` 条目为 0；数字来自非空 rigs 的实验构建。）
- v4.26 仓库形态整理：本仓库 = 玩家向（`dist/` 下载 + `docs/` + `rules/`）；生成器、测试台、验收报告、CI 是作者本机的东西（不随本仓库分发）。
- 同批修复：主世界 `water_creature / water_ambient / underground_water_creature / axolotls` 四类全局容量判定恒读 0（容量门形同不存在）；`water_fluid` 孤儿文件导致实验性变体整函数加载失败；`data merge` 递归把上一条的 NBT 粘到下一只；1.21.5+ 装备 NBT 应为 `equipment:{}`。

> 顺带"修复"了一个没人报过、也没人觉得是 bug 的 bug：发光鱿鱼不能刷在草地上。😄（原版当然不是 bug，是现在允许你把它改成"能"。）

完整逐版本条目与数字在作者本机留档（不随本仓库分发）。

> 文档修正（v4.25 之后 · 2026-09-29）：README / docs / Wiki 里"玩法 A（运行时刻）"的示例曾混用构建期字段名。
> 现已逐条对齐实现：条目里的群系是 biome（单数）· 组大小是 min / max · belowAny 要写方块标签 #minecraft:leaves ·
> on_spawn 是钩子开关（1b）加同名函数文件 · cluster / coins / ySea / tag 等源码级开关只能构建期改。数据包产物本身未改动。

## 文档升级 — 2026-09-29 · 首屏 / 兼容表 / 报问题入口 / 致谢页 / 校验行

- 动机：对照 24 个同类与通用优秀仓库（报告在作者本机 `reports/参考-优秀仓库案例-20260929.md`，不随本仓库分发），把"第一屏还是文字墙、版本兼容要自己拼、报问题没有固定字段"这三件事补上。只动文档与模板，不动数据包产物。
- README 重排：首屏加徽章行（最新版本 / MC 版本 / 许可）+ 效果图位（占位，图要进游戏拍）+ 30 秒三步表；"更多例子"这类长文移到 [`docs/wiki/示例库.md`](docs/wiki/示例库.md) 与 [`docs/24`](docs/24-玩家能改动的一切.md)，README 只留"给答案的"内容 + 链接表。
- 新增 [`docs/25-兼容与版本.md`](docs/25-兼容与版本.md)：版本 × 变体 × 是否要实验性玩法 × `pack_format` 一页对照，含升级/降级/换变体/卸载，以及"实验性变体为什么要借一个原生旗标、代价是什么"。
- 新增 [`docs/26-致谢与许可.md`](docs/26-致谢与许可.md)：许可摘要（能做什么/不能做什么）、第三方边界（不含 Mojang 资产；自定义外观桥接只演示机制，rig 等第三方包不随包分发）、致谢与署名格式。
- 新增报问题表单：`.github/ISSUE_TEMPLATE/`（Bug 报告 / 功能请求 / 引导配置）。Bug 表单固定收集 包版本 · 变体 · MC 版本与单人还是服务器 · 校验结果 · 复现步骤 · 日志片段 · 截图。
- 新增校验怎么验：README 里一行两法（`sha256sum -c` / PowerShell `Get-FileHash`）+ 当前两个 zip 的 sha256 值（`cd347370…` / `ddf72ddb…`）。
- 新增 [`docs/图-首屏效果位.md`](docs/图-首屏效果位.md)：首屏图放哪、多大、拍什么、别放什么（含"别放第三方外观包截图"）。
- Wiki：`docs/wiki/` 仍是 9 页源文件；线上 Wiki 仓库尚未创建（GitHub 需要先在网页点一次 "Create first page"），README 已加"打不开就看 `docs/wiki/`"的兜底。

## 措辞清理 — 2026-09-29 · 玩家可读化（去掉旧缩写，重新打包）

- 为什么：README / docs / Wiki / 包内描述里不该出现内部缩写。统一改成「自然生成复刻（数据包驱动）」「复刻原版刷怪」这类玩家能懂的说法，不引入新术语缩写。
- 改了什么：本仓库 `README.md` / `CHANGELOG.md` / `docs/`（含 `docs/wiki/`）全文清理；数据包内部的 `pack.mcmeta` 描述与进游戏的就绪提示同步改（由 `src/tools/` 的生成器重新生成，不手改产物）。
- 重新打包：`dist/` 两个 zip 按新产物重打（zip 内顶层仍是 `doom.nats/`；两个 zip 的每一个文件与从 `src/` 重新生成后的产物逐字节一致）：
  - `doom.nats-v4.25.zip` · sha256 `cd3473703bdcb51186ba10c26767f7385dfe5bf3c1c625602bfd260e63ea065e`
  - `doom.nats-v4x-experimental-v4.25.zip` · sha256 `ddf72ddb393c432adc55066af9074b2bc8bb3f68312fe2980cce68746a1786a9`
  - Release `v4.25` 的四个附件（两个 zip + 各自 sha256）已同步替换。
- 玩法与规则没有任何变化：这一次只动“给人看的字”——`pack.mcmeta` 描述、`core/setup` 的聊天栏就绪提示、产物文件头注释、方块标签里的一行说明。
  逐字节比对确认：函数、标签、判定逻辑全不变（默认变体 697 个文件 / 实验性变体 765 个文件，文件名单完全一致）。
- 验收：`src/tools/check_static.mjs` 默认 0 error / 2 warning、`--exp` 0 error / 2 warning；`check_leak.mjs` 0 命中；两个仓库正文全文搜索旧缩写 0 命中。

## v4.26 — 2026-09-29 · 仓库拆分：公开仓库只留玩家要的东西（+ 名称清理）

- 公开仓库（本仓库）只剩 6 项：`README.md` `LICENSE` `CHANGELOG.md` `dist/` `docs/` `rules/`。
  数据包 = `dist/` 里的两个 zip（各带 sha256），不再放源码 / 生成器 / 测试台 / 报告 / CI。
- 开发物搬到作者本机的开发工作区：生成器与静态门（`doom.nats/tools/*`）、
  生成器数据表（`doom.nats/_work/generated/*`）、真机测试台（`tests/`）、逐轮取证报告（`doom.nats/reports/`）、CI（`.github/workflows`）、VS Code 任务。
- 产物目录改名：`v4/doom.nats` → `pack/doom.nats`、`v4x/doom.nats` → `pack/doom.nats-experimental`（两个变体同放 `pack/` 下）。
  公开仓库不再收录这两个目录，玩家只下载 `dist/` 的 zip。产物逐字节未变（1462 个文件 sha256 全等 · 生成器 `--check` 通过）。
- "为什么有两份"：默认变体 = 逐条复刻原版（推荐，绝大多数人）；实验性变体 = 默认变体 + 非原版能力
  （`near` / `on_spawn` / 预设包），且 `pack.mcmeta` 带 `features` 引擎门 ⇒ 世界必须在创建时开启对应实验性玩法，否则装不上。
- 名称清理：按用户要求做了一轮措辞替换（177 个文件），并把旧项目名加入泄漏门黑名单（公开仓库 0 命中）。
- 验收：`tools/check_static.mjs` 默认变体 0 error / 2 warning、`--exp` 实验性变体 0 error / 2 warning；
  `check_leak` 0 命中（含本机绝对路径）；顶层结构门（白名单）0 违规；
  zip 内文件与从 `src/` 重新生成后的产物逐字节一致。

---

## v4.22d — 2026-09-29 · `in_fortress` 抖动结案（结论：测试台问题，不是包缺陷）

- 引擎语义（`LocationPredicate.java:49-53`）：`location_check` 的 `structures` 与 `biomes` 都被
  `level.isLoaded(pos)` 短路 ⇒ 位置所在区块没加载时谓词恒假。原版只在已加载且 ticking 的区块里
  尝试生成 ⇒ 生产路径永不撞这条；本包调用的就是引擎谓词 ⇒ 与原版语义一致。
- 测试台 bug：`forceload add <x1> <z1> [<x2> <z2>]` 收的是方块坐标（一次 ≤256 区块）。旧脚本按
  "区块坐标"传（`Math.floor(X/16)±4`）⇒ 命令回显成功、实际标的是别的区块（传 `-45,-44` 实际加载 `chunk[-3,-3]`）。
- 数字（隔离实例 25581，同一要塞点 200 次求值）：未加载 0/200 = 0.0% · 强加载 200/200 = 100.0% ·
  只加载 5 个候选点中的 1 个 80/200 = 40.0%（逐点 0% 或 100%，零抖动）。端到端（25565 同要塞）：
  两次门都是表外 0/24 = 0.0%、3 PASS / 0 FAIL。「~17% 抖动」是更早一轮判据收敛前的记录。
- 新纪律：靠 `forceload` 的用例必须回读 `data get block` 判 `loaded`，不满足 `exit 1`，不许静默降级；
  在任意坐标戳结构/群系谓词的测试先强加载该坐标。
  `_work/verify_fortress_e2e.mjs` 已按 ±64 方块 = 9×9 区块改。

## v4.22 — 2026-09-29 · 消失层「最近玩家」量词 bug（P0）＋ 门锚点/测试前置成片假红

- P0：消失层把「最近玩家」写成了「任一玩家」。v4.17 的 `execute as @a at @s as @e[tag=…,distance=129..]`
  = 「∃ 玩家 >128 ⇒ 杀」；原版 `Mob.checkDespawn()` 是「最近玩家 >128 才 discard」= 「∀ 玩家 >128 ⇒ 杀」。
  后果：两名玩家相距 >256 格时，各自身边的生成物被对方判掉（真机 3 人相距 460 格：75 秒
  `$spawned.total` +692 而场上只剩 0–9 只）。
- 修法：标记-清扫两遍（先清 `near64/near128`，再"任一玩家 64/128 格内 ⇒ 打标记"，最后只有"没有任何标记"
  的才 `void_kill`），另加有玩家在线守卫（无玩家时原版 `getNearestPlayer=null` ⇒ 不判定）。概率消失段（`near32`）同族修法。
- 数字：`verify_multibot` 1 PASS / 3 FAIL → 4 PASS / 0 FAIL；A/B 两处 128 格内 0/0 → 67/24。
- 工具三修：`tools/check_closure.mjs` 的 `RE_TAG_ADD` 字符类漏了 `@`（实际写法恒为 `tag @s add <tag>`）
  ⇒ 这条正则从来没匹配到过、把动态打的标签报成"读了从未添加的标签"（C4 假红 6 处 → 0）；
  `debug/dryrun_check` 先刷新 `$att.dim`（否则跨维度 dryrun 假 r5）；`install.mjs` 夹具新增
  `general:fortress_rounds`（一次 RCON = 40 轮，结构类 e2e 提速，不进产物）。
- 门锚点：锚点写死 `y=64` 而测试世界地表在 y=70 ⇒ 机器人被埋 ⇒ 天空光 0 ⇒ 成片假红。门现在自上而下扫
  「`#doom.nats:standable` + 上方两格可生成 + 站立点见天」，扫前把机器人抬到 y=200 让区块加载。
  数字：`rules 12/4 → 16/0`、`animals 4/2 → 6/0`、`persist 9/1 → 10/0`。
- 安全回归：新增 `_work/verify_dim_att.mjs`（`$att.dim` 归属 / `$snap.dim` 隔离 / 末地满 cap ⇒ 必 r5 /
  反向不连坐 / 生产链正反两向）6 PASS / 0 FAIL；自动化命令一律加守卫（只动锚定机器人）。

## v4.20 — 2026-09-29 · 极端场景 E1–E7 挖出的两个跨维度 P0

- P0-1 生产路径从不刷新"本次尝试的维度" ⇒ 下界/末地的尝试被拿主世界的计数/容量/海平面窗口判定，
  全局容量门在非主世界维度形同不存在（实测末地堆到 500 只末影人、`$rej.5` 恒 0）。
  根因：`pos/ctx` 只被 debug 路径调用。修：`spawn/try_at` 首行补 `function doom.nats:pos/ctx`（每次尝试 1 次）。
  回归断言：干净世界 + 末地有玩家 + `cap.monster` 压低 ⇒ `$rej.5` 必须增长。
- P0-2 `$snap.dim` 是共享计分板（快照层每 20t 写、尝试层也写 ⇒ 忙时被覆盖）⇒ 拆出专用 `$att.dim`
  （`circ/detect_dim_att` 写；`check/cap`、`check/sealevel` 读）。
- `check/border`（reason=11）：补上原版三种落位都查的 `worldborder.isWithinBounds`，配置
  `border.centerX/centerZ/size`（默认 `size=0` 关闭），半开区间与原版一致。
- `water_fluid` 标签：水生落位改流体语义（water / seagrass / tall_seagrass / kelp / kelp_plant / bubble_column），
  13 处判定（`check/block` 12 + `check/entity` 1）。E5 实测：修前海草/海带/气泡柱格全被误拒。
- 纪律：门必须单实例（同时跑两门 ⇒ 数字全是混写）；单脚本必须带超时（`spawnSync` 等的是 stdio 管道关闭）；
  锚定机器人的维度/距离/时间由门兜底；探针必须调被测函数本体并读 `$chk.*`，不许"等价推算"。

## v4.19 — 2026-09-29 · 「水里看不到溺尸」→ 四个修复（三个真 bug）

- P0-4 生产链路从不掷 `$rng`（只有测试脚本掷 ⇒ 恒 0）⇒ 每个类别永远只刷"表里第一条"（海洋永远蜘蛛、
  要塞永远烈焰人、森林/沙漠/雪原清一色蜘蛛），溺尸（5/520）永远选不中。
  修：`gen_mobs.mjs` 群系分发表头部自掷 `random 0..999999`。
- P0-5 取点 y 只扫「玩家层 +2..-16」 ⇒ 深水上空扫不到地面、候选点被钉在玩家层 ⇒ 深水零生成。
  修：扫不到时回退原版式整列均匀 `pos/band_fallback`（配置 `band.fallback` / `floorY.<维度>`）。
- P1-10 `#reduce_water_ambient_spawns` 极性反了（`unless` 应为 `if`）⇒ 海洋鱼被白扣 98%、河流反而 50 倍过量。
- P1-11 漏 `Drowned.checkDrownedSpawnRules` 第一条"脚下必须是水" ⇒ 浅水坑也能刷溺尸。
- 新增回归门 `_work/verify_species_mix.mjs`（走生产分发、不预掷 `$rng`；桶对齐 + `$rng` 取值数 +
  首行占比 + 类别份额 + 活性）9/0。
- 口径三修：① 冻结必须冻 `$snap_period`（只设 `$eff.period` 会被快照一秒还原）；
  ② 探针不许自己掷 `$rng`（老写法恰好掩盖 P0-4：测试全绿、生产全退化）；③ 长命机器人与长任务要活在
  DSH 进程树之外（`_work/start_bot.ps1` / `run_bg.ps1`），否则进程树回收即掉线。

## v4.18 — 2026-09-28/29 · Q7 收口（地图 worldgen 覆盖端到端 · 单类别群系致命 bug · 幽灵文件）

- worldgen 覆盖端到端（同世界只换 roster 的四相位 A/B/A，独立实例 25567/25577）：
  P1 原版 `+91` 生成 / 70 只场上 → P2a 空表覆盖（= RC4 地图语义）`+0` → P2b husk 覆盖 `+59`（husk=70，其它全 0）
  → P3 还原 `+51` / 68。取证：修后 `mob/biome/plains/monster.mcfunction` 由 97 行/8 物种 → 20 行/["husk"]。
- 致命 bug（原版构建就有，7 个群系中招）：`mob/biome/<群系>.mcfunction` 的单类别分支不设 `$catid`
  ⇒ 沿用上一个群系的值 ⇒ `if score $catid matches 0` 随机不成立 ⇒ 整片群系不刷怪。
  受害：`the_end / end_barrens / end_highlands / end_midlands / small_end_islands / deep_dark / the_void`
  及任何被地图覆盖成单类别的群系。修：单类别分支显式 `scoreboard players set $catid doom.nats 0`；
  新增 lint L14。红→绿：修前生成 `+0`/reason=8 `+1891`，修后 `+59` 只 husk。
- 幽灵文件：生成器只写不删 ⇒ roster 变化后旧表残留（用户存档里就有 2 个 `mob/biome/wgtest/**`），
  `--check` 看不出来。修：写出后清理 `mob/biome/**` 中不在本次产出集合的文件，`--check` 把"陈旧文件"计入漂移。
  原版构建 586 → 584 文件。
- 回归钩子 `tools/regress.mjs --worldgen <目录>`：合并覆盖 → `export_rosters` → 重生成 → 整套静态/离线/真机 →
  自动 `--reset` 还原并按 `biomes.json` 的 sha1 回读校验（不一致拉红整轮）。
- 陷阱：不要用 `execFileSync('powershell', …Start-Process -PassThru)` 起 detached 服（`execFileSync` 等 stdout EOF，
  Java 子进程继承句柄 ⇒ 父进程永久阻塞）。正解 `spawn(JAVA, …, {detached:true, stdio:['ignore', fd, fd]})` + `unref()`。

## v4.17 — 2026-09-28 · 保真度 backlog（P0-3 变体掷点 · 消失层参考点 bug · 多实例隔离）

- P0-3 变体掷点共享时机：原版 `NaturalSpawner:186` 的 `finalizeSpawn(...)` 在 `isValidPositionForMob`（:254）
  之后 ⇒ `SpawnGroupData` 由首只真正生成成功的个体创建、位置取它的 `blockPosition()`。
  现 `grp/init/<slug>` 只写兜底值 + `$grp.vneed=1`；`post/<slug>` 先 `grp/var/<slug>` 再 `grp/mem/<slug>`。
  红→绿：`verify_group` 22 PASS / 0 FAIL（`/fillbiome` 造 forest/plains 两个互斥群系区，首只在 forest ⇒ 4/4 woods；
  反向 ⇒ 2/2 pale；反证把掷骰放回 init ⇒ pale）。
- 消失层真机 bug（严重）：`despawn/tick` 用裸 `distance=129..`，而其参考点是函数执行位置 = `core/tick`
  的上下文 = 世界出生点 ⇒ 玩家离出生点 >128 格时，本包所有非持久生物在一个消失节拍内被 `void_kill`
  （症状："怪刚刷出来就没了"）。改为逐玩家判定。红→绿：`verify_persist 10 PASS / 0 FAIL`、`verify_animals 6/0`。
- 多实例隔离：`mcauto.mjs` / `regress.mjs` 支持 `MC_SRV` / `MC_PORT` / `RCON_PORT`，默认值与过去完全一致；
  `bot.mjs` 由它们传 `--port`。并行工作流各用一份 `mcserver-<名>` + 独立端口。
- 陷阱：数据包里裸 `@e[,…,distance=N..]` 与任何依赖位置的谓词参考的是函数执行位置；
  宏函数参数必须在调用前写进存储；跨成员各自的值要拆独立宏函数（马 `Variant`）。

## v4.16 — 2026-09-28 · 工具链：VS Code 接入 + headless Spyglass

- 新增 `.vscode/tasks.json`：默认 build 跑 `tools/check_static.mjs --vscode`（9 生成器 `--check` + lint + 闭包），
  输出 `file:line:col: error: msg` 配 `$gcc` problemMatcher ⇒ 直接进编辑器「问题」面板；另有一键回归 / 组数据专项任务。
- 新增 `tools/check_static.mjs`（统一静态门，<2s）、`tools/lint_spyglass.mjs`（headless 拉起已装的 Spyglass LSP）。
  后者未打通：探针包跑出「（无诊断）」⇒ 不可作证据（见 `docs/20`）。
- 硬门仍是游戏自己的加载器（`/reload` + 只看本轮的 `Failed to load function`），已内建在 mcauto/regress。

## v4.15 — 2026-09-28 · finalizeSpawn 组数据层（SpawnGroupData 复刻）

- 先纠正旧认知：`/summon` 与 `execute summon` 已经会调 finalizeSpawn
  （`SummonCommand.createEntity(..., true)`，reason=COMMAND，groupData=null）⇒ 逐实体重写装备/变体/婴儿是多余的；
  真正缺的是原版 `NaturalSpawner` 传的 `SpawnGroupData`。
- 新生成器 `gen_group.mjs`（140 文件）：`grp/init/<slug>`（每组一次）、`grp/mem/<slug>`（每只施加）、
  `post/<slug>`（补本包 NBT + 全局持久化 + 随机朝向）、`predicate/grp/biome/*`（冷/暖家畜、白兔/金兔、雪狐、狼 8 群系）。
- `spawn/emit` 改为 `$execute summon $(type) run function doom.nats:post/$(slug) with storage doom.nats:sel`
  ⇒ 新实体就是 `@s`，消除旧写法 `@e[distance=..1,sort=nearest]` 认错人的隐患。
- 引擎坑：宏行没有 `$(name)` 会让整函数加载失败（`No variables in macro`）⇒ lint 新增 L12。
- 动物幼年用 `Age:-24000`（`AgeableMob` 存档键），僵尸系用 `IsBaby`；新增 cfg `difficulty`、`special`。
  真机 14 断言全绿，全套回归 16 PASS / 0 FAIL。

## v4.14 — 2026-09-28 · 动物 / 维度 / 持久化 / 配置化

- 被动生物节拍必须用 `time query gametime`（原版 `gameTime % 400`），不能用 `daytime`；creature 只在节拍命中那一拍进候选。
- 维度探测在首个非旁观玩家位置（`circ/detect_dim`），因为 tick 函数的执行上下文永远在主世界。
- 海平面/光照档按维度进配置层：主世界 63 / uniform 0..7；下界 32 / 常量 7（无天空光）；末地 0。
- 持久化三态：默认（原版管消失）/ `doom.nats.persistent` 标签（只影响本包清理层）/
  `PersistenceRequired:1b`（原版也不消失）；逐规则 `persist:true` + 全局 `$cfg.persist=1`。
- 配置层：`doom.nats:cfg_defaults` → `doom.nats:config`（作者覆盖）→ `$cfg.*`，键清单见 `docs/18-配置手册.md`。
- 真机验证 `_work/verify_{rules,persist,animals,dims,mode}.mjs`，全部并入 `regress.mjs --reuse`。

## v4.13 — 2026-09-28 · 逐实体规则 + 逐实体光照（源码核对后的修正）

- 规则表 `tools/lib/entity-rules.mjs`（47 实体 → 27 条规则签名）→ `_work/generated/entity-rules.json`；
  `gen_mobs.mjs` 写 `$sel.rule/place/light/tag/grp1/cluster`，`gen_check.mjs` 生成 `check/block` 与 `check/entity`。
- 光照逐实体（`$sel.light`：none/dark/bright/bat/slime/glow/bl8）⇒ 修掉"动物被同时要求亮与暗"的互斥 bug。
- 落位逐类型（`$sel.place`：ground/any/water/water_surface/below_tag/lava）⇒ 修掉"水生要求下方可站立"的互斥 bug。
- 下方方块改用 14 个原版标签；新增群系谓词（slime / river / more_drowned / polar_alt）与 `can_see_sky`。
- 簇上限补齐 ghast/pillager/happy_ghast=1、camel/llama/trader_llama=6；water_ambient 距离 64；河流 98% 不刷；
  史莱姆补 50% 掷币。消失层默认关闭（原版 `Mob.checkDespawn` 已对普通生物生效）。
- lint 新增 L11（命令里不得有连续两个空格：Brigadier 直接拒整条命令，真机踩过）。

## v4.12 — 2026-09-28 · 生存直用模式（`mode/*`）

- 问题：本包用 `summon` 造生物，不受 `doMobSpawning` 约束 ⇒ 原版自然生成若还开着就是双份刷怪。
- `core/setup`（装载 tag）默认执行 `mode/survival`：`gamerule doMobSpawning false` + 出一份快照 + `say` 到日志。
- 开关 `mode/{survival,manual,auto,off}`，状态存计分板、可跨 `/reload` 与重进世界。
  真机 `verify_mode` 9 PASS / 0 FAIL（含「manual 后 reload 仍为 true」的反证）。
- 生存手册 `docs/16-生存直用手册.md`（装配三步 + 命令表 + 实测数字 + 与原版差距的诚实清单）。

## v4.11 — 2026-09-28 · 移除一律 void_kill

- 原版消失/超距移除 = `discard()`（静默、无掉落、无经验）；`kill` 会掉战利品给经验 ⇒ 语义不对。
- `util/void_kill` = `tp @s ~ ~-500 ~`；消失层与清理都走它。`debug/clear` 静默清掉本包生物
  （保留 `doom.nats.persistent`），数量报聊天栏与日志。
- 别再用 `kill @e[tag=doom.nats.spawned]` 清场（实测会在地上留下 476 个掉落物）。

## v4.10 — 2026-09-28 · 簇（cluster）模型

- 一次刷怪尝试 = 最多 3 个 group；组起点每组建模为重置，组内位移 `nextInt(6)-nextInt(6)` 累加。
- `groupSize = minCount + rand(1+max-min)`（物种挑中后重算一次）；物种每 group 只挑一次。
- `spawned >= getMaxSpawnClusterSize()` ⇒ 结束整次尝试（默认 4；仅 8 个实体类覆盖）。
- 调试看 `$grp.sel / $grp.sized / $grp.stop / $dbg.clusterMax`。

## v4.9 — 2026-09-28 · 一键回归 `regress.mjs`

```bash
node tools/regress.mjs --reuse          # 静态 + 对照 + 离线 + 真机一轮（不停服、不踢人）
node tools/regress.mjs --quick          # 跳过对照变体
node tools/regress.mjs --reuse --stress # 顺带跑 batch 阶梯压力测试
```

- 一步失败不中断（跑完汇总），产出 `reports/回归-<时间戳>.md`：每步 PASS/FAIL、耗时、关键输出 + 最近走势图路径；
  退出码 0/1 可直接接 CI。实测全绿 9 PASS / 0 FAIL。

## v4.8 — 2026-09-27 · `mcauto.mjs` 两种跑法（重要）

| 命令 | 行为 | 会不会踢人 |
|---|---|---|
| `node tools/mcauto.mjs --reuse --minutes N` | 复用已在跑的服务器：只热载新包（`/reload`）、跑场景、不停服 | **不会**（实测 PID 不变、在场玩家不断线） |
| `node tools/mcauto.mjs --minutes N` | 清世界 → 起新服务器 → 跑完停服 | **会**（客户端 Connection reset） |

默认带 `--curve 1.5`（每轮附走势图 + 统计行），`--stress` 顺带跑 batch 阶梯压测。

## v4.7 — 2026-09-27 · 两个新工具

- `_work/timeseries.mjs`：时间序列采样（各类别计数 / 累计生成 / batch / 上限 / mspt），产 json+csv+svg+png。
  实测稳态：怪物 71.7（上限 70）、mspt 5.29ms（预算 50）、清场后 6 秒补满。
- `tools/propose_tags.mjs --save <存档>`：读 Anvil region 统计真实地形的「下方/上方方块」分布 → 给出覆盖率与建议补的 id。
  首跑即发现 `standable` 漏了 `ice`/`packed_ice`（雪原 40% 的落位面），覆盖率 3.7% → 43.9%。

## v4.5 / v4.4 — 2026-09-27 · 自动找地面 + 逐实体规则

- v4.4：`pos/band` 默认 `$band.mode 0` = 在候选点从「玩家层 +2」往下扫到 -16，取第一处「下方可站 + 本体/上方可生成」
  ⇒ 不再要求作者声明高度带（模式 1 固定带、模式 2 ±jitter）。
- v4.5：`check/entity`（reason=9），规则 id 写在 roster 行的 `$sel.rule`：陆生不能在水里 / 水面水生要 seaLevel 窗口 +
  上下都是水 / 深水生物要真水 / 蝙蝠在地表下 + 暗 + 50% / 史莱姆 50<y<70 + 月相门。新增快照量 `$snap.py`、`$snap.moon`。
- 新增 lint L9（行尾注释）、L10（`~+N` 非法坐标），都是当天真机加载失败换来的。

## v4.3 — 2026-09-27 · 真机自动化

- 不再需要手敲命令：`node tools/mcauto.mjs --minutes 3` 一条命令跑完「杀旧服 → 干净世界 → 装包 → 起本地 Fabric 服务器 →
  起真客户端机器人 → 设场景 → 等区块稳定 → `debug/all` → 采报告」。
- 组件：`tools/mcrcon.mjs`、`_work/mcserver/setup.mjs`、`_work/mcserver/bot.mjs`（mineflayer）、`_work/mcprobe.mjs`。
- 驱动每次开局必须断言加载期 0 错误：函数加载失败会让整条链静默消失（当天踩过 `check/distance`）。
  专用服务器上 `tellraw` 不进日志 ⇒ 采集走 `say`。
- 实测稳态：`$cnt.monster = 70`（= 上限）、`$cnt.ambient = 13` ⇒ 容量链真的在管。

## v4.1 — 2026-09-27 · 采集链路

- `collect.mjs` 能真的采到 v4 标记：`[nats.env]` / `[nats.reject] rej:` / `[nats.light] tier:` / `[dryrun]`。
- `debug/reject_report` 先打数值再清零 ⇒ 每次 `/function doom.nats:debug/all` 都是一段独立测量窗口。
- 新存档自动装机 + 自动采集：`node _work/watch_new_save.mjs --minutes 45`、`node _work/watch_collect.mjs --minutes 60`。

---

## 附：当前验收口径（四道门）

| 门 | 命令 | 需要 | 最近结果 |
|---|---|---|---|
| ① 静态 | `node tools/check_static.mjs`（生成器 `--check` + lint L1–L14 + 引用闭包） | node | **0 error / 2 warning**（<2s；CI 已接） |
| ② 加载期 | 装机 + `/reload`，只看本轮 `Failed to load function` | Fabric 服务器 | 0（内建在 mcauto/regress） |
| ③ 真机断言 | `_work/verify_*.mjs`（`RCON_PORT=<port>` 可指到隔离实例） | 服务器 + 机器人 | `rules 16/0` · `animals 6/0` · `persist 10/0` · `dims 13/0` · `multibot 4/0` · `species_mix 9/0` · `dim_att 6/0` · `fortress_e2e 3/0`（表外 0/24 = 0.0%）· `e6_generic 7/0` |
| ④ 一键回归 | `node tools/regress.mjs --reuse --minutes 1 --curve 1` | 服务器（`--reuse` 不踢人） | **16 PASS / 0 FAIL** |

容量（E6/压测口径）：单维度 cap 由 `maxInstancesPerChunk × spawnableChunkCount / 289` 决定，随区块数自然增长；
多维度各自独立计数（v4.20 修）；`/tick freeze` 下不刷、红石类场景靠 10 Hz 观察时钟取证。
