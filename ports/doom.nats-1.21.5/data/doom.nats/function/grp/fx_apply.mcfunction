# doom.nats:grp/fx_apply [MACRO] —— 施加组内共享效果（MobEffectInstance(effect, -1)：无限时长、amplifier 0）
# 用法：function doom.nats:grp/fx_apply with storage doom.nats:grp
$data merge entity @s {active_effects:[{id:"minecraft:$(fx)",amplifier:0b,duration:-1,ambient:0b,show_particles:1b,show_icon:1b}]}
