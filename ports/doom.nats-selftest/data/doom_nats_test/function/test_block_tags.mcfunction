# T5 —— 5 个自定义 block 标签可解析（narrow_partial = chain/iron_chain 回归点）
execute if block ~ ~ ~ #doom.nats:full_collision run scoreboard players set #t.a nats.test 1
execute if block ~ ~ ~ #doom.nats:spawnable_at run scoreboard players set #t.a nats.test 1
execute if block ~ ~ ~ #doom.nats:standable run scoreboard players set #t.a nats.test 1
execute if block ~ ~ ~ #doom.nats:water_fluid run scoreboard players set #t.a nats.test 1
execute if block ~ ~ ~ #doom.nats:narrow_partial run scoreboard players set #t.a nats.test 1
scoreboard players set #t.ok nats.test 1
function doom_nats_test:_assert {name:"block_tags_5_narrow_partial", detail:"a #doom.nats:<block> failed to parse (chain/iron_chain suspect)"}
