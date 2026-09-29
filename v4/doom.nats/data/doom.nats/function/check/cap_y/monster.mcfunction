# doom.nats:check/cap_y/monster —— 作者层：按 Y 段覆盖该类容量（rules/counts.json capByY.monster）
# 由 check/cap 在比较前调用（$cap.now 已初始化为引擎快照算出的 $cap.monster；后面命中的段**依次覆盖**）。

execute if score $py doom.nats matches ..0 run scoreboard players set $cap.now_monster doom.nats 200
execute if score $py doom.nats matches ..0 run scoreboard players set $cap.lmax_monster doom.nats 140
execute if score $py doom.nats matches 1.. run scoreboard players set $cap.now_monster doom.nats 70
execute if score $py doom.nats matches 1.. run scoreboard players set $cap.lmax_monster doom.nats 70
