# doom.nats:pos/pick —— 选一个生成原点（复刻 getRandomPosWithin 的语义）
#
# v4.14h：这里只负责"挑玩家并进入玩家上下文"，真正的取点在 pos/pick_local（在玩家上下文里跑）。
#   为什么要拆：core/tick 的执行上下文在世界出生点（主世界），若在外层用绝对坐标 positioned，
#   玩家在下界/末地时候选点会落到主世界的同名坐标上（真机实测：reason=2 暴涨、下界 0 生成）。
scoreboard players set $pos.ok doom.nats 0
scoreboard players set $pos_tries doom.nats 8
execute as @a[gamemode=!spectator,sort=random,limit=1] at @s run function doom.nats:pos/ctx
execute as @a[gamemode=!spectator,sort=random,limit=1] at @s run function doom.nats:pos/pick_local
