- **读原版实现**：本机可完整反编译（Vineflower + AutoRenamingTool + 官方映射，全走 Maven Central / piston-meta，**不需要 GitHub**）⇒ 见 `docs/09` 第九节；工具在 `_work/decomp/`，**不要发布反编译产物**。
- **定位类的正确姿势**：按「常量池里引用了 X」扫会漏掉**只在方法描述符里出现**的类型；要扫 UTF8 描述符（如 `Ldne;` ⇒ 一次命中 `dnf`=NaturalSpawner）。
- **v4（CTM）与 v3 是两条独立线**：v3 复刻 suso.nats，v4 复刻**原版**自然生成并加了情形引擎；两者都叫 `doom.nats` 但目录/变体互斥（`install.mjs --variant v3|v4`），不要混装。
- **v4 的生成物一律带 tag**：`doom.nats.spawned`（本包生成）+ `doom.nats.cat.<类别>`（用于 cap 计数与消失层）；作者可用 `doom.nats.persistent` 免疫消失。
- **GitHub 不可达的绕行（镜像间歇可用，务必重试 + 跟随重定向）**：`cdn.jsdelivr.net/gh/<user>/<repo>@<branch>/<path>`（**要加 -L**，且会间歇返回 301/000）、`gcore.jsdelivr.net`（同样间歇）。取不到时改试另一镜像或直接换来源。中文文件名按 URL 编码。
- **检索可用** `https://cn.bing.com/search?q=...`（HTTP 200，返回正常结果页）。
- **Bookshelf 数据包库**（不是 `bookshelf.dev` —— 那是个编程书站）：文档 `https://docs.mcbookshelf.dev/en/latest/` ✅ 稳定，源码仓库 `github.com/mcbookshelf/bookshelf`（GitHub 直连不可达，走镜像）。其 `hitbox` 模块是**运行时操作/查询碰撞盒**的工具（Bake/Get/Set/Reset entity、Is inside），**不含**原版实体尺寸表 —— 需要尺寸表请自己从 jar 的 `EntityType` 导出。
- **光照判定（1.19+ 数据驱动）**：`Monster.isDarkEnoughToSpawn` = 天空光 ≤ `nextInt(32)` ∧（`block_light_limit<15` 时方块光 ≤ 该值）∧ 综合亮度 ≤ `dimension_type.monster_spawn_light_level`（主世界/末地 `uniform(0..7)`，下界常量 7）；雷暴时 skyDarken=10 会更亮阈值判定更易通过。动物是 `ANIMALS_SPAWNABLE_ON` **且** `getRawBrightness(pos,0) > 8`（≥9）。
# AGENTS.md — 子焦点：RC4 `suso.nats` → 1.21.6

## v4.22（2026-09-29）消失层「最近玩家」量词 bug（P0）＋ 门锚点/测试前置成片假红

0. **门与工具自身的三处修复**（都在同一天收口时踩出来的）：
   - `tools/check_closure.mjs` 的 `RE_TAG_ADD` 写成了 `/tag ([a-z0-9_.:$-]+) add/` —— 字符类里没有 `@`，
     而实际写法永远是 `tag @s add <tag>` ⇒ **这条正则从来没匹配到过**，`tagWrites` 只靠注册表 `Tags:[…]` 填充；
     于是"用 tag 命令动态打的标记"（despawn 的 `near64/near128/near32`）被报成"读了从未添加的标签"（C4 假红 6 处）。
     改成 `/\btag\s+\S+\s+add\s+([a-z0-9_.:$-]+)/g` 后 **0 处待确认**。
   - `debug/dryrun_check` 现在**先刷新 `$att.dim`**（`circ/detect_dim_att`）：debug 路径不走 `spawn/try_at`，
     不刷就会拿上一次尝试/上一个维度的 `$cnt.<cat>` 比容量（实测：下界脚本跑完后在主世界 dryrun ⇒ 假 r5）。
   - `install.mjs` 的夹具包新增 `general:fortress_rounds`（一次 RCON = 40 轮"一次 pack"）——结构类 e2e 采样
     一轮一条 RCON 太慢（1000 轮 ≈ 2 分钟，超出门的单脚本超时）。**夹具只在 zz-test-fixtures 里**，不进产物。

0b. **门的四条纪律（都是本轮 29 条假红换来的）**：
   - **锚点必须"扫 + 校验"，扫不到就中止门**：写死 y 或 `|| 64` 兜底会把机器人塞进地表以下（该列真地表 y=70）
     ⇒ 天空光=0 ⇒ `verify_aabb_cheap 0/23`、`verify_rules 12/4` 成片假红。扫描前先 `forceload` 锚点区块、
     把机器人抬到 y=200 等 2.5s；`b1` 为空就 `exit(3)`。
   - **机器人要免死**：`_kill_old_bots.ps1` 会杀掉所有 `bot.mjs --port 25565`（包括刚 ensurePlayer 确认过的），
     所以 `resetEnv` 里**清完再 ensurePlayer 一次**；并且给锚定机器人 `gamemode creative`
     （仍是 non-spectator ⇒ 刷怪/距离语义不变），否则午夜地表 + v4.22 修正后的"怪会留在玩家身边"
     ⇒ 机器人被打死 ⇒ 后面的脚本在"无人在场"的世界里跑（`That position is not loaded` / `No entity was found`）。
   - **每个脚本前清一次本包生成物**（三界各一次 `debug/clear`，自带安全过滤）：残留怪物会把容量顶满，
     凡是断言"生成增量 > 0"的脚本都会红。
   - **测试脚本里的宏调用必须在与被测谓词相同的 `positioned` 上下文里**：`function <ns>:biome/dispatch`
     读的是调用点的 `in_fortress`，漏了 `positioned` 就在控制台所在的主世界求值 ⇒ 永远 false（实测 enderman×40）。
   - 另外记住：`data modify storage <id> set value {…}` **缺 path 会被 Brigadier 拒**（要塞 e2e 曾整轮用错原点）；
     `forceload add` 的参数是**方块坐标**（v4.22d 更正，见下）且一次 ≤256 区块；生成器模板串里不能出现反引号。

