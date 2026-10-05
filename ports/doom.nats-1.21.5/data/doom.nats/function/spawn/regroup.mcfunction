# doom.nats:spawn/regroup [MACRO] —— 按物种 min/max 重算组大小
# 用法：function doom.nats:spawn/regroup with storage doom.nats:sel
# ⚠ 退化区间保护：min==max 时不能写 random value N..N（会被拒且 store result 会把目标写成 0）
$execute store result score $cnt doom.nats run random value $(min)..$(max)
