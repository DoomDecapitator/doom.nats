# doom.nats:pos/ctx —— 按执行位置的维度刷新本次尝试的上下文
# 由 pos/pick 在选中玩家（at @s）之后立刻调用
# v4.20：写 $att.dim（**只给尝试链用**）—— 不要再写 $snap.dim，那是快照层的，会在尝试中途被 circ/snapshot 覆盖
function doom.nats:circ/detect_dim_att
function doom.nats:check/sealevel