1. **消失层把"最近玩家"写成了"任一玩家"**（`verify_multibot` ②③ 一直报的就是它）：
   v4.17 的写法 `execute as @a at @s as @e[tag=…,distance=129..] run void_kill` 是"对**每个**玩家各判一次、超距就杀"
   = 「∃ 玩家 >128 ⇒ 杀」；原版 `Mob.checkDespawn()` 是「**最近**玩家 >128 才 discard」= 「∀ 玩家 >128 ⇒ 杀」。
   后果：**两名玩家相距 >256 格时，各自身边的生成物会被对方判掉**（真机：3 人、机器人相距 460 格，
   75 秒 `$spawned.total` +692 而场上只剩 0–9 只）。修法：**标记-清扫两遍**（先清 `near64/near128`，
   再"任一玩家 64/128 格内 ⇒ 打标记"，最后只有"没有任何标记"的才 `void_kill`），另加**有玩家在线**守卫
   （无玩家时原版 `getNearestPlayer=null` ⇒ 不判定；不加守卫会把"没有标记"错解成"全都超距"⇒ 一拍清空）。
   概率消失段同族修法（`near32`）。生成器 `tools/gen_ctm_despawn.mjs`。
   数字：`verify_multibot` 1 PASS / 3 FAIL → **4 PASS / 0 FAIL**；A/B 两处 128 格内 0/0 → **67/24**。
2. **门锚点必须落在"地表 + 看得见天空"处**：锚点 `y=64` 是写死的，而测试世界 `(-240,-592)` 的地表在 **y=70**
   ⇒ 机器人被埋在实心地形里 ⇒ 测试点天空光=0、上方两格是石头 ⇒
   `verify_rules`「动物 bright / 白天露天必须否决」、`verify_animals` ③（reason=3 光照）**成片假红**。
   门现在会自上而下扫「`#doom.nats:standable` + 上方两格可生成 + 站立点 `spawn/can_see_sky`」，
   扫之前先把机器人抬到 y=200 让区块加载（`if block` 对未加载区块恒 false，会扫到加载边缘的随机层）。
   数字：`rules 12/4 → 16/0`、`animals 4/2 → 6/0`、`persist 9/1 → 10/0`。
3. **测试脚本里这些写法必定假红**（本轮一次性清掉）：
   - `data modify storage <id> set value {…}` **缺 path 会被 Brigadier 拒** ⇒ 原点/配置根本没写进去（要塞 e2e 走了几十轮"空原点"）；
   - `forceload add a b c d` 的参数是**方块坐标**（v4.22d 更正：不是区块坐标！）、一次最多 **256** 区块 ⇒
     ① `±32`（方块）写法 = 65×65 区块 > 256 ⇒ 命令直接失败；
     ② 按"区块坐标"传（例如 `Math.floor(X/16)±4`）**命令会成功但加载错的地方**（传 -45,-44 实际标的是 `chunk[-3,-3]`），
     要塞探针因此长期读到 `not loaded` 而靠机器人视距兜底；
     ⇒ **凡是靠 forceload 的用例，强加载后必须回读一次 `data get block` 判 loaded，不满足就 exit 1**（别静默降级）。
   - forceload 的区块**不一定立刻 loaded**；`if biome`/`if block` 在未加载位置返回**空串**而不是 false。
     更根本的一条（引擎语义，`LocationPredicate.java:49-53`）：`location_check` 的 `structures` 与 `biomes`
     **都被 `level.isLoaded(pos)` 短路** ⇒ 未加载区块上它们**恒假**。结论：要塞/结构谓词的"抖动"多数是探针点落在未加载区块，
     不是包行为（结案见 `reports/诊断-in_fortress抖动-20260929.md`）；
   - `SECONDS` 之类"带默认值的参数解析"要用 `Number(x) || 60` 且**先取数组元素**：`argv[indexOf('--x')+1]` 在缺参时取到 `argv[0]`（node 路径）⇒ `NaN` ⇒ 采样循环一次都不进；
   - `execute at @e[type=player,name=DoomBot] run function …` 在机器人不在场时**静默不执行** ⇒ 计数/配置停在旧值（`verify_animals` 的 `$cnt.creature` 一致性问题就是这么来的）；
   - 探针里的两条判定**必须写进同一条 execute** 才是合取（`if A run …1` + `unless B run …2` 分两条 = 或）；
   - 生成器模板串里**不能出现反引号**（会提前结束模板；注释里一律用「」）。
4. **自动化不得触碰用户的实时会话**（本轮用户在线，逐条改过）：`tp @a[…]`、`kill @e[type=zombie]` 这类**无守卫**的
   群伤/位移命令一律改成只动锚定机器人；`kill @e[type=…]` 统一加「命名 / 有主 / 持久化 / 拴绳」守卫。
5. **安全回归用例**：新增 `_work/verify_dim_att.mjs`（`$att.dim` 归属 / `$snap.dim` 隔离 / 末地满 cap ⇒ 必 r5 /
   反向不连坐 / 生产链正反两向），6 PASS / 0 FAIL —— v4.20 的 P0 现在有常驻回归。

## v4.20（2026-09-29）极端场景 E1–E7 挖出的两个 P0（跨维度维度上下文）

1. **生产路径从不刷新"本次尝试的维度"** ⇒ 下界/末地的尝试被拿**主世界**的计数/容量/海平面窗口判定：
   全局容量门在非主世界维度**形同不存在**（实测末地堆到 500 只末影人、`$rej.5` 恒 0）。
   根因：`pos/ctx` 只被 debug 路径 `pos/pick` 调用，生产链路 `spawn/try → spawn/try_at → pos/pick_local` 从不调用。
   **修**：`spawn/try_at` 首行补 `function doom.nats:pos/ctx`（每次尝试 1 次，成本可忽略）。
   **回归断言**：干净世界 + 末地有玩家 + `cap.monster` 压到远小于该维度存量 ⇒ `$rej.5` **必须增长**。
2. **`$snap.dim` 是共享计分板**：快照层（`circ/snapshot` 每 20 tick）与尝试层都写它 ⇒ 忙时尝试中途被覆盖。
   **修**：拆出专用 `$att.dim`（`circ/detect_dim_att` 写；`check/cap`、`check/sealevel` 读），`$snap.dim` 只留快照/情形层。
3. **`check/border`（reason=11）**：原版三种落位都查 `worldborder.isWithinBounds`，本包此前完全没有；
   配置 `border.centerX/centerZ/size`（默认 size=0 关闭），半开区间与原版一致。
4. **`water_fluid` 标签**：水生落位改流体语义（water/seagrass/tall_seagrass/kelp/kelp_plant/bubble_column），
   13 处判定（`check/block` 12 + `check/entity` 1）。E5 实测：修前海草/海带/气泡柱格全被误拒。

