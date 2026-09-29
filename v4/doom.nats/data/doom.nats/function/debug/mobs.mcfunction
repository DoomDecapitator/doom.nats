# doom.nats:debug/mobs —— 查看生物注册表规模与按类别的实体标签（走 doom.log 的 [dump]）
function doom.log:info {message:"doom.nats 生物注册表：条目 47 条"}
function doom.log:dump {key:"mobs.monster", message:"可用 @e[type=#doom.nats:monster] 筛选"}
function doom.log:dump {key:"mobs.creature", message:"可用 @e[type=#doom.nats:creature] 筛选"}
function doom.log:dump {key:"mobs.ambient", message:"可用 @e[type=#doom.nats:ambient] 筛选"}
function doom.log:dump {key:"mobs.water_ambient", message:"可用 @e[type=#doom.nats:water_ambient] 筛选"}
function doom.log:dump {key:"mobs.water_creature", message:"可用 @e[type=#doom.nats:water_creature] 筛选"}
function doom.log:dump {key:"mobs.underground_water_creature", message:"可用 @e[type=#doom.nats:underground_water_creature] 筛选"}
function doom.log:dump {key:"mobs.axolotls", message:"可用 @e[type=#doom.nats:axolotls] 筛选"}
tellraw @a [{"text":"[nats] 注册表清单见 data/doom.nats/names.json；实体标签 #doom.nats:<category>","color":"gray"}]
