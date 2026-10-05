# doom.nats:grp/apply/horse [MACRO] —— 把合成后的变体写进实体（$(h) 由调用方先写进 grp 存储）
# 调用点：doom.nats:grp/mem/horse（h 算完之后）
$data merge entity @s {Variant:$(h)}
