# doom.nats:cfg/apply —— 把 doom.nats:cfg_defaults（默认）与 doom.nats:config（作者覆盖）折算成 $cfg.*
#
# 由 circ/snapshot 每拍调用（维度会变），也可由地图作者在改完 storage 后手动调用一次。
# 约定：作者只写要改的键，其余取默认。例如：
#   /data merge storage doom.nats:config {seaLevel:{overworld:64}, cap:{monster:120}}
#   /function doom.nats:cfg/apply

# --- 与维度无关的标量
execute store result score $cfg.period doom.nats run data get storage doom.nats:cfg_defaults period
execute if data storage doom.nats:config period run execute store result score $cfg.period doom.nats run data get storage doom.nats:config period
execute store result score $cfg.batch doom.nats run data get storage doom.nats:cfg_defaults batch
execute if data storage doom.nats:config batch run execute store result score $cfg.batch doom.nats run data get storage doom.nats:config batch
execute store result score $cfg.maxBatch doom.nats run data get storage doom.nats:cfg_defaults maxBatch
execute if data storage doom.nats:config maxBatch run execute store result score $cfg.maxBatch doom.nats run data get storage doom.nats:config maxBatch
execute store result score $cfg.density doom.nats run data get storage doom.nats:cfg_defaults density
execute if data storage doom.nats:config density run execute store result score $cfg.density doom.nats run data get storage doom.nats:config density
execute store result score $cfg.dice doom.nats run data get storage doom.nats:cfg_defaults dice
execute if data storage doom.nats:config dice run execute store result score $cfg.dice doom.nats run data get storage doom.nats:config dice
execute store result score $cfg.creature_gate doom.nats run data get storage doom.nats:cfg_defaults creatureGate
execute if data storage doom.nats:config creatureGate run execute store result score $cfg.creature_gate doom.nats run data get storage doom.nats:config creatureGate
execute store result score $cfg.persist doom.nats run data get storage doom.nats:cfg_defaults persist
execute if data storage doom.nats:config persist run execute store result score $cfg.persist doom.nats run data get storage doom.nats:config persist
execute store result score $cfg.peaceful doom.nats run data get storage doom.nats:cfg_defaults peaceful
execute if data storage doom.nats:config peaceful run execute store result score $cfg.peaceful doom.nats run data get storage doom.nats:config peaceful
execute store result score $cfg.difficulty doom.nats run data get storage doom.nats:cfg_defaults difficulty
execute if data storage doom.nats:config difficulty run execute store result score $cfg.difficulty doom.nats run data get storage doom.nats:config difficulty
execute store result score $cfg.special doom.nats run data get storage doom.nats:cfg_defaults special
execute if data storage doom.nats:config special run execute store result score $cfg.special doom.nats run data get storage doom.nats:config special
execute store result score $cfg.no_despawn doom.nats run data get storage doom.nats:cfg_defaults noDespawnDistance
execute if data storage doom.nats:config noDespawnDistance run execute store result score $cfg.no_despawn doom.nats run data get storage doom.nats:config noDespawnDistance
execute store result score $cfg.player24 doom.nats run data get storage doom.nats:cfg_defaults playerExclusion
execute if data storage doom.nats:config playerExclusion run execute store result score $cfg.player24 doom.nats run data get storage doom.nats:config playerExclusion
execute store result score $cfg.spawn24 doom.nats run data get storage doom.nats:cfg_defaults spawn24
execute if data storage doom.nats:config spawn24 run execute store result score $cfg.spawn24 doom.nats run data get storage doom.nats:config spawn24
execute store result score $cfg.spawn_x doom.nats run data get storage doom.nats:cfg_defaults spawnX
execute if data storage doom.nats:config spawnX run execute store result score $cfg.spawn_x doom.nats run data get storage doom.nats:config spawnX
execute store result score $cfg.spawn_y doom.nats run data get storage doom.nats:cfg_defaults spawnY
execute if data storage doom.nats:config spawnY run execute store result score $cfg.spawn_y doom.nats run data get storage doom.nats:config spawnY
execute store result score $cfg.spawn_z doom.nats run data get storage doom.nats:cfg_defaults spawnZ
execute if data storage doom.nats:config spawnZ run execute store result score $cfg.spawn_z doom.nats run data get storage doom.nats:config spawnZ
execute store result score $cfg.band_mode doom.nats run data get storage doom.nats:cfg_defaults band.mode
execute if data storage doom.nats:config band.mode run execute store result score $cfg.band_mode doom.nats run data get storage doom.nats:config band.mode
execute store result score $cfg.band_ymin doom.nats run data get storage doom.nats:cfg_defaults band.yMin
execute if data storage doom.nats:config band.yMin run execute store result score $cfg.band_ymin doom.nats run data get storage doom.nats:config band.yMin
execute store result score $cfg.band_ymax doom.nats run data get storage doom.nats:cfg_defaults band.yMax
execute if data storage doom.nats:config band.yMax run execute store result score $cfg.band_ymax doom.nats run data get storage doom.nats:config band.yMax
execute store result score $cfg.band_jitter doom.nats run data get storage doom.nats:cfg_defaults band.jitter
execute if data storage doom.nats:config band.jitter run execute store result score $cfg.band_jitter doom.nats run data get storage doom.nats:config band.jitter
execute store result score $cfg.band_fallback doom.nats run data get storage doom.nats:cfg_defaults band.fallback
execute if data storage doom.nats:config band.fallback run execute store result score $cfg.band_fallback doom.nats run data get storage doom.nats:config band.fallback
execute store result score $cfg.border_cx doom.nats run data get storage doom.nats:cfg_defaults border.centerX
execute if data storage doom.nats:config border.centerX run execute store result score $cfg.border_cx doom.nats run data get storage doom.nats:config border.centerX
execute store result score $cfg.border_cz doom.nats run data get storage doom.nats:cfg_defaults border.centerZ
execute if data storage doom.nats:config border.centerZ run execute store result score $cfg.border_cz doom.nats run data get storage doom.nats:config border.centerZ
execute store result score $cfg.border_size doom.nats run data get storage doom.nats:cfg_defaults border.size
execute if data storage doom.nats:config border.size run execute store result score $cfg.border_size doom.nats run data get storage doom.nats:config border.size

