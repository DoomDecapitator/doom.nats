# doom.nats:exp/on_spawn/_example —— 运行时刻条目的 on_spawn 钩子模板（复制成 <你的条目 id>.mcfunction 即可）
# 运行时刻追加的条目（add_entry）如果写了 on_spawn:1b，就必须存在同名文件：
#   data/doom.nats/function/exp/on_spawn/<条目 id>.mcfunction
# 否则只有钩子派发那一步静默跳过（生成的实体照常保留），其余流程不受影响。
# @s = 刚生成的那只生物；这里默认什么都不做。

