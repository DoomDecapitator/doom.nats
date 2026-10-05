# doom.nats:check/drowned_deep —— 溺尸的自然刷怪门：1/40 掷币 + y < seaLevel-5（isDeepEnoughToSpawn）
execute store result score $coin doom.nats run random value 0..39
execute if score $coin doom.nats matches 1.. run function doom.nats:check/fail {reason:9}
execute if score $py doom.nats >= $chk.sea_deep doom.nats run function doom.nats:check/fail {reason:9}
