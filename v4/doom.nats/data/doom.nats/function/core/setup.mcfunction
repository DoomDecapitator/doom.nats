# doom.nats:core/setup —— 装载
scoreboard objectives add doom.nats dummy
scoreboard players set #0 doom.nats 0
scoreboard players set #1 doom.nats 1
scoreboard players set #8 doom.nats 8
scoreboard players set #16 doom.nats 16
scoreboard players set #2400 doom.nats 2400
scoreboard players set #13000 doom.nats 13000
scoreboard players set #23000 doom.nats 23000
scoreboard players set #1200 doom.nats 1200
scoreboard players set #40 doom.nats 40
scoreboard players set #1 doom.nats 1
scoreboard players set #5 doom.nats 5
scoreboard players set #4 doom.nats 4
# 取 y 的默认参数（.mode 0=跟随玩家 1=固定带）
# 固定带的默认值：60..70（CTM 地图应在 maps/ 侧覆盖成自己地形的实际高度带）
# v4.14：下列默认值全部改由 cfg 层提供（作者可在 doom.nats:config 里覆盖，见 docs/18）
scoreboard players set $snap.dim doom.nats 0
function doom.nats:cfg/setup
# v4.14：band / batch / density / maxBatch 也都来自 cfg 层（见 cfg/apply）
scoreboard players operation $density doom.nats = $cfg.density doom.nats
scoreboard players operation $ctrl.maxBatch doom.nats = $cfg.maxBatch doom.nats
scoreboard players operation $eff.batch doom.nats = $cfg.batch doom.nats

# 情形引擎：装载注册表 + 立即产出一份快照
function doom.nats:check/setup
scoreboard players set $chunks_mode doom.nats 0
function doom.nats:despawn/setup
function doom.nats:circ/load
function doom.nats:circ/snapshot

# v4.24 运行时刻作者层：装载（默认空 = 静默；玩家改完 storage 也可以手动再跑一次）
function doom.nats:author/load

# 生存直用：装载即接管原版自然生成（不想让本包动 gamerule，就先执行一次 doom.nats:mode/manual）
execute unless score $mode.manual doom.nats matches 1 run function doom.nats:mode/survival
function doom.log:info {message:"doom.nats v4 就绪（CTM 自然生成复刻）"}
