# doom.nats:pos/band_jitter [MACRO] —— 简单近似：y = 玩家层 + random(-$(jitter)..$(jitter))
#
# 用法：function doom.nats:pos/band_jitter with storage doom.nats:band
$execute store result score $dz doom.nats run random value -$(jitter)..$(jitter)
scoreboard players operation $py doom.nats += $dz doom.nats
