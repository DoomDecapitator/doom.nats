# T7 —— 容量计数链：check/caps_scan（整图盒子选择器 + 逐实体派发）
scoreboard players set $cap_phase doom.nats 1
function doom.nats:check/caps_scan
scoreboard players set #t.ok nats.test 0
execute if score $cnt.monster doom.nats matches 0..500 run scoreboard players set #t.ok nats.test 1
function doom_nats_test:_assert {name:"capacity_scan", detail:"check/caps_scan failed or cnt.monster out of range"}
