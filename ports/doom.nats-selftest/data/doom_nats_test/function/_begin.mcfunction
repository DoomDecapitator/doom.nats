# 重置自断言状态
scoreboard objectives remove nats.test
scoreboard objectives add nats.test dummy
scoreboard players set #fail nats.test 0
scoreboard players set #pass nats.test 0
data remove storage doom_nats_test:ctx results
data modify storage doom_nats_test:ctx results set value []
say [SELFTEST] BEGIN doom.nats
