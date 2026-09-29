# 19 · finalizeSpawn、组数据与七个刷怪问题

> 一次性回答 2026-09 那轮提问，并记录 v4.15 新增的 **组数据层（SpawnGroupData 复刻）**。
> 所有结论都来自本机反编译源码（`doom.nats/_work/decomp/out15/`，1.21.6 named），行号可自查。

---

## 一、七个问题

### Q1 为什么"世界出生点 24 格内不刷怪"必须让作者声明坐标？

原版 `NaturalSpawner.isRightDistanceToPlayerAndSpawnPoint` 判三件事：

```java
player distSq > 576                              // 24 格
&& !level.getSharedSpawnPos().closerToCenterThan(pos, 24.0)
&& (chunk == 当前区块 || level.canSpawnEntitiesInChunk(chunk))
```

`getSharedSpawnPos()` 来自 `level.dat` 的 `spawn` 字段（ServerLevelData）。**数据包读不到它**：

- 谓词 `LocationPredicate` 的全部字段只有 `position / biomes / structures / dimension / smokey / light / block / fluid / can_see_sky` —— 没有出生点；
- 没有 `execute if spawnpoint` 之类的条件；
- 玩家 NBT 里的 `SpawnX/SpawnY/SpawnZ` 是**床/重生锚的复活点**，与世界出生点是两回事（睡过觉就分叉了）。

所以只能由作者声明。本包的实现：`$cfg.player24` 之外单列这一条，作者在 `doom.nats:config` 里写世界出生点坐标即可（不写 = 不启用该排除，属于"已知偏差"而不是 bug）。这是**信息不可观测**导致的缺口，不是懒。

### Q2 `getMobsAt` 管什么？

```java
// ChunkGenerator.getMobsAt(Holder<Biome>, StructureManager, MobCategory, BlockPos)
for (StructureStart s : structureManager.getAllStructuresAt(pos)) {
   var overrides = s.getStructure().spawnOverrides();
   if (overrides 有该 category 的条目 && 该 pos 落在对应 bounding_box（piece | full）内)
      return 该条目给的物种表;          // ← 结构覆盖
}
return biome.getMobSettings().getMobs(category);   // ← 平时的群系表
```

即：**"这个位置该刷哪些物种"的最终裁决者**。默认走群系 `spawners`；只要脚下有带 `spawn_overrides` 的结构，就整表换成结构给的那份。原版带非空 `spawn_overrides` 的结构只有少数几个（`pillager_outpost`、`swamp_hut`（cat，piece）、`ancient_city`（ambient 空表）、`nether_fortress` 走的是硬编码而非 override 等）。本包已复刻 `nether_fortress`（`mob/fortress`），其余结构覆盖仍是缺口（见 §四）。

### Q3 "finalizeSpawn 可以做起来了" —— 现在已经做完了，但不是你以为的那种做法

**关键事实（源码实证）**：`/summon` 与 `execute summon` **本来就会调用 `finalizeSpawn`**。

```java
// SummonCommand.createEntity(CommandSourceStack, Reference<EntityType<?>>, Vec3, CompoundTag, boolean)
Entity e = EntityType.loadEntityRecursive(tag, level, EntitySpawnReason.COMMAND, x -> { x.snapTo(pos…); return x; });
if ($$4 && e instanceof Mob m)                                   // ← /summon 传的就是 true
   m.finalizeSpawn(level, level.getCurrentDifficultyAt(e.blockPosition()), EntitySpawnReason.COMMAND, null);
level.tryAddFreshEntityWithPassengers(e);                        // ← 顺序与 NaturalSpawner 一致
```

`execute summon <type> run <cmd>` 走的也是这条（`ExecuteCommand.spawnEntityAndRedirect` → `SummonCommand.createEntity(..., true)`），并且把新实体作为 `@s` 交给 `run` 的命令。

所以「逐实体重写 finalizeSpawn」不但不必要，还会重复施加：
装备/武器（僵尸铁剑铁锹、骷髅弓、溺尸三叉戟钓竿、猪灵金剑弩+金甲、卫道士铁斧、劫掠者弩、凋灵骷髅石剑+攻击力 4）、
变体（牛羊猪鸡冷/暖/温带、猫 11 种、狼 9 种+7 种叫声、狐狸红/雪、兔子 7 种、美西螈 5 种、马 7×纹样、羊驼 4 种、鹦鹉 5 种、熊猫基因、鲑鱼大中小、热带鱼花色、僵尸村民职业/群系）、
婴儿（僵尸 5%、猪灵 20%、疣猪兽 20%）、**鸡骑士**（僵尸→鸡）、**蛛骑骷髅**、**僵尸首领**（5% 强化）、山羊尖叫 2%/断角 10%、幻翼体型、海龟 home_pos、蝙蝠/史莱姆尺寸、`LeftHanded` 5%、`follow_range` 三角分布加成，
以上全部由**原版自己**在创建时完成。

**v4.15 改的两件事：**

1. `spawn/emit` 从 `summon <type> ~ ~ ~ <nbt>` 改成
   ```
   $execute summon $(type) run function doom.nats:post/$(slug) with storage doom.nats:sel
   ```
   于是「给刚生成的那只补本包 NBT + 施加组数据」有了**无歧义的 `@s`**。
   旧写法 `@e[distance=..1,sort=nearest]` 在同点连续生成（同一簇、随机游走撞在一起）时会认错人 —— 那是原设计的潜在 bug，顺手修掉。
2. 新增**组数据层**（本文件 §二）：把 `NaturalSpawner` 传给 `finalizeSpawn` 的 `SpawnGroupData` 用计分板重放。

另外顺手补上了原版在 `snapTo` 里给的**随机朝向**（`random*360`）：`execute summon` 只对齐位置，rotation 会留 0。

### Q4 "逐位置群系"是什么、差在哪？

原版选物种用的是**候选点**的群系：`NaturalSpawner.getRandomSpawnMobAt(level, structureManager, chunkGenerator, category, random, pos)` → `chunkGenerator.getMobsAt(level.getBiome(pos), …)`。

