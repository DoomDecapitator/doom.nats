# doom.nats:pos/pick_local —— 在当前执行位置（= 某个玩家）所在维度里取一个候选原点
#
# 约定：调用前必须已经 as/at 到玩家。结果写 storage doom.nats:pos = {x,y,z,ok:1b}。
function doom.nats:pos/pick_chunk
