# T1 —— doom.nats → doom.log 链路（装载期 E101）
scoreboard players set #t.ok nats.test 0
execute store result score #t.n nats.test run data get storage doom.log:data history
execute if score #t.n nats.test matches 1.. run scoreboard players set #t.ok nats.test 1
execute store result storage doom.nats:gt log_count int 1 run scoreboard players get #t.n nats.test
function doom_nats_test:_assert {name:"log_link_E101", detail:"doom.log:data.history empty - doom.log not loaded or info macro missing a key"}