本包为了性能，把群系探测做成"每快照节拍、在每个玩家身上探一次"（`biome/detect` → `$snap.biome`），整簇沿用。偏差发生在**群系边界附近**（探到的是玩家脚下的群系，候选点可能已越过边界）以及**玩家与候选点相距较远**时。

代价对比：改成逐候选点探测 = 每个候选点 65 个 `execute if biome`（见 `biome/dispatch` 的表），按当前约 40 次尝试/秒算，是数量级上升。折中方案（未做）：候选点与玩家跨群系时才重探。特殊规则（史莱姆/北极熊/溺水/河）本来就是逐候选点的谓词判定，不受影响。

**注意**：变体层是**逐位置精确**的 —— `post/<slug>` 在 `@s`（新实体的真实坐标）上求值群系谓词，所以「冷/暖群系的牛羊猪、雪地狐狸、白兔/金兔」判的正是那只生物脚下的群系。

### Q5 "精确 AABB"指什么？

原版合法性判定里，除"下方是有效方块 + 脚部/头部可站"之外，还有一条**真正按碰撞箱**的检查：

```java
// NaturalSpawner.isValidPositionForMob / isValidSpawnPostitionForType 的最后一环
level.noCollision(type.getSpawnAABB(x, y, z));   // AABB 以方块中心为基准，宽/深用实体尺寸
```

`type.getSpawnAABB(x,y,z)` = 以块中心 `(x, y, z)` 为轴心、按实体 `width/height` 撑开的盒（`spawnDimensionsScale` 缩放），再做**与方块碰撞形状**的相交测试。它能拦住半砖/楼梯/栅栏/活板门/玻璃板这类"标签看着能站、实际有碰撞箱"的情况。

本包现在用的是**规则表驱动的近似**：下方方块 `isValidSpawn`（坚固顶面 ∧ 发光 <14）+ 脚/头 `isValidEmptySpawnBlock` + 尺寸派生的邻格/第三格检查（`$sel.wide/wide2/tall`）。差距就是上面那类**部分方块**，以及"发光条件"和**逐类型 AABB 偏移**（体型窄长的生物 AABB 并不等比）。要精确只有两条路：① 用 `#full_collision` 之类的方块标签把半砖/楼梯单独排除（便宜，覆盖大多数）；② 逐实体手写 AABB 盒判定（贵）。

### Q6 "spawn cost" = 生成势能吗？

是，同一个东西。原版数据结构 `MobSpawnSettings.MobSpawnCost { energy_budget, charge }`，配合 `PotentialCalculator`：

```java
// 每只候选生物对周围施力 charge / r，累计超过 energy_budget 就否决
calc.getPotentialEnergyChange(pos, charge).getChange() > 0  ⇒ 拒绝
```

1.21.6 里**只有两个群系**填了非空 `spawn_costs`：`warped_forest`（末影人）与 `soul_sand_valley`（骷髅/恶魂/末影人）。本包已实现：每群系一份 `energy_budget`，对每个候选点按距离分桶累加 `Σ(1/r) ≤ budget/q²`（6 个距离档）。

**未做的**：原版是连续积分（对每只附近生物按其真实半径求 `charge/r`），本包是分桶离散近似 —— 数值上等价到档位精度。

### Q7 "worldgen 覆盖的物种表合并"是什么？

群系 `spawners` 属于 **worldgen 数据**。地图自带的数据包若覆盖 `data/<ns>/worldgen/biome/*.json`（或新增自定义群系），我们的 roster（按原版 `biome/*.json` 生成）就**过期**了：原版会把整份注册表条目**整体替换**（不是逐字段合并），新群系则完全不在我们表内。

正确做法（未做）：生成器加 `--worldgen <目录>`，在生成 roster 前把这些 JSON 合并/覆盖到原版之上，并给 `biome/detect` 补新群系条目。当前状态：包内所有群系表与"候选群系"枚举都来自原版 1.21.6，**地图自带 worldgen 时需作者手动告知**。

---

## 二、v4.15：组数据层（SpawnGroupData 复刻）

### 为什么要它

`finalizeSpawn` 的最后一个参数是 `SpawnGroupData`，`NaturalSpawner` 会把**同一簇**的多只生物绑成一个"家庭"：首只创建 groupData，其余沿用。`/summon` 传的是 `null`，所有共享语义退化成"每只独立随机"：

| 事实 | 原版（有 groupData） | 只用 /summon（groupData=null） |
| --- | --- | --- |
| 僵尸婴儿 | 整组同一个 5% 决定（`ZombieGroupData`） | 每只各掷 5%（一簇里混着有/无） |
| 动物幼崽 | 首只成年，成员 2+ 按机会掷（`AgeableMobGroupData`） | **永远没有幼崽**（groupSize 恒 0，条件不成立） |
| 狐/美西螈 | 成员 3+ 恒幼年（`groupSize>=2`） | 永远成年 |
| 狼/狐/美西螈/马/羊驼变体 | 同簇同色（首只决定） | 每只各自随机 |
| 蜘蛛药水效果 | 同簇同效果（`SpiderEffectsGroupData`） | 每只各自 10% |

### 怎么实现的

生成器 `tools/gen_ctm_group.mjs`（v4.15 新增，140 个文件）：

| 产物 | 作用 |
| --- | --- |
| `grp/init.mcfunction` | 宏派发：`$function doom.nats:grp/init/$(slug) with storage doom.nats:sel` |
| `grp/init/<slug>` | **每组一次**（`spawn/pick_one` 首次抽中物种后）：掷整组共享项（僵尸婴儿 / 蜘蛛效果 / 变体），并把 `$grp.mem` 归零 |
| `grp/mem/<slug>` | **每只生成时**（在 `post/<slug>` 里、`@s` 上下文）：施加婴儿/变体/效果，末尾 `$grp.mem += 1` |
| `grp/fx_apply` | 宏函数：把 `storage doom.nats:grp fx` 的效果名转成 `active_effects` 施加 |
| `post/<slug>` | ① `data merge entity @s $(nbt)`（本包标签/规则 NBT）② `$cfg.persist` 全局持久化 ③ 随机朝向 ④ 调 `grp/mem/<slug>` |
| `predicate/grp/biome/*` | 变体需要的群系条件（冷/暖家畜、白兔/金兔、雪狐、狼的 8 个群系） |

