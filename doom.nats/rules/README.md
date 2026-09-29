# rules/ —— 作者规则层（v4.23）

> **默认 = 原版。** 这三个文件都是空的（`{}` / `[]` / `{}`）时，生成器走原路径，
> 产物与"没有这一层"**逐字节一致**（由 `tools/check_static.mjs` 的 9 个生成器 `--check` 把守）。
> 填进去的每一条，只影响被点名的那一个行为。

这一层是**构建期**输入：改完要重新生成 + 重装（见文末「怎么用」）。
运行期的简单开关仍在 `doom.nats:config` → `$cfg.*`（`docs/18-配置手册.md`）。

---

## 1. 三个文件

| 文件 | 作用 | 空值 |
|---|---|---|
| `entity-rules.json` | **逐实体规则补丁**：改落位面 / 光照 / Y 窗口 / 群系 / 天气 | `{}` |
| `entries.json` | **追加条件刷怪条目**：条件成立才进候选池，可带自定义 NBT | `[]` |
| `counts.json` | **按 Y 轴定义数量**：`groupByY`（每次生几只）/ `capByY`（该类容量） | `{}` |

`DOOM_RULES=<目录>` 可以把这一层指到别处（验收用例就是这么跑的，见 `examples/full/`）。

---

## 2. `entity-rules.json` —— 逐实体规则补丁

键 = 实体 id，值 = 要覆盖的字段（**浅合并**到原版规则上；`null` = 删掉该字段）。

```json
{
  "minecraft:zombie":     { "belowAny": ["minecraft:leaves"] },
  "minecraft:glow_squid": { "place": "ground", "light": "dark", "ySea": null }
}
```

### 2.1 原版词表（就是 `lib/entity-rules.mjs` 里那些，可直接覆盖/删除）

| 字段 | 取值 | 含义 |
|---|---|---|
| `place` | `ground` / `any` / `water` / `water_surface` / `below_tag` / `lava` | 落位类型（ON_GROUND / NO_RESTRICTIONS / IN_WATER / 水面窗口 / 下方标签 / IN_LAVA） |
| `light` | `none` / `dark` / `bright` / `bat` / `slime` / `glow` / `bl8` | 光照档（见 `lib/entity-rules.mjs` 顶部逐条注释） |
| `tag` | 方块标签 id | `below_tag` 用的"下方必须是"标签 |
| `coins` | `half` / `moon` / `2of3` / `1of15` / `1of20` / `1of40` | 掷币否决 |
| `cluster` | 整数 | `getMaxSpawnClusterSize` |
| `persist` | `true` | 生成即带 `PersistenceRequired:1b`（原版语义：永不消失） |
| `biome` | `slime` / `polar_bear` | 两条特殊的群系分支 |
| 其它 | `sky` `notWart` `deep` `moreDrowned` `river98` `d64` `noPlayer5` `ySea` `yTurtle` `lavaToAir` `grp1` `water` `noSky` `belowSurface` | 与原版源码逐条对应的开关（同上） |

删字段就写 `null`：例 `"ySea": null` 去掉发光鱿鱼的 `y ≤ seaLevel-33` 窗口，
`"deep": null` 去掉溺尸的深水门（**注意**：这会让所有溺尸变常见）。

### 2.2 本层新增字段

| 字段 | 取值 | 含义 |
|---|---|---|
| `belowAny` | `["#标签" 或 "标签"]` | **额外允许的"下方落位面"**（并与 `#doom.nats:standable ∪ #doom.nats:full_collision`）。用它就能让陆生生物站在树叶/原木/诡异疣块上 —— 原版这些方块不算可站立。 |
| `yMin` / `yMax` | 整数（闭区间） | 候选点 y 窗口（判定用 `$py`，与原版 seaLevel 窗口同一口径） |
| `lightMax` / `lightMin` | 0..15 | 综合亮度上/下限（`location_check.light.light.max/min`）；比 `light` 档位更细 |
| `biomeIn` / `biomeNot` | `["#标签"]` 或 `["id", …]` | 只在这些 / 不在这些群系刷（标签必须**单独**使用：原版 `biomes` 谓词只接受单标签或 id 列表） |
| `weather` | `thunder` / `rain` / `clear` | 天气门（`weather_check` 谓词） |

