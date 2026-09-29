# doom.nats:check/coin_1of50 —— 2% 通过（河流 water_ambient：nextFloat() < 0.98 直接不刷）
execute store result score $coin doom.nats run random value 0..49
execute if score $coin doom.nats matches 1.. run function doom.nats:check/fail {reason:9}
