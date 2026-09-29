# 变更日志 · doom.nats（v4 · CTM 原版自然生成复刻）

> **口径**：本表只记 **v4 线**（数据包驱动复刻**原版**自然生成 + Circumstance 情形引擎 + 消失层）。
> v3（复刻 RC4 地图包 `suso.nats`）与 `ported/` `optimized/` 属另一条线，历史见 `AGENTS.md`。
> 目标环境：**Minecraft 1.21.6 · Fabric**（`pack_format` 80）。
> 每条 = 改了什么 · 为什么 · 可复核的数字。工程纪律（生成器写法、四道门、测试台坑）在 `AGENTS.md` 版本节，
> 取证报告在 `reports/`。
> 注：v4.19–v4.22 的时间戳都是 2026-09-29（同一天连续迭代）；`v4.21b` 只在 v4.22d 里被引用（forceload 单位问题），
> 没有独立版本节。

---

## v4.25 — 2026-09-29 · 实验性 AJ/BDEngine rig 桥接（真实体当内核，rig 当外观）

- **新输入 `rules/rigs.json`（实验性）**：`{carrier, rig, carrier_nbt?, rig_args?, rig_root_tag?, on_spawn?, cat?, count_with_carrier?, mount?}`；
  校验入口 `tools/lib/exp-rigs.mjs`。**空/缺文件 ⇒ 整条链路不生成任何东西**（并清理陈旧 `exp/aj/**`）。
- **新生成器 `tools/gen_ctm_exp_aj.mjs`**（只写实验性变体）：`exp/aj/{emit_sel, emit/<id>, post/<id>, rigsummon/<id>, on_spawn/<id>, tick, sweep, count, status, say_status, help, placeholder/summon}` 共 17 个文件 +
  `tags/entity_type/exp_aj_display.json`。链路：`spawn/emit` → `emit_sel` → `emit/<id>` → `execute summon <内核>` → `post/<id>`
  （标准收尾 + 内核 NBT/标签 → 召唤第三方 rig → **pre 差集整云认领** → 只挂"顶层"）→ `on_spawn` 钩子。
- **清扫层**：`core/tick`（仅实验性变体 + rigs 非空时多 1 行）→ `exp/aj/tick`（40t 分频）→ `exp/aj/sweep`
  （从**活内核**做乘客闭包，孤儿 rig/骨骼 kill；display 无战利品表，kill ≡ discard）。
- **真机数字**（隔离实例 **mcserver-aj 25572/25582**；`_work/verify_exp_aj.mjs`）：
  rig 相 **13 PASS / 0 FAIL** · 空 rigs A/B **2 PASS / 0 FAIL** · `/reload` **0** 个 Failed to load。
  关键量：deep_ocean 表 `$rng=0` 命中 squid+rig · rig **50** 个 display **50/50 全挂上** · 根↔内核 **0.80 格**（挂载点偏移）·
  tp 后 rig 位移 **7.14 格 / 误差 0.0000** · 逐格位移 ×10 **最大误差 0.0000** · 自走 4s 两侧 **5.55/5.55·0.0000** ·
  容量 `$cnt.monster` **Δ1**（50 个 display 计 0）· 内核消失后 **~6.6s 残留 0** · MSPT 0/1/5 rig = **1.57 / 1.43 / 2.37ms**。
- **三条挂载实测**（换挂法前先读）：① 方向必须是"rig 骑内核"（反过来内核不再自己走）；
  ② `minecraft:marker` **不能载客**；③ 多个 display 乘客**落在同一个挂载点**（实测 Pos 全同）
  且 **display 上没有 `RootVehicle`** ⇒ 判挂载要用乘客闭包。
- **静态门**：默认变体 **0 error / 2 warning**（逐字节不变）· rig 启用的实验性产物 lint **0 error / 2 warning**
  （`calamar:*` 被列为"需随包提供"的外部依赖）。
- **第三方资产**：验收用的 Gigantic Squid（Modrinth，**All-Rights-Reserved**）**只放测试实例，不进产物**；
  其 `pack.mcmeta` 用新 schema（`min_format/max_format`）在 1.21.6 不可选 ⇒ 副本补 `pack_format:80` 才可用。
- 报告：`reports/验收-实验性AJ桥接-20260929.md`（含图 `reports/图-实验性AJ巨人鱿鱼-20260929.png`，副路自绘；
  主路 mineflayer+prismarine-viewer 被 1.21.6 移动包兼容问题挡住，见报告第八章）。

