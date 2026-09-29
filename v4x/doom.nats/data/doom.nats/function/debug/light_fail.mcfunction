# doom.nats:debug/light_fail [MACRO] —— 记录失败档位（$lit.<tier>），再走 reason=3 的失败链
$scoreboard players add $lit.$(tier) doom.nats 1
function doom.nats:check/fail {reason:3}
