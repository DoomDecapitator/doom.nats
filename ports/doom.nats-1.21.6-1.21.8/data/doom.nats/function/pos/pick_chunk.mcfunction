# doom.nats:pos/pick_chunk —— 抽一个候选区块（最多 8 次），偏移取 16 的倍数即"整区块"
scoreboard players remove $pos_tries doom.nats 1
execute store result score $cx doom.nats run random value -128..128
execute store result score $cz doom.nats run random value -128..128
scoreboard players operation $cx doom.nats /= #16 doom.nats
scoreboard players operation $cz doom.nats /= #16 doom.nats
scoreboard players operation $cx doom.nats *= #16 doom.nats
scoreboard players operation $cz doom.nats *= #16 doom.nats
execute store result storage doom.nats:pos_tmp cx int 1 run scoreboard players get $cx doom.nats
execute store result storage doom.nats:pos_tmp cz int 1 run scoreboard players get $cz doom.nats
function doom.nats:pos/try with storage doom.nats:pos_tmp
