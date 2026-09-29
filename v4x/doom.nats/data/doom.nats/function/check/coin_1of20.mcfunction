# doom.nats:check/coin_1of20 —— 1/20 通过（恶魂 nextInt(20) == 0、守卫者同）
execute store result score $coin doom.nats run random value 0..19
execute if score $coin doom.nats matches 1.. run function doom.nats:check/fail {reason:9}
