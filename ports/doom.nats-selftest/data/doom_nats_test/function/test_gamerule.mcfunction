# T10 —— gamerule 接管标志位
scoreboard players set #t.ok nats.test 0
execute if score $mode.manual doom.nats matches 0..1 run scoreboard players set #t.ok nats.test 1
function doom_nats_test:_assert {name:"gamerule_mode_flag", detail:"mode.manual not in 0..1"}
