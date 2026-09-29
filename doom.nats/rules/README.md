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
