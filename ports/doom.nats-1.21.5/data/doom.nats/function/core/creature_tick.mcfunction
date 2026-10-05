# doom.nats:core/creature_tick —— 被动生物的 400 tick 节拍（原版 getGameTime() % 400）
execute store result score $gt doom.nats run time query gametime
scoreboard players operation $gt doom.nats %= $cfg.creature_gate doom.nats
