# doom.nats:check/cnt_overworld —— 逐实体类别派发（minecraft:overworld）
#
# 由 check/caps_scan 的那 1 次整图盒子查询调用：execute in minecraft:overworld as @e[…] run function 本函数。
# 每个被选中的实体执行一次，**逐 tag 独立判定** —— 同时属于多个类别的实体（ocelot 既在 monster 又在 creature）
# 会给每个命中的类别各 +1，与旧实现（每类别一条选择器）逐位一致。
# 每个类别各自封顶 500：等价于旧选择器 limit=500 的饱和语义（计数 = min(n, 500)）。
# monster：属于 #doom.nats:monster 就 +1（封顶 500）
execute if entity @s[type=#doom.nats:monster] if score $cnt.monster doom.nats matches ..499 run scoreboard players add $cnt.monster doom.nats 1
# creature：属于 #doom.nats:creature 就 +1（封顶 500）
execute if entity @s[type=#doom.nats:creature] if score $cnt.creature doom.nats matches ..499 run scoreboard players add $cnt.creature doom.nats 1
# ambient：属于 #doom.nats:ambient 就 +1（封顶 500）
execute if entity @s[type=#doom.nats:ambient] if score $cnt.ambient doom.nats matches ..499 run scoreboard players add $cnt.ambient doom.nats 1
# water_creature：属于 #doom.nats:water_creature 就 +1（封顶 500）
execute if entity @s[type=#doom.nats:water_creature] if score $cnt.water_creature doom.nats matches ..499 run scoreboard players add $cnt.water_creature doom.nats 1
# water_ambient：属于 #doom.nats:water_ambient 就 +1（封顶 500）
execute if entity @s[type=#doom.nats:water_ambient] if score $cnt.water_ambient doom.nats matches ..499 run scoreboard players add $cnt.water_ambient doom.nats 1
# underground_water_creature：属于 #doom.nats:underground_water_creature 就 +1（封顶 500）
execute if entity @s[type=#doom.nats:underground_water_creature] if score $cnt.underground_water_creature doom.nats matches ..499 run scoreboard players add $cnt.underground_water_creature doom.nats 1
# axolotls：属于 #doom.nats:axolotls 就 +1（封顶 500）
execute if entity @s[type=#doom.nats:axolotls] if score $cnt.axolotls doom.nats matches ..499 run scoreboard players add $cnt.axolotls doom.nats 1