概率与判定全部按源码：

- 僵尸：`getSpawnAsBabyOdds = nextFloat() < 0.05` → `random value 1..100 matches ..5`；非婴儿组**显式** `IsBaby:0b` 清零（因为 `execute summon` 的单只掷骰可能刚给了它幼年态）。
- 动物：`AgeableMobGroupData(boolean)` 默认 chance `0.05`；显式覆盖的有 `Dolphin 0.1 / Panda 0.2 / Strider 0.5 / PolarBear 1.0 / Ocelot 1.0`；`RabbitGroupData super(1.0F)`；`HorseGroupData/LlamaGroupData super(true)=0.05`；判定门槛是 `groupSize > 0`，即**首只恒成年**。整数近似：`random value 1..10000 <= round(chance*10000)`。
- 狐/美西螈：`groupSize >= 2 ⇒ setAge(-24000)`，而 `AgeableMob` 的自增发生在检查之后 ⇒ **成员 3+**（`$grp.mem matches 2..`）。
- 蜘蛛：`difficulty == HARD ∧ nextFloat() < 0.1 * special`，`setRandomEffect = nextInt(5)`（0,1 速度 40% / 2 力量 20% / 3 再生 20% / 4 隐身 20%）。数据包读不到难度，故新增 `$cfg.difficulty`；`special` 取 `$cfg.special`（-1 = 按难度自动：普通 75%、困难 100%）。
- 共享变体：首只的掷法与原版一致（兔子按 `SPAWNS_WHITE_RABBITS`（80/20）/`SPAWNS_GOLD_RABBITS`/其余 50:40:10；狐按 `SPAWNS_SNOW_FOXES`；美西螈在 common 的 4 种里均匀；狼按注册表 8 个群系+兜底 pale；马 `Variant.values()` 7 种；羊驼 4 种），其余沿用 —— 马的 `Variant` 是「变体 | 纹样<<8」的合成值，只替换低 8 位以保留每只各自的 `Markings`（用乘除 256 做位运算，计分板没有位运算指令）。

### 新增配置键（详见 docs/18）

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `difficulty` | `2` | 0 和平 / 1 简单 / 2 普通 / 3 困难。数据包读不到游戏难度，蜘蛛组效果需要它 |
| `special` | `-1` | 区域难度系数 percent（`DifficultyInstance.getSpecialMultiplier` 的 0..1）。`-1` = 自动（普通 75%、困难 100%，简单/和平 0）。原版按世界时间/月相/区块驻留时间逐区块计算，数据包不可观测 |

### 接线点

- `spawn/group`：`$grp.inited = 0`
- `spawn/pick_one`：抽中物种后 `grp/init`（每组一次）
- `spawn/emit`：`execute summon … run function post/$(slug) with storage doom.nats:sel`
- `sel` 新增 `slug`（群系表与下界要塞表两处都写）

---

## 三、验证

| 断言 | 方法 | 结果 |
| --- | --- | --- |
| T1 僵尸组婴儿率 5% | 直调 `grp/init/zombie` 2000 次 | **5.05%~5.70%**（多次运行；期望 5%±1.5%）✅ |
| T2 整组同一婴儿决定 | `$grp.baby=1/0` 各生成一组 | 婴儿组 5/5 全幼年；成年组 0/8 ✅ |
| T3 首只成年 + 成员 2+ 按 chance | 牛 400 次（每轮清场）、北极熊 4 次 | 首只 0/1 ✅；牛成员 2+ **6.5%** ✅；北极熊 4/4 ✅ |
| T4 狐 成员 3+ 恒幼年 | `$grp.mem=1/2` 各 3 只 | mem=1 → 0/3；mem=2 → 3/6（累计）✅ |
| T5 狼 同组同变体 | 4 只 + **显式把组变体设为 snowy**（测试点群系不满足 snowy） | 4/4 全部 snowy ⇒ 组共享生效（非原版各自随机）✅ |
| T6 蜘蛛 10% 组效果 + 共享施加 | `grp/init/spider` 1000 次 + 2 只同组 | **9.10%~10.20%** ✅；同组 2/2 都带 invisibility（duration:-1）✅ |
| T7 朝向随机 | 24 只僵尸抽样 12 次 `sort=random` | 11 个不同 yaw ✅ |
| T8 `execute summon` 宏派发链路 + 标签 + 持久化开关 | 直调 `spawn/emit` | 标签 1/1 ✅；`$cfg.persist=1` → 1/1 ✅ |

脚本：`_work/verify_group.mjs`（真机 RCON）。

## 四、仍未复刻 / 已知偏差（诚实清单）

1. 世界出生点 24 格排除（Q1：不可观测，需作者声明）。
2. 除 `nether_fortress` 外的结构 `spawn_overrides`（Q2）。→ **已补（v4.17 / P1-6）**：`pillager_outpost` / `swamp_hut` /
   `monument` / `ancient_city` / `trial_chambers` 共 5 个（vanilla 里带非空 `spawn_overrides` 的结构总共 6 个）。见 §七.4。
3. 逐候选点群系（Q4：性能折中；特殊规则与变体层不受影响）。
4. 精确 AABB（Q5：半砖/楼梯/玻璃板等部分方块仍可能被误判为合法）。→ **便宜版已做（v4.17 / P1-7）**：
   ① 下方支撑 = `#standable ∪ #full_collision`（`Block.isFaceFull` 语义）；② 本体/上方显式排除 water/lava/snow
   （`#minecraft:replaceable` 传递包含它们 ⇒ 光靠白名单会误收）；③ **邻格** AABB 用 `#narrow_partial` 放行"居中窄条"
   （栅栏/栅栏门/墙/铁栏杆/玻璃板/锁链/火把/灯笼/花盆/蜡烛/按钮…）—— 宽体生物的 AABB 只伸进邻格 0.2 格，几何上够不到。
   逐实体精确 AABB（按 width/height 求交）仍未做。见 §七.5。
