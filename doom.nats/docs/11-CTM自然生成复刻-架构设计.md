# 11 · CTM 地图：数据包驱动的「自然生成复刻」架构设计

> 前提：地图**关闭原版自然生成**（`doMobSpawning=false` + 维度生成器不刷怪），全部刷怪由本数据包驱动。
> 目标：**严格复刻**原版自然刷怪的行为，并额外提供原版没有的**可控性**（环境情形注册表）。
> 依据：`docs/09`（源码级机制）+ `docs/10`（第三方文档检视）+ 本机反编译链（`_work/decomp/`）。
> 不考虑刷怪笼（`BaseSpawner`）—— 与原版自然刷怪是两套完全独立的机制。

## 一、可行性边界（先说清能到哪一步）

**已实测可用的关键原语**（决定了复刻的精度上限）：

| 原语 | 用途 | 状态 |
|---|---|---|
| `execute if loaded <pos>` | **查询区块是否已加载** ⇒ 复刻「合格区块」 | ✅ 已在本机 `ExecuteCommand` 常量池确证（1.21.6 可用） |
| `execute if biome` / `if dimension` | 群系 / 维度判定（比谓词更快） | ✅ 同上 |
| `location_check.predicate.light.light{min,max}` | 光照判定（精确到亮度数值） | ✅ suso.nats 已在用；与 `dimension_type` 的规则可一一对应 |
| `predicate` 全套（位置/方块/实体/天气/随机/时间） | 合法性判定 | ✅ |
| `/random value` + 宏 + `storage` 注册表 | 随机数与数据驱动 | ✅ v3 已验证 |
| `execute store result score … if entity @e[…]` | 按类别计数 | ✅（性能需实测定标尺） |

**无法精确复刻的（数据包表达不了）**：实体 AABB 碰撞检测、`spawn_costs` 的连续能量场、
`finalizeSpawn` 的族群数据、原版 `ChunkLevel` 的精确分级。⇒ 这些用**近似 + 显式文档化**处理，不假装等同。

## 二、分层架构

```
doom.nats/
├─ core/        setup（计分板 + 装载注册表 + 初始化情形）
│               tick（调度：按类别 × 节拍）
├─ chunk/       合格区块枚举：玩家 17×17 → 距离/加载状态过滤（execute if loaded）
│               ⇒ 得到 spawnableChunkCount（对应原版同名概念）
├─ pos/         取点：区块内 x/z 随机 + y 在 [minY, 地表+1] 区间随机（复刻 getRandomPosWithin）
├─ pack/        3 组尝试 × 逐只游走偏移 (nextInt(6)-nextInt(6)) × 群体大小 minCount..maxCount
├─ check/       合法性链，**每步独立成函数**以便按步 debug：
│               distance（24 格禁区 / 128 格上限）→ block（方块标签）
│               → light（光照档）→ cap（全局 + per-player）→ cost（能量，可选）→ collision（近似）
├─ registry/    mobs（生物条目）/ biome_table（群系权重，从 vanilla 导出）/ circumstance / placement
├─ circumstance/ 环境情形引擎（本文第三节）
└─ debug/       log（接入 doom.log）/ probe（环境探针）/ reject（拒绝原因分类）
```

## 三、Circumstance：环境情形注册表（原版没有的能力）

**动机**：原版把"雨/雷暴/夜晚/维度"等影响**硬编码**在各处（例如 `Monster.isDarkEnoughToSpawn` 在雷暴时
用 `getMaxLocalRawBrightness(pos, skyDarken = 10)`）。CTM 地图需要**显式、可注册、可调参**地控制这些。

**条目结构**（存 `storage doom.nats:circumstance`，与 v3 生物注册表同一模式）：

```
{ id: rain_night, when: { weather: rain, time: night }, effects: { period: 3, cap_monster: 90, weight_mult: 1.5 } }
```

- **when 的判定维度**：天气（clear / rain / thunder）· 时间（day / night / dusk，且**月相**可由 `time` 推算）·
  维度 · 高度带 · 群系（标签）· 玩家数（单人/多人）· 难度 · 光照档
- **effects 可覆盖**：节拍 `period` · 各类别上限 `cap_*` · 群系权重倍率 · 允许/禁止的注册表条目 ·
  光照规则（对应原版 `monster_spawn_light_level` / `monster_spawn_block_light_limit` 的语义）· 能量参数
- **执行模型**：每 N tick 计算一次**当前生效的情形位掩码**（`storage doom.nats:circumstance.active`），
  刷怪时由宏读取并覆盖参数 ⇒ 生成逻辑不变，只是参数随情形切换。
- **注册方式**：数据驱动 —— 写一条 `data modify storage …` + 一行 `function doom.nats:circumstance/register`。

## 四、debug 机制（接入 doom.log）

沿用既有基建（`harness/doom.log` + `collect.mjs`），**新增三个前缀**：

| 前缀 | 内容 | 用途 |
|---|---|---|
| `[nats.spawn]` | `id=… pos=… cat=… group=i/n` | 生成事件流 |
| `[nats.reject]` | `id=… reason={distance\|block\|light\|cap\|cost\|collision} step=N` | **拒绝原因分类** ⇒ 调参主依据 |
| `[nats.circum]` | `active=rain,night players=2 chunks=137 cap=monster:41/70` | 情形与容量快照 |

`collect.mjs` 相应扩展：把拒绝原因做成**直方图**，并分节输出情形统计与容量曲线。

**环境探针** `nats.debug:env`（对应"单/多/服务器"差异）一次性打印：
玩家数 · 每人距离 · 已加载区块数（`if loaded` 统计）· 每玩家每类别计数 · 当前情形位 · 各类别上限与余量。

## 五、单 / 多 / 服务器环境（待研究收敛后量化）

已知要点（`docs/09`）：全局 cap = `maxInstancesPerChunk × spawnableChunkCount ÷ 289`；
per-player cap 由 `LocalMobCapCalculator` 独立统计（以区块中心到玩家的水平距离 <128 为基准）。

**待补（已派研究员，见第六节）**：`getNaturalSpawnChunkCount` 的确切定义、多条玩家时
`spawnableChunkCount` 的去重与叠加行为、`view-distance` / `simulation-distance` 的影响、
专用服务器与单人集成服务器的差异。这些直接决定"多人地图的刷怪上限怎么算"。

## 六、当前进度

- ✅ 可行性原语已验证（`if loaded` / `if biome` / 光照谓词）
- 🔄 研究员 A：源码细节报告（`_work/research/B-源码细节报告.md`）
- 🔄 研究员 B：外部资料清单，含 Bookshelf 正确地址（`_work/research/C-外部资料清单.md`）
- ⏳ 待办：注册表层 → 调度与取点 → 合法性链 → pack → debug 接入 → 验证
