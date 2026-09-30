# doom.nats:author/biome_check —— 规则补丁里的群系白/黑名单
# 白名单"非空且没命中 ⇒ 拒"；黑名单"命中 ⇒ 拒"。reason 与构建期一致（9）。
scoreboard players set $auth.bok doom.nats 0
execute if data storage doom.nats:author_rt v.m0 run function doom.nats:author/biome_in_one with storage doom.nats:author_rt v.m0
execute if data storage doom.nats:author_rt v.m1 run function doom.nats:author/biome_in_one with storage doom.nats:author_rt v.m1
execute if data storage doom.nats:author_rt v.m2 run function doom.nats:author/biome_in_one with storage doom.nats:author_rt v.m2
execute if data storage doom.nats:author_rt v.m3 run function doom.nats:author/biome_in_one with storage doom.nats:author_rt v.m3
execute if score $chk.ok doom.nats matches 1 if data storage doom.nats:author_rt n.m0 run function doom.nats:author/biome_not_one with storage doom.nats:author_rt n.m0
execute if score $chk.ok doom.nats matches 1 if data storage doom.nats:author_rt n.m1 run function doom.nats:author/biome_not_one with storage doom.nats:author_rt n.m1
execute if score $chk.ok doom.nats matches 1 if data storage doom.nats:author_rt n.m2 run function doom.nats:author/biome_not_one with storage doom.nats:author_rt n.m2
execute if score $chk.ok doom.nats matches 1 if data storage doom.nats:author_rt n.m3 run function doom.nats:author/biome_not_one with storage doom.nats:author_rt n.m3
execute if score $chk.ok doom.nats matches 1 if score $auth.bok doom.nats matches 0 if data storage doom.nats:author_rt v.m0 run function doom.nats:check/fail {reason:9}
