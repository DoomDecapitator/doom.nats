# doom.nats:pos/band_at [MACRO] —— 在候选点 (px,pz) 上取 y
#
# 用法：function doom.nats:pos/band_at with storage doom.nats:pt2  →  结果写 $py
$execute positioned $(px) ~ $(pz) run function doom.nats:pos/band