5. spawn cost 的连续积分（Q6：分桶近似）。
6. 地图自带 worldgen 的 roster 合并（Q7）。
7. `populateDefaultEquipmentEnchantments` / `MOB_SPAWN_EQUIPMENT`（`by_cost_with_difficulty` 附魔，需要复刻附魔代价模型；且 `special=0` 时概率本来就是 0）。
8. AI 记忆初始化（`PiglinAi/CamelAi/FrogAi/GoatAi.initMemories`、`Fox.setTargetGoals`、`Warden` 的 BRAIN 记忆、`Shulker` 朝向等）—— 属于运行时记忆，NBT 表达不了。
9. **Brain 记忆**（`PiglinAi/CamelAi/FrogAi/GoatAi.initMemories`、`Warden` 的 `DIG_COOLDOWN`）—— **2026-09-28 实测纠正**：`Brain` **确实在实体 NBT 里**（`/data get entity <e> Brain` ⇒ `{memories:{}}`），带 codec 的记忆项**可以写**且 ttl 生效（`data merge … {Brain:{memories:{"minecraft:dig_cooldown":{value:{},ttl:200L}}}}` ⇒ 回读一致，1.2s 后仍在；脚本 `_work/verify_brain_nbt.mjs`）。因此"不可表达"只成立于三处：① 这些 initMemories 本来就在 `/summon`/`execute summon` 内部的 finalizeSpawn 里跑过，重做无意义；② **传感器记忆**（如 `nearest_visible_player`）每 tick 重算，写进去下一 tick 即被覆盖；③ 纯 Java 字段/对象引用与 Goal 列表（`AbstractSchoolingFish.leader`、`Fox.setTargetGoals()`）不是数据。
10. 万圣节南瓜（`LocalDate.now()` 读**真实日期**，数据包无日历）—— `Zombie`/`AbstractSkeleton` 的 25% 南瓜头只在每年 10/31 生效，本包不复刻。
10. 学校群（`SchoolSpawnGroupData`：鲑鱼/鳕鱼"跟队"）与 `Phantom` 锚点等纯 AI 行为。
11. ~~组数据的一个细节偏差：本包在**首次抽中物种的候选点**掷共享变体，原版是在**首只真正生成的生物**的位置掷；两者在同簇内通常只差几格。~~ → **已修（v4.17 / P0-3）**：掷骰推迟到 `grp/var/<slug>`（由 `post/<slug>` 在首只生成时调用，位置 = 那只的生成点）。见 §七.1。

---

## 五、v4.15 硬教训（都踩过，写进 lint / 文档）

1. **传 `finalizeSpawn` 的组数据才是缺口，不是 `finalizeSpawn` 本身**：`/summon` 与 `execute summon` 都会走
   `SummonCommand.createEntity(..., EntitySpawnReason.COMMAND, true)`，最后那个 `true` 就是"对 Mob 调一次
   `finalizeSpawn(..., groupData = null)`"。单只层面的装备/变体/婴儿/骑士/属性原版已经跑过；我们唯一要补的是
   `NaturalSpawner` 传进去的 `SpawnGroupData`。
2. **宏行（$ 开头）必须含至少一个 $(name)**：整行没有占位符时，函数加载直接抛
   `IllegalArgumentException: No variables in macro`，**整个函数不可用**（不是那一行失效）。实测：
   `$execute store result storage … run random value 0..359` 让 `spawn/emit` 整文件加载失败；同样内容去掉
   `$` 前缀就正常。已加 lint **L12** 兜住。
3. **动物幼年态用 `Age`（int），不是 `IsBaby`**：`AgeableMob.addAdditionalSaveData` 写的是 `Age`/`ForcedAge`；
   只有僵尸/猪灵/僵尸疣猪兽这类自己实现 `setBaby` 的类才用 `IsBaby`（boolean）。给牛 `data merge {IsBaby:1b}`
   是**空操作**（实测 400 只 0 幼年）。
4. **组数据的宏参数源必须一致**：`grp/mem/<slug>` 里的 $(v)/$(fx) 来自 `doom.nats:grp`，而 `post/<slug>` 被
   `spawn/emit` 以 `sel` 调用 ⇒ 调用 `grp/mem` 时必须显式 `with storage doom.nats:grp`，否则变体行缺参数、
   整函数实例化失败（实体照旧 spawn，但组数据没施加 —— 狐 0 只、狼"看似通过"都是这个原因）。
5. **测试基建同样要锚点**：mcauto 的"加载期错误"检查原来扫**整个 run.log**，历史失败会永久污染结论（已加行数锚点）；
   需要玩家的 verify 脚本在没人时直接退出（regress 现在会自起一个 mineflayer 机器人）；远处实体所在区块未加载时
   `kill` 是空操作，清场必须放在 `forceload remove` **之前**。
6. **同一台机器并行验证必须分开端口**：本次 doom.nats 用 25565/25575，另一个工作区的 doom.ui 验收用 25566/25576。
7. **回归口径**：`regress.mjs --reuse --minutes 1 --curve 1` → **16 PASS / 0 FAIL**（报告
   `reports/回归-2026-09-28045848.md`）；组数据层专项 `_work/verify_group.mjs` → **14 PASS / 0 FAIL**。


---

## 六、Q4/Q7 的世界生成风险与保护（2026-09-28 追加，含一条未完成的实测）

**机制（必须在实现"逐候选点群系"时一起考虑）**：`execute if biome ~ ~ ~ <id>` 走的是 `Level.getBiome(pos)`，
位置落在**未加载区块**时服务端需要把该区块抬到 BIOME 阶段才能回答 ⇒ 一次探测可能引发**区块加载/世界生成成本**。
候选点虽然都锚在玩家附近（`pos/*` 从玩家/区块上下文起步），但 `band.mode 0` 的纵向扫描与远端候选仍可能越界。

**建议的保护（尚未实现，优先级高于继续加保真度）**：在 `biome/detect_at` 与 `biome/detect` 的调用点前加
`execute if loaded <pos>` 判定，未加载就跳过探测（此时按原版语义本来也不会在那一点生成 ⇒ 既保真又避免拉区块）。
```mcfunction
# 示意：只在已加载位置探测
execute if loaded ~ ~ ~ run function doom.nats:biome/detect_at
```

