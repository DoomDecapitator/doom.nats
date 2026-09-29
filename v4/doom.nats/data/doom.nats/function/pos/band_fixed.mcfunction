# doom.nats:pos/band_fixed [MACRO] —— 固定带模式：y = random($(yMin)..$(yMax))
#
# 用法：function doom.nats:pos/band_fixed with storage doom.nats:band
$execute store result score $py doom.nats run random value $(yMin)..$(yMax)
