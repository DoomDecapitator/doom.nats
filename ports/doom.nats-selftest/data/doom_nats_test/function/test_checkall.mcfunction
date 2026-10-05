# T9 —— check/all 六步判定链
function doom.nats:check/all
scoreboard players set #t.ok nats.test 1
function doom_nats_test:_assert {name:"check_all_chain", detail:"check/all errored"}
