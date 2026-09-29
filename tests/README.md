# doom.nats · 测试与验收（怎么在本机复现那些数字）

> 这个目录是 `_work/` 的**精选副本**：只放"可复现验收"需要的脚本，
> 不含反编译产物、第三方数据包、服务器运行目录。

## 前置

1. 一个可 RCON 的测试服（默认 **25565 / RCON 25575**，`server.properties` 里 `enable-rcon=true`）。
   把 `../v4/doom.nats/`（数据包本体）与 `../harness/doom.log/` 一起装进存档的 `datapacks/`。
2. `bot.mjs` 需要 **mineflayer**：在该目录 `npm i mineflayer`（或把它指向已有的 node_modules）。
3. 测试约定（脚本默认按这套写，改世界要同步改脚本）：
   `doDaylightCycle=false` + `time midnight`、`doMobSpawning=false`（由本包接管）、
   锚定机器人 `DoomBot` / `DoomBot2`（相距 >400 格，例：`(-240,71,-592)` 与 `(-700,64,-592)`）。

## 四道门（一次全跑）

```bash
node gate_merge.mjs                # ① 静态 ② 安装+/reload ③ 18 个 verify_*.mjs ④ tools/regress.mjs
node gate_merge.mjs --quick        # 跳过 ④（只跑 ①②③）
node _anchor.mjs                   # 单跑某个脚本前，先把机器人摆到锚点（地表 + 免死 + midnight）
node verify_multibot.mjs           # 单独复跑某条（脚本自己会解冻节拍/清场）
```

- `gate_merge.mjs` 会在每个脚本前：清遗留机器人 → 确保机器人在场 → 扫锚点地表（`forceload` + `can_see_sky`）
  → `tp` → `gamemode creative`（免死，仍算 non-spectator）→ 三界 `debug/clear` → `time set midnight`。
- 单脚本超时 210 s；**门必须单实例**（同时跑会互相装包/抢机器人，数字全是混写）。
- 每个脚本的完整输出落在 `gate-<时间戳>-detail/<脚本名>.log`。

## 脚本清单（18）

| 脚本 | 测什么 |
|---|---|
| `verify_aabb_cheap.mjs` | 碰撞盒（AABB）近似判定矩阵（10 通过 / 13 否决） |
| `verify_animals.mjs` | 被动生物链路（类别门 + 端到端喂入 + 计数一致） |
| `verify_biome_at.mjs` | 逐候选点群系探测（位置敏感 + 同点两函数一致 + 活性） |
| `verify_brain_nbt.mjs` | Warden 记忆 NBT 可写回读 |
| `verify_dim_att.mjs` | **本包新增回归**：`$att.dim` 归属 / `$snap.dim` 隔离 / 末地满 cap ⇒ 必 r5 / 反向不连坐 / 生产链正反两向 |
| `verify_dims.mjs` | 维度参数（海平面 63/32/0、光照档、`can_see_sky`、三维度可执行） |
| `verify_fortress_e2e.mjs` | 下界要塞端到端（选种 ⊆ 要塞表 + 独占种出现） |
| `verify_group.mjs` | 组数据层（SpawnGroupData：首只位置决定组变体、蛛骑/共享效果…） |
| `verify_mode.mjs` | 生存直用开关 `mode/*` |
| `verify_multibot.mjs` | 多机器人锚定 + 消失层隔离（v4.22 修的 P0 回归用例） |
| `verify_nether.mjs` | 下界维度端到端刷怪 |
| `verify_persist.mjs` | `PersistenceRequired` 语义（128 格硬消失 / 持久不消失 / debug/clear 跳过） |
| `verify_probe_cost.mjs` | 探针开销 |
| `verify_rules.mjs` | 逐实体规则 + 逐实体光照（受控试验场：草台 / 水池 / 密闭盒子） |
| `verify_spawn24.mjs` | 世界出生点 24 格排除（reason=10） |
| `verify_species_mix.mjs` | 物种分布（`$rng` 自掷 + 桶对齐 + 类别份额） |
| `verify_struct_aabb.mjs` | 结构 AABB + 要塞结构优先（直调类别通道） |
| `verify_struct_overrides.mjs` | 结构 `spawn_overrides` 一处一表 |

## 已知的"测试侧"坑（都在脚本注释里写明了原因）

- 冻结节拍要**回读**（`circ/apply` 会把 `$eff.period` 从 `$cfg.period` 重算）；
  解冻只给"测活循环"的脚本做（`verify_multibot`）。
- 读分数前要确认**没有别的写入者**（后台快照/世界循环）；维度类先 `forceload`。
- 探针必须**调被测函数本体**并读 `$chk.ok`/`$chk.reason`，不要在脚本里"等价推算"。
- `data modify storage <id> set value {…}` **缺 path 会被拒**（用 `data merge`）。
- `forceload add` 的参数是**区块坐标**且一次 ≤256 区块。
