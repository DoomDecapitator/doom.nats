# doom.nats:circ/apply —— 把当前 active 的情形叠加成生效参数（由 tools/gen_ctm_effects.mjs 生成，勿手改）
#
# 顺序即优先级：先写默认值（= 原版语义），再按 CIRC 表的顺序逐条覆盖，后注册者优先。
# 这些 $eff.* 是生成端唯一读取的参数源：core/tick 读 $eff.period，check/caps 读 $eff.max.<cat>，
# check/light 读 $eff.light。情形不生效时即为原版行为。

# ---- 默认值（原版语义）
scoreboard players operation $eff.period doom.nats = $cfg.period doom.nats
scoreboard players operation $eff.max_monster doom.nats = $cfg.cap_monster doom.nats
scoreboard players operation $eff.max_creature doom.nats = $cfg.cap_creature doom.nats
scoreboard players operation $eff.max_ambient doom.nats = $cfg.cap_ambient doom.nats
scoreboard players operation $eff.max_water_creature doom.nats = $cfg.cap_water_creature doom.nats
scoreboard players operation $eff.max_water_ambient doom.nats = $cfg.cap_water_ambient doom.nats
scoreboard players operation $eff.max_underground_water_creature doom.nats = $cfg.cap_underground_water_creature doom.nats
scoreboard players operation $eff.max_axolotls doom.nats = $cfg.cap_axolotls doom.nats
scoreboard players operation $eff.light doom.nats = $cfg.light doom.nats
scoreboard players operation $eff.creature_gate doom.nats = $cfg.creature_gate doom.nats
# 兜底：配置层没写（=0）时用原版默认，避免整包静默不刷怪
execute unless score $eff.period doom.nats matches 1.. run scoreboard players set $eff.period doom.nats 5
execute unless score $eff.max_monster doom.nats matches 1.. run scoreboard players set $eff.max_monster doom.nats 70
execute unless score $eff.max_creature doom.nats matches 1.. run scoreboard players set $eff.max_creature doom.nats 10
execute unless score $eff.max_ambient doom.nats matches 1.. run scoreboard players set $eff.max_ambient doom.nats 15
execute unless score $eff.light doom.nats matches 0.. run scoreboard players set $eff.light doom.nats 7

# ---- rainy_night：雨夜：节拍加快、怪物上限提高
execute if score $circ.rainy_night doom.nats matches 1 run scoreboard players set $eff.period doom.nats 3
execute if score $circ.rainy_night doom.nats matches 1 run scoreboard players set $eff.max_monster doom.nats 90

# ---- thunder：雷暴：原版靠 skyDarken=10 让刷怪更容易（Monster.isDarkEnoughToSpawn），这里显式化
execute if score $circ.thunder doom.nats matches 1 run scoreboard players set $eff.period doom.nats 2
execute if score $circ.thunder doom.nats matches 1 run scoreboard players set $eff.max_monster doom.nats 100

# ---- multiplayer：多人：per-player cap 各自独立、并集容量随人数放大，故放宽全局节拍
execute if score $circ.multiplayer doom.nats matches 1 run scoreboard players set $eff.period doom.nats 4

# ---- nether：下界：block_light_limit=15（不限制方块光）、综合亮度 <= 7（对齐 dimension_type）
execute if score $circ.nether doom.nats matches 1 run scoreboard players set $eff.light doom.nats 7
execute if score $circ.nether doom.nats matches 1 run scoreboard players set $eff.max_monster doom.nats 70
