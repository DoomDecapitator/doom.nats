scoreboard players add #pass nats.test 1
$say [SELFTEST] PASS $(name)
$data modify storage doom_nats_test:ctx results append value {name:"$(name)",ok:1b,detail:"$(detail)"}
