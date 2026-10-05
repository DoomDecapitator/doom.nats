# doom.nats:check/coin_2of3 —— 2/3 通过（豹猫 nextInt(3) != 0）
execute store result score $coin doom.nats run random value 0..2
execute if score $coin doom.nats matches 0 run function doom.nats:check/fail {reason:9}
