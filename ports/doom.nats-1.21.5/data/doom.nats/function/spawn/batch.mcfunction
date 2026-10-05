# doom.nats:spawn/batch —— 一拍内跑 $eff.batch 次完整尝试
#
# 原版对**每个合格区块每个 tick**都调用一次 spawnCategoryForChunk（本包一次尝试 ≈ 一个区块的一次 pack），
# 数据包做不到同量级：这里用批量把每拍的尝试数抬到 $eff.batch（默认 6），量级仍低于原版，
# 因此**单位时间的刷怪数会低于原版**——按设计如此，需要更高密度就调大 $eff.batch / 调小 $eff.period。
scoreboard players set $batch doom.nats 0
execute unless score $eff.batch doom.nats matches 1.. run scoreboard players set $eff.batch doom.nats 1
function doom.nats:spawn/batch_step