否决时记的 reason 与原版一致：落位面 ⇒ `3`，光照 ⇒ `3`，其余规则 ⇒ `9`。

---

## 3. `entries.json` —— 条件刷怪条目

数组，每条 = 一个"条件成立才在候选池里"的物种条目。

```json
[
  {
    "id": "thunder_royal_zombie",
    "comment": "雷暴时的深海：带自定义 NBT 的特例",
    "biomes": ["#minecraft:is_deep_ocean"],
    "category": "monster",
    "mob": "minecraft:zombie",
    "weight": 40,
    "group": [2, 3],
    "when": { "thundering": true, "yMax": 40 },
    "nbt": "{CustomName:'{\"text\":\"深海雷暴僵尸\",\"color\":\"aqua\"}',HandItems:[{id:\"minecraft:trident\",Count:1b},{}],Health:40f}"
  }
]
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | 唯一名。生成物里会给生成的生物打 `doom.nats.author.<id>` 标签（便于统计/清理） |
| `mob` | ✅ | 实体 id |
| `category` | ✅ | `monster` / `creature` / `ambient` / `water_creature` / `water_ambient` / `underground_water_creature` / `axolotls` |
| `biomes` | ✅ | 群系 id 或 `#标签`（标签由 `node tools/export_biome_tags.mjs` 展开成具体群系） |
| `weight` | | 默认 `1`。**与香草条目同池竞争**：池和只在条件成立时变大 |
| `group` | | `[min, max]`，默认 `[1,1]` |
| `when` | | 条件（全部 AND）：`thundering` `raining` `yMin` `yMax` `lightMax` `lightMin`；留空 = 无条件 |
| `nbt` | | SNBT，**并入**本包标签之后再 `data merge entity @s`。写了 `Tags` 会覆盖本包标签（不推荐） |
| `groupByY` | | 该条目的组大小按 Y 段覆盖（同 §4 的写法） |

**语义（等价性）**：生成物把条件写进 `#wsum` 的累加——条件成立时 `#wsum += weight`，命中区间紧接香草区间之后，
且"偏移量 `#off` 只在条件成立时前进"。这与**先把候选表按条件过滤、再按权重掷**逐点等价（不会出现空档）。

**限制（诚实清单）**：条目只能加到该群系**已有的**类别里（`mob/biome/<群系>/<类别>` 必须已存在）。
要给一个"原本没有任何 monster 的群系"加怪物，得改 roster / worldgen 覆盖（`tools/apply_worldgen.mjs`）。

---

## 4. `counts.json` —— 按 Y 轴定义数量

```json
{
  "groupByY": {
    "minecraft:zombie": [
      { "yMax": 0,             "min": 4, "max": 6 },
      { "yMin": 1, "yMax": 63, "min": 2, "max": 3 },
      { "yMin": 64,            "min": 1, "max": 1 }
    ]
  },
  "capByY": {
    "monster": [
      { "yMax": 0, "max": 200, "localMax": 140 },
      { "yMin": 1, "max": 70,  "localMax": 70 }
    ]
  }
}
```

- `groupByY.<实体>` = `[{yMin?, yMax?, min, max}]`：**每次尝试生成几只**（原版 `minCount..maxCount`）按候选点 Y 段覆盖。
  段**按顺序求值、后面的覆盖前面的**；只写 `yMax` / 只写 `yMin` / 都写都行。
- `capByY.<类别>` = `[{yMin?, yMax?, max?, localMax?}]`：
  - `max` = **全局容量**（该维度的该类总数上限；原版公式 `maxInstancesPerChunk × spawnableChunkCount / 289`）
  - `localMax` = **每玩家上限**（原版 `LocalMobCapCalculator`，默认 = `maxInstancesPerChunk`，怪物是 70）
  两个都能单独给；不给的沿用引擎每拍算出来的快照值。
- 数量判定失败走原版的 reason：全局满 ⇒ `5`，本地满 ⇒ `6`。

> `capByY` 的口径提醒：容量是"**每拍重新算的快照**"，你的 Y 段只在**尝试点**的 y 上求值——
> 也就是说"玩家在地下时，怪物上限按地下那一段算"，这与原版"上限只跟区块数有关"是**刻意不同**的行为，
> 属于本层扩展（要的就是"可以完全定义"）。