**未完成的实测（诚实记录）**：我写了一条"远端点(900,64,900) 探测成本"的测量脚本，用来判定 ① 探测是否会强制加载
② 第二次调用是否便宜（一次性生成 vs 常态成本）。脚本**没写出结果**：`node -e` 里的 RCON 连接没有 `close/process.exit`，
进程一直挂着直到工具墙钟超时（10 分钟）——是**我的工具脚本 bug**，不是数据包问题。重跑要点：结尾必须 `process.exit(0)`，
并先 `execute if loaded` 记录探测前后的加载状态。

**Q7（地图自带 worldgen）与"实验性世界生成"**：我们的 65 项 `biome-index` 与 roster 全部来自 vanilla worldgen；
地图若自带/覆盖 `worldgen/biome/*.json`，索引表会失效（表现为"不收录 ⇒ 0 生成"，不会报错）。

**✅ 已实现并跑完真机（2026-09-28 18:26–18:34，详见 `reports/验证-世界生成覆盖-20260928.md`）**：

- `tools/apply_worldgen.mjs`（`--worldgen <含 data/ 的目录>` 可重复 / `--reset` / `--status`）把地图的
  `data/<ns>/worldgen/biome/*.json` 的 `spawners` / `spawn_costs` / `creature_spawn_probability` 合并进
  `_work/generated/biomes.json`（**注册表条目整体替换**，不是逐字段合并），再 `export_rosters` + 重生成。
- `tools/regress.mjs --worldgen <目录>`（Q7 ④）：一条命令跑「带覆盖」的整套回归，跑完**自动 `--reset` 还原**并回读 sha1 校验。
- **实验性开关的坑（实测）**：flat 世界的 `generator-settings.biome` 指向**自定义群系**时，探针实测 `if biome` = NO
  （该群系没进世界注册表，`level.dat.enabled_features` 只有 `minecraft:vanilla`）⇒ 测试会全是 0、结论无效。
  改用**原版群系**做覆盖目标即可绕开（覆盖语义完全一样），不必碰 `enabled_features`。
- **四相位真机数字（A/B/A）**：P1 原版 **+91** 生成（场上 70 只蜘蛛）→ P2a 覆盖成空表（= RC4 地图语义）**+0** 且 `reason=8` **+1884**
  → P2b 覆盖成 husk（原版 plains 没有的物种）**+59** 且场上 **70 只全是 husk、其它物种 0** → P3 还原 **+51**（68 只蜘蛛）。
  `$snap.biome`/`$sel.biome` 三相恒为 `41`（plains 表内序号）⇒ 差异只可能来自 roster ✓。
- **顺带抓出并修掉两个真 bug**（详见 `AGENTS.md` v4.18）：
  ① 单类别群系的 `mob/biome/<群系>.mcfunction` 不显式置 `$catid` ⇒ 沿用上一个群系的值 ⇒ 随机整片不刷怪
  （原版就有 7 个群系中招：`the_end` 一系 5 个 + `deep_dark` + `the_void`）；新增 lint **L14** 挡复发。
  ② 生成器只写不删 ⇒ roster 变更后残留"幽灵"类别文件（用户存档里实测有 2 个 `mob/biome/wgtest/**`）；现在写出后清理 + `--check` 检测多余文件。

**仍待做（诚实记录）**：远端点的探测成本实测脚本仍没写出结果（脚本自身 bug：RCON 没 `close/process.exit` ⇒ 挂到墙钟超时）。
重跑要点：结尾必须 `process.exit(0)`，并先 `execute if loaded` 记录探测前后的加载状态。

---

## 七、v4.17：P0-3 组变体掷点 + 一个真机级消失层 bug

> 本节记录 2026-09-28「保真度 backlog」的第一批改动。所有结论都带**源码行号**与**红→绿数字**，不写"看起来正常"。

### 7.1 P0-3：共享变体改为"首只真正生成时"掷（对齐 SpawnGroupData 的创建位置）

**源码依据**（`_work/decomp/out/net/minecraft/world/level/NaturalSpawner.java`）：

- `:186` `$$17 = $$26.finalizeSpawn($$1, $$1.getCurrentDifficultyAt($$26.blockPosition()), EntitySpawnReason.NATURAL, $$17);`
- 这一行在 `:254` 的 `isValidPositionForMob($$1, $$26, $$24)` **之后**（`$$26` = 本次真正生成成功的那只 Mob），
  所以 **SpawnGroupData 由"本组第一只真正生成成功的个体"创建**，而且掷骰读的群系/位置是**那只个体的 `blockPosition()`**。
- 组内其余成员复用同一个 groupData（`:187` 之后的下一轮循环把 `$$17` 传回去）⇒ 共享变体/婴儿/效果"每组一次"。

**旧实现的偏差**：`grp/init`（= 本组首个**抽中物种**的候选点）就掷共享变体。该候选点与"首只真正生成的个体"之间
隔着：首个候选点可能因光照/落位/容量被否掉、以及组内随机游走 `nextInt(6)-nextInt(6)` 的若干格 —— 在群系边界上
（狼 8 条群系条件、狐的雪地条件、兔子的白/金兔标签）会选错变体。

**新实现**（`tools/gen_ctm_group.mjs`）：

| 文件 | 责任 |
| --- | --- |
| `grp/init/<slug>` | 只写**兜底值**（= vanilla 无群系条件命中时的默认分支）+ `$grp.vneed=1`，**不掷** |
| `grp/var/<slug>` | 掷骰本体，守卫 `$grp.vneed==1`；掷完 `$grp.vneed=0` ⇒ 严格"每组一次" |
| `post/<slug>` | **先** `function grp/var/<slug>`，**后** `function grp/mem/<slug> with storage grp`（③a/③b） |

**为什么掷骰必须放在 `post` 而不是 `grp/mem` 内部**（本轮踩到的宏实例化坑，见 §五.2 同类）：
`grp/mem/<slug>` 是**宏函数**，它的 `$(v)` 在**实例化那一刻**就从 `doom.nats:grp` 取值 ⇒ 若掷骰写在函数体里，
首只成员的实例化会因为 `v` 还不存在而失败（`Missing argument v`：实体照旧生成，组数据整层不施加）。

