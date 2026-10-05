execute store result score #f nats.test run scoreboard players get #fail nats.test
execute store result score #p nats.test run scoreboard players get #pass nats.test
execute store result storage doom_nats_test:ctx rep.f int 1 run scoreboard players get #fail nats.test
execute store result storage doom_nats_test:ctx rep.p int 1 run scoreboard players get #pass nats.test
scoreboard players operation #t nats.test = #f nats.test
scoreboard players operation #t nats.test += #p nats.test
execute store result storage doom_nats_test:ctx rep.t int 1 run scoreboard players get #t nats.test
function doom_nats_test:_report with storage doom_nats_test:ctx rep
