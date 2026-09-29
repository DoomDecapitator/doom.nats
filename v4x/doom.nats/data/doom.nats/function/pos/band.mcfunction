# doom.nats:pos/band —— 取生成点的 y（复刻 getRandomPosWithin 的 y 选择）
#
# 原版：y 在 [minY, 地表高度+1] 里**整列**均匀随机，绝大多数点落在石头/空气层里被 check/block 拒掉。
# 数据包读不到 heightmap，于是给三个模式（$band.mode）：
#   0（默认）**自动扫地面**：在候选点从「玩家层 +2」往下扫到 -16，取第一处
#              「下方可站 + 本体可生成 + 上方可生成」的层 ⇒ **不需要作者声明任何高度带**
#              v4.19 起：扫不到（= 浮在深水/空中，窗口里没有可站立层）时**回退**成原版式整列均匀
#              y = random(floorY .. 玩家层+2)（band.fallback=1，默认开）。原因见下面回退段的长注释。
#   1        固定带：y = random($band.yMin .. $band.yMax)（地图地形已知时更贴合作者意图）
#   2        跟随玩家 ± $band.jitter（natspawn 式的简易近似）
# 无论哪种模式，落位是否合法仍由 check/block 判定（reason=4），与原版一样"抽了才知道"。
# v4.14 模式 3：**均匀随机带** —— 最接近原版 getRandomPosWithin 的 uniform(minY, 地表+1)：
#   在 [yMin, yMax] 内均匀取 y，再由合法性链（空位 / 下方可站立 …）自然筛出洞穴与地表。
scoreboard players set $band.hit doom.nats 0
scoreboard players set $band.dy doom.nats 9999
# ⚠ 玩家高度只能从 Pos[1] 取：实体 NBT 里没有 Y 字段（写 data get entity @s Y 会失败并把 $py 落成 0，
#    进而整包 y=0 ⇒ 落位全灭。v4.3 真机实测踩到。）
execute store result score $py doom.nats run data get entity @s Pos[1]
execute store result storage doom.nats:band yMin int 1 run scoreboard players get $band.yMin doom.nats
execute store result storage doom.nats:band yMax int 1 run scoreboard players get $band.yMax doom.nats
execute store result storage doom.nats:band jitter int 1 run scoreboard players get $band.jitter doom.nats
# ① 固定带模式
execute if score $band.mode doom.nats matches 1 if score $band.yMin doom.nats >= $band.yMax doom.nats run scoreboard players operation $py doom.nats = $band.yMin doom.nats
execute if score $band.mode doom.nats matches 1 if score $band.yMin doom.nats < $band.yMax doom.nats run function doom.nats:pos/band_fixed with storage doom.nats:band
# ② 简易抖动模式
execute if score $band.mode doom.nats matches 2 if score $band.jitter doom.nats matches 1.. run function doom.nats:pos/band_jitter with storage doom.nats:band
# 模式 3：均匀随机带（min<max 保护同模式 1）
execute if score $band.mode doom.nats matches 3 if score $band.yMin doom.nats >= $band.yMax doom.nats run scoreboard players operation $py doom.nats = $band.yMin doom.nats
execute if score $band.mode doom.nats matches 3 if score $band.yMin doom.nats < $band.yMax doom.nats run function doom.nats:pos/band_uniform with storage doom.nats:band
# ⚠ 退化区间保护：random value 64..64（退化区间）会被游戏拒绝，而 execute store result 失败时会**把目标写成 0**
#    ⇒ $py=0 ⇒ 整包 y=0 ⇒ 落位全灭（v4.3 真机实测踩到的就是这个）。min==max 时直接取该值、jitter=0 时跳过。
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~2 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats 2
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~1 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats 1
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~0 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats 0
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-1 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -1
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-2 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -2
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-3 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -3
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-4 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -4
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-5 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -5
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-6 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -6
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-7 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -7
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-8 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -8
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-9 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -9
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-10 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -10
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-11 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -11
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-12 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -12
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-13 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -13
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-14 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -14
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-15 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -15
execute if score $band.mode doom.nats matches 0 if score $band.dy doom.nats matches 9999 positioned ~ ~-16 ~ if block ~ ~-1 ~ #doom.nats:standable if block ~ ~ ~ #doom.nats:spawnable_at if block ~ ~1 ~ #doom.nats:spawnable_at run scoreboard players set $band.dy doom.nats -16

# ---- v4.19 回退：扫不到地面时按原版"整列均匀"取 y（[floorY, 玩家层+2]）----
# 为什么需要：原版 y 在 [minY, 地表+1] 整列均匀随机，玩家在海面时整列都是候选 ⇒ 水下十几格照样出溺尸/鱼。
#   模式 0 只在「玩家层 +2 .. -16」里扫地面：玩家浮在**深水**上方时这一窗口内没有任何可站立方块
#   ⇒ 旧行为把 dy 落到 0（贴玩家层）⇒ 候选点被钉在水面那一层：
#     · 溺尸的 isDeepEnoughToSpawn（y < seaLevel-5）永远不过
#     · 水面窗口 place 3 要求上方也是水 ⇒ 也不成立
#   真机实测（深海列 (-4425,-7879)，锚点 y=62）：40/40 次取点全部 dy=0 落在 y=62，0/40 过溺尸深度门 ⇒ 深水零生成。
# 回退语义 = 原版那条均匀分布：y = random($band.floorY .. 玩家层+2)（玩家在水面时 ≈ [minY, 地表+1]）。
#   只在「模式 0 ∧ 扫不到 ∧ $band.fallback=1」时触发，扫得到地面的陆地图层完全不受影响；
#   回退点会有一部分落在石头/空气里被 check/block 拒掉 —— 与原版"抽了才知道"同构。
scoreboard players set $band.fb doom.nats 0
execute if score $band.mode doom.nats matches 0 if score $band.fallback doom.nats matches 1 if score $band.dy doom.nats matches 9999 run scoreboard players set $band.fb doom.nats 1
execute if score $band.fb doom.nats matches 1 run scoreboard players operation $band.yHi doom.nats = $py doom.nats
execute if score $band.fb doom.nats matches 1 run scoreboard players add $band.yHi doom.nats 2
execute if score $band.fb doom.nats matches 1 run scoreboard players operation $band.yLo doom.nats = $chk.floorY doom.nats
# 退化区间保护（同 min==max 的坑：random value 5..3 会被拒，且 store result 失败会把目标写成 0）
execute if score $band.fb doom.nats matches 1 if score $band.yHi doom.nats <= $band.yLo doom.nats run scoreboard players operation $band.yHi doom.nats = $band.yLo doom.nats
execute if score $band.fb doom.nats matches 1 if score $band.yHi doom.nats <= $band.yLo doom.nats run scoreboard players add $band.yHi doom.nats 1
execute if score $band.fb doom.nats matches 1 run execute store result storage doom.nats:band yLo int 1 run scoreboard players get $band.yLo doom.nats
execute if score $band.fb doom.nats matches 1 run execute store result storage doom.nats:band yHi int 1 run scoreboard players get $band.yHi doom.nats
execute if score $band.fb doom.nats matches 1 run function doom.nats:pos/band_fallback with storage doom.nats:band
# 回退关闭时的旧行为：未命中 ⇒ dy=0（贴玩家层；会不会被 check/block 拒掉与原版一样"抽了才知道"）
execute if score $band.dy doom.nats matches 9999 run scoreboard players set $band.dy doom.nats 0
execute if score $band.mode doom.nats matches 0 run scoreboard players operation $py doom.nats += $band.dy doom.nats
