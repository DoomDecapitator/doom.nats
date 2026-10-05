# doom.nats:grp/init [MACRO] —— 组数据初始化派发（按物种）
# 用法：function doom.nats:grp/init with storage doom.nats:sel
# 调用点：spawn/pick_one —— 本组首次抽中物种之后（清 $grp.inited 见 spawn/group）
# ⚠ 共享变体**不在本层掷**（v4.17）：见 grp/var/<slug>，由 grp/mem 在本组首只真正生成时调用
$function doom.nats:grp/init/$(slug) with storage doom.nats:sel

# armadillo → age
# axolotl → baby3 +variant(axolotl)
# bat → none
# blaze → none
# bogged → none
# camel → age
# chicken → age
# cod → none
# cow → age
# creeper → none
# dolphin → age
# donkey → none
# drowned → zombie
# enderman → none
# fox → baby3 +variant(fox)
# frog → age
# ghast → none
# glow_squid → age
# goat → age
# hoglin → none
# horse → age +variant(horse)
# husk → zombie
# llama → age +variant(llama)
# magma_cube → none
# mooshroom → age
# ocelot → age
# panda → age
# parrot → none
# pig → age
# piglin → none
# polar_bear → age
# pufferfish → none
# rabbit → age +variant(rabbit)
# salmon → none
# sheep → age
# skeleton → none
# slime → none
# spider → effect
# squid → age
# stray → none
# strider → age
# tropical_fish → none
# turtle → age
# witch → none
# wither_skeleton → none
# wolf → none +variant(wolf)
# zombie → zombie
# zombie_villager → zombie
# zombified_piglin → zombie