## v4.24 — 2026-09-29 · 运行时刻作者层（改 storage 即刻生效）+ 实验性变体

- **运行时刻通路（新）**：同样的三层内容（逐实体补丁 / 条件条目 / 数量随 Y）现在**也在 storage 里**：
  `doom.nats:author`（与 `rules/*.json` **同构**）。判定**当场读**，改完即刻生效 —— 不用重生成、不用重装、不用重启。
  上限：条目 ≤8 · Y 段 ≤8 · 落位面标签 ≤8 · 群系白/黑名单各 ≤4（运行期槽位固定）。
- **通用派发**（构建期生成、运行时读 storage）：`mob/biome` 表头的条目扫描 + 命中行的 `author/row`（补丁 + Y 段）、
  `check/block`（额外落位面逐条 `if block ~ ~-1 ~ <标签>`）、`check/entity`（Y/亮度/天气/群系名单）、
  `check/cap`（容量随 Y）、`spawn/emit`（运行时刻条目 / 实验性条目 / 香草 三路派发）。
  亮度窗口走 **0..15 谓词阶梯 + 宏拼 id**（命令侧读不到亮度值）；条件条目用 `$data merge entity @s $(nbt)` 落自定义 NBT。
- **命令面**：`doom.nats:author/{help,show,load,reset,export,demo,add_entry,add_below_tag,set_group_by_y,set_cap_y}`
  （`/function` 没有内联参数 ⇒ 统一走 `doom.nats:author_in` 入参 storage）。
- **契约：空层 = 原版**：storage 空时所有通路被守卫挡住 ⇒ 逐条与原版一致（探针 §1 三条断言 + default A/B 5/0）。
- **两个变体**（`tools/lib/packdir.mjs`，`DOOM_EXP=1` ⇒ `v4x/doom.nats`）：
  · **默认变体** = 原版复刻 + 稳定扩展（`pack.mcmeta` 不带 `features`）；
  · **实验性变体** = 默认 + `doom.nats:exp/*`（**非原版能力**：`when.near` 关系条件 / `on_spawn` 演出钩子 / `preset` 预设），
    `pack.mcmeta` 带 `features{minecraft:minecart_improvements}` ⇒ 世界没开该实验性玩法时**引擎拒绝启用**
    （真机：`Pack file/doom.nats cannot be enabled, since required flags are not enabled in this world: minecraft:minecart_improvements!`）。
    ⚠ `/reload` 会绕过这道门；若包已在 enabled 列表里，服务端会 `Found feature pack …, forcing to enabled` 强行开旗标（都真机复现）。
- **双轨开关**：引擎 `features` 管"能不能装"；运行时刻 `doom.nats:exp enabled:1b` 管"行为回不回滚"（`exp/enable|disable`）。
- **顺手修掉的既有问题**：① `doom.nats:water_fluid` 以前是**手写进产物的孤儿文件**（无生成器产出）⇒ 新变体缺它、
  `check/entity` 整函数加载失败；已收进 `gen_ctm_check.mjs`。② `data merge` 递归 ⇒ `sel.nbt` 残留（上一条目的
  `CustomName`/`HandItems` 粘到下一只）⇒ 全面改成"结构字段 merge + nbt 整体 set"。③ 1.21.5+ 装备 NBT 是
  `equipment:{mainhand:…,head:…}`，老的 `HandItems`/`ArmorItems` **静默忽略** ⇒ 示例与文档已改。
- **数字**：静态门 **0 error / 2 warning**（两变体）· `/reload` **0** Failed to load ·
  `verify_author_runtime --variant std` **15 PASS / 0 FAIL / 3 SKIP** · `--variant exp` **19 PASS / 0 FAIL** ·
  `verify_author_rules` default **5/0** · author **6/0** · `_work/auto_gate.mjs` **全绿**。
  详情：`reports/验收-作者运行时层-20260929.md`。

---

## v4.23 — 2026-09-29 · 作者规则层（默认 = 原版，可高度自定义）

