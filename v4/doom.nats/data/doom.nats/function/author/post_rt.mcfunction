# doom.nats:author/post_rt [MACRO] —— 运行时刻条目生成后的收尾（@s = 新生成的那只）
# 用法：function doom.nats:author/post_rt with storage doom.nats:sel
# 顺序对齐 post/<slug>：先生成物标签 → 再作者的 NBT（写了 Tags 会覆盖本包标签）→ 持久化 → 朝向。
$data merge entity @s {Tags:["doom.nats.spawned","doom.nats.cat.$(cat)","doom.nats.author.$(authorId)"]}
execute if data storage doom.nats:author_rt hit.nbt run function doom.nats:author/nbt_apply with storage doom.nats:author_rt hit
execute if score $cfg.persist doom.nats matches 1 run data merge entity @s {PersistenceRequired:1b}
$tp @s ~ ~ ~ $(rot) 0
