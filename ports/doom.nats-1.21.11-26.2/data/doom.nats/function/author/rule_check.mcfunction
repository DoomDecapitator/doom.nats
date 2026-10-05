# doom.nats:author/rule_check [MACRO] —— 运行时刻规则补丁的 Y 窗口 / 亮度窗口 / 天气门
# 用法：function doom.nats:author/rule_check with storage doom.nats:author_rt cur
# 说明：doom.nats:author_rt:cur 的 yMin/yMax/lightMax/lightMin/weather 一定是"默认值 + 作者值"（见 row），
#   所以宏占位符必定齐全；窗口用"正条件 + 取反否决"表达，避免运行时刻算 yMin-1。
$execute if score $chk.ok doom.nats matches 1 unless score $py doom.nats matches $(yMin).. run function doom.nats:check/fail {reason:9}
$execute if score $chk.ok doom.nats matches 1 unless score $py doom.nats matches ..$(yMax) run function doom.nats:check/fail {reason:9}
$execute if score $chk.ok doom.nats matches 1 unless predicate doom.nats:author/run/light_le_$(lightMax) run function doom.nats:check/fail {reason:3}
$execute if score $chk.ok doom.nats matches 1 unless predicate doom.nats:author/run/light_ge_$(lightMin) run function doom.nats:check/fail {reason:3}
$execute if score $chk.ok doom.nats matches 1 unless predicate doom.nats:author/run/weather_$(weather) run function doom.nats:check/fail {reason:9}