# --- 世界出生点 24 格排除（v4.17 / P1-5，reason=10）
#   原版 isRightDistanceToPlayerAndSpawnPoint 的第二条：
#     level.getSharedSpawnPos().closerToCenterThan(new Vec3(pos.x+0.5, pos.y, pos.z+0.5), 24.0) ⇒ 拒
#   数据包读不到 SharedSpawnPos（docs/19 Q1）⇒ 由作者在 doom.nats:config 里声明坐标，默认关闭。
#   启用门槛：spawn24=1 **且** spawnX/spawnY/spawnZ 三轴都声明过；缺任一轴视作关闭
#   （不设门槛的话，默认 0,0,0 会被当作出生点，把世界原点周围 24 格整片禁掉）。
#   写法说明：只用 `execute if data …`（不用 `unless data …`）—— 离线解释器 lib/interp.mjs 的
#   evalCondition 没有 data 分支，`unless data` 会被当成"取反后仍为真"从而把后面的 storage 当子命令报错。
scoreboard players set $cfg.sx doom.nats 0
execute if data storage doom.nats:config spawnX run scoreboard players set $cfg.sx doom.nats 1
scoreboard players set $cfg.sy doom.nats 0
execute if data storage doom.nats:config spawnY run scoreboard players set $cfg.sy doom.nats 1
scoreboard players set $cfg.sz doom.nats 0
execute if data storage doom.nats:config spawnZ run scoreboard players set $cfg.sz doom.nats 1
scoreboard players operation $cfg.spawn24 doom.nats *= $cfg.sx doom.nats
scoreboard players operation $cfg.spawn24 doom.nats *= $cfg.sy doom.nats
scoreboard players operation $cfg.spawn24 doom.nats *= $cfg.sz doom.nats


# --- 难度与区域难度系数 special（v4.15：组数据层里蜘蛛的困难难度共享效果读这两个键）
#   $cfg.difficulty：0 和平 / 1 简单 / 2 普通 / 3 困难（数据包读不到游戏难度，只能由作者声明）
#   $cfg.special  ：区域难度系数 percent（vanilla DifficultyInstance.getSpecialMultiplier 的 0..1）
#     -1 = 自动：按 difficulty 取成熟世界近似（普通 75%、困难 100%；简单/和平恒 0）
#   派生 $cfg.special_x10 = special*10（蜘蛛组效果的 1..10000 掷骰阈值：100% ⇒ 1000 ⇒ 10%）
scoreboard players set $cfg.auto doom.nats 0
execute if score $cfg.special doom.nats matches ..-1 run scoreboard players set $cfg.auto doom.nats 1
execute if score $cfg.auto doom.nats matches 1 run scoreboard players set $cfg.special doom.nats 0
execute if score $cfg.auto doom.nats matches 1 if score $cfg.difficulty doom.nats matches 2 run scoreboard players set $cfg.special doom.nats 75
execute if score $cfg.auto doom.nats matches 1 if score $cfg.difficulty doom.nats matches 3 run scoreboard players set $cfg.special doom.nats 100
scoreboard players set #10 doom.nats 10
scoreboard players operation $cfg.special_x10 doom.nats = $cfg.special doom.nats
scoreboard players operation $cfg.special_x10 doom.nats *= #10 doom.nats

