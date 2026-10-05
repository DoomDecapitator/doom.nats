# doom.nats:check/cost —— spawn cost（reason=7）
#
# 原版：charge_new × Σ(q_i / r_i) ≤ energy_budget（1/r 三维权重、无衰减、每 tick 重建）。
# 同一群系内 q 恒定（warped_forest 全 1.0 / soul_sand_valley 全 0.7），故可化为 Σ(1/r) ≤ budget / q²，
# 阈值由 biome/distpatch 按当前群系写入 $cost.threshold（0 = 该群系不适用）。
# 近似之处：Σ(1/r) 用 6 个距离桶代替连续积分（原版是逐实体精确 1/r）。
execute if score $cost.threshold doom.nats matches 1.. run function doom.nats:check/cost_sum
execute if score $cost.threshold doom.nats matches 1.. if score $cost.sum doom.nats > $cost.threshold doom.nats run function doom.nats:check/fail {reason:7}
