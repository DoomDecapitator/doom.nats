# doom.nats:exp/cap_scan [MACRO] —— 运行时刻容量随 Y（counts.capByY.<类别>）
# 用法：function doom.nats:exp/cap_scan with storage doom.nats:sel（由 check/cap 守卫后调用）
# 段按顺序求值、后面的覆盖前面的；只给 max 或只给 localMax 都行（另一项沿用引擎快照值）。
scoreboard players set $exp.cap doom.nats -1
scoreboard players set $exp.lmax doom.nats -1
$data modify storage doom.nats:exp_rt cap set from storage doom.nats:exp counts.capByY."$(cat)"
execute if data storage doom.nats:exp_rt cap[0] run function doom.nats:exp/cap_0
execute if data storage doom.nats:exp_rt cap[1] run function doom.nats:exp/cap_1
execute if data storage doom.nats:exp_rt cap[2] run function doom.nats:exp/cap_2
execute if data storage doom.nats:exp_rt cap[3] run function doom.nats:exp/cap_3
execute if data storage doom.nats:exp_rt cap[4] run function doom.nats:exp/cap_4
execute if data storage doom.nats:exp_rt cap[5] run function doom.nats:exp/cap_5
execute if data storage doom.nats:exp_rt cap[6] run function doom.nats:exp/cap_6
execute if data storage doom.nats:exp_rt cap[7] run function doom.nats:exp/cap_7
$execute if score $exp.cap doom.nats matches 0.. run scoreboard players operation $cap.now_$(cat) doom.nats = $exp.cap doom.nats
$execute if score $exp.lmax doom.nats matches 0.. run scoreboard players operation $cap.lmax_$(cat) doom.nats = $exp.lmax doom.nats
