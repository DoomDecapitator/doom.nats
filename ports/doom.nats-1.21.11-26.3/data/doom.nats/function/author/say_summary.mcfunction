# doom.nats:author/say_summary [MACRO] —— 摘要打进服务器日志（无真人也能采）
# 用法：function doom.nats:author/say_summary with storage doom.nats:author_rt sum
$say [nats.author] entries=$(n) entityRules=$(rules) groupByY=$(gy) capByY=$(cap)
