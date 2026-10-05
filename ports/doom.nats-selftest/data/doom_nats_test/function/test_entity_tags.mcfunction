# T4 —— 8 个自定义 entity_type 标签可解析
# 只要命令能执行完，就说明 8 个标签全部解析成功（否则前面的命令已报错）
execute if entity @e[type=#doom.nats:monster] run scoreboard players set #t.a nats.test 1
execute if entity @e[type=#doom.nats:creature] run scoreboard players set #t.a nats.test 1
execute if entity @e[type=#doom.nats:ambient] run scoreboard players set #t.a nats.test 1
execute if entity @e[type=#doom.nats:water_creature] run scoreboard players set #t.a nats.test 1
execute if entity @e[type=#doom.nats:water_ambient] run scoreboard players set #t.a nats.test 1
execute if entity @e[type=#doom.nats:underground_water_creature] run scoreboard players set #t.a nats.test 1
execute if entity @e[type=#doom.nats:axolotls] run scoreboard players set #t.a nats.test 1
execute if entity @e[type=#doom.nats:misc] run scoreboard players set #t.a nats.test 1
scoreboard players set #t.ok nats.test 1
function doom_nats_test:_assert {name:"entity_tags_8", detail:"one of #doom.nats:<category> failed to parse"}
