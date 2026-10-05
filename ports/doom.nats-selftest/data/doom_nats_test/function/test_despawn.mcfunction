# T11 —— 消失层探针可跑（despawn/setup 的 period 参数已就位）
scoreboard players set #t.ok nats.test 0
execute if score $despawn_period doom.nats matches 1.. run scoreboard players set #t.ok nats.test 1
execute store result storage doom.nats:gt despawn_period int 1 run scoreboard players get $despawn_period doom.nats
function doom_nats_test:_assert {name:"despawn_period_set", detail:"despawn_period missing"}
