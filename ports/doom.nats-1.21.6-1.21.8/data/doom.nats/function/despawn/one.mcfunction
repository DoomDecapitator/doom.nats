# doom.nats:despawn/one —— 对单个实体掷骰（1/$despawn_dice；0 = 关闭）
execute if score $despawn_dice doom.nats matches ..0 run return 1
execute store result score $dice doom.nats run random value 1..40
execute if score $dice doom.nats matches 1 run function doom.nats:despawn/kill