**红→绿（`_work/verify_group.mjs`，真机 RCON，本机实例 25571/25581）**：22 PASS / 0 FAIL。新断言 T5b 用
`/fillbiome` 造两个群系区（A=forest ⇒ 狼变体 `woods`；B=plains ⇒ `pale`，两者**互斥**，所以结论是确定性的而不是统计性的）：

| 断言 | 做法 | 结果 |
| --- | --- | --- |
| T5b-0/0b | 两个群系区生效 + 记录原群系（收尾还原） | Test passed ✓ |
| T5b-1 | init 在 B 区 ⇒ `grp v` **不存在**、`$grp.vneed=1`（证明 init 不再掷） | `Found no elements matching v` ✓ |
| T5b-2 | init 在 B 区、**首只在 A 区** ⇒ 全组 4 只 | **4/4 `woods`** ✓（B 区单独掷骰不可能出 woods） |
| T5b-3 | 反向：init 在 A 区、首只在 B 区 ⇒ 2 只 | **2/2 `pale`** ✓（A 区那只若各自掷骰会是 woods） |
| T5b-5 | 反证：把掷骰放回 init 位置（B 区）⇒ 首只生在 A 区 | 结果 `pale` ⇒ **旧语义下 T5b-2 必红** ✓ |

### 7.2 真机级 bug：消失层的 `distance` 参考点不是玩家（"刷出来的怪立刻没了"）

**现象**：`_work/verify_persist.mjs` ① "本包生成物存在 存活 0"（红）；`verify_animals` 的计数对不上。

**定位链**（可复现）：
1. `level.dat` 实读世界出生点 = `(-592, 66, -272)`；测试机器人在 `(-640, 61, -688)` ⇒ 相距 ≈418 格。
2. 同一位置、同一 `sel` 生成 1 只**非持久**僵尸：0.6 s 内消失；把 `$despawn_period` 设 `200000`（停掉 `despawn/tick`）
   ⇒ 同一只存活（只按原版窒息掉血 20→17→…）。
3. 根因：`despawn/tick` 的 `execute as @e[tag=…,distance=129..] run function util/void_kill` 里的裸 `distance`
   参考的是**函数执行位置**；本函数由 `core/tick` 调用，而 `core/tick` 的执行上下文是 `minecraft:tick` 的
   **世界出生点**。⇒ 只要玩家离出生点 >128 格（正常玩法里几乎总是），本包生成的所有非持久生物会在
   **一个消失节拍（默认 20 tick）内**被静默 `void_kill`。

**原版语义**（`Mob.checkDespawn()`）：`Entity p = level.getNearestPlayer(this, -1.0); d² = p.distanceToSqr(this);`
⇒ 参考点永远是**最近的玩家**；`d² > despawnDistance²` 才 `discard()`。

**修复**（`tools/gen_ctm_despawn.mjs`，硬消失与概率消失两条都改）：

```mcfunction
execute as @a[gamemode=!spectator] at @s as @e[tag=…spawned,tag=!…persistent,nbt=!{PersistenceRequired:true},distance=129..] unless data entity @s Passengers run function …:util/void_kill
```

逐玩家判定 ≡ 原版"最近玩家"：生物只要在**任一**玩家 128 格内就跳过，对所有玩家都超距才移除。
（无玩家在线时不做判定 —— 原版此时也只对仍有票据的区块判定。）

**红→绿数字**：`verify_persist` ①"存活 0" ⇒ **10 PASS / 0 FAIL**（①存活 1）；
`verify_animals` "③`$cnt.creature`=10 / 手动 17" ⇒ **6 PASS / 0 FAIL**（`$cnt.creature=10 / 手动 10`）。

### 7.3 教训（追加进陷阱清单）

- **数据包里的裸 `@e[…,distance=N..]`（以及任何依赖执行位置的谓词）参考的是"函数执行位置"**；
  `minecraft:tick` 的上下文 = **世界出生点**（专用服务器）。要表达"某个玩家周围"必须 `as @a at @s as @e[…]`。
  这条与"不带位置约束的 @e 会跨维度"是同一类坑的两个面：**位置上下文必须显式建立**。
- 测试脚本里的绝对坐标会过期：玩家被生成物推动后，`execute positioned <旧坐标>` 会落到未加载区块，
  `execute summon` 仍会实例化实体并跑 `post/<slug>`（记分板照样自增），但 `tryAddFreshEntityWithPassengers`
  因区块未加载而丢弃它 ⇒ 选择器查不到、"总数=0"。**验证脚本一律用相对玩家的坐标 + 实体标签计数**。
- 宏函数的参数必须在**调用前**就位：掷骰 → 写存储 → 再调用宏函数；跨成员各自的值（如马的合成 Variant）
  要拆到独立的宏函数里（`grp/apply/<slug>`），否则首只会因缺参整函数失效。

### 7.4 P1-6：其余结构的 `spawn_overrides`（`ChunkGenerator.getMobsAt`）

**数据（从 `server-1.21.6.jar` 的 `data/minecraft/worldgen/structure/*.json` 逐字抄）**：34 个结构里只有 **6 个**
带非空 `spawn_overrides` —— `fortress`（已有专用分支）/ `pillager_outpost` / `swamp_hut` / `monument` /
`ancient_city` / `trial_chambers`。

**语义与实现**：`getMobsAt` 是"这个位置该刷哪些物种"的最终裁决者 —— 只要所在位置命中某结构**当前类别**的覆盖条目，
就**整表替换**群系表（空表 ⇒ `getRandom` 返回 empty ⇒ `NaturalSpawner` `break` 掉整个组）。
本包把检查挂在**每个「群系 × 类别」表**的开头（`return` 早退），而不是 `pick_one` 里：
只有到表这一层才知道"本次抽中的是哪个类别"，而原版的覆盖判定正是**按类别**匹配的。

| 结构 | 类别 | 覆盖表 | 本包产物 |
| --- | --- | --- | --- |
| pillager_outpost | monster | pillager 1..1（full） | `mob/struct/pillager_outpost_monster` |
| swamp_hut | creature / monster | cat 1..1 / witch 1..1（piece） | `mob/struct/swamp_hut_{creature,monster}` |
| monument | monster / axolotls / underground_water_creature | guardian 2..4 / 空 / 空（full） | `mob/struct/monument_monster` + 空表早退 |
| ancient_city | 全部 8 类 | 空（full） | 表头 `return 0` |
| trial_chambers | 全部 8 类 | 空（piece） | 表头 `return 0` |

