# 10 · 第三方文档检视：`acaciachan/tree-hole`《区块刻与生物生成》

> 对象：`https://github.com/acaciachan/tree-hole/blob/main/游戏机制/区块刻与生物生成.md`
> 获取方式：GitHub 本机不可达，经 **jsDelivr CDN** 取到原文（36.6 KB / 637 行），存 `_work/research/treehole_doc.md`。
> 检视基准：`docs/09` 的**源码级确证**（本机反编译 `NaturalSpawner`/`Monster`/`Animal` + 官方 `dimension_type` 数据）。

## 总评：**优秀，可信度高** —— 属于源码级文档，明显优于 wiki

它大量使用真实类名/方法名/字段名（`MobCategory` · `SpawnState` · `spawnableChunkCount` · `mobCategoryCounts` ·
`spawnPotential` · `localMobCapCalculator` · `isValidSpawnPostitionForType` · `checkSpawnObstruction` …），
多处细节**比我此前基于 wiki 的认识更精确**，且最后一节把机制推导成了实战优化结论。

## 一、它比我此前掌握得更细的地方（5 项，均已核对无误）

| # | 文档内容 | 核对结果 |
|---|---|---|
| 1 | `LocalMobCapCalculator` 内部结构：`playersNearChunk` + `playerMobCounts`，判定用「**区块中心**到玩家水平距离 < 128」 | ✅ 与我推断结构一致，且补上我未细读的判定基准 |
| 2 | 8 个类别完整表：上限 / 消失距离 / isFriendly / isPersistent | ✅ 与我字节码实证**逐项一致**；其中 `water_ambient` **上限 20 / 消失 64** 正好印证我当时无法归属的 `bipush 20 / bipush 64` |
| 3 | `getMaxSpawnClusterSize()` 分生物数值（Mob=4 / 鱼=8 / 马=6 / 狼=8 / 掠夺者=1 / 恶魂=1）与 `isMaxGroupSizeReached`「只有热带鱼触发」 | ✅ 与我读到的两个调用点吻合，且补上了源码里没展开的数值表 |
| 4 | 生成原点必须是「非红石导体」；`x,z += 随机(0~5) − 随机(0~5)` 的**逐只累加游走** | ✅ 与 `!isRedstoneConductor` 及 `nextInt(6)-nextInt(6)` **逐字一致** |
| 5 | **「必须离开 24 格才会选物种」**（因为选物种发生在距离检查之后），并据此推出女巫小屋 / 多玩家"挤压"刷怪平台的优化 | ✅ 与源码控制流一致（`isRightDistanceToPlayerAndSpawnPoint` 通过后才进入 `if (data == null)` 选物种）——**这是从源码推出的实战结论，wiki 完全没有** |

另外它明确指出「最高非空气方块高度 = 社区俗称的 **LC 值** 其实是个误解」——这是**高质量更正**，我的结论与它一致（取点用的是 `WORLD_SURFACE` 高度图，与所谓 LC 无关）。

## 二、需要更正的地方（3 处，有源码/官方数据为证）

| # | 文档写法 | 实况 | 依据 |
|---|---|---|---|
| 1 | 怪物光照：「主世界和末地 **≤ 12**，下界 **< 12**」 | 主世界/末地：**方块光必须 = 0**（`block_light_limit = 0`）且综合亮度 **≤ `uniform(0..7)`（随机值）**；下界：**≤ 7（常量）**，方块光不设限（limit=15）。**12 不成立** | `Monster.isDarkEnoughToSpawn` 源码 + 官方 `dimension_type/{overworld,the_nether,the_end}.json` |
| 2 | 动物：「下方是草方块 **or** 实际光照 **≥ 12**」 | `getBlockState(below).is(ANIMALS_SPAWNABLE_ON) **&&** getRawBrightness(pos,0) **> 8**` ⇒ 连接词是 **AND**，阈值是 **≥9** | `Animal.checkAnimalSpawnRules` / `isBrightEnoughToSpawn` |
| 3 | 初始群体数量 `count = 随机 1~4` | `Mth.ceil(random.nextFloat() * 4)` ⇒ **0~4**（**可以为 0**，此时该组不生成） | `NaturalSpawner.spawnCategoryForPosition` |

## 三、缺失（会让读者算不出阈值）

1. **没有给出 mobcap 公式**（全文未出现 `289`）：
   `cap = category.getMaxInstancesPerChunk() × spawnableChunkCount ÷ 289`（**整数除法**，且判定是**严格小于**）。
2. 示例里 `spawnableChunkCount: 36` 未说明它**不是常量**：它是「玩家 17×17 区块范围内**实际可刷怪**区块数」，
   上界 17² = **289**，随视距、加载状态与玩家分布变化 —— 照抄 36 会严重低估阈值。
3. **未声明适用版本**：光照判定在 1.19+ 已数据驱动（`monster_spawn_light_level` / `monster_spawn_block_light_limit`），
   与 1.18 及更早不同。文中对 1.19.3 的脚手架特判有版本标注，但整体缺版本前提。

## 四、我的增量发现（文档与 wiki 都没提）

**雷暴会让刷怪更容易**：`isDarkEnoughToSpawn` 在 `level.isThundering()` 时取
`getMaxLocalRawBrightness(pos, skyDarken = 10)` 而非默认值 ⇒ 雷雨期间有效亮度被下调，
阈值判定更容易通过。这也解释了为什么雷雨天怪物明显变多（过去常被归因于"光照被遮挡"，实际还有这一层）。

## 五、使用建议

- 该文档可直接作为工程参考，**但引用数值前按第二节更正三条**；
- 若要算实际刷怪阈值，务必补上第三节的 mobcap 公式，且不要照抄 `spawnableChunkCount` 的示例值；
- 结合 `docs/09` 第九节（本机反编译链）可自行复核任意细节 —— 整条链只依赖 Maven Central 与 Mojang 元数据。
