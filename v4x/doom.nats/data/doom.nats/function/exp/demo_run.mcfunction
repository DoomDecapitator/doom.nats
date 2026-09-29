# doom.nats:exp/demo_run —— 演示体（逐条走命令面；带开闸守卫，关闸即 no-op）
execute if score $exp.demo doom.nats matches 1 run data merge storage doom.nats:exp_in {type:"minecraft:zombie",tag:"#minecraft:leaves"}
execute if score $exp.demo doom.nats matches 1 run function doom.nats:exp/add_below_tag with storage doom.nats:exp_in
execute if score $exp.demo doom.nats matches 1 run data merge storage doom.nats:exp_in {type:"minecraft:zombie",yMin:0,yMax:63,min:2,max:3}
execute if score $exp.demo doom.nats matches 1 run function doom.nats:exp/set_group_by_y with storage doom.nats:exp_in
execute if score $exp.demo doom.nats matches 1 run data merge storage doom.nats:exp_in {category:"monster",yMin:0,yMax:63,max:120,localMax:70}
execute if score $exp.demo doom.nats matches 1 run function doom.nats:exp/set_cap_y with storage doom.nats:exp_in
execute if score $exp.demo doom.nats matches 1 run data modify storage doom.nats:exp_in entry set value {id:"demo_zombie",mob:"minecraft:zombie",biome:"#minecraft:is_overworld",category:"monster",weight:20}
execute if score $exp.demo doom.nats matches 1 run function doom.nats:exp/add_entry with storage doom.nats:exp_in
execute if score $exp.demo doom.nats matches 1 run function doom.nats:exp/show
execute if score $exp.demo doom.nats matches 1 run data merge storage doom.nats:exp_in {name:"blood_moon"}
execute if score $exp.demo doom.nats matches 1 run function doom.nats:exp/preset with storage doom.nats:exp_in