**门自身的三条纪律（v4.20 实测）**：
1. **门必须单实例**：同时跑两门会互相装包/reload/抢机器人/打断脚本，产出的数字**全是混写**（本轮曾把并发产物当成"包回归"，白追了两轮）。
   起门前先数：`Get-CimInstance Win32_Process -Filter "name='node.exe'" | ? { $_.CommandLine -match 'gate_merge' } | Measure-Object` **必须是 0**。
2. **单脚本必须带超时**：`run()` 用 `spawnSync`，而 `spawnSync` 等的是 **stdio 管道关闭**；某些 `verify_*` 自己起机器人并留在后台，
   孙进程继承管道 ⇒ 脚本早退出了、门却永远等下去（实测 `gate-012432` 卡在 9/16；残留进程正是那两个机器人）。现已给单脚本加 8 分钟超时。
3. **锚定机器人的维度/距离/时间由门兜底**：脚本用 `execute at @e[name=DoomBot]` 取位置，而 RCON 执行维度固定主世界 ⇒
   `verify_nether` 把 DoomBot 留在下界会让后面几个脚本**成片假红**（persist 5/5、struct_aabb 9/3 由此而来，拉回主世界立刻 10/0、12/0）。
   门已在每个脚本前重置：DoomBot → `(-240,64,-592)`、**DoomBot2 → `(-700,64,-592)`（必须 >400 格，verify_multibot 的前置）**、`time set midnight`（不是 day —— 测试世界约定是午夜，设 day 会把依赖"暗"的脚本整片打红）。

**探针纪律（新增三条，都是实测踩出来的）**：
- **探针必须调被测函数本体**并读 `$chk.ok/$chk.reason`，不许在探针里"等价推算"（E5 首版就是这样测不出修复）；
- **冻结要带"回读+重试"**（`verify_aabb_cheap` 的写法）：reload 后残留的快照相位会把 `$eff.period` 还原一次，
  于是尝试循环在探针中途跑起来、把 `$att.dim/$sel/$py` 覆盖（本轮踩到，导致一版"冻结测试"全假）；
- **维度类测试先 forceload**；未加载区块上 `if biome`/`can_see_sky` 返回假值。
- **查表类探针**：索引↔名字的映射表要么从产物解析出**正确字段名**、要么硬编码并断言字段存在（E3 首版把"全绿"读成"全红"）。

## v4.19（2026-09-29）"水里看不到溺尸" → 四个修复（三个真 bug）

现场：用户在水里看不到溺尸。诊断报告：`reports/诊断-水中无溺尸-20260929.md`。

| 编号 | 问题 | 修在哪 |
|---|---|---|
| **P0-4** | **生产链路从不掷 `$rng`**（只有测试脚本掷 ⇒ 恒 0）⇒ 每个类别永远只刷"表里第一条"：海洋永远蜘蛛、要塞永远烈焰人、森林/沙漠/雪原清一色蜘蛛 ⇒ 溺尸（5/520）永远选不中 | `gen_ctm_mobs.mjs`：群系分发表头部自掷 `random 0..999999` |
| **P0-5** | 取点 y 只扫「玩家层 +2..-16」⇒ 深水上空扫不到地面 ⇒ 候选点被钉在玩家层 ⇒ 深水**零生成**（溺尸/鱼/鱿鱼都没有） | `gen_ctm_pos.mjs`：扫不到时回退原版式整列均匀 `pos/band_fallback`（配置 `band.fallback` / `floorY.<维度>`） |
| **P1-10** | `#reduce_water_ambient_spawns` 极性反了（`unless` 应为 `if`）⇒ 海洋鱼被白扣 98%、河流反而 50 倍过量 | `gen_ctm_check.mjs`：`if predicate biome_river` |
| **P1-11** | 漏 `Drowned.checkDrownedSpawnRules` 第一条"脚下必须是水" ⇒ 浅水坑也能刷溺尸 | `gen_ctm_check.mjs`：两条分支共用新否决行 |

**新增回归门**：`_work/verify_species_mix.mjs`（走生产分发、**不预掷 `$rng`**；桶对齐 + `$rng` 取值数 + 首行占比 + 类别份额 + 活性）**9/0**。

### 口径修正（三条，都是实测踩出来的）

1. **冻结要冻 `$snap_period`**：只设 `$eff.period=20000` 会被 `circ/snapshot → circ/apply` 一秒内还原（`$eff.batch` 不受影响，它只由 `ctrl/aimd` 改）。
   冻结：`$snap_period=20000` + `$eff.period=20000`；解冻：`$snap_period=20` + `function doom.nats:circ/snapshot`。
2. **探针不许自己掷 `$rng`**：老 `verify_*`/`_probe_*` 自掷（还常写 `0..99` 或固定桶）⇒ 恰好掩盖 P0-4：测试全绿、生产全退化。
   要测"生产行为"就直接调 `mob/biome/<群系>`（它自掷）或整条 `spawn/pick_one`。
3. **长命机器人 / 长任务要活在 DSH 进程树之外**：`run_code`/bash 程序结束时进程树被回收（实测机器人 12–13 秒掉线，服务端日志只有 `lost connection: Disconnected`）。
   用 `powershell Invoke-CimMethod Win32_Process Create`：`_work/start_bot.ps1 -Name DoomBot4 -Minutes 60`、
   `_work/run_bg.ps1 -Cmd "node _work/gate_merge.mjs" -Log _work/gate.log -WorkDir <dir>`。

Ragecraft IV 地图自然生成包 `suso.nats` 的分析 / 移植 / 优化 / 验证焦点。协议框架见根 `../AGENTS.md`，此处只写"这个目录里必须怎么做"。

- **建立**：2026-09-18 · **状态**：分析 + 移植 + 优化 + **v3 改造（doom.nats：注册表 + 宏）完成**，无头验证 8/8；进游戏实测基建就位（`doom.log` + `collect.mjs`）

## 目录

