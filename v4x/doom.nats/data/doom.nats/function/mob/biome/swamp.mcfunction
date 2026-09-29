# doom.nats:mob/biome/swamp —— minecraft:swamp 的类别分发（vanilla 权重，区间与原版逐点等价）
#
# 类别数 N=4：本函数自己掷 $rng → 均匀抽一类 → 在该类内按「$rng % 权重和」掷物种。
# ⚠ v4.19 关键修复（P0-4）：此前 $rng 只由**测试脚本**（_work/verify_*、_work/_probe_*）掷骰，
#   生产链路里没有任何地方掷它 ⇒ $rng 恒为 0 ⇒ 每个类别的 "if score $rng matches from..to" 只命中第一条，
#   **权重整体失效**：海洋怪物永远蜘蛛（溺尸 5/520 永远选不中）、海洋 ambient 永远蝙蝠、要塞永远烈焰人…
#   真机证据：深海 4 分钟 batch=24 零溺尸零鱼；矩阵 12 点里 8 点是 spider —— 全是"表里第一条"。
# 掷骰范围 0..999999：对最大权重和 615 的取模偏差 < 0.1%，且 /random value 一定接受这个区间。
execute store result score $rng doom.nats run random value 0..999999

execute store result score $catid doom.nats run random value 0..3
execute if score $catid doom.nats matches 0 run function doom.nats:mob/biome/swamp/ambient
execute if score $catid doom.nats matches 1 if score $gt doom.nats matches 0 run function doom.nats:mob/biome/swamp/creature
execute if score $catid doom.nats matches 2 if score $cfg.peaceful doom.nats matches 0 run function doom.nats:mob/biome/swamp/monster
execute if score $catid doom.nats matches 3 run function doom.nats:mob/biome/swamp/underground_water_creature