**已知近似**：`location_check.structures` 是"在结构（整体包围盒）内"，而 `swamp_hut`/`trial_chambers` 原版声明的是
`piece`（具体部件）⇒ 本包会比原版**略宽**（部件之间的空隙也可能命中）。重叠结构的判定顺序固定为
outpost → swamp_hut → monument → ancient_city → trial_chambers（原版是 map 遍历，顺序不定）。

**真机红→绿**（`_work/verify_struct_overrides.mjs`，8 PASS / 0 FAIL）：
S1 outpost 内 monster 表 ⇒ `minecraft:pillager`（min/max 1/1）；S5 结构外 +400 格对照 ⇒ 走群系表（蜘蛛）；
S2a/S2b swamp_hut ⇒ `cat` / `witch`；S3 monument ⇒ `guardian`（2/4）；S4 ancient_city（monster+ambient）与
trial_chambers（monster）⇒ `$sel.ok` 保持 0（空表）。

**红→绿的关键坑（真机抓到）**：`guardian` **不在任何群系 roster 里**（原版只从结构覆盖来）⇒ 规则表取不到它的
规则 id，模板把 JS 的 `undefined` 直接写进产物：`scoreboard players set $sel.rule doom.nats undefined`
⇒ 加载期 `Expected integer at position 89`，**整函数失效**（加载门红）。修法：把 `guardian/pillager/cat/witch`
并入 `EXTRA_RULE_TYPES` 并补 `cat`/`pillager` 的规则；同时**新增 lint L13（ERROR）：产物里不得出现裸 `undefined`/`NaN`**
兜住这一类"JS 值漏进产物"。

### 7.5 P1-7：AABB 便宜版（`#full_collision` / `#narrow_partial`）

**要复刻的原版两步**（`NaturalSpawner.isValidSpawnPostitionForType` 的最后一环与 `isValidEmptySpawnBlock`）：

```java
// ① 空位判定
if (state.isCollisionShapeFullBlock(level, pos)) return false;      // 满碰撞 ⇒ 不是空位
if (state.isSignalSource()) return false;
if (!fluid.isEmpty()) return false;                                  // 流体 ⇒ 不是空位
// ② 尺寸判定（便宜版的目标）
level.noCollision(type.getSpawnAABB(x + 0.5, y, z + 0.5));           // AABB ∩ 方块碰撞形状 = ∅
```

**本包的三条改动**（都在 `gen_ctm_check.mjs`，`CTM_LEGACY_AABB=1` 可生成"改前"版本用于前后对比）：

1. **下方支撑**：`#standable` 是历史白名单；现在与新的 `#full_collision`（满碰撞立方，144 条，由构造保证
   `standable ⊆ full_collision`）取**并集** ⇒ 白名单外的完整方块（玻璃/铁块/石英/矿石/石砖变体…）不再被误否决。
   判据出处：`BlockBehaviour$BlockStateBase:536 isFaceSturdy(...,UP)`（3 参版）= `SupportType.FULL` ⇒
   `Block.isFaceFull(shape.getFaceShape(UP))` ⇒ 只有**满立方**（以及 top 半砖/正向楼梯这类 UP 面满格的态）算可站立。
2. **本体/上方（可生成空位）**：`#minecraft:replaceable` **传递包含** `water`/`lava`/`snow` ⇒ 只靠白名单会误收；
   现在显式加 6 条排除（water/lava/snow × 本体/上方）× place 0/1/4。
3. **邻格 AABB（便宜版核心）**：新增 `#narrow_partial`（栅栏/栅栏门/墙/铁栏杆/玻璃板 17 种/锁链/火把/灯笼/末地烛/
   避雷针/按钮/拉杆/绊线钩/花盆/蜡烛）作为**放行清单** —— 宽体生物（蜘蛛 width 1.4）的 AABB 只伸进邻格 **0.2 格**，
   几何上够不到这些"居中窄条"的碰撞盒，原版不会因此否决，而旧实现按白名单会误否决。
   `tall`（第三格）**不**放行：那一格被生物自己的躯体占据，窄条照样相交。

**真机前后对比**（`_work/verify_aabb_cheap.mjs`，23 个场景；基线 = `CTM_LEGACY_AABB=1` 生成的 v4.16 规则）：

| 场景 | 改前 | 改后 | 说明 |
| --- | --- | --- | --- |
| A2 下方 = 玻璃 | 否决 | **通过** | 满碰撞但不在旧白名单里 ⇒ 误否决 |
| B2 本体 = 水 | 通过 | **否决** | 流体 ⇒ 原版 `isValidEmptySpawnBlock` 直接拒 |
| B3 本体 = 雪层 | 通过 | **否决** | 雪层有碰撞盒（0..2/16）⇒ 原版 AABB 会拒 |
| C1 邻格栅栏 | 否决 | **通过** | 居中窄条，够不到 AABB 边条 |
| C2 邻格玻璃板 | 否决 | **通过** | 同上 |
| C3 邻格铁栏杆 | 否决 | **通过** | 同上 |
| C4 邻格墙 | 否决 | **通过** | 同上 |
| C5 邻格火把 | 否决 | **通过** | 同上 |
| C6 邻格下半砖 / C7 邻格石头 / C8 邻格树叶 | 否决 | 否决 | 占满 1×1（或满立方）⇒ 边条会撞上，必须拒 |
| D1/D2/D3 第三格（本列）栅栏/石头/玻璃板 | 否决 | 否决 | 本列任何非空位都挡头（**不放行**） |
| 合计 | 6 通过 / 17 否决 | **10 通过 / 13 否决** | 3 处误收修掉、6 处误否决修掉 |

---

## 八、§7.4 更正：`spawn_overrides` 的 piece / full 语义（2026-09-28，带反编译证据）

§7.4 里那句「`location_check.structures` 是"在结构（整体包围盒）内"…本包会比原版**略宽**」**方向写反了**，现更正：

