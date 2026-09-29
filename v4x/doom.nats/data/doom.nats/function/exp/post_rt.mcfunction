# doom.nats:exp/post_rt [MACRO] —— 运行时刻条目生成后的收尾（@s = 新生成的那只）
# 用法：function doom.nats:exp/post_rt with storage doom.nats:sel
# 顺序对齐 post/<slug>：先生成物标签 → 再作者的 NBT（写了 Tags 会覆盖本包标签）→ 持久化 → 朝向 → on_spawn。
$data merge entity @s {Tags:["doom.nats.spawned","doom.nats.cat.$(cat)","doom.nats.exp.$(authorId)"]}
execute if data storage doom.nats:exp_rt hit.nbt run function doom.nats:exp/nbt_apply with storage doom.nats:exp_rt hit
execute if score $cfg.persist doom.nats matches 1 run data merge entity @s {PersistenceRequired:1b}
$tp @s ~ ~ ~ $(rot) 0
execute if score $exp.hook doom.nats matches 1 run function doom.nats:exp/on_spawn_go with storage doom.nats:exp_rt hit
