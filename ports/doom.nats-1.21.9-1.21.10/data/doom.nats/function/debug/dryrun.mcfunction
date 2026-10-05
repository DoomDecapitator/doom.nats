# doom.nats:debug/dryrun —— 诊断模式：走完整判定链但不生成实体
#
# 用法：/function doom.nats:debug/dryrun
# 先抽点，再跳到那个点逐步判定，最后把每步结果打印出来（并写进 doom.log 的 [dump]）。
function doom.log:info {code:"E911", message:"doom.nats dryrun：抽点 → 距离 → 群系 → 选物种 → 光照 → 落位 → 容量"}
function doom.nats:pos/pick
function doom.log:dump {key:"pos.ok", message:"1=抽到合格区块 0=没抽到（区块未加载）"}
execute if score $pos.ok doom.nats matches 1 run function doom.nats:debug/dryrun_at with storage doom.nats:pos
execute if score $pos.ok doom.nats matches 0 run tellraw @a [{"text":"[dryrun] ","color":"gold"},{"text":"抽不到合格区块 —— 检查玩家周围 17x17 是否已加载（/function doom.nats:debug/env 看 chunks）","color":"red"}]