| 路径 | 含义 | 可否改动 |
|---|---|---|
| `original/suso.nats/` | 1.20.1 原样副本（125） | 🔒 只读基线 |
| `v3/doom.nats/` | **v3 交付版**：命名空间 `doom.nats` + 生物注册表 + 宏驱动（89） | ✅ `tools/doomify.mjs` 生成 |
| `v4/doom.nats/` | **CTM 版**：数据包驱动复刻原版自然生成 + Circumstance 情形引擎 + 消失层（105 函数 / 129 文件） | ✅ `tools/gen_ctm*.mjs` 生成 |
| `ported/suso.nats/` | 忠实 1.21.6 移植（127，含 1 个兜底标签） | ✅ `tools/port.mjs` 生成 |
| `optimized/suso.nats/` | v2 无假实体版（70，含 1 个兜底标签） | ✅ `tools/optimize.mjs` 生成 |
| `tools/` | 转换器 + 校验器 + **无头模拟器** + 装机/采集脚本 | ✅ 改包只改这里 |
| `tools/doomify.mjs` | v2 → v3 转换器（改名 + 注册表分片 + 宏化） | ✅ |
| `tools/gen_ctm*.mjs` | v4 的 7 个生成器：core / pos / check / mobs / spawn / despawn / effects（改动一律改生成器） | ✅ |
| `tools/lint_ctm.mjs` | v4 静态自检：函数引用 / objective / 常量 / 宏前缀 / 环境差异 | ✅ |
| `tools/check_closure.mjs` | v4 语义闭包检查（storage/宏参数/虚位玩家/实体标签读写是否自洽） | ✅ |
| `tools/viz.mjs` + `tools/viz/template.html` | 点位三维可视化（导出可交互单文件 HTML） | ✅ |
| `tools/lib/exttag.mjs` | 外部标签兜底（port/optimize 共用；`#minecraft:` 不存在则补空标签） | ✅ |
| `tools/install.mjs` | 装包进存档（`--variant` / `--status`），含夹具与 `doom.log` | ✅ |
| `tools/collect.mjs` | 从游戏日志抽断言/报错 → `reports/实测-*.md` | ✅ |
| `reports/` | 实测回报（`collect.mjs` 产物） | 🗒 可删可增 |
| `docs/` | 01 结构树 · 02 移植矩阵 · 03 可行性 · 04 优化方案 · 05 静默验证 · 06 实测清单 · 07 标准化测试流程 · 08 v3 改造说明 · 11 CTM 架构 · 12 单多服务器差异 · 13 v4 使用手册 · **14 实现状态与待验证清单** · 09 原版刷怪机制研究 · **10 第三方文档检视（tree-hole）** | ✅ 结论变更须同步 |
| `_work/` | 取证脚本 + 1.21.6 权威参照 + 同捆 7 包文本 | 可重建 |

## 改任何东西后必跑

```bash
node tools/port.mjs && node tools/optimize.mjs
node tools/verify.mjs ../ported/suso.nats && node tools/verify.mjs ../optimized/suso.nats  # 0 blocking
node tools/doomify.mjs && node tools/verify.mjs ../v3/doom.nats   # v3：0 blocking / 0 warning（含注册表校验）

# v4（CTM）：8 个生成器 + 双静态检查
for g in gen_ctm gen_ctm_pos gen_ctm_check gen_ctm_mobs gen_ctm_spawn gen_ctm_despawn gen_ctm_effects gen_ctm_debug; do node tools/$g.mjs; done
node tools/lint_ctm.mjs && node tools/check_closure.mjs   # 均须 0 error / 0 处
node tools/sim.mjs 6000   # 必须 8/8 PASS 且 错误=告警=0
```

进游戏实测流程见 `docs/07-标准化测试流程.md`（装包 → P0/P1/P2 → `collect.mjs` → 判读）。

## 必须遵守

1. **不手改 `ported/`、`optimized/`**——一律改转换器再重跑。
2. **`_work/ref/` 是 1.21.6 权威参照**（方块 1107 / 生物群系 65 / 实体 206 / `version.json`），校验只认它。
3. **NBT 可用性判据**：必须**沿继承链**看是否最终继承 `com/mojang/datafixers/DataFix`；只看直接父类会误判（`bik→bkj→…→DataFix`）。**fixer-only = 命令期无效**。
4. **1.21.6 里 `biome` 已改复数 `biomes`**；`entity_properties{location.*}` 需实体，v2 一律用 `location_check`（走命令位置）。
5. **Java `%` 保留符号**：`$rng % N` 可为负，原二分树负数落最小叶；算术化改写必须复现钳位（`operation $x > #0`）。
6. **1.20.2 起函数加载期解析**：悬空引用/未知标签/未知谓词 → **整函数失效**，不报运行期错。
7. 目标实例 `1.21.6-Fabric 0.16.14`；验收路径 `C:\minecraft\Release 2.8.3.zip\.minecraft`，**不是** `%APPDATA%\.minecraft`。

## 已知坑

- `minecraft:grass` 在 1.21.6 不存在 → `free` 标签静默消失 → "完全不刷怪"且不报方块错误。
- `ns_ground_dark` 调用 `basalt_deltas`，实际文件是 `dark_basalt_deltas`（上游 bug）。
- `$enable suso.nats` 原包**全工程无写入点**，系统默认永不运行。
- **18 张刷怪表含 23 处 `execute at @s[x=..,dx=..]`**，去实体化必须一并改位置谓词，否则整表静默失效（模拟器抓到的 S2）。
- 谓词可放**子目录**（`predicate/box/…`），加载必须递归。
- 探测语法：**别把反引号写进 JS 模板字符串里的注释**（会截断模板）。
- **`#minecraft:red_area` 不存在**（上游地图包提供、移植后丢失）⇒ `dark_end_barrens` 整函数加载失败。已由 `tools/lib/exttag.mjs` 补空标签兜底，语义待原作确认。
- **`tick freeze/sprint/rate` 是专用服务器命令**，单人存档里写进函数 ⇒ 同样整函数加载失败（`Whilst parsing ... 未知或不完整的命令`）。调试加速请用逻辑加速（改 `$period`/`$repeat`）或连调 `suso.nats:main`。
- **日志不在存档里**：本机 per-version game dir ⇒ 日志在 `versions/1.21.6-Fabric 0.16.14/logs/latest.log`。
- **中文客户端报错是中文文本**（`未知的方块标签`）：扫日志只匹配英文会漏。
- **v3 注册表把 NBT 搬出函数体** ⇒ 静态校验必须跟着搬：`verify.mjs` 现在扫 `data modify storage doom.nats:mobs … set value {type,nbt}` 并校验条目引用。
- **宏替换里字符串参数不带引号**插入（`type:"zombie"` → `summon zombie`）—— 这正是宏能拼实体 id 的原因；复合参数按 SNBT 插入。
- **`tools/lib` 里所有硬编码的 `suso.nats` 都是坑**：解释器曾硬编码 `#suso.nats:free`，导致 v3 的落地判定恒假、完全不刷怪。现改为自动探测命名空间。

