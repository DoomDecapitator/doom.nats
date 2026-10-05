# T8 —— dryrun 全链（抽点→距离→群系→选物种→光照→落位→容量）
function doom.nats:debug/dryrun
scoreboard players set #t.ok nats.test 1
function doom_nats_test:_assert {name:"dryrun_chain", detail:"debug/dryrun errored"}
