# doom.nats:exp/biome_not_one [MACRO] —— 黑名单单条：命中即否决（reason=9，与构建期同码）
# 用法：function doom.nats:exp/biome_not_one with storage doom.nats:exp_rt:n.m<i>（{b:"minecraft:desert"}）
$execute if biome ~ ~ ~ $(b) run function doom.nats:check/fail {reason:9}