# --- 取点高度带（pos/band 读 $band.*，并在取点时把 storage doom.nats:band 同步给宏用）
scoreboard players operation $band.mode doom.nats = $cfg.band_mode doom.nats
scoreboard players operation $band.yMin doom.nats = $cfg.band_ymin doom.nats
scoreboard players operation $band.yMax doom.nats = $cfg.band_ymax doom.nats
scoreboard players operation $band.jitter doom.nats = $cfg.band_jitter doom.nats
scoreboard players operation $band.fallback doom.nats = $cfg.band_fallback doom.nats

# --- 按类别（maxInstancesPerChunk / despawnDistance）
execute store result score $cfg.cap_monster doom.nats run data get storage doom.nats:cfg_defaults cap.monster
execute if data storage doom.nats:config cap.monster run execute store result score $cfg.cap_monster doom.nats run data get storage doom.nats:config cap.monster
execute store result score $cfg.dist_monster doom.nats run data get storage doom.nats:cfg_defaults distance.monster
execute if data storage doom.nats:config distance.monster run execute store result score $cfg.dist_monster doom.nats run data get storage doom.nats:config distance.monster
execute store result score $cfg.cap_creature doom.nats run data get storage doom.nats:cfg_defaults cap.creature
execute if data storage doom.nats:config cap.creature run execute store result score $cfg.cap_creature doom.nats run data get storage doom.nats:config cap.creature
execute store result score $cfg.dist_creature doom.nats run data get storage doom.nats:cfg_defaults distance.creature
execute if data storage doom.nats:config distance.creature run execute store result score $cfg.dist_creature doom.nats run data get storage doom.nats:config distance.creature
execute store result score $cfg.cap_ambient doom.nats run data get storage doom.nats:cfg_defaults cap.ambient
execute if data storage doom.nats:config cap.ambient run execute store result score $cfg.cap_ambient doom.nats run data get storage doom.nats:config cap.ambient
execute store result score $cfg.dist_ambient doom.nats run data get storage doom.nats:cfg_defaults distance.ambient
execute if data storage doom.nats:config distance.ambient run execute store result score $cfg.dist_ambient doom.nats run data get storage doom.nats:config distance.ambient
execute store result score $cfg.cap_water_creature doom.nats run data get storage doom.nats:cfg_defaults cap.water_creature
execute if data storage doom.nats:config cap.water_creature run execute store result score $cfg.cap_water_creature doom.nats run data get storage doom.nats:config cap.water_creature
execute store result score $cfg.dist_water_creature doom.nats run data get storage doom.nats:cfg_defaults distance.water_creature
execute if data storage doom.nats:config distance.water_creature run execute store result score $cfg.dist_water_creature doom.nats run data get storage doom.nats:config distance.water_creature
execute store result score $cfg.cap_water_ambient doom.nats run data get storage doom.nats:cfg_defaults cap.water_ambient
execute if data storage doom.nats:config cap.water_ambient run execute store result score $cfg.cap_water_ambient doom.nats run data get storage doom.nats:config cap.water_ambient
execute store result score $cfg.dist_water_ambient doom.nats run data get storage doom.nats:cfg_defaults distance.water_ambient
execute if data storage doom.nats:config distance.water_ambient run execute store result score $cfg.dist_water_ambient doom.nats run data get storage doom.nats:config distance.water_ambient
execute store result score $cfg.cap_underground_water_creature doom.nats run data get storage doom.nats:cfg_defaults cap.underground_water_creature
execute if data storage doom.nats:config cap.underground_water_creature run execute store result score $cfg.cap_underground_water_creature doom.nats run data get storage doom.nats:config cap.underground_water_creature
execute store result score $cfg.dist_underground_water_creature doom.nats run data get storage doom.nats:cfg_defaults distance.underground_water_creature
execute if data storage doom.nats:config distance.underground_water_creature run execute store result score $cfg.dist_underground_water_creature doom.nats run data get storage doom.nats:config distance.underground_water_creature
execute store result score $cfg.cap_axolotls doom.nats run data get storage doom.nats:cfg_defaults cap.axolotls
execute if data storage doom.nats:config cap.axolotls run execute store result score $cfg.cap_axolotls doom.nats run data get storage doom.nats:config cap.axolotls
execute store result score $cfg.dist_axolotls doom.nats run data get storage doom.nats:cfg_defaults distance.axolotls
execute if data storage doom.nats:config distance.axolotls run execute store result score $cfg.dist_axolotls doom.nats run data get storage doom.nats:config distance.axolotls

