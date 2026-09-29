# doom.nats:exp/nbt_apply [MACRO] —— 把作者条目里的自定义 NBT **并入**刚生成的实体
# 用法：function doom.nats:exp/nbt_apply with storage doom.nats:exp_rt:hit（hit.nbt 是一条 SNBT 字符串）
# 这一行就是 SPEC 要求的 `$data merge entity @s $(nbt)`：宏把 storage 里的字符串原样替换成 SNBT。
$data merge entity @s $(nbt)
