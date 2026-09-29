# doom.nats:check/coin_half —— 50% 否决（蝙蝠 nextBoolean / 史莱姆 nextFloat()<0.5）
execute store result score $coin doom.nats run random value 0..1
execute if score $coin doom.nats matches 0 run function doom.nats:check/fail {reason:9}
