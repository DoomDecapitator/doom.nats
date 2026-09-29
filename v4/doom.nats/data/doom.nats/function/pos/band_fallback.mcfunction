# doom.nats:pos/band_fallback [MACRO] —— 模式 0 扫不到地面时的回退取点：y = random(floorY .. 玩家层+2)
#
# v4.19：语义 ≈ 原版 getRandomPosWithin 的「y 在 [minY, 地表+1] 整列均匀随机」。
#   玩家在水面/地表时 [floorY, 玩家层+2] 与 [minY, 地表+1] 几乎重合；深处浮空时至少要覆盖下方整列，
#   否则深水里连一个水下候选点都抽不到（真机实测：深水 0 生成）。
# 触发条件见 pos/band（模式 0 ∧ 扫不到 ∧ $band.fallback=1）；$band.dy 归 0 使后面的 += dy 成为空操作。
# 用法：function doom.nats:pos/band_fallback with storage doom.nats:band
$execute store result score $py doom.nats run random value $(yLo)..$(yHi)
scoreboard players set $band.dy doom.nats 0