## 文档

`docs/05-静默验证报告.md` = 实例化 + 无头计算 8/8 PASS，及抓到的 3 个静默 bug（S1 负数取余 / S2 区域检测 / S3 谓词子目录）。
`docs/07-标准化测试流程.md` = 装包 → 进游戏 P0/P1/P2 → `collect.mjs` 采集判读 → 回归四步；含两个"静默杀手"的防线说明。

## v4.1 采集链路（2026-09-27）

- `collect.mjs` 现在能真的采到 v4 标记：`[nats.env]` / `[nats.reject] rej:` / `[nats.light] tier:` / `[dryrun]`。
  三点别踩回去：① 正则里的 `\d` 不要写成 `(d+)`（转义会被吃掉）；② 标记行筛选要允许标签带后缀；③ 解析数值前先剥 `§` 颜色码。
- `debug/reject_report` **先打数值再清零**，所以每次 `/function doom.nats:debug/all` 都是一段独立测量窗口。
- 新存档自动装机 + 自动采集（工作区根 `_work/`）：
  `node _work/watch_new_save.mjs --minutes 45`（盯 `saves/`，出现新目录就 `install.mjs --variant v4`）
  `node _work/watch_collect.mjs --minutes 60`（盯 `latest.log`，见快照行就 `collect.mjs`）

## v4.3 真机自动化（2026-09-27）

- **不再需要用户手敲命令**：`node tools/mcauto.mjs --minutes 3` 一条命令跑完「杀旧服 → 干净世界 → 装包 →
  起本地 Fabric 服务器 → 起 mineflayer 真客户端机器人 → 设场景 → 等区块稳定 → debug/all → 采报告」。
- 组件：`tools/mcrcon.mjs`（RCON，一条命令一次往返）、`_work/mcserver/setup.mjs`（一次搭服）、
  `_work/mcserver/bot.mjs`（真客户端）、`_work/mcprobe.mjs`（起服+发命令）、`_work/{dist,account}_probe.mjs`（分布/对账）。
- **驱动每次开局必须断言加载期 0 错误**：函数加载失败会让整条链静默消失（当天踩过 `check/distance`）。
- 专用服务器上 `tellraw` 不进日志 ⇒ 采集走 `say`（`debug/say_report`、`debug/say_env`）。
- 当日修掉 12 个静默失效，清单与实测数字见 `docs/15-真机自动化验证-v4.3.md`。
- 实测稳态：`$cnt.monster = 70`（= 上限）、`$cnt.ambient = 13`，说明容量链真的在管。

## v4.4 / v4.5

- **v4.4 自动找地面**：`pos/band` 默认 `$band.mode 0` = 在候选点从「玩家层+2」往下扫到 -16，
  取第一处「下方可站 + 本体/上方可生成」⇒ **不再要求作者声明高度带**（模式 1 仍是固定带、模式 2 是 ±jitter）。
  实现为 19 行展开的常量坐标检查（无宏无递归）；`pos/band_at` 负责把执行位置挪到候选点再扫。
- **v4.5 逐实体规则**：`check/entity`（reason=9），规则 id 写在 roster 行的 `$sel.rule`。
  陆生不能在水里 / 水面水生要 seaLevel 窗口+上下都是水 / 深水生物要真水 / 蝙蝠在地表下+暗+50% / 史莱姆 50<y<70+月相门。
  新增快照量 `$snap.py`（玩家层）与 `$snap.moon`（月相八分制）。
- 三条新 lint 规则（都已红→绿自证）：**L9** 行尾注释、**L10** `~+N` 非法坐标、L7/L8 同前。
  （L9/L10 是当天真机加载失败换来的：行尾 `#` 与 `~+2` 都会让**整个函数**失效。）

## v4.7：两个新工具

- `_work/timeseries.mjs [--minutes N --every S --killAt T]`：时间序列采样（各类别计数 / 累积生成 / batch / 上限 /
  mspt），产出 json+csv+svg+png（PNG 手写编码，无依赖，便于 agent 看图）。实测：怪物稳态 71.7（上限 70）、
  mspt 5.29ms（预算 50）、清场后 6 秒补满。
- `tools/propose_tags.mjs --save <存档>`：**读 Anvil region 自动补全方块标签**。统计地形里实际的
  「下方方块/上方方块」分布 → 给出覆盖率 + 建议补充 id + 分档（雪片/水/树叶等明确标"不该当落位面"）。
  首跑即发现默认 `standable` 漏了 `ice`/`packed_ice`（雪原地形 40% 的落位面），覆盖率 3.7% → 43.9% 且待补为 0。
  地图成型后跑一次即可；改生成器而非改包。

## v4.8：mcauto 两种跑法（重要）

| 命令 | 行为 | 会不会踢人 |
|---|---|---|
| `node tools/mcauto.mjs --reuse --minutes N` | **复用已在跑的服务器**：只热载新包（/reload）、跑场景、不停服 | **不会**（实测 PID 不变、在场玩家不断线） |
| `node tools/mcauto.mjs --minutes N` | 清世界 → 起新服务器 → 跑完停服 | **会**（服务器重启会让客户端 Connection reset） |

默认已带 `--curve 1.5`：每轮自动附一张走势图（`_work/timeseries-*.{json,csv,svg,png}`）+ 统计行；
加 `--stress` 还会顺带跑一次 batch 阶梯压力测试并把摘要打进日志。

## v4.9：一键回归

```bash
node tools/regress.mjs --reuse            # 默认：静态 + 对照 + 离线 + 真机一轮（不踢人）
node tools/regress.mjs --quick            # 跳过对照变体（最快）
node tools/regress.mjs --reuse --stress   # 顺带跑 batch 阶梯压力测试
```

一步失败**不中断**（跑完汇总），产出 `doom.nats/reports/回归-<时间戳>.md`：
每步的 PASS/FAIL、耗时、关键输出，并把最近的走势图路径列在开头。退出码 0/1 可直接接 CI。

实测全绿：**9 PASS / 0 FAIL**（8 个生成器无漂移 · lint 0 error · closure 0 处 ·
ported/optimized/v3 verify 各 0 blocking · sim v1-v3 无告警 · sim_v4 27/0 · 真机 reuse 一轮含曲线）。

## v4.10：簇（cluster）模型

