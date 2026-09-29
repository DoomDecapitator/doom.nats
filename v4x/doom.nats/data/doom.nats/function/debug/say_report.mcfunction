# doom.nats:debug/say_report [MACRO] —— 把归因数字打到服务器日志（无人也能采）
#
# 用法：function doom.nats:debug/say_report with storage doom.nats:rep
$say [nats.reject] rej: 0=$(r0) 1=$(r1) 2=$(r2) 3=$(r3) 4=$(r4) 5=$(r5) 6=$(r6) 7=$(r7) 8=$(r8) 9=$(r9) 10=$(r10) 11=$(r11) spawned=$(spawned)
$say [nats.light] tier: 0=$(t0) 3=$(t3) 7=$(t7) 8=$(t8) 9=$(t9) 11=$(t11) 15=$(t15)
