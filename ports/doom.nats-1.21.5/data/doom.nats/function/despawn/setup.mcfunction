# doom.nats:despawn/setup —— 消失层参数
#
# v4.13：$despawn_dice 默认 **0 = 关闭**。理由：本包召出的是普通生物，原版 Mob.checkDespawn()
# 本来就会对它们执行"128 格硬消失 + noActionTime>600 后每 tick 1/800 掷骰"，
# 我们再掷一次骰只会让消失比原版更快（失真）。想开就设成 40（= 每 20 tick 掷 1/40，等效每 tick 1/800）。
scoreboard players set $despawn_period doom.nats 20
# v4.14：掷骰分母来自配置层（默认 0 = 关闭，交给原版 Mob.checkDespawn）
scoreboard players operation $despawn_dice doom.nats = $cfg.dice doom.nats
