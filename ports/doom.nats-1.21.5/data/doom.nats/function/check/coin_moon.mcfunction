# doom.nats:check/coin_moon —— 月相门（史莱姆）
# 月相亮度 0..8（$snap.moon）：random(0..7) >= moon ⇒ 否决（等价 nextFloat() < moonBrightness）
execute store result score $coin doom.nats run random value 0..7
execute if score $coin doom.nats >= $snap.moon doom.nats run function doom.nats:check/fail {reason:9}
