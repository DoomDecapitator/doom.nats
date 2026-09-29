# doom.nats:check/coin [MACRO] —— 原版 checkSpawnRules 里的随机否决（50% 或按捕月相）
# 用法：function doom.nats:check/coin with storage doom.nats:sel（$rule 决定门限：2=蝙蝠 50%、4=史莱姆按 $snap.moon 八分制）
execute store result score $coin doom.nats run random value 0..7
execute if score $sel.rule doom.nats matches 3 if score $coin doom.nats matches 4.. run function doom.nats:check/fail {reason:9}
execute if score $sel.rule doom.nats matches 4 if score $coin doom.nats >= $snap.moon doom.nats run function doom.nats:check/fail {reason:9}
