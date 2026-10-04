# doom.nats:author/demo_run —— 演示体（逐条走命令面；带开闸守卫，关闸即 no-op）
execute if score $auth.demo doom.nats matches 1 run data merge storage doom.nats:author_in {type:"minecraft:zombie",tag:"#minecraft:leaves"}
execute if score $auth.demo doom.nats matches 1 run function doom.nats:author/add_below_tag with storage doom.nats:author_in
execute if score $auth.demo doom.nats matches 1 run data merge storage doom.nats:author_in {type:"minecraft:zombie",yMin:0,yMax:63,min:2,max:3}
execute if score $auth.demo doom.nats matches 1 run function doom.nats:author/set_group_by_y with storage doom.nats:author_in
execute if score $auth.demo doom.nats matches 1 run data merge storage doom.nats:author_in {category:"monster",yMin:0,yMax:63,max:120,localMax:70}
execute if score $auth.demo doom.nats matches 1 run function doom.nats:author/set_cap_y with storage doom.nats:author_in
execute if score $auth.demo doom.nats matches 1 run data modify storage doom.nats:author_in entry set value {id:"demo_zombie",mob:"minecraft:zombie",biome:"#minecraft:is_overworld",category:"monster",weight:100000}
execute if score $auth.demo doom.nats matches 1 run function doom.nats:author/add_entry with storage doom.nats:author_in
execute if score $auth.demo doom.nats matches 1 run function doom.nats:author/show
