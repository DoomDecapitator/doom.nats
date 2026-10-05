# doom.nats:author/below_one [MACRO] —— 单条额外落位面判定
# 用法：function doom.nats:author/below_one with storage doom.nats:author_rt:w<i>（{t:"#minecraft:leaves"}）
$execute if block ~ ~-1 ~ $(t) run scoreboard players set $chk.belowok doom.nats 1
