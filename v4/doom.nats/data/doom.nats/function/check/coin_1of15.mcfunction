# doom.nats:check/coin_1of15 —— 1/15 通过（溺尸 · 高溺尸群系 nextInt(15) == 0）
execute store result score $coin doom.nats run random value 0..14
execute if score $coin doom.nats matches 1.. run function doom.nats:check/fail {reason:9}
