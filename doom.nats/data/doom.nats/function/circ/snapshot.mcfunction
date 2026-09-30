# doom.nats:circ/snapshot —— 采集环境快照（情形判定与 debug 的共同基础）
#
# 为什么要"实测"而不是估算：
#   原版 mobcap 的关键量 spawnableChunkCount 取决于**实际加载状态**，而加载状态由
#   view-distance / simulation-distance / 玩家分布共同决定 —— 这是单人与服务器差别的根源。
#   数据包能直接问游戏：`execute if loaded <pos>`，所以这里对每个玩家 17×17 区块逐一实测。

# 1. 玩家数（非旁观）
scoreboard players set $snap.players doom.nats 0
execute store result score $snap.players doom.nats if entity @a[gamemode=!spectator]

# 2. 天气：0=晴 1=雨 2=雷暴
scoreboard players set $snap.weather doom.nats 0
execute if predicate doom.nats:weather/rain run scoreboard players set $snap.weather doom.nats 1
execute if predicate doom.nats:weather/thunder run scoreboard players set $snap.weather doom.nats 2

# 3. 时间与月相（月相 = (daytime / 2400) % 8）
execute store result score $snap.daytime doom.nats run time query daytime
scoreboard players operation $snap.phase doom.nats = $snap.daytime doom.nats
scoreboard players operation $snap.phase doom.nats /= #2400 doom.nats
scoreboard players operation $snap.phase doom.nats %= #8 doom.nats

# 4. 维度：0=主世界 1=下界 2=末地
#    v4.14 修正：必须**在玩家位置**判定。core/tick 由 tick 函数标签调用，执行上下文是世界出生点
#    （永远在主世界）⇒ 老写法在玩家进下界后仍然把 $snap.dim 判成 0，下界的海平面/光照档全都用错。
execute at @a[gamemode=!spectator,limit=1] run function doom.nats:circ/detect_dim
execute unless entity @a[gamemode=!spectator] run scoreboard players set $snap.dim doom.nats 0

# 4b. 配置层：按当前维度折算 $cfg.*（必须在 dim 探测之后、容量与情形之前）
function doom.nats:cfg/apply

# 5. 已加载区块数（玩家 17×17 范围，逐一实测；多玩家取并集需按玩家分别扫描）
scoreboard players set $snap.chunks doom.nats 0
execute at @a[gamemode=!spectator,limit=1] run function doom.nats:circ/scan_chunks

# 6. 派生量：先把情形叠加成生效参数，再算容量（容量依赖 $eff.max.<cat>），最后缓存群系
# 顺序很重要：先判定情形（写 $circ.*），再叠加生效参数（读 $circ.* → $eff.*），最后算容量（读 $eff.max.*）
function doom.nats:circ/eval
function doom.nats:circ/apply
function doom.nats:check/sealevel
# v4.14d：容量计数必须在**玩家所在维度**里做（原版 SpawnState 是 per-level 的；
#   core/tick 的执行上下文在世界出生点 ⇒ 不加这一层就会拿主世界的生物数去卡下界的额度）
execute at @a[gamemode=!spectator,limit=1] run function doom.nats:check/caps
execute unless entity @a[gamemode=!spectator] run function doom.nats:check/caps
execute at @a[gamemode=!spectator,limit=1] run function doom.nats:biome/detect
# 玩家层（蝙蝠规则要低于地表，用玩家位置近似）与月相亮度（八分制 0..8，史莱姆规则要用）
execute store result score $snap.py doom.nats run data get entity @a[gamemode=!spectator,limit=1] Pos[1]
# 月相亮度（八分制）：相位 0..7 → 8,6,4,2,0,2,4,6（0=满月最亮、4=新月最暗）
scoreboard players set $snap.moon doom.nats 0
execute if score $snap.phase doom.nats matches 0 run scoreboard players set $snap.moon doom.nats 8
execute if score $snap.phase doom.nats matches 1 run scoreboard players set $snap.moon doom.nats 6
execute if score $snap.phase doom.nats matches 2 run scoreboard players set $snap.moon doom.nats 4
execute if score $snap.phase doom.nats matches 3 run scoreboard players set $snap.moon doom.nats 2
execute if score $snap.phase doom.nats matches 4 run scoreboard players set $snap.moon doom.nats 0
execute if score $snap.phase doom.nats matches 5 run scoreboard players set $snap.moon doom.nats 2
execute if score $snap.phase doom.nats matches 6 run scoreboard players set $snap.moon doom.nats 4
execute if score $snap.phase doom.nats matches 7 run scoreboard players set $snap.moon doom.nats 6
# 7. 被动生物节拍：源码判定 **gameTime** % 400 == 0（ServerChunkCache.tickChunks）
#    v4.14 修正：早期版本用 time query daytime —— 那是"一天内的时刻"，在 doDaylightCycle=false 或 /time set 之后
#    会与 gameTime 脱钩，导致被动生物节拍卡死。现在用 time query gametime（core/creature_tick）。
function doom.nats:core/creature_tick
scoreboard players operation $creature_gate doom.nats = $gt doom.nats
