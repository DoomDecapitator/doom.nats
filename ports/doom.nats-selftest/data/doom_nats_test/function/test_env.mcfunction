# T3 —— circ/snapshot 可跑且 dim 在 0..2
function doom.nats:circ/snapshot
scoreboard players set #t.ok nats.test 0
execute if score $snap.dim doom.nats matches 0..2 run scoreboard players set #t.ok nats.test 1
execute store result storage doom.nats:gt snap_dim int 1 run scoreboard players get $snap.dim doom.nats
function doom_nats_test:_assert {name:"env_snapshot_dim", detail:"snap.dim not in 0..2"}