- **新增 `rules/` 覆盖层**（构建期输入，三个文件都可为空）：
  `entity-rules.json` 逐实体规则补丁（`belowAny` 额外落位面 / `yMin·yMax` / `lightMax·lightMin` / `biomeIn·biomeNot` / `weather`，`null` = 删字段）·
  `entries.json` 条件刷怪条目（`when`：thundering/raining/y/light；`nbt`：自定义 SNBT；条目级 `place·light·tag·cluster` 覆盖）·
  `counts.json` 数量随 Y（`groupByY` 组大小 / `capByY` 全局+每玩家容量）。
- **契约：默认 = 原版** —— 空层时 9 个生成器 `--check` 逐字节一致（静态门 **0 error / 2 warning**，改这一层前后完全相同）。
- **等价性**：条件条目 = 把权重**条件并入** `#wsum`、命中区间紧接香草区间（`#off` 只在条件成立时前进）⇒ 与"先过滤候选表、再按权重掷"逐点等价。
- **真机 A/B**（隔离实例 fid 25581，`_work/verify_author_rules.mjs --expect default|author`）：author **6 PASS / 0 FAIL**、default **5 PASS / 0 FAIL**；
  四个用例数字见 `reports/验收-作者规则层-20260929.md`（树叶落位 ok 0→1 · 雷暴深海 NBT 特例只在本层命中 · 发光鱿鱼 place 2→0 / light 5→1 · 组大小 4/4 → 4/6·2/3·1/1）。
- 工具：`tools/lib/author-rules.mjs`（唯一读取+校验入口）· `tools/export_biome_tags.mjs`（72 个群系标签 → 群系列表）· `rules/README.md`（字段手册）。

## v4.22d — 2026-09-29 · `in_fortress` 抖动结案（结论：测试台问题，不是包缺陷）

- **引擎语义**（`LocationPredicate.java:49-53`）：`location_check` 的 `structures` 与 `biomes` **都被
  `level.isLoaded(pos)` 短路** ⇒ 位置所在区块没加载时谓词**恒假**。原版 CTM 只在**已加载且 ticking** 的区块里
  尝试生成 ⇒ 生产路径永不撞这条；本包调用的就是引擎谓词 ⇒ **与原版语义一致**。
- **测试台 bug**：`forceload add <x1> <z1> [<x2> <z2>]` 收的是**方块坐标**（一次 ≤256 区块）。旧脚本按
  "区块坐标"传（`Math.floor(X/16)±4`）⇒ 命令回显成功、实际标的是别的区块（传 `-45,-44` 实际加载 `chunk[-3,-3]`）。
- **数字**（隔离实例 25581，同一要塞点 200 次求值）：未加载 **0/200 = 0.0%** · 强加载 **200/200 = 100.0%** ·
  只加载 5 个候选点中的 1 个 **80/200 = 40.0%**（逐点 0% 或 100%，**零抖动**）。端到端（25565 同要塞）：
  两次门都是**表外 0/24 = 0.0%**、3 PASS / 0 FAIL。「~17% 抖动」是更早一轮判据收敛前的记录。
- **新纪律**：靠 `forceload` 的用例**必须回读** `data get block` 判 `loaded`，不满足 `exit 1`，不许静默降级；
  在任意坐标戳结构/群系谓词的测试先强加载该坐标。
  `_work/verify_fortress_e2e.mjs` 已按 ±64 方块 = 9×9 区块改。

## v4.22 — 2026-09-29 · 消失层「最近玩家」量词 bug（P0）＋ 门锚点/测试前置成片假红

- **P0：消失层把「最近玩家」写成了「任一玩家」**。v4.17 的 `execute as @a at @s as @e[tag=…,distance=129..]`
  = 「∃ 玩家 >128 ⇒ 杀」；原版 `Mob.checkDespawn()` 是「**最近**玩家 >128 才 discard」= 「∀ 玩家 >128 ⇒ 杀」。
  后果：**两名玩家相距 >256 格时，各自身边的生成物被对方判掉**（真机 3 人相距 460 格：75 秒
  `$spawned.total` +692 而场上只剩 0–9 只）。
- **修法**：**标记-清扫两遍**（先清 `near64/near128`，再"任一玩家 64/128 格内 ⇒ 打标记"，最后只有"没有任何标记"
  的才 `void_kill`），另加**有玩家在线**守卫（无玩家时原版 `getNearestPlayer=null` ⇒ 不判定）。概率消失段（`near32`）同族修法。
