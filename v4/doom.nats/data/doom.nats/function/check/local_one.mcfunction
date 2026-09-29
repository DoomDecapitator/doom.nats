# doom.nats:check/local_one [MACRO] —— 单个玩家的本地容量（以该玩家为执行位置）
# 宏参数 cat 来自 doom.nats:sel；$eff.max_$(cat) 会被替换成 $eff.max_monster 之类的计分板 holder。
$execute store result score $cnt.local doom.nats if entity @e[type=#doom.nats:$(cat),nbt=!{PersistenceRequired:true},distance=..128]
$execute if score $cnt.local doom.nats < $eff.max_$(cat) doom.nats run scoreboard players set $local_ok doom.nats 1
