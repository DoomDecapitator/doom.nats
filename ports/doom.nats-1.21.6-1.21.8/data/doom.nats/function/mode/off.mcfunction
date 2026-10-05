# doom.nats:mode/off —— 退场：静默清掉本包生物，并把原版自然生成还回去
function doom.nats:debug/clear
gamerule doMobSpawning true
say [nats] mode/off —— 已静默清场并把自然生成还给原版
