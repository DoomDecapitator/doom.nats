# doom.nats:spawn/point [MACRO] —— 跳到游走点（只改 x/z，y 保持在 pack 原点，对齐源码）
# —— 临时：所有候选点的距离分桶（判定 reason 2 占比是几何问题还是判定问题）
scoreboard players add $dbg.points doom.nats 1
$execute positioned $(x) ~ $(z) run function doom.nats:spawn/pick_one
