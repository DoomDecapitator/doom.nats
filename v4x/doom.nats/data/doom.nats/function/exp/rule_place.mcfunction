# doom.nats:exp/rule_place —— 规则补丁里的 place / light / persist（字符串→枚举值）
# 与构建期 rules/entity-rules.json 的 place/light 词表同一套编号（见 rules/README.md）。
# place 0=通用陆生 1=无落位限制 2=水中 3=水面窗口 4=陆生+专属标签 5=岩浆
execute if data storage doom.nats:exp_rt cur{place:"ground"} run scoreboard players set $sel.place doom.nats 0
execute if data storage doom.nats:exp_rt cur{place:"any"} run scoreboard players set $sel.place doom.nats 1
execute if data storage doom.nats:exp_rt cur{place:"water"} run scoreboard players set $sel.place doom.nats 2
execute if data storage doom.nats:exp_rt cur{place:"water_surface"} run scoreboard players set $sel.place doom.nats 3
execute if data storage doom.nats:exp_rt cur{place:"below_tag"} run scoreboard players set $sel.place doom.nats 4
execute if data storage doom.nats:exp_rt cur{place:"lava"} run scoreboard players set $sel.place doom.nats 5
execute if data storage doom.nats:exp_rt cur{light:"none"} run scoreboard players set $sel.light doom.nats 0
execute if data storage doom.nats:exp_rt cur{light:"dark"} run scoreboard players set $sel.light doom.nats 1
execute if data storage doom.nats:exp_rt cur{light:"bright"} run scoreboard players set $sel.light doom.nats 2
execute if data storage doom.nats:exp_rt cur{light:"bat"} run scoreboard players set $sel.light doom.nats 3
execute if data storage doom.nats:exp_rt cur{light:"slime"} run scoreboard players set $sel.light doom.nats 4
execute if data storage doom.nats:exp_rt cur{light:"glow"} run scoreboard players set $sel.light doom.nats 5
execute if data storage doom.nats:exp_rt cur{light:"bl8"} run scoreboard players set $sel.light doom.nats 6
execute if data storage doom.nats:exp_rt cur{persist:1b} run data modify storage doom.nats:sel nbt.PersistenceRequired set value 1b