---

## 5. 怎么用

```bash
cd <仓库>/doom.nats

# ① 直接改 rules/ 里的文件（或把 examples/full/*.json 拷进去）
# ② 重新生成产物（9 个生成器）
for g in gen_ctm gen_ctm_pos gen_ctm_check gen_ctm_mobs gen_ctm_spawn gen_ctm_despawn gen_ctm_effects gen_ctm_debug gen_ctm_group; do node tools/$g.mjs; done
# ③ 静态门（生成器无漂移 + lint + 引用闭包）
node tools/check_static.mjs
# ④ 装进存档 / 测试实例
node tools/install.mjs --variant v4 --save <存档名>

# 变体构建（不改仓库里的 rules/）：DOOM_RULES=<目录> 前缀即可
DOOM_RULES=$PWD/rules/examples/full node tools/gen_ctm_mobs.mjs
```

**回到原版**：清空三个文件（或删掉 `rules/`）后重新生成 ⇒ 产物应当与"从未改过"逐字节一致
（`node tools/check_static.mjs` 会告诉你）。

## 6. 验收用例

`examples/full/` 就是四个用例的合集（用户提的那四个）：

| 用例 | 文件 | 效果 |
|---|---|---|
| ① 僵尸刷在树叶上 | `entity-rules.json` | 僵尸的下方可站立集合并入 `#minecraft:leaves` |
| ② 雷暴 + 深海刷出带 NBT 的生物 | `entries.json` | 深海 `monster` 池在雷暴且 y≤40 时多出一条 40 权重的"深海雷暴僵尸"（三叉戟 + 自定义名 + 40 血） |
| ③ 发光鱿鱼在草地上生成 | `entity-rules.json` | 去掉 `y ≤ seaLevel-33` 窗口、落位改陆生、光照改 `dark` |
| ④ 刷怪数量跟 Y 轴完全定义 | `counts.json` | 僵尸组大小 y≤0 → 4~6 / 1~63 → 2~3 / ≥64 → 1；怪物容量 y≤0 → 全局 200·每玩家 140，否则 70·70 |

跑法：

```bash
DOOM_RULES=$PWD/rules/examples/full node tools/gen_ctm_mobs.mjs
DOOM_RULES=$PWD/rules/examples/full node tools/gen_ctm_check.mjs
DOOM_RULES=$PWD/rules/examples/full node tools/gen_ctm_group.mjs
```

真机验收脚本：`_work/verify_author_rules.mjs`（A/B：同一世界只换 rules 目录，比"原版 / 本包 / 差在哪 / 数字"）。

---

## 7. 运行时刻改（v4.24）：改 storage 即刻生效，不用重生成包

> 上面 1–6 节是**构建期**：改 `rules/*.json` → 重新生成 → 重装。
> 从 v4.24 起，同一套能力还有一条**运行时刻**通路：**在游戏里改 storage 即刻生效**（判定当场读 storage），
> 不用重生成、不用重装、不用重启。构建期那一层原样保留（两者可以叠加）。

### 7.1 storage 形状（与 `rules/*.json` 同构，可直接把 JSON 灌进去）

```mcfunction
# 逐实体补丁（= entity-rules.json 的形状，键还是实体 id）
data modify storage doom.nats:author entityRules."minecraft:zombie".belowAny set value ["#minecraft:leaves"]
# 条件条目（= entries.json 的一条）
data modify storage doom.nats:author_in entry set value {id:"royal",mob:"minecraft:zombie",biome:"#minecraft:is_overworld",category:"monster",weight:40,when:{thundering:1b},nbt:"{CustomName:'{\"text\":\"皇家僵尸\",\"color\":\"gold\"}'}"}
function doom.nats:author/add_entry with storage doom.nats:author_in
# 数量随 Y（= counts.json 的一段）
data merge storage doom.nats:author_in {type:"minecraft:zombie",yMax:0,min:4,max:6}
function doom.nats:author/set_group_by_y with storage doom.nats:author_in
```

