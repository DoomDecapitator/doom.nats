scoreboard players add #fail nats.test 1
$say [SELFTEST] FAIL $(name) | $(detail)
$data modify storage doom_nats_test:ctx results append value {name:"$(name)",ok:0b,detail:"$(detail)"}