- 一次刷怪尝试 = 最多 3 个 group；group 起点每组建模为重置，组内位移 `nextInt(6)-nextInt(6)` **累加**。
- `groupSize = minCount + rand(1+max-min)`（物种挑中后重算一次）；物种每 group 只挑一次。
- `spawned >= getMaxSpawnClusterSize()` ⇒ 结束**整次尝试**。默认 4；仅 8 个实体类覆盖。
- 表见 `gen_ctm_mobs.mjs` 的 `CLUSTER` / `clusterOf`；调试看 `$grp.sel/$grp.sized/$grp.stop`、`$dbg.clusterMax`。

## v4.11：移除一律 void_kill

- 原版消失/超距移除 = `discard()`（静默、无掉落、无经验）；`kill` 会掉战利品给经验 ⇒ 语义不对。
- `util/void_kill` = `tp @s ~ ~-500 ~`（与原作 recovered/doom.nats 一致）；消失层与清理都走它。
- `debug/clear`：静默清掉本包生物（保留 `doom.nats.persistent`），数量报聊天栏与服务器日志。
- **别再用 `kill @e[tag=doom.nats.spawned]` 清场**（实测会在地上留下 476 个掉落物）。


## v4.12：生存直用模式（mode/*）

- 问题：本包用 `summon` 造生物，**不受 `doMobSpawning` 约束** ⇒ 原版自然生成若还开着就是双份刷怪。
- 所以 `core/setup`（装载 tag）默认执行 `mode/survival`：`gamerule doMobSpawning false` + 出一份快照 + `say` 到日志。
- 开关：`mode/survival` / `mode/manual`（装载不再自动改 gamerule，状态存计分板、可跨 reload 与重进世界）/ `mode/auto` / `mode/off`（清场 + 还回原版）。
- 真机验证 `_work/verify_mode.mjs`（已并入 `regress.mjs --reuse`）：9 PASS / 0 FAIL —— 含「manual 后 reload 仍为 true」这条反证。
- 生存手册：`doom.nats/docs/16-生存直用手册.md`（装配三步 + 命令表 + 实测数字 + 与原版差距的诚实清单）。



## v4.13：逐实体规则 + 逐实体光照（源码核对后的修正）

- 规则表：`tools/lib/entity-rules.mjs`（47 实体 → 27 条规则签名）→ `_work/generated/entity-rules.json`；
  `gen_ctm_mobs.mjs` 写 `$sel.rule/place/light/tag/grp1/cluster`，`gen_ctm_check.mjs` 生成 `check/block` 与 `check/entity`。
- **光照是逐实体的**（`$sel.light`：none/dark/bright/bat/slime/glow/bl8）——修掉了"动物被同时要求亮与暗"的互斥 bug。
- **落位是逐类型的**（`$sel.place`：ground/any/water/water_surface/below_tag/lava）——修掉了"水生要求下方可站立"的互斥 bug。
- 下方方块改用 14 个 **vanilla 原标签**；新增群系谓词（slime/river/more_drowned/polar_alt）与 `can_see_sky`。
- 簇上限补齐 ghast/pillager/happy_ghast=1、camel/llama/trader_llama=6；water_ambient 距离 64；河流 98% 不刷；史莱姆补 50% 掷币。
- **消失层默认关闭**（原版 `Mob.checkDespawn` 已对普通生物生效）。
- lint 新增 **L11**：命令里不得有连续两个空格（Brigadier 直接拒整条命令，真机踩过）。

## v4.14：动物 / 维度 / 持久化 / 配置化

- **被动生物节拍**必须用 `time query gametime`（原版 `gameTime % 400`），不能用 `daytime`；
  creature 类别只在节拍命中那一拍进候选（`MobCategory.isPersistent()` 语义）。
- **维度探测**要在首个非旁观玩家位置（`circ/detect_dim`）——tick 函数的执行上下文永远在主世界。
- 海平面/光照档按维度进配置层：主世界 63/uniform0..7；下界 32/常量7（无天空光）；末地 0。
- **持久化三态**：默认（原版管消失）/ `doom.nats.persistent` 标签（只影响本包清理层）/ `PersistenceRequired:1b`（原版也不消失）。
  逐规则 `persist:true`，全局 `$cfg.persist=1`；清理与消失层用 `nbt=!{PersistenceRequired:true}` 跳过持久生物。
- **配置层**：`doom.nats:cfg_defaults` → `doom.nats:config`（作者覆盖）→ `$cfg.*`；键清单见 `docs/18-配置手册.md`。
- 真机验证：`_work/verify_{rules,persist,animals,dims,mode}.mjs`，全部并入 `regress.mjs --reuse`。

## v4.15：finalizeSpawn 组数据层（SpawnGroupData 复刻）

- **先纠正一个旧认知**：`/summon` / `execute summon` **已经会调 finalizeSpawn**
  （`SummonCommand.createEntity(..., true)`，reason=COMMAND，groupData=null）⇒ 逐实体重写装备/变体/婴儿是多
  余的；真正缺的是原版 `NaturalSpawner` 传的 `SpawnGroupData`。
- 新生成器 `gen_ctm_group.mjs`（140 文件）：`grp/init/<slug>`（每组一次：整组共享婴儿/变体/蜘蛛效果）、
  `grp/mem/<slug>`（每只施加；**with storage doom.nats:grp**）、`post/<slug>`（补本包 NBT + 全局持久化 +
  随机朝向）、`predicate/grp/biome/*`（冷/暖家畜、白兔/金兔、雪狐、狼的 8 个群系）。
- `spawn/emit` 改为 `$execute summon $(type) run function doom.nats:post/$(slug) with storage doom.nats:sel`
  ⇒ 新实体就是 @s，彻底消除旧写法 `@e[distance=..1,sort=nearest]` 认错人的隐患；`sel` 新增 `slug`。
- 引擎坑：**宏行没有 $(name) 会让整函数加载失败**（No variables in macro）⇒ lint 新增 L12；朝向掷骰因此写成
  普通行放在 `spawn/emit`，`post` 只负责 `$tp @s ~ ~ ~ $(rot) 0`。
- 动物幼年用 `Age:-24000`（AgeableMob 的存档键），僵尸系用 `IsBaby`。
- 新增 cfg：`difficulty`（0..3，默认 2）、`special`（percent，默认 -1=自动）。
- 真机 14 断言全绿（`_work/verify_group.mjs`）；全套回归 16 PASS / 0 FAIL。

## v4.16（工具链）：VS Code 接入 + headless Spyglass