| storage 键 | 等价于 | 运行时刻支持的字段 |
|---|---|---|
| `doom.nats:author.entityRules.<实体 id>` | `rules/entity-rules.json` | `belowAny`(≤8) `yMin` `yMax` `lightMin` `lightMax` `weather`(thunder/rain/clear) `biomeIn`(≤4) `biomeNot`(≤4) `place` `light` `persist` |
| `doom.nats:author.entries[]`（≤8 条） | `rules/entries.json` | `id` `mob` `biome`（单个 biome 或 `#标签`；要多个就写多条）`category` `weight` `min` `max` `nbt` `when{thundering,raining,yMin,yMax,lightMin,lightMax}` |
| `doom.nats:author.counts.groupByY.<实体 id>[]`（≤8 段） | `rules/counts.json` 的 `groupByY` | 每段 `{yMin?,yMax?,min,max}`；**段按顺序求值，后面的覆盖前面的** |
| `doom.nats:author.counts.capByY.<类别>[]`（≤8 段） | `counts.json` 的 `capByY` | 每段 `{yMin?,yMax?,max?,localMax?}`；两个都能单独给 |

命令面（`/function` 没有内联参数 ⇒ 统一走 `doom.nats:author_in` 这个"入参 storage"）：

| 命令 | 作用 |
|---|---|
| `function doom.nats:author/help` | 用法与字段清单 |
| `function doom.nats:author/show` | 打印当前覆盖（聊天栏摘要 + `data get storage` 全量 + 一行日志） |
| `function doom.nats:author/export` | 把当前覆盖打成一条可复制的 `data modify storage … set value {…}` |
| `function doom.nats:author/reset` | **回原版**（删掉三层键 + 清缓存） |
| `…/add_below_tag` · `…/set_group_by_y` · `…/set_cap_y` · `…/add_entry` | 追加一条（入参见上表） |
| `…/load` · `…/demo` | 重新装载/刷新摘要 · 命令面演示（需先 `scoreboard players set $auth.demo doom.nats 1`） |

### 7.2 三栏对照（别只看"能改"，要看"改完和原版差在哪"）

| 能力 | 原版会怎样 | 本包（默认）会怎样 | 实验性变体（v4x）会怎样 |
|---|---|---|---|
| 额外落位面 `belowAny` | 树叶不算 `isFaceSturdy(UP)` ⇒ 僵尸不会站在树叶上 | 构建期 `rules/` 与运行时刻 storage 都能加标签；默认空 = 逐条与原版一致 | 同默认 |
| Y 窗口 / 亮度窗口 / 天气门 / 群系名单 | 由源码写死（`check*SpawnRules`） | storage 里写一条即刻生效，reason 码与构建期一致（亮度⇒3，其余⇒9） | 同默认 |
| 组大小 / 容量随 Y | 组大小 = `minCount..maxCount`（与 y 无关）；容量 = `maxInstancesPerChunk × chunks / 289` | 按**候选点 y** 覆盖（容量覆盖是**本包扩展**，见 §4 的口径提醒） | 同默认 |
| 条件条目（含自定义 NBT） | 没有"条件条目"这个概念 | 条件成立才进池（与"先过滤再按权重掷"逐点等价）；NBT 用 `$data merge entity @s $(nbt)` 并入 | 同默认 |
| `when.near` 关系条件 | **没有**这种耦合 | 不支持（写进 `when` 会被忽略） | 支持：`near:{type:"#doom.nats:creature",radius:24,min:1,max:0}` 以**候选点**为圆心数一次实体。**非原版能力** |
| `on_spawn` 演出钩子 | **没有** | 不支持（`on_spawn` 字段被忽略） | 支持：条目写 `on_spawn:1b`，命中生成后调用 `doom.nats:exp/on_spawn/<条目 id>`（`@s` = 新实体）。文件不存在时只有钩子那一步跳过，实体照常生成 |
| `preset` 预设 | **没有** | 不支持 | 支持：`blood_moon` / `storm_season` / `deep_dark`（+ `rules/presets/*.json`）。merge 语义、可叠加、`reset` 一键还原 |

### 7.3 两条轨：引擎门 + 运行时刻开关（都在**实验性变体**里）

