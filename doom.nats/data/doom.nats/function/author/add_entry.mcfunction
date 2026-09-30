# doom.nats:author/add_entry [MACRO] —— 追加一条"条件刷怪条目"
# 用法：data modify storage doom.nats:author_in entry set value {id:"x",mob:"minecraft:zombie",biome:"#minecraft:is_overworld",category:"monster",weight:40,when:{thundering:1b},nbt:"{CustomName:'{\"text\":\"X\"}'}"}
#       function doom.nats:author/add_entry
# 整条条目按原样追加（与 rules/entries.json 同构）⇒ 缺的字段由判定层补默认值。
execute unless data storage doom.nats:author entries run data modify storage doom.nats:author entries set value []
execute if data storage doom.nats:author entries[8] run tellraw @s [{"text":"条目已满（上限 8 条）","color":"red"}]
$execute unless data storage doom.nats:author entries[8] run data modify storage doom.nats:author entries append value $(entry)
say [nats.author] add_entry 已写入（改 storage 即刻生效）

