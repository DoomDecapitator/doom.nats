# T5b —— narrow_partial 解析探针（chain→iron_chain 版本回归）
# 【重要】链方块在 1.21.9 由 minecraft:chain 改名为 minecraft:iron_chain。
# 运行时**无法**在不指名具体 id 的前提下断言其成员，而指名一个本机不存在的 id
# 会让本函数整体加载失败 ⇒ 真正的判定放在**加载错误计数**上：
#   若包装里的 id 与本机版本不符 ⇒ 标签加载报
#   "Couldn't load tag doom.nats:narrow_partial ... missing following references"
#   该错误由 runner 收集（必须为 0）。
# 本函数只做"标签可被引用"的轻量探针：能执行到这里即说明标签已被引擎接受。
execute if block ~ ~ ~ #doom.nats:narrow_partial run scoreboard players set #t.hit nats.test 1
scoreboard players set #t.ok nats.test 1
function doom_nats_test:_assert {name:"narrow_partial_resolvable", detail:"#doom.nats:narrow_partial could not be referenced"}