- **引擎门**（整包级，决定"能不能装"）：实验性变体 `v4x/doom.nats` 的 `pack.mcmeta` 带
  `"features": {"enabled": ["minecraft:minecart_improvements"]}`（字段形状取自 vanilla 自带实验性数据包；
  1.21.6 可用的三个旗标是 `minecart_improvements` / `redstone_experiments` / `trade_rebalance`，没有"自定义"旗标
  ⇒ 只能借一个原生旗标当门，代价是开它的世界同时拿到 vanilla 的矿车改动）。
  世界没开该实验性玩法时，引擎会明确拒绝启用：
  `Pack 'file/doom.nats' cannot be enabled, since required flags are not enabled in this world: minecraft:minecart_improvements!`
- **运行时刻开关**（`storage doom.nats:exp enabled:1b`，决定"行为回不回滚"）：`function doom.nats:exp/disable`
  一条命令即可让整层不参与判定（条目与规则都留着），`enable` 再打开；`reset` 清空。

### 7.4 数字（真机，隔离实例 fid 25571/RCON 25581）

| 项 | 数字 |
|---|---|
| 运行时刻层验收（默认变体） | `_work/verify_author_runtime.mjs --variant std` ⇒ **15 PASS / 0 FAIL**（3 条实验性断言按设计 SKIP） |
| 运行时刻层验收（实验性变体） | `--variant exp` ⇒ **19 PASS / 0 FAIL**（含 on_spawn / near / preset 三条） |
| 构建期 A/B 不回归 | `verify_author_rules.mjs --expect default` **5 PASS / 0 FAIL** · `--expect author` **6 PASS / 0 FAIL** |
| 加载期 | 两个变体 `/reload` 均 **0 个 Failed to load function** |
| 静态门 | `node tools/check_static.mjs` ⇒ **0 error / 2 warning**（两个变体各跑一遍生成器 `--check` + lint） |

### 7.5 坑（运行时刻这一层特有的，都真机踩过）

1. **宏行里所有占位符都必须存在**：缺一个 ⇒ **整个函数中止**（`Failed to instantiate … Missing argument`）。
   所以运行时刻的值一律"先铺默认值再合并"（见 `author/row` 里的 `cur`、`entry_prep_*` 里的 `e`）。
2. **`data merge` 是递归合并**：`nbt` 写进同一个 merge 里会让上一条目的键累积到下一只身上
   ⇒ 本包已改成"结构字段 merge + `nbt` 整体 `set`"（`sel.nbt`）。
3. **`data remove storage <id>` 必须带 path**；`execute if data storage <id>{…}` **非法**（都真机报过错）。
4. **宏替换进 SNBT 的字符串要自己加引号**：`type:$(mob)` 会变成 `type:minecraft:zombie`（非法 SNBT）⇒ 写 `type:"$(mob)"`。
5. **1.21.5+ 的装备 NBT 是 `equipment:{mainhand:{…},head:{…}}`**：老的 `HandItems`/`ArmorItems` 会被**静默忽略**
   （本轮实测：写 `HandItems` 既不报错也不生效）。
6. 运行时刻条目的 `biome` 判定在**候选点**求值（与构建期"表按群系展开"同义）⇒ 条目只能加到该群系**已有的**类别里。

---

## 8. 实验性 AJ / BDEngine rig 桥接（v4.25，`rules/rigs.json`）

> **默认不存在**：`rules/rigs.json` 是 `{}` / 缺文件 ⇒ 生成器**不产出任何 `exp/aj/**`**，`spawn/emit` 与 `core/tick`
> 也一个字都不多（默认变体 `check_static` 仍 0 error / 2 warning）。这一层**只进实验性变体**（`DOOM_EXP=1 ⇒ v4x/doom.nats`）。

**要解决的问题**：Animated Java / BDEngine 导出的"自定义生物"是 **display 实体骨架 + 动画函数**；display 不是 `Mob`
（没有 `MobCategory`/`SpawnPlacements`/`checkDespawn`/`finalizeSpawn`）⇒ 当不了群系表里的物种。
本层的做法是 **A 方案「真实体当内核，rig 当外观」**：内核（普通生物）照原样走刷怪链，rig 在同一位置被召唤并**挂到内核上**。

