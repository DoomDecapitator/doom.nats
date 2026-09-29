# doom.nats:pos/try [MACRO] —— 用 if loaded 判定候选区块；这是与原版"合格区块"对齐的关键一步
$execute if loaded ~$(cx) ~ ~$(cz) run function doom.nats:pos/hit
$execute unless loaded ~$(cx) ~ ~$(cz) if score $pos_tries doom.nats matches 1.. run function doom.nats:pos/pick_chunk
