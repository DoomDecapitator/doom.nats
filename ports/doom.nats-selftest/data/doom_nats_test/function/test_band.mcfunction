# T12 —— y 高度带配置已装载（cfg/apply 把 $cfg.band_* 写入 $band.*）
scoreboard players set #t.ok nats.test 0
execute if score $band.mode nats.test matches -2147483648..2147483647 run scoreboard players set #t.ok nats.test 0
execute if score $band.mode doom.nats matches 0..3 run scoreboard players set #t.ok nats.test 1
execute store result storage doom.nats:gt band_mode int 1 run scoreboard players get $band.mode doom.nats
function doom_nats_test:_assert {name:"band_config_loaded", detail:"band.mode not in 0..3 - cfg/apply did not run"}