- **数字**：`verify_multibot` 1 PASS / 3 FAIL → **4 PASS / 0 FAIL**；A/B 两处 128 格内 0/0 → **67/24**。
- **工具三修**：`tools/check_closure.mjs` 的 `RE_TAG_ADD` 字符类漏了 `@`（实际写法恒为 `tag @s add <tag>`）
  ⇒ 这条正则**从来没匹配到过**、把动态打的标签报成"读了从未添加的标签"（C4 假红 6 处 → 0）；
  `debug/dryrun_check` 先刷新 `$att.dim`（否则跨维度 dryrun 假 r5）；`install.mjs` 夹具新增
  `general:fortress_rounds`（一次 RCON = 40 轮，结构类 e2e 提速，**不进产物**）。
- **门锚点**：锚点写死 `y=64` 而测试世界地表在 **y=70** ⇒ 机器人被埋 ⇒ 天空光 0 ⇒ 成片假红。门现在自上而下扫
  「`#doom.nats:standable` + 上方两格可生成 + 站立点见天」，扫前把机器人抬到 y=200 让区块加载。
  数字：`rules 12/4 → 16/0`、`animals 4/2 → 6/0`、`persist 9/1 → 10/0`。
- **安全回归**：新增 `_work/verify_dim_att.mjs`（`$att.dim` 归属 / `$snap.dim` 隔离 / 末地满 cap ⇒ 必 r5 /
  反向不连坐 / 生产链正反两向）**6 PASS / 0 FAIL**；自动化命令一律加守卫（只动锚定机器人）。

## v4.20 — 2026-09-29 · 极端场景 E1–E7 挖出的两个跨维度 P0

- **P0-1 生产路径从不刷新"本次尝试的维度"** ⇒ 下界/末地的尝试被拿**主世界**的计数/容量/海平面窗口判定，
  全局容量门在非主世界维度**形同不存在**（实测末地堆到 500 只末影人、`$rej.5` 恒 0）。
  根因：`pos/ctx` 只被 debug 路径调用。修：`spawn/try_at` 首行补 `function doom.nats:pos/ctx`（每次尝试 1 次）。
  回归断言：干净世界 + 末地有玩家 + `cap.monster` 压低 ⇒ `$rej.5` **必须增长**。
- **P0-2 `$snap.dim` 是共享计分板**（快照层每 20t 写、尝试层也写 ⇒ 忙时被覆盖）⇒ 拆出专用 `$att.dim`
  （`circ/detect_dim_att` 写；`check/cap`、`check/sealevel` 读）。
- `check/border`（reason=11）：补上原版三种落位都查的 `worldborder.isWithinBounds`，配置
  `border.centerX/centerZ/size`（默认 `size=0` 关闭），半开区间与原版一致。
- `water_fluid` 标签：水生落位改流体语义（water / seagrass / tall_seagrass / kelp / kelp_plant / bubble_column），
  13 处判定（`check/block` 12 + `check/entity` 1）。E5 实测：修前海草/海带/气泡柱格**全被误拒**。
- **纪律**：门必须**单实例**（同时跑两门 ⇒ 数字全是混写）；单脚本必须带超时（`spawnSync` 等的是 stdio 管道关闭）；
  锚定机器人的维度/距离/时间由门兜底；探针必须调被测函数本体并读 `$chk.*`，不许"等价推算"。

## v4.19 — 2026-09-29 · 「水里看不到溺尸」→ 四个修复（三个真 bug）

- **P0-4 生产链路从不掷 `$rng`**（只有测试脚本掷 ⇒ 恒 0）⇒ 每个类别永远只刷"表里第一条"（海洋永远蜘蛛、
  要塞永远烈焰人、森林/沙漠/雪原清一色蜘蛛），溺尸（5/520）**永远选不中**。
  修：`gen_ctm_mobs.mjs` 群系分发表头部自掷 `random 0..999999`。
- **P0-5 取点 y 只扫「玩家层 +2..-16」** ⇒ 深水上空扫不到地面、候选点被钉在玩家层 ⇒ **深水零生成**。
  修：扫不到时回退原版式整列均匀 `pos/band_fallback`（配置 `band.fallback` / `floorY.<维度>`）。
