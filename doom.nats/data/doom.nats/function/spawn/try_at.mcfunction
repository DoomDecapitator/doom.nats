# doom.nats:spawn/try_at —— 在**玩家上下文**里跑完一次尝试（由 spawn/try 调用）
#
# 顺序与源码一致：取点（区块内随机 x/z + y）→ 跳到 pack 原点 → 三组尝试。
# ⚠ v4.20 关键修复（P0，跨维度泄漏）：**必须**先跑 pos/ctx 刷新"本次尝试的维度与海平面窗口"。
#   以前只有 debug 路径（pos/pick）会调 pos/ctx，生产路径（spawn/try → try_at）从不调 ⇒
#   $att.dim（修复前是 $snap.dim）一直停留在"快照那条路径"写下的维度（通常是主世界）⇒
#   末地/下界的尝试被拿**主世界的计数与容量、主世界的海平面窗口**判定：
#     实测：末地怪物堆到 500 只、快照 $cap.monster=40、$rej.5 恒为 0（容量门形同不存在）；
#     冻结节拍下直接戳 check/cap 却正确拒 r5 ⇒ 差异只可能来自"尝试链里维度没被刷新"。
#   代价：每次尝试多 2 条函数调用（detect_dim_att + check/sealevel），可忽略。
function doom.nats:pos/ctx
function doom.nats:pos/pick_local
execute if score $pos.ok doom.nats matches 1 run function doom.nats:spawn/at with storage doom.nats:pos
execute if score $pos.ok doom.nats matches 0 run function doom.nats:debug/reject {reason:0}