### 8.1 字段表（`rules/rigs.json`）

```json
{
  "gigantic_squid": {
    "carrier": "minecraft:squid",
    "rig": "calamar:summon",
    "carrier_nbt": "{Silent:1b,active_effects:[{id:\"minecraft:invisibility\",amplifier:0,duration:-1,show_particles:0b}]}",
    "rig_args": "{args:{}}",
    "rig_root_tag": "calamar1727993704352",
    "on_spawn": "calamar:start_animation",
    "cat": "water_creature",
    "count_with_carrier": true,
    "mount": true,
    "comment": "第三方巨型鱿鱼（只用于验收，不进产物）"
  }
}
```

| 字段 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `carrier` | ✅ | —— | 真实体内核（**必须**是生物注册表里的物种；一个内核只能配一个 rig） |
| `rig` | ✅ | —— | 第三方 rig 的**召唤入口函数** id（AJ：`<ns>:<blueprint>/summon`；BDEngine：`<ns>:summon`） |
| `carrier_nbt` | | 无 | 并入内核的 SNBT（隐形/静音/无 AI…） |
| `rig_args` | | `{args:{}}` | 传给 rig 召唤函数的宏参数（AJ/BDEngine 约定读 `$(args)`） |
| `rig_root_tag` | | `aj.global.root` | rig **根** display 上带的标签（AJ 的约定；BDEngine 导出是作者自定义的那一串） |
| `on_spawn` | | 无 | 挂载完成后调用的函数（@s = 内核），典型用途：启动第三方动画 |
| `cat` | | 取注册表 | 类别（只影响标签与诊断；**必须**与注册表一致，否则构建报错） |
| `count_with_carrier` | | `true` | 内核是否计入 mobcap；`false` ⇒ 给内核打 `PersistenceRequired:1b`（原版语义：持久生物不计入 `SpawnState`，代价是也免疫消失层/`debug/clear`） |
| `mount` | | `true` | 是否由本桥接托管（认领 + 挂载 + 清扫）；`false` ⇒ 只召唤，剩下交给第三方包自己管 |
| `comment` | | 无 | 给人看的注释（`_` 开头的键一律忽略） |

### 8.2 怎么用

```bash
cd <仓库>/doom.nats
# ① 写 rules/rigs.json（或把 rules/examples/aj/rigs.json 拷进去）
# ② 用实验性变体重生成
DOOM_EXP=1 node tools/gen_ctm.mjs && DOOM_EXP=1 node tools/gen_ctm_mobs.mjs && DOOM_EXP=1 node tools/gen_ctm_exp_aj.mjs
#    其余生成器照常；gen_ctm_exp_aj 只写 data/doom.nats/function/exp/aj/**（17 个文件）
# ③ 装实验性变体（v4x/doom.nats）+ 把第三方包放进世界 datapacks
#    第三方包若用新 schema 的 pack.mcmeta（min_format/max_format），1.21.6 认不出 ⇒ 需补 "pack_format": 80
```

**游戏内自检**：`function doom.nats:exp/aj/help`（用法 + 当前 rig 清单）· `function doom.nats:exp/aj/status`（在场上多少 display/挂上多少/残留多少）。
`function doom.nats:exp/aj/placeholder/summon` 是**零依赖占位 rig**（手搓 display 骨架），用来区分"桥接坏了"还是"某个第三方 rig 坏了"。

### 8.3 三条实测结论（换挂载方式前先读）

1. **方向必须是"rig 骑内核"**（`ride <rig> mount <内核>`）。反过来内核变成乘客，会被钉在不会移动的 display 上。
2. **`minecraft:marker` 不能载客**（`Item Display couldn't start riding Marker`）⇒ 不要做"marker 当挂载枢纽"那一层。
3. **一个生物可以同时挂多个 display，且它们落在同一个挂载点**（3 个乘客实测 `Pos` 完全相同）⇒
   骨架的相对布局由各自 `transformation` 决定，不会被"乘客序号"打乱。
   另一条相关实测：display 实体上**没有 `RootVehicle`**（哪怕正在被骑）⇒ 判"是否挂载"要用乘客闭包（本层用 `exp.aj.live` 标记）。
