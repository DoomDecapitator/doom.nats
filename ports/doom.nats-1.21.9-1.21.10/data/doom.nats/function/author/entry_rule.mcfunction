# doom.nats:author/entry_rule [MACRO] —— 把注册表里的原版规则数据搬到 $sel（rule/place/light/tag/grp1/cluster/wide…）
# 用法：function doom.nats:author/entry_rule with storage doom.nats:author_rt:e（e.slug 已由 lookup 写好）
$data modify storage doom.nats:author_rt e.rt set from storage doom.nats:mobs."$(slug)".rt
execute store result score $sel.rule doom.nats run data get storage doom.nats:author_rt e.rt.rule
execute store result score $sel.place doom.nats run data get storage doom.nats:author_rt e.rt.place
execute store result score $sel.light doom.nats run data get storage doom.nats:author_rt e.rt.light
execute store result score $sel.tag doom.nats run data get storage doom.nats:author_rt e.rt.tag
execute store result score $sel.grp1 doom.nats run data get storage doom.nats:author_rt e.rt.grp1
execute store result score $sel.cluster doom.nats run data get storage doom.nats:author_rt e.rt.cluster
execute store result score $sel.wide doom.nats run data get storage doom.nats:author_rt e.rt.wide
execute store result score $sel.wide2 doom.nats run data get storage doom.nats:author_rt e.rt.wide2
execute store result score $sel.tall doom.nats run data get storage doom.nats:author_rt e.rt.tall