- 新增 `.vscode/tasks.json`：默认 build 跑 `tools/check_static.mjs --vscode`（9 生成器 `--check` + lint + 闭包），
  输出 `file:line:col: error: msg` 配 `$gcc` problemMatcher ⇒ 进编辑器「问题」面板；另有一键回归 / 组数据专项任务。
- 新增 `tools/check_static.mjs`（统一静态门槛）、`tools/lint_spyglass.mjs`（headless 拉起已装的 Spyglass LSP）。
  后者**未打通**：探针包 `_work/spyglass-probe`（`frobnicate @s`）跑出「（无诊断）」⇒ 不可作证据，详见 docs/20。
- 硬门仍是游戏自己的加载器（`/reload` + 只看本轮的 `Failed to load function`），已内建在 mcauto/regress。

## v4.17：保真度 backlog（P0-3 变体掷点 · 消失层参考点 bug · 多实例隔离）

- **P0-3 共享变体掷点**：原版 `NaturalSpawner:186` 的 `finalizeSpawn(...)` 在 `isValidPositionForMob`（:254）**之后**
  ⇒ SpawnGroupData 由**首只真正生成成功**的个体创建、位置取它的 `blockPosition()`。现在 `grp/init/<slug>` 只写
  **兜底值** + `$grp.vneed=1`；`post/<slug>` **先**调 `grp/var/<slug>`（守卫 `vneed==1`，掷完清零）**再**调
  `grp/mem/<slug>`（宏函数，`$(v)` 必须在实例化前存在）。真机红→绿：`_work/verify_group.mjs` **22 PASS / 0 FAIL**
  （T5b 用 `/fillbiome` 造 forest/plains 两个互斥群系区：首只在 forest ⇒ **4/4 woods**；反向 ⇒ **2/2 pale**；
  T5b-5 反证把掷骰放回 init 位置 ⇒ pale，旧语义下 T5b-2 必红）。详见 docs/19 §七。
- **消失层真机 bug（严重）**：`despawn/tick` 原先 `as @e[…,distance=129..]`，而裸 `distance` 的参考点是
  **函数执行位置** = `core/tick` 的上下文 = **世界出生点**（本机 (-592,66,-272)）⇒ 玩家离出生点 >128 格时，
  本包所有非持久生物在**一个消失节拍内**被 `void_kill`（现象："怪刚刷出来就没了"）。原版 `Mob.checkDespawn()`
  用的是 `level.getNearestPlayer(this,-1)` ⇒ 已改为 `as @a[gamemode=!spectator] at @s as @e[…]` 逐玩家判定
  （概率消失那条同修）。红→绿：`verify_persist` **10 PASS / 0 FAIL**（①存活 0 → 1）、`verify_animals` **6 PASS / 0 FAIL**。
- **多实例隔离（并发纪律）**：`mcauto.mjs` / `regress.mjs` 支持 `MC_SRV`（服务器目录）/ `MC_PORT`（server-port）
  / `RCON_PORT` 环境变量覆盖，**默认值与过去完全一致**（不设就是 25565/25575 + `_work/mcserver`）；`bot.mjs` 由它们传 `--port`。
  并行工作流各用一份 `mcserver-<名>` + 独立端口；验证脚本用 `RCON_PORT=<port> node _work/verify_*.mjs`。
- **陷阱（追加，本轮两次踩到）**：数据包里的裸 `@e[…,distance=N..]` 与任何依赖位置的谓词，参考的是
  **函数执行位置**（`minecraft:tick` = 世界出生点），不是玩家 —— 要"玩家周围"必须 `as @a at @s as @e[…]`。
  测试脚本里别用开头抓的绝对坐标（玩家会被生成物推动 ⇒ 坐标过期 ⇒ 落未加载区块 ⇒ `execute summon` 实体加不进世界，
  记分板照样自增、选择器查不到）；一律相对玩家 + 实体标签计数。
  宏函数参数必须在**调用前**写进存储；跨成员各自的值（马 `Variant` 合成）要拆独立宏函数 `grp/apply/<slug>`。

## v4.18：Q7 收口（地图 worldgen 覆盖端到端 · 单类别群系刷怪致命 bug · 幽灵文件）

- **Q7 ③ 真机四相位（A/B/A，同一世界只换 roster）**：flat `minecraft:plains` 世界 + 独立实例 25567/25577，
  RCON 每 10s 采样 90s/相位：
  | 相位 | roster | 生成 | 候选点 | reason=8 | 场上 |
  |---|---|---|---|---|---|
  | P1 原版 | `--reset` | **+91** | +22941 | +1155 | 70（spider=70） |
  | P2a 空表覆盖（= RC4 地图语义） | `--worldgen _work/worldgen-wgtest` | **+0** | +2204 | **+1884** | 0 |
  | P2b husk 覆盖 | `--worldgen _work/worldgen-wgtest-husk` | **+59** | +16792 | **0** | 70（**husk=70**，其它全 0） |
  | P3 还原 | `--reset` | +51 | +20176 | +893 | 68（spider=68） |
  取证：每相位 bot 处 `if biome ~ ~ ~ minecraft:plains` = OK、`$snap.biome`/`$sel.biome` 三相全 = 41、
  安装后回读 `mob/biome/plains/monster.mcfunction`（97 行/8 物种 ↔ 20 行/["husk"]）。报告 `reports/验证-世界生成覆盖-20260928.md`。
  脚本：`_work/q7/{make_wgtest_pack,make_wgtest_husk,wg_plains_run}.mjs`（带 30s RCON 超时 + 30s 心跳 + 落盘）。
- **致命 bug（原版就有 7 个群系中招）**：`mob/biome/<群系>.mcfunction` 的单类别分支不设 `$catid`
  ⇒ 沿用上一个群系留下的 0..N-1 ⇒ `if score $catid matches 0` 随机不成立 ⇒ **整片群系不刷怪**。
  受害：`the_end / end_barrens / end_highlands / end_midlands / small_end_islands / deep_dark / the_void`（全是「只有 monster」），
  以及任何被地图覆盖成单类别的群系 —— 真机症状就是 P2b 修前 **生成 +0 / reason=8 +1891**，修后 **+59 只 husk**。
  修：`gen_ctm_mobs.mjs` 单类别分支显式 `scoreboard players set $catid doom.nats 0`；新增 **lint L14**（分发行不设 `$catid` ⇒ ERROR，反向测试已验）。
