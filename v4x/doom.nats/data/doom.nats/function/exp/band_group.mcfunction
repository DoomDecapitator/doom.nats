# doom.nats:exp/band_group [MACRO] —— 把一段"每次生几只"写进 doom.nats:sel（覆盖香草 min/max）
# 用法：function doom.nats:exp/band_group with storage doom.nats:exp_rt b
$execute if score $py doom.nats matches $(yMin)..$(yMax) run data merge storage doom.nats:sel {min:$(min),max:$(max)}
