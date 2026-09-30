# doom.nats:cfg/apply_here —— 先在当前执行位置探测维度，再折算配置
# 用途：地图作者手动改完 doom.nats:config 后，想按**某个维度**复核参数时调用。
function doom.nats:circ/detect_dim
function doom.nats:cfg/apply