- **幽灵文件**：生成器只写不删 ⇒ roster 变了以后 `mob/biome/<群系>/<类别>.mcfunction` 旧表残留
  （实测用户存档里就有 2 个 `mob/biome/wgtest/**`），`--check` 看不出来。修：写出后清理 `mob/biome/**` 中不在本次产出集合的文件（并收空目录），
  `--check` 把「陈旧文件」计入漂移。原版构建 586 → **584** 文件。
- **Q7 ④ 回归钩子**：`tools/regress.mjs --worldgen <目录>`（可重复）⇒ 先合并覆盖 + `export_rosters` + 重生成，
  再跑整套静态/离线/真机/断言，最后**自动 `--reset` 还原**并按 `biomes.json` 的 sha1 回读校验（还原校验行必须 ✅ 一致，否则拉红整轮）。
- **陷阱（新，害我卡死过一轮）**：**不要用 `execFileSync('powershell', ['-Command','Start-Process … -PassThru'])` 起 detached 服**：
  `execFileSync` 要等 stdout 管道 EOF，而 Java 子进程继承了该句柄 ⇒ 父进程永久阻塞（表现为：服务端已 `Done`、RCON 可连，
  但脚本 CPU 0.2s、一次 RCON 都没发、日志不再增长）。正解：直接 `spawn(JAVA, …, {detached:true, stdio:['ignore', fdOut, fdErr]})` + `unref()`。
  排查心法：日志（appendFileSync 直写）+ 30s 心跳打印「当前步骤」，别再靠 stdout 猜。

### v4.18 附：本轮的「测试前置」教训（都是假红，不是包的问题；已在脚本里修掉）

- **`verify_animals` 在门里红、单跑绿（4 PASS / 2 FAIL）**：根因是**容量冻结**。
  `$cap.<cat> = maxInstancesPerChunk × spawnableChunkCount / 289`，而 `spawnableChunkCount` 来自**快照**；
  上一个脚本（`verify_aabb_cheap`）会 `$snap_period=20000 / $eff.period=100000` 冻结节拍且**不解冻** ⇒
  玩家刚进场、快照还没把区块算进来时被冻住 ⇒ `$cap.creature` **永久为 0** ⇒ 40 次尝试全 `reason=5`（0>=0）。
  修：脚本自己在判定前 `function doom.nats:circ/snapshot` 强制跑一拍 + 轮询 `$cap.creature>0`；
  并把「清场 ⇒ 等额度释放」写成显式前置（原来是 tp 到 y-500 等自然消失，长寿命世界里根本等不到）。
- **反向教训（我先改错了）**：想过在门的 ③ 里**统一给每个脚本解冻**（`$snap_period=0`）——结果
  `verify_persist` 9/1、`verify_rules` 9/7、`verify_struct_aabb` 6/3 集体转红（明细日志里 `$eff.period=2` 说明刷怪循环恢复了，
  把它们的 `$sel.*`/`$snap.*` 全冲掉）。**多数 verify_* 是「先冻结再戳分数」的写法，冻结就是它们的前提，不能替他解冻。**
- **`verify_dims` 12/1 抖动**：③ 断言的前提是「玩家露天」，抬到 y=120 时若那一列区块还没加载，高度图读不到 ⇒ 假红。
  修：抬人前先 `forceload add` 目标区块、轮询重试，判完 `forceload remove`。
- **`verify_probe_cost` 2/1 抖动**：② 用「第 2..5 次**平均** < 5ms」，被第 2 次那一发预热抖动（实测 16ms）拉爆（5.8ms）。
  修：改**中位数**口径（并打印均值/样本，便于判读）。
- **门自身**：`_work/gate_merge.mjs` 现在把每个脚本的**完整输出**落盘到 `_work/gate-<时间戳>-detail/<脚本>.log`
  （以前只留汇总行 ⇒ 红了无法复盘，只能靠复现猜，本轮为此多跑了两轮门）。
- 纪律：**别留下别的名字的 bot**。门的 ③ 看到场上有玩家就不自起机器人（`verify_nether` 需要 `DoomBot`/`Doom_Flare`），
  留一个 `ABot` 在线会让 `verify_nether` 直接以「没有可用的玩家」整门假 FAIL（实测踩到）。


## v4.22d：`in_fortress` 抖动结案 + 两条测试台硬规则（2026-09-29）

**结论**：「要塞谓词 ~17% 抖动」既不是随机、也不是包缺陷。两层原因都在**测试台**：

1. **引擎语义**：`LocationPredicate#matches`（1.21.6 反编译 `LocationPredicate.java:49-53`）里
   `boolean loaded = level.isLoaded(pos)` **同时短路 `biomes` 与 `structures`** ⇒ 位置所在区块没加载，
   谓词**恒假**（不是"读不到"，是直接假）。原版 CTM 只在**已加载且 ticking** 的区块里尝试生成 ⇒ 生产路径永不撞这条；
   本包调的就是引擎谓词 ⇒ **语义与原版一致**。
2. **`forceload` 坐标单位搞错了**：`forceload add <x1> <z1> [<x2> <z2>]` 收的是**方块坐标**。
   旧脚本传 `Math.floor(X/16)±4`（区块坐标）⇒ 命令成功、回显 `Marked chunk [...]`，但标的是**另一个区块**
   （传 `-45,-44` 实际加载 `chunk[-3,-3]`）⇒ 要塞区块从没被强加载，只能靠机器人视距兜底 ——
   这就是 v4.21b 记的"forceload 之后仍报 `loaded=false`"的真因。

**数字（受控复现，隔离实例 fid 25581，同一要塞点 200 次求值）**：未加载 `0/200 = 0.0%` · 强加载 `200/200 = 100.0%` ·
只加载 5 个候选点中的 1 个 `80/200 = 40.0%`（逐点全部 0% 或 100%，**零抖动**）；
端到端（主服 25565，同一要塞）：修前 `表外 1/24 = 4.2%`（ghast 混入，2 PASS/1 FAIL）→ 修后 **`表外 0/24 = 0.0%`，3 PASS / 0 FAIL**。

**规矩（写进脚本，别再犯）**：

- 靠 forceload 的用例：强加载后**回读** `data get block` 判 `loaded`，不满足 **exit 1**，不许静默降级；
- 在任意坐标戳结构/群系谓词的测试：先强加载该坐标的区块，否则读数是"加载态混合值"；
- `_work/verify_fortress_e2e.mjs` 已按此修（`forceload add` 用 ±64 方块 = 9×9 区块 + loaded 硬断言）。