- **P1-10** `#reduce_water_ambient_spawns` 极性反了（`unless` 应为 `if`）⇒ 海洋鱼被白扣 98%、河流反而 50 倍过量。
- **P1-11** 漏 `Drowned.checkDrownedSpawnRules` 第一条"脚下必须是水" ⇒ 浅水坑也能刷溺尸。
- **新增回归门** `_work/verify_species_mix.mjs`（走生产分发、**不预掷 `$rng`**；桶对齐 + `$rng` 取值数 +
  首行占比 + 类别份额 + 活性）**9/0**。
- **口径三修**：① 冻结必须冻 `$snap_period`（只设 `$eff.period` 会被快照一秒还原）；
  ② 探针不许自己掷 `$rng`（老写法恰好掩盖 P0-4：测试全绿、生产全退化）；③ 长命机器人与长任务要活在
  DSH 进程树之外（`_work/start_bot.ps1` / `run_bg.ps1`），否则进程树回收即掉线。

## v4.18 — 2026-09-28/29 · Q7 收口（地图 worldgen 覆盖端到端 · 单类别群系致命 bug · 幽灵文件）

- **worldgen 覆盖端到端**（同世界只换 roster 的四相位 A/B/A，独立实例 25567/25577）：
  P1 原版 `+91` 生成 / 70 只场上 → P2a 空表覆盖（= RC4 地图语义）**`+0`** → P2b husk 覆盖 **`+59`（husk=70，其它全 0）**
  → P3 还原 `+51` / 68。取证：修后 `mob/biome/plains/monster.mcfunction` 由 97 行/8 物种 → 20 行/["husk"]。
- **致命 bug（原版构建就有，7 个群系中招）**：`mob/biome/<群系>.mcfunction` 的单类别分支不设 `$catid`
  ⇒ 沿用上一个群系的值 ⇒ `if score $catid matches 0` 随机不成立 ⇒ **整片群系不刷怪**。
  受害：`the_end / end_barrens / end_highlands / end_midlands / small_end_islands / deep_dark / the_void`
  及任何被地图覆盖成单类别的群系。修：单类别分支显式 `scoreboard players set $catid doom.nats 0`；
  新增 lint **L14**。红→绿：修前生成 `+0`/reason=8 `+1891`，修后 `+59` 只 husk。
- **幽灵文件**：生成器只写不删 ⇒ roster 变化后旧表残留（用户存档里就有 2 个 `mob/biome/wgtest/**`），
  `--check` 看不出来。修：写出后清理 `mob/biome/**` 中不在本次产出集合的文件，`--check` 把"陈旧文件"计入漂移。
  原版构建 586 → **584** 文件。
- **回归钩子** `tools/regress.mjs --worldgen <目录>`：合并覆盖 → `export_rosters` → 重生成 → 整套静态/离线/真机 →
  自动 `--reset` 还原并按 `biomes.json` 的 sha1 回读校验（不一致拉红整轮）。
- **陷阱**：不要用 `execFileSync('powershell', …Start-Process -PassThru)` 起 detached 服（`execFileSync` 等 stdout EOF，
  Java 子进程继承句柄 ⇒ 父进程永久阻塞）。正解 `spawn(JAVA, …, {detached:true, stdio:['ignore', fd, fd]})` + `unref()`。

## v4.17 — 2026-09-28 · 保真度 backlog（P0-3 变体掷点 · 消失层参考点 bug · 多实例隔离）

- **P0-3 变体掷点共享时机**：原版 `NaturalSpawner:186` 的 `finalizeSpawn(...)` 在 `isValidPositionForMob`（:254）
  **之后** ⇒ `SpawnGroupData` 由**首只真正生成成功**的个体创建、位置取它的 `blockPosition()`。
  现 `grp/init/<slug>` 只写兜底值 + `$grp.vneed=1`；`post/<slug>` 先 `grp/var/<slug>` 再 `grp/mem/<slug>`。
  红→绿：`verify_group` **22 PASS / 0 FAIL**（`/fillbiome` 造 forest/plains 两个互斥群系区，首只在 forest ⇒ 4/4 woods；
  反向 ⇒ 2/2 pale；反证把掷骰放回 init ⇒ pale）。
- **消失层真机 bug（严重）**：`despawn/tick` 用裸 `distance=129..`，而其参考点是**函数执行位置** = `core/tick`
  的上下文 = **世界出生点** ⇒ 玩家离出生点 >128 格时，本包所有非持久生物**在一个消失节拍内**被 `void_kill`
  （症状："怪刚刷出来就没了"）。改为逐玩家判定。红→绿：`verify_persist 10 PASS / 0 FAIL`、`verify_animals 6/0`。