- `StructureManager`（本次从 `named.jar` 抽 `StructureManager.class` 单独反编译）：
  - `getStructureAt(pos, structure)`（:102-110）= `StructureStart.getBoundingBox().isInside(pos)` ⇒ **整体包围盒（full）**
  - `getStructureWithPieceAt(pos, …)`（:112-140）与 `structureHasPieceAt`（:142-150）= 遍历 `start.getPieces()` 逐个判包围盒 ⇒ **部件级（piece）**
- `LocationPredicate`（:53）里 `structures` 走的是 **`getStructureWithPieceAt`** ⇒ 数据包 `location_check.structures` = **piece 级**，
  与 `ChunkGenerator.getMobsAt` 里 `BoundingBoxType.PIECE ? structureHasPieceAt : start.getBoundingBox().isInside` 的 **piece 分支同义**。

**因此准确结论**：

| 结构 | 原版 `bounding_box` | 本包（piece 级谓词） | 判定 |
|---|---|---|---|
| `swamp_hut`（creature/monster） | `piece` | piece | **精确一致** ✓（§7.4 说的"略宽"不成立） |
| `trial_chambers`（8 类空表） | `piece` | piece | **精确一致** ✓ |
| `fortress`（monster 5 条） | `piece` | 未实现 JSON 那条（只做了硬编码那条） | 缺口（见下） |
| `ancient_city`（8 类空表） | `full` | piece | 偏松：整体盒内、pieces 外的环带会回落到群系表 ⇒ 会刷怪，而原版不刷 |
| `monument`（monster 1 条等） | `full` | piece | 同上（环带里用群系表而非结构表） |
| `pillager_outpost`（monster 1 条） | `full` | piece | 同上 |

**要塞是双路径，别只做一条**（`NaturalSpawner.mobsAt` :276-290）：

```java
return isInNetherFortressBounds(pos, level, cat, sm)   // 硬编码：cat==MONSTER ∧ 脚下是 NETHER_BRICKS ∧ getStructureAt(full) 有效
     ? NetherFortressStructure.FORTRESS_ENEMIES
     : chunkGenerator.getMobsAt(biome, sm, cat, pos);   // 否则才走 JSON 覆盖（fortress: monster 5 条 / piece）
```

本包已精确复刻**硬编码那条**（`mob/fortress.mcfunction` + `pick_one` 的 `if block ~ ~-1 ~ minecraft:nether_bricks`），
**没做** fortress 的 JSON 覆盖 —— 它的作用窗口是"要塞整体盒内、脚下不是下界砖"的 monster 生成（比原版宽一点点）。

**对 backlog 的修正**：原 P1-6 记的"把整体包围盒换成 piece"**不需要做**（本来就是 piece ✗）；该记的是两条：
① 3 个 `full` 结构（ancient_city / monument / pillager_outpost）**数据包表达不了**（没有 full 级 API）⇒ 属**不可达**缺口，只能文档声明；
② fortress 的 JSON 覆盖（piece / monster 5 条）未实现 ⇒ 可实现，列为待做。

---

## 九、P1-6b 实施结果：要塞两条路径补齐 + 一个分类别 bug（2026-09-28）

**背景**：§八 纠正了 piece/full 之后，要塞暴露出两件事：

1. **JSON 路径缺失**：原版 `NaturalSpawner.mobsAt` 是"先硬编码、后 `getMobsAt`"两条路径；本包只做了硬编码那条
   （`下界 ∧ 脚下 NETHER_BRICKS ∧ in_fortress`），于是"要塞内、脚下不是下界砖"的位置会回落到**群系表** —— 而原版那里用的是
   要塞的 JSON `spawn_overrides`（`monster` / `piece`）。
2. **分类别 bug（保真度）**：旧实现把要塞判定放在 `spawn/pick_one` 这一层，而**这一层还不知道本次抽中的是哪个类别**
   ⇒ 要塞内连 `creature` / `ambient` 的尝试也被换成 monster 表（多刷怪、少掉群系该有的物种）。
   而原版是**按类别**调用 `mobsAt(cat, pos)`，非 monster 类别在要塞内照样用群系表（要塞 JSON 只写了 `monster`）。

**改法（两处生成器，产物不手改）**

- `gen_ctm_mobs.mjs`：`STRUCT_OVERRIDES` 增加 `fortress: { monster: { ref: 'mob/fortress' } }`，
  并让 `structPreambleLines` 支持 `{ ref }`（复用已有表，避免两张表漂移 —— 原版这两张表逐字段相同：
  `NetherFortressStructure:21-27` vs `fortress.json`）。
  生成物里每个 `mob/biome/<群系>/monster.mcfunction` 结构前置多出一行：
  `execute if predicate doom.nats:spawn/in_fortress run return run function doom.nats:mob/fortress`
- `gen_ctm_spawn.mjs`：删除 `pick_one` 里"不分类别"的要塞专用分支（4 行 → 1 行纯 `biome/dispatch`）。

**真机红→绿**（`_work/verify_struct_aabb.mjs` 重写 B 段，**12 PASS / 0 FAIL**）：

| 断言 | 结果 |
|---|---|
| B1a 要塞内 + 下界砖地面 ⇒ monster 通道出要塞表（原版硬编码那条） | ✅ 五选一：blaze/magma_cube/skeleton/wither_skeleton/zombified_piglin |
| B1b 要塞内 + **非**下界砖地面 ⇒ **仍**出要塞表（原版 JSON 那条，本次新补） | ✅ 同五选一 |
| B1c 要塞内 ⇒ **creature** 通道回群系表（修掉分类别 bug；原版只覆盖 monster） | ✅ `strider` |
| B1d 要塞表独占标记（blaze / wither_skeleton）在一次抽样里确实出现 | ✅ brick=5 种 / stone=5 种 |
| B2 要塞外 ⇒ 群系表，且绝不出现要塞独占物种 | ✅ ghast / piglin / zombified_piglin |

**仍保留的近似（重申 §八）**：原版路径①用**整体包围盒**（full）、路径②用 piece，而数据包只有 piece 级 API
⇒ "要塞盒内、piece 外、脚下下界砖"那一圈本包会回落到群系表。属**不可达**缺口，已在 §八 记录。
