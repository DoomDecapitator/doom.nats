# doom.nats:mob/biome/deep_dark —— minecraft:deep_dark 的类别分发（vanilla 权重，区间与原版逐点等价）
#
# 类别数 N=0：本函数自己掷 $rng → 均匀抽一类 → 在该类内按「$rng % 权重和」掷物种。
# ⚠ v4.19 关键修复（P0-4）：此前 $rng 只由**测试脚本**（_work/verify_*、_work/_probe_*）掷骰，
#   生产链路里没有任何地方掷它 ⇒ $rng 恒为 0 ⇒ 每个类别的 "if score $rng matches from..to" 只命中第一条，
#   **权重整体失效**：海洋怪物永远蜘蛛（溺尸 5/520 永远选不中）、海洋 ambient 永远蝙蝠、要塞永远烈焰人…
#   真机证据：深海 4 分钟 batch=24 零溺尸零鱼；矩阵 12 点里 8 点是 spider —— 全是"表里第一条"。
# 掷骰范围 0..999999：对最大权重和 615 的取模偏差 < 0.1%，且 /random value 一定接受这个区间。
execute store result score $rng doom.nats run random value 0..999999

# 只有一个类别：不掷（random value 0..0 是退化区间，会被游戏拒绝）。
# ⚠ 必须**显式置 0**（v4.18/Q7 实测修）：$catid 是全局计分板，会被上一个群系的抽取留下 0..N-1 的值；
#   少了这一行，本群系下面那句「if score $catid matches 0」就会随上一个群系随机不成立 ⇒ 整片群系不刷怪。
#   受害面：原版就有 5 个单类别群系（the_end / end_barrens / end_highlands / end_midlands / small_end_islands，
#   全是 monster=末影人）；地图 worldgen 覆盖成「只有一类」的群系同样中招。
scoreboard players set $catid doom.nats 0
