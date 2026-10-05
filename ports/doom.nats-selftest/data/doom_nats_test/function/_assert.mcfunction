# 依赖 #t.ok（1=通过）；name/detail 由调用方以宏传入
$execute if score #t.ok nats.test matches 1 run function doom_nats_test:_pass {name:"$(name)", detail:"$(detail)"}
$execute unless score #t.ok nats.test matches 1 run function doom_nats_test:_fail {name:"$(name)", detail:"$(detail)"}