- **多实例隔离**：`mcauto.mjs` / `regress.mjs` 支持 `MC_SRV` / `MC_PORT` / `RCON_PORT`，默认值与过去完全一致；
  `bot.mjs` 由它们传 `--port`。并行工作流各用一份 `mcserver-<名>` + 独立端口。
- **陷阱**：数据包里裸 `@e[,…,distance=N..]` 与任何依赖位置的谓词参考的是**函数执行位置**；
  宏函数参数必须在**调用前**写进存储；跨成员各自的值要拆独立宏函数（马 `Variant`）。

## v4.16 — 2026-09-28 · 工具链：VS Code 接入 + headless Spyglass

- 新增 `.vscode/tasks.json`：默认 build 跑 `tools/check_static.mjs --vscode`（9 生成器 `--check` + lint + 闭包），
  输出 `file:line:col: error: msg` 配 `$gcc` problemMatcher ⇒ 直接进编辑器「问题」面板；另有一键回归 / 组数据专项任务。
- 新增 `tools/check_static.mjs`（统一静态门，**<2s**）、`tools/lint_spyglass.mjs`（headless 拉起已装的 Spyglass LSP）。
  后者**未打通**：探针包跑出「（无诊断）」⇒ 不可作证据（见 `docs/20`）。
- 硬门仍是游戏自己的加载器（`/reload` + 只看本轮的 `Failed to load function`），已内建在 mcauto/regress。

## v4.15 — 2026-09-28 · finalizeSpawn 组数据层（SpawnGroupData 复刻）

- **先纠正旧认知**：`/summon` 与 `execute summon` **已经会调 finalizeSpawn**
  （`SummonCommand.createEntity(..., true)`，reason=COMMAND，groupData=null）⇒ 逐实体重写装备/变体/婴儿是多余的；
  真正缺的是原版 `NaturalSpawner` 传的 `SpawnGroupData`。
- 新生成器 `gen_ctm_group.mjs`（140 文件）：`grp/init/<slug>`（每组一次）、`grp/mem/<slug>`（每只施加）、
  `post/<slug>`（补本包 NBT + 全局持久化 + 随机朝向）、`predicate/grp/biome/*`（冷/暖家畜、白兔/金兔、雪狐、狼 8 群系）。
- `spawn/emit` 改为 `$execute summon $(type) run function doom.nats:post/$(slug) with storage doom.nats:sel`
  ⇒ 新实体就是 `@s`，消除旧写法 `@e[distance=..1,sort=nearest]` 认错人的隐患。
- **引擎坑**：宏行没有 `$(name)` 会让**整函数加载失败**（`No variables in macro`）⇒ lint 新增 **L12**。
- 动物幼年用 `Age:-24000`（`AgeableMob` 存档键），僵尸系用 `IsBaby`；新增 cfg `difficulty`、`special`。
  真机 14 断言全绿，全套回归 **16 PASS / 0 FAIL**。

## v4.14 — 2026-09-28 · 动物 / 维度 / 持久化 / 配置化

- **被动生物节拍**必须用 `time query gametime`（原版 `gameTime % 400`），不能用 `daytime`；creature 只在节拍命中那一拍进候选。
- **维度探测**在首个非旁观玩家位置（`circ/detect_dim`）——tick 函数的执行上下文永远在主世界。
- 海平面/光照档按维度进配置层：主世界 63 / uniform 0..7；下界 32 / 常量 7（无天空光）；末地 0。
- **持久化三态**：默认（原版管消失）/ `doom.nats.persistent` 标签（只影响本包清理层）/
  `PersistenceRequired:1b`（原版也不消失）；逐规则 `persist:true` + 全局 `$cfg.persist=1`。
- **配置层**：`doom.nats:cfg_defaults` → `doom.nats:config`（作者覆盖）→ `$cfg.*`，键清单见 `docs/18-配置手册.md`。
- 真机验证 `_work/verify_{rules,persist,animals,dims,mode}.mjs`，全部并入 `regress.mjs --reuse`。

## v4.13 — 2026-09-28 · 逐实体规则 + 逐实体光照（源码核对后的修正）

