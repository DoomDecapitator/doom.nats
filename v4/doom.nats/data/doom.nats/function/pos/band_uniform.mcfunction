# doom.nats:pos/band_uniform [MACRO] —— 模式 3：在 [yMin, yMax] 内均匀取 y
# 用法：function doom.nats:pos/band_uniform with storage doom.nats:band
$execute store result score $py doom.nats run random value $(yMin)..$(yMax)
