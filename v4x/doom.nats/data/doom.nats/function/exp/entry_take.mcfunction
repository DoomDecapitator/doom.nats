# doom.nats:exp/entry_take [MACRO] —— 命中后写 doom.nats:sel（含自定义 NBT 与作者标签）
# 用法：function doom.nats:exp/entry_take with storage doom.nats:exp_rt e
# 与构建期条目一致：写 type/cat/min/max/nbt（本包标签 + doom.nats.exp.<id>）。
# slug 不在这里写 —— 先反查注册表（SpawnGroupData 与 post/<slug> 用），查不到就留空（跳过组数据层）。
# ⚠ nbt 必须整体替换（data merge 递归 ⇒ 上一条目残留的键会累加到下一只）⇒ 拆成 merge + set
$data merge storage doom.nats:sel {type:"$(mob)",cat:"$(cat)",min:$(min),max:$(max),authorId:"$(id)"}
$data modify storage doom.nats:sel nbt set value {Tags:["doom.nats.spawned","doom.nats.cat.$(cat)","doom.nats.exp.$(id)"]}
scoreboard players set $sel.ok doom.nats 1
scoreboard players set $exp.hit doom.nats 1
execute if data storage doom.nats:exp_rt e.hook run scoreboard players set $exp.hook doom.nats 1
data modify storage doom.nats:exp_rt hit set from storage doom.nats:exp_rt e
function doom.nats:exp/lookup
execute if data storage doom.nats:exp_rt e.slug run function doom.nats:exp/entry_rule with storage doom.nats:exp_rt e
# 该物种的运行时刻规则补丁与 groupByY 同样适用于条目（与构建期"条目级覆盖"的差别见 rules/README.md）
execute if data storage doom.nats:sel type run function doom.nats:exp/row with storage doom.nats:sel

