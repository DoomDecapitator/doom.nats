# doom.nats:spawn/begin —— 记下游走的世界坐标基准，开始三组
execute store result score $wx doom.nats run data get storage doom.nats:pos x
execute store result score $wz doom.nats run data get storage doom.nats:pos z
execute store result score $wx0 doom.nats run data get storage doom.nats:pos x
execute store result score $wz0 doom.nats run data get storage doom.nats:pos z
scoreboard players set $grp doom.nats 3
function doom.nats:spawn/group
