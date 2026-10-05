# doom.nats:author/cap_scan [MACRO] —— 运行时刻容量随 Y（counts.capByY.<类别>）
# 用法：function doom.nats:author/cap_scan with storage doom.nats:sel（由 check/cap 守卫后调用）
# 段按顺序求值、后面的覆盖前面的；只给 max 或只给 localMax 都行（另一项沿用引擎快照值）。
scoreboard players set $auth.cap doom.nats -1
scoreboard players set $auth.lmax doom.nats -1
$data modify storage doom.nats:author_rt cap set from storage doom.nats:author counts.capByY."$(cat)"
execute if data storage doom.nats:author_rt cap[0] run function doom.nats:author/cap_0
execute if data storage doom.nats:author_rt cap[1] run function doom.nats:author/cap_1
execute if data storage doom.nats:author_rt cap[2] run function doom.nats:author/cap_2
execute if data storage doom.nats:author_rt cap[3] run function doom.nats:author/cap_3
execute if data storage doom.nats:author_rt cap[4] run function doom.nats:author/cap_4
execute if data storage doom.nats:author_rt cap[5] run function doom.nats:author/cap_5
execute if data storage doom.nats:author_rt cap[6] run function doom.nats:author/cap_6
execute if data storage doom.nats:author_rt cap[7] run function doom.nats:author/cap_7
$execute if score $auth.cap doom.nats matches 0.. run scoreboard players operation $cap.now_$(cat) doom.nats = $auth.cap doom.nats
$execute if score $auth.lmax doom.nats matches 0.. run scoreboard players operation $cap.lmax_$(cat) doom.nats = $auth.lmax doom.nats
