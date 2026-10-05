# doom.nats:check/sealevel —— 由 $cfg.sealevel 折算各"海平面窗口"
#
# 原版出处：
#   WaterAnimal / AgeableWaterCreature : seaLevel-13 ≤ y ≤ seaLevel
#   GlowSquid                          : y ≤ seaLevel-33
#   Turtle                             : y < seaLevel+4
#   Drowned.isDeepEnoughToSpawn        : y < seaLevel-5
# 海平面本身来自噪声设置（主世界 63 / 下界 32 / 末地 0），现已进配置层 ⇒ 地图可覆盖。
# v4.14f：以 $snap.dim 选 per-dim 海平面（多玩家跨维度时，每次尝试都会先跑 pos/ctx 把维度改成"那个玩家的"）
scoreboard players operation $chk.sealevel doom.nats = $cfg.sea0 doom.nats
execute if score $att.dim doom.nats matches 1 run scoreboard players operation $chk.sealevel doom.nats = $cfg.sea1 doom.nats
execute if score $att.dim doom.nats matches 2 run scoreboard players operation $chk.sealevel doom.nats = $cfg.sea2 doom.nats
scoreboard players operation $chk.sea_lo doom.nats = $chk.sealevel doom.nats
scoreboard players remove $chk.sea_lo doom.nats 13
scoreboard players operation $chk.sea_hi doom.nats = $chk.sealevel doom.nats
scoreboard players operation $chk.sea_glow doom.nats = $chk.sealevel doom.nats
scoreboard players remove $chk.sea_glow doom.nats 33
scoreboard players operation $chk.sea_turtle doom.nats = $chk.sealevel doom.nats
scoreboard players add $chk.sea_turtle doom.nats 4
scoreboard players operation $chk.sea_deep doom.nats = $chk.sealevel doom.nats
scoreboard players remove $chk.sea_deep doom.nats 5
# v4.19：维度的世界下界（取点回退 pos/band_fallback 用它当均匀分布的下界；主世界 -64 / 下界 0 / 末地 0）
scoreboard players operation $chk.floorY doom.nats = $cfg.floor0 doom.nats
execute if score $att.dim doom.nats matches 1 run scoreboard players operation $chk.floorY doom.nats = $cfg.floor1 doom.nats
execute if score $att.dim doom.nats matches 2 run scoreboard players operation $chk.floorY doom.nats = $cfg.floor2 doom.nats
