# doom.nats:exp/preset_do [MACRO] —— 按名字派发预设；名字不存在时**只有本函数中止**（调用者照常继续）
# 用法：function doom.nats:exp/preset_do with storage doom.nats:exp_in
$function doom.nats:exp/preset/$(name)
# 走到这一行说明派发成功（宏行失败会让整函数中止）⇒ 置成功标记
scoreboard players set $exp.p doom.nats 1
