# T2 —— 装载期状态：cfg_defaults 顶层即配置（无 .cfg 包裹）
scoreboard players set #t.ok nats.test 0
execute if data storage doom.nats:cfg_defaults cap.monster run scoreboard players set #t.ok nats.test 1
function doom_nats_test:_assert {name:"load_state_cfg", detail:"doom.nats:cfg_defaults.cap.monster missing - cfg/setup did not run"}
