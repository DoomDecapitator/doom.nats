# doom.nats:despawn/kill —— 真正移除（单独成函数，方便在日志里归因）
# v4.11：走 void_kill（discard 语义）而不是 kill @s —— 消失的生物不该掉战利品。
execute if score $despawn_log doom.nats matches 1 run tellraw @a [{"text":"[nats.despawn] ","color":"dark_gray"},{"text":"概率消失（静默移除）","color":"gray"}]
function doom.nats:util/void_kill
