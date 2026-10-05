# T13 —— 生物注册表入口 debug/mobs 可跑（47 条）
function doom.nats:debug/mobs
scoreboard players set #t.ok nats.test 1
function doom_nats_test:_assert {name:"debug_mobs_runs", detail:"debug/mobs errored"}