- 规则表 `tools/lib/entity-rules.mjs`（47 实体 → 27 条规则签名）→ `_work/generated/entity-rules.json`；
  `gen_ctm_mobs.mjs` 写 `$sel.rule/place/light/tag/grp1/cluster`，`gen_ctm_check.mjs` 生成 `check/block` 与 `check/entity`。
- **光照逐实体**（`$sel.light`：none/dark/bright/bat/slime/glow/bl8）⇒ 修掉"动物被同时要求亮与暗"的互斥 bug。
- **落位逐类型**（`$sel.place`：ground/any/water/water_surface/below_tag/lava）⇒ 修掉"水生要求下方可站立"的互斥 bug。
- 下方方块改用 14 个**原版标签**；新增群系谓词（slime / river / more_drowned / polar_alt）与 `can_see_sky`。
- 簇上限补齐 ghast/pillager/happy_ghast=1、camel/llama/trader_llama=6；water_ambient 距离 64；河流 98% 不刷；
  史莱姆补 50% 掷币。消失层默认关闭（原版 `Mob.checkDespawn` 已对普通生物生效）。
- lint 新增 **L11**（命令里不得有连续两个空格：Brigadier 直接拒整条命令，真机踩过）。

## v4.12 — 2026-09-28 · 生存直用模式（`mode/*`）

- 问题：本包用 `summon` 造生物，**不受 `doMobSpawning` 约束** ⇒ 原版自然生成若还开着就是双份刷怪。
- `core/setup`（装载 tag）默认执行 `mode/survival`：`gamerule doMobSpawning false` + 出一份快照 + `say` 到日志。
- 开关 `mode/{survival,manual,auto,off}`，状态存计分板、可跨 `/reload` 与重进世界。
  真机 `verify_mode` **9 PASS / 0 FAIL**（含「manual 后 reload 仍为 true」的反证）。
- 生存手册 `docs/16-生存直用手册.md`（装配三步 + 命令表 + 实测数字 + 与原版差距的诚实清单）。

## v4.11 — 2026-09-28 · 移除一律 void_kill

- 原版消失/超距移除 = `discard()`（静默、无掉落、无经验）；`kill` 会掉战利品给经验 ⇒ 语义不对。
- `util/void_kill` = `tp @s ~ ~-500 ~`；消失层与清理都走它。`debug/clear` 静默清掉本包生物
  （保留 `doom.nats.persistent`），数量报聊天栏与日志。
- **别再用 `kill @e[tag=doom.nats.spawned]` 清场**（实测会在地上留下 476 个掉落物）。

## v4.10 — 2026-09-28 · 簇（cluster）模型

- 一次刷怪尝试 = 最多 3 个 group；组起点每组建模为重置，组内位移 `nextInt(6)-nextInt(6)` **累加**。
- `groupSize = minCount + rand(1+max-min)`（物种挑中后重算一次）；物种每 group 只挑一次。
- `spawned >= getMaxSpawnClusterSize()` ⇒ 结束**整次尝试**（默认 4；仅 8 个实体类覆盖）。
- 调试看 `$grp.sel / $grp.sized / $grp.stop / $dbg.clusterMax`。

## v4.9 — 2026-09-28 · 一键回归 `regress.mjs`

```bash
node tools/regress.mjs --reuse          # 静态 + 对照 + 离线 + 真机一轮（不停服、不踢人）
node tools/regress.mjs --quick          # 跳过对照变体
node tools/regress.mjs --reuse --stress # 顺带跑 batch 阶梯压力测试
```

- 一步失败**不中断**（跑完汇总），产出 `reports/回归-<时间戳>.md`：每步 PASS/FAIL、耗时、关键输出 + 最近走势图路径；
  退出码 0/1 可直接接 CI。实测全绿 **9 PASS / 0 FAIL**。

## v4.8 — 2026-09-27 · `mcauto.mjs` 两种跑法（重要）

| 命令 | 行为 | 会不会踢人 |
|---|---|---|
| `node tools/mcauto.mjs --reuse --minutes N` | **复用已在跑的服务器**：只热载新包（`/reload`）、跑场景、不停服 | **不会**（实测 PID 不变、在场玩家不断线） |
| `node tools/mcauto.mjs --minutes N` | 清世界 → 起新服务器 → 跑完停服 | **会**（客户端 Connection reset） |

默认带 `--curve 1.5`（每轮附走势图 + 统计行），`--stress` 顺带跑 batch 阶梯压测。

## v4.7 — 2026-09-27 · 两个新工具

