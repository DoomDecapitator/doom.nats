# doom.nats:author/entry_prep_7 —— 规范化第 7 条（补默认值 + 摊平 when）
# 规范化是必须的：宏源里**所有**占位符都必须存在，否则整个 entry_hit 会因 "Missing argument" 中止。
# 摊平：when.* ⇒ 顶层 yMin/yMax/lightMax/lightMin（宏占位符只认顶层键）。
data modify storage doom.nats:author_rt e merge value {id:"",mob:"",biome:"",category:"",weight:1,min:1,max:1,when:{thundering:0,raining:0,yMin:-2147483648,yMax:2147483647,lightMax:15,lightMin:0}}
data modify storage doom.nats:author_rt e merge from storage doom.nats:author entries[7]
execute if data storage doom.nats:author entries[7].when run data modify storage doom.nats:author_rt e.when merge from storage doom.nats:author entries[7].when
execute store result storage doom.nats:author_rt e.yMin int 1 run data get storage doom.nats:author_rt e.when.yMin
execute store result storage doom.nats:author_rt e.yMax int 1 run data get storage doom.nats:author_rt e.when.yMax
execute store result storage doom.nats:author_rt e.lightMax int 1 run data get storage doom.nats:author_rt e.when.lightMax
execute store result storage doom.nats:author_rt e.lightMin int 1 run data get storage doom.nats:author_rt e.when.lightMin
execute store result storage doom.nats:author_rt e.th int 1 run data get storage doom.nats:author_rt e.when.thundering
execute store result storage doom.nats:author_rt e.ra int 1 run data get storage doom.nats:author_rt e.when.raining
execute store result score $auth.w doom.nats run data get storage doom.nats:author_rt e.weight