# --- 按维度（海平面与怪物光照档；维度由 circ/snapshot 先写入 $snap.dim）
execute store result score $cfg.sealevel doom.nats run data get storage doom.nats:cfg_defaults seaLevel.overworld
execute store result score $cfg.light doom.nats run data get storage doom.nats:cfg_defaults light.overworld
execute if data storage doom.nats:config seaLevel.overworld run execute store result score $cfg.sealevel doom.nats run data get storage doom.nats:config seaLevel.overworld
execute if data storage doom.nats:config light.overworld run execute store result score $cfg.light doom.nats run data get storage doom.nats:config light.overworld
execute if score $snap.dim doom.nats matches 1 run execute store result score $cfg.sealevel doom.nats run data get storage doom.nats:cfg_defaults seaLevel.the_nether
execute if score $snap.dim doom.nats matches 1 run execute store result score $cfg.light doom.nats run data get storage doom.nats:cfg_defaults light.the_nether
execute if score $snap.dim doom.nats matches 1 run execute if data storage doom.nats:config seaLevel.the_nether run execute store result score $cfg.sealevel doom.nats run data get storage doom.nats:config seaLevel.the_nether
execute if score $snap.dim doom.nats matches 1 run execute if data storage doom.nats:config light.the_nether run execute store result score $cfg.light doom.nats run data get storage doom.nats:config light.the_nether
execute if score $snap.dim doom.nats matches 2 run execute store result score $cfg.sealevel doom.nats run data get storage doom.nats:cfg_defaults seaLevel.the_end
execute if score $snap.dim doom.nats matches 2 run execute store result score $cfg.light doom.nats run data get storage doom.nats:cfg_defaults light.the_end
execute if score $snap.dim doom.nats matches 2 run execute if data storage doom.nats:config seaLevel.the_end run execute store result score $cfg.sealevel doom.nats run data get storage doom.nats:config seaLevel.the_end
execute if score $snap.dim doom.nats matches 2 run execute if data storage doom.nats:config light.the_end run execute store result score $cfg.light doom.nats run data get storage doom.nats:config light.the_end

# --- v4.14f：**每个维度各存一份**海平面（多玩家分布在不同维度时，每次尝试要按"那个玩家的维度"取）
execute store result score $cfg.sea0 doom.nats run data get storage doom.nats:cfg_defaults seaLevel.overworld
execute if data storage doom.nats:config seaLevel.overworld run execute store result score $cfg.sea0 doom.nats run data get storage doom.nats:config seaLevel.overworld
execute store result score $cfg.sea1 doom.nats run data get storage doom.nats:cfg_defaults seaLevel.the_nether
execute if data storage doom.nats:config seaLevel.the_nether run execute store result score $cfg.sea1 doom.nats run data get storage doom.nats:config seaLevel.the_nether
execute store result score $cfg.sea2 doom.nats run data get storage doom.nats:cfg_defaults seaLevel.the_end
execute if data storage doom.nats:config seaLevel.the_end run execute store result score $cfg.sea2 doom.nats run data get storage doom.nats:config seaLevel.the_end
execute if score $cfg.sea0 doom.nats matches ..-1000 run scoreboard players set $cfg.sea0 doom.nats 63
execute if score $cfg.sea1 doom.nats matches ..-1000 run scoreboard players set $cfg.sea1 doom.nats 32
execute if score $cfg.sea2 doom.nats matches ..-1000 run scoreboard players set $cfg.sea2 doom.nats 0

# --- v4.19：**每个维度各存一份**世界下界（取点回退 pos/band_fallback 的均匀分布下界；check/sealevel 按 $snap.dim 取）
execute store result score $cfg.floor0 doom.nats run data get storage doom.nats:cfg_defaults floorY.overworld
execute if data storage doom.nats:config floorY.overworld run execute store result score $cfg.floor0 doom.nats run data get storage doom.nats:config floorY.overworld
execute store result score $cfg.floor1 doom.nats run data get storage doom.nats:cfg_defaults floorY.the_nether
execute if data storage doom.nats:config floorY.the_nether run execute store result score $cfg.floor1 doom.nats run data get storage doom.nats:config floorY.the_nether
execute store result score $cfg.floor2 doom.nats run data get storage doom.nats:cfg_defaults floorY.the_end
execute if data storage doom.nats:config floorY.the_end run execute store result score $cfg.floor2 doom.nats run data get storage doom.nats:config floorY.the_end