- `_work/timeseries.mjs`：时间序列采样（各类别计数 / 累计生成 / batch / 上限 / mspt），产 json+csv+svg+png。
  实测稳态：怪物 **71.7**（上限 70）、mspt **5.29ms**（预算 50）、清场后 6 秒补满。
- `tools/propose_tags.mjs --save <存档>`：读 Anvil region 统计真实地形的「下方/上方方块」分布 → 给出覆盖率与建议补的 id。
  首跑即发现 `standable` 漏了 `ice`/`packed_ice`（雪原 40% 的落位面），覆盖率 **3.7% → 43.9%**。

## v4.5 / v4.4 — 2026-09-27 · 自动找地面 + 逐实体规则

- **v4.4**：`pos/band` 默认 `$band.mode 0` = 在候选点从「玩家层 +2」往下扫到 -16，取第一处「下方可站 + 本体/上方可生成」
  ⇒ 不再要求作者声明高度带（模式 1 固定带、模式 2 ±jitter）。
- **v4.5**：`check/entity`（reason=9），规则 id 写在 roster 行的 `$sel.rule`：陆生不能在水里 / 水面水生要 seaLevel 窗口 +
  上下都是水 / 深水生物要真水 / 蝙蝠在地表下 + 暗 + 50% / 史莱姆 50<y<70 + 月相门。新增快照量 `$snap.py`、`$snap.moon`。
- 新增 lint **L9**（行尾注释）、**L10**（`~+N` 非法坐标）—— 都是当天真机加载失败换来的。

## v4.3 — 2026-09-27 · 真机自动化

- **不再需要手敲命令**：`node tools/mcauto.mjs --minutes 3` 一条命令跑完「杀旧服 → 干净世界 → 装包 → 起本地 Fabric 服务器 →
  起真客户端机器人 → 设场景 → 等区块稳定 → `debug/all` → 采报告」。
- 组件：`tools/mcrcon.mjs`、`_work/mcserver/setup.mjs`、`_work/mcserver/bot.mjs`（mineflayer）、`_work/mcprobe.mjs`。
- **驱动每次开局必须断言加载期 0 错误**：函数加载失败会让整条链静默消失（当天踩过 `check/distance`）。
  专用服务器上 `tellraw` 不进日志 ⇒ 采集走 `say`。
- 实测稳态：`$cnt.monster = 70`（= 上限）、`$cnt.ambient = 13` ⇒ 容量链真的在管。

## v4.1 — 2026-09-27 · 采集链路

- `collect.mjs` 能真的采到 v4 标记：`[nats.env]` / `[nats.reject] rej:` / `[nats.light] tier:` / `[dryrun]`。
- `debug/reject_report` **先打数值再清零** ⇒ 每次 `/function doom.nats:debug/all` 都是一段独立测量窗口。
- 新存档自动装机 + 自动采集：`node _work/watch_new_save.mjs --minutes 45`、`node _work/watch_collect.mjs --minutes 60`。

---

## 附：当前验收口径（四道门）

| 门 | 命令 | 需要 | 最近结果 |
|---|---|---|---|
| ① 静态 | `node tools/check_static.mjs`（生成器 `--check` + lint L1–L14 + 引用闭包） | node | **0 error / 2 warning**（<2s；CI 已接） |
| ② 加载期 | 装机 + `/reload`，只看本轮 `Failed to load function` | Fabric 服务器 | 0（内建在 mcauto/regress） |
| ③ 真机断言 | `_work/verify_*.mjs`（`RCON_PORT=<port>` 可指到隔离实例） | 服务器 + 机器人 | `rules 16/0` · `animals 6/0` · `persist 10/0` · `dims 13/0` · `multibot 4/0` · `species_mix 9/0` · `dim_att 6/0` · `fortress_e2e 3/0`（表外 0/24 = 0.0%）· `e6_generic 7/0` |
| ④ 一键回归 | `node tools/regress.mjs --reuse --minutes 1 --curve 1` | 服务器（`--reuse` 不踢人） | **16 PASS / 0 FAIL** |

**容量（E6/压测口径）**：单维度 cap 由 `maxInstancesPerChunk × spawnableChunkCount / 289` 决定，随区块数自然增长；
多维度各自独立计数（v4.20 修）；`/tick freeze` 下不刷、红石类场景靠 10 Hz 观察时钟取证。
