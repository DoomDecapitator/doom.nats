// gen_pack.mjs — 生成 doom.nats（v4）骨架：核心调度 + Circumstance 情形引擎 + debug 接入。
//
//   node tools/gen_pack.mjs [--check]
//
// 设计见 docs/11。本轮落地的是「环境快照」这一层 —— 它是情形判定与 debug 的共同基础，
// 也是掌握单/多/服务器差异的关键量（已加载区块数用 `execute if loaded` 实测，而不是估算）。
import fs from 'node:fs';
import path from 'node:path';
import * as PKG from './lib/packdir.mjs';

import { CIRC, whenToCmd } from './lib/circ-defs.mjs';
// v4.25 实验性 AJ 桥接：只有「实验性变体 + rules/rigs.json 非空」时才多一行 tick 转发。
//   为什么必须由 core/tick 转发：整包只有一个 minecraft:tick 文件（本生成器写），第二个生成器写它会漂移；
//   而清扫要 40t 节拍 ⇒ 由 exp/aj/tick 自己分频，core/tick 只负责每 tick 喊一声。
import { EXP_RIGS } from './lib/exp-rigs.mjs';
const ROOT = path.resolve(import.meta.dirname, '..');
// v4.24：产物根目录由 lib/packdir.mjs 统一解析（DOOM_EXP=1 ⇒ pack/doom.nats-experimental 实验性变体）
const PACK = PKG.PACK;
const LF = String.fromCharCode(10);
const NS = 'doom.nats';
const DOLLAR = String.fromCharCode(36);   // '$'，避免与生成器自身的模板字符串冲突
const DEP = '${';   // 宏占位符起始，避免与生成器模板字符串冲突
const F = {};

// v4.25 实验性 AJ 桥接：core/tick 末尾的那一段（空 rigs.json ⇒ 空串 ⇒ core/tick 逐字节不变）
const RIG_TICK = EXP_RIGS.active ? `
# 实验性 AJ 桥接（v4.25）：rig 层节拍。每 tick 只多一次函数调用（分频/清扫都在 exp/aj/tick 里做）；
#   rules/rigs.json 为空时这一行**根本不生成** ⇒ core/tick 与不带这一层时逐字节相同。
function ${NS}:exp/aj/tick` : '';

const j = (o) => JSON.stringify(o, null, 2) + LF;

// ---------------------------------------------------------------- 元数据
// v4.24：两个变体。实验性变体（DOOM_EXP=1 ⇒ pack/doom.nats-experimental）在 pack.mcmeta 里声明 `features`（**顶层字段**），
//   于是**世界没开对应实验性玩法时引擎直接拒绝加载这个包**（拒绝比警告可靠）。
//   形状取自 vanilla 自带实验性数据包（server-1.21.6.jar 的 data/minecraft/datapacks/*/pack.mcmeta）：
//     { "features": { "enabled": ["minecraft:minecart_improvements"] }, "pack": { … } }
//   1.21.6 可用的旗标只有三个（同一份 jar 的证据）：minecraft:minecart_improvements / redstone_experiments /
//     trade_rebalance —— 没有"自定义数据包"旗标，只能**借用一个原生实验性旗标**当引擎门。
//   选 minecart_improvements 的理由：它只改矿车运动，对"自然生成/战斗/交易"影响最小。
//   ⚠ 代价必须写进文档：开它的世界同时也会拿到 vanilla 的矿车改动。
const EXP = PKG.EXP;
F['pack.mcmeta'] = EXP
  ? j({
    features: { enabled: ['minecraft:minecart_improvements'] },
    pack: {
      pack_format: 80,
      description: "§6Doom's Artificial Natspawns §7[v4x · 1.21.6 · 实验性变体（含非原版能力 near / on_spawn / preset）]",
    },
  })
  : j({
    pack: {
      pack_format: 80,
      description: "§bDoom's Artificial Natspawns §7[v4 · 1.21.6 · 自然生成复刻（数据包驱动）]",
    },
  });

F['data/minecraft/tags/function/load.json'] = j({ values: [NS + ':core/setup'] });
F['data/minecraft/tags/function/tick.json'] = j({ values: [NS + ':core/tick'] });

// ---------------------------------------------------------------- 核心
F['data/' + NS + '/function/core/setup.mcfunction'] = `# ${NS}:core/setup —— 装载
scoreboard objectives add ${NS} dummy
scoreboard players set #0 ${NS} 0
scoreboard players set #1 ${NS} 1
scoreboard players set #8 ${NS} 8
scoreboard players set #16 ${NS} 16
scoreboard players set #2400 ${NS} 2400
scoreboard players set #13000 ${NS} 13000
scoreboard players set #23000 ${NS} 23000
scoreboard players set #1200 ${NS} 1200
scoreboard players set #40 ${NS} 40
scoreboard players set #1 ${NS} 1
scoreboard players set #5 ${NS} 5
scoreboard players set #4 ${NS} 4
# 取 y 的默认参数（.mode 0=跟随玩家 1=固定带）
# 固定带的默认值：60..70（自定义地图应在 maps/ 侧覆盖成自己地形的实际高度带）
# v4.14：下列默认值全部改由 cfg 层提供（作者可在 doom.nats:config 里覆盖，见 docs/18）
scoreboard players set $snap.dim ${NS} 0
function ${NS}:cfg/setup
# v4.14：band / batch / density / maxBatch 也都来自 cfg 层（见 cfg/apply）
scoreboard players operation $density ${NS} = $cfg.density ${NS}
scoreboard players operation $ctrl.maxBatch ${NS} = $cfg.maxBatch ${NS}
scoreboard players operation $eff.batch ${NS} = $cfg.batch ${NS}

# 情形引擎：装载注册表 + 立即产出一份快照
function ${NS}:check/setup
scoreboard players set $chunks_mode ${NS} 0
function ${NS}:despawn/setup
function ${NS}:circ/load
function ${NS}:circ/snapshot

# v4.24 运行时刻作者层：装载（默认空 = 静默；玩家改完 storage 也可以手动再跑一次）
function ${NS}:author/load${PKG.EXP ? `
# v4.24 实验性层（只有实验性变体才有这些函数）：装载 + 总览
function ${NS}:exp/load` : ''}

# 生存直用：装载即接管原版自然生成（不想让本包动 gamerule，就先执行一次 doom.nats:mode/manual）
execute unless score $mode.manual ${NS} matches 1 run function ${NS}:mode/survival
function doom.log:info {message:"${NS} v4 就绪（自然生成复刻）"}
`;


// ---------------------------------------------------------------- 配置层（v4.14）
// 「所有的刷新都可以被定义」：把此前散落在生成器里的数值全部收进两个 storage：
//   doom.nats:cfg_defaults —— 我们写的默认值（= 原版语义，每次装载重写）
//   doom.nats:config       —— **作者覆盖**（只写想改的键；地图/datapack 用 data merge 写入）
// cfg/apply 把它们按**当前维度**折算成 $cfg.* 计分板，其余各层只读 $cfg.*。
// 每个键的出处见 docs/18-配置手册.md（MobCategory / dimension_type / noise_settings 等）。
{
  const defLines = [];
  const score = (name, path) => 'execute store result score $cfg.' + name + ' ' + NS + ' run data get storage ' + NS + ':cfg_defaults ' + path;
  const over = (name, path) => 'execute if data storage ' + NS + ':config ' + path + ' run execute store result score $cfg.' + name + ' ' + NS + ' run data get storage ' + NS + ':config ' + path;

  defLines.push('# ' + NS + ':cfg/setup —— 写入默认配置（每次装载重写；作者覆盖写在 doom.nats:config）');
  defLines.push('data merge storage ' + NS + ':cfg_defaults ' + JSON.stringify({
    seaLevel: { overworld: 63, the_nether: 32, the_end: 0 },
    // v4.19：世界下界（原版 Level.getMinY：主世界 -64 / 下界 0 / 末地 0）。取点回退的均匀分布下界。
    floorY: { overworld: -64, the_nether: 0, the_end: 0 },
    // v4.19（E2c 实测缺口）：世界边界 —— 原版 SpawnPlacementTypes 的 ON_GROUND/IN_WATER/IN_LAVA 都先查
    //   level.getWorldBorder().isWithinBounds(pos)。命令侧只能读 worldborder get 的**尺寸**、读不到**中心**，
    //   所以中心由作者声明；size=0（默认）表示不启用 ⇒ 默认行为与以前完全一致。
    border: { centerX: 0, centerZ: 0, size: 0 },
    light: { overworld: 7, the_nether: 7, the_end: 7 },
    blockLightLimit: { overworld: 0, the_nether: 15, the_end: 0 },
    cap: { monster: 70, creature: 10, ambient: 15, water_creature: 5, water_ambient: 20, underground_water_creature: 5, axolotls: 5 },
    distance: { monster: 128, creature: 128, ambient: 128, water_creature: 128, water_ambient: 64, underground_water_creature: 128, axolotls: 128 },
    noDespawnDistance: 32,
    playerExclusion: 24,
    // v4.17（P1-5）：世界出生点 24 格排除 —— 原版读 ServerLevel.getSharedSpawnPos()，数据包不可观测（docs/19 Q1）
    //   ⇒ 默认关闭；作者声明 spawnX/spawnY/spawnZ 并把 spawn24 置 1 才生效（门槛见 cfg/apply）
    spawn24: 0, spawnX: 0, spawnY: 0, spawnZ: 0,
    period: 5, batch: 6, maxBatch: 40, density: 0, dice: 0, creatureGate: 400, persist: 0, peaceful: 0, difficulty: 2, special: -1,
    // v4.19：band.fallback=1 ⇒ 模式 0 扫不到地面时按原版整列均匀取 y（[floorY, 玩家层+2]），见 pos/band
    band: { mode: 0, yMin: 60, yMax: 70, jitter: 3, fallback: 1 },
  }));
  defLines.push('function ' + NS + ':cfg/apply');
  F['data/' + NS + '/function/cfg/setup.mcfunction'] = defLines.join(LF) + LF;

  const rows = [
    '# ' + NS + ':cfg/apply —— 把 doom.nats:cfg_defaults（默认）与 doom.nats:config（作者覆盖）折算成 $cfg.*',
    '#',
    '# 由 circ/snapshot 每拍调用（维度会变），也可由地图作者在改完 storage 后手动调用一次。',
    '# 约定：作者只写要改的键，其余取默认。例如：',
    '#   /data merge storage ' + NS + ':config {seaLevel:{overworld:64}, cap:{monster:120}}',
    '#   /function ' + NS + ':cfg/apply',
    '',
    '# --- 与维度无关的标量',
  ];
  for (const [name, path] of [
    ['period', 'period'], ['batch', 'batch'], ['maxBatch', 'maxBatch'], ['density', 'density'],
    ['dice', 'dice'], ['creature_gate', 'creatureGate'], ['persist', 'persist'], ['peaceful', 'peaceful'],
    ['difficulty', 'difficulty'], ['special', 'special'],
    ['no_despawn', 'noDespawnDistance'], ['player24', 'playerExclusion'],
    ['spawn24', 'spawn24'], ['spawn_x', 'spawnX'], ['spawn_y', 'spawnY'], ['spawn_z', 'spawnZ'],
    ['band_mode', 'band.mode'], ['band_ymin', 'band.yMin'], ['band_ymax', 'band.yMax'], ['band_jitter', 'band.jitter'],
    ['band_fallback', 'band.fallback'],
    ['border_cx', 'border.centerX'], ['border_cz', 'border.centerZ'], ['border_size', 'border.size'],
  ]) {
    rows.push(score(name, path));
    rows.push(over(name, path));
  }
  rows.push('');
  rows.push('# --- 世界出生点 24 格排除（v4.17 / P1-5，reason=10）');
  rows.push('#   原版 isRightDistanceToPlayerAndSpawnPoint 的第二条：');
  rows.push('#     level.getSharedSpawnPos().closerToCenterThan(new Vec3(pos.x+0.5, pos.y, pos.z+0.5), 24.0) ⇒ 拒');
  rows.push('#   数据包读不到 SharedSpawnPos（docs/19 Q1）⇒ 由作者在 doom.nats:config 里声明坐标，默认关闭。');
  rows.push('#   启用门槛：spawn24=1 **且** spawnX/spawnY/spawnZ 三轴都声明过；缺任一轴视作关闭');
  rows.push('#   （不设门槛的话，默认 0,0,0 会被当作出生点，把世界原点周围 24 格整片禁掉）。');
  rows.push('#   写法说明：只用 `execute if data …`（不用 `unless data …`）—— 离线解释器 lib/interp.mjs 的');
  rows.push('#   evalCondition 没有 data 分支，`unless data` 会被当成"取反后仍为真"从而把后面的 storage 当子命令报错。');
  rows.push('scoreboard players set $cfg.sx ' + NS + ' 0');
  rows.push('execute if data storage ' + NS + ':config spawnX run scoreboard players set $cfg.sx ' + NS + ' 1');
  rows.push('scoreboard players set $cfg.sy ' + NS + ' 0');
  rows.push('execute if data storage ' + NS + ':config spawnY run scoreboard players set $cfg.sy ' + NS + ' 1');
  rows.push('scoreboard players set $cfg.sz ' + NS + ' 0');
  rows.push('execute if data storage ' + NS + ':config spawnZ run scoreboard players set $cfg.sz ' + NS + ' 1');
  rows.push('scoreboard players operation $cfg.spawn24 ' + NS + ' *= $cfg.sx ' + NS);
  rows.push('scoreboard players operation $cfg.spawn24 ' + NS + ' *= $cfg.sy ' + NS);
  rows.push('scoreboard players operation $cfg.spawn24 ' + NS + ' *= $cfg.sz ' + NS);
  rows.push('');
  rows.push('');
  rows.push('# --- 难度与区域难度系数 special（v4.15：组数据层里蜘蛛的困难难度共享效果读这两个键）');
  rows.push('#   $cfg.difficulty：0 和平 / 1 简单 / 2 普通 / 3 困难（数据包读不到游戏难度，只能由作者声明）');
  rows.push('#   $cfg.special  ：区域难度系数 percent（vanilla DifficultyInstance.getSpecialMultiplier 的 0..1）');
  rows.push('#     -1 = 自动：按 difficulty 取成熟世界近似（普通 75%、困难 100%；简单/和平恒 0）');
  rows.push('#   派生 $cfg.special_x10 = special*10（蜘蛛组效果的 1..10000 掷骰阈值：100% ⇒ 1000 ⇒ 10%）');
  rows.push('scoreboard players set $cfg.auto ' + NS + ' 0');
  rows.push('execute if score $cfg.special ' + NS + ' matches ..-1 run scoreboard players set $cfg.auto ' + NS + ' 1');
  rows.push('execute if score $cfg.auto ' + NS + ' matches 1 run scoreboard players set $cfg.special ' + NS + ' 0');
  rows.push('execute if score $cfg.auto ' + NS + ' matches 1 if score $cfg.difficulty ' + NS + ' matches 2 run scoreboard players set $cfg.special ' + NS + ' 75');
  rows.push('execute if score $cfg.auto ' + NS + ' matches 1 if score $cfg.difficulty ' + NS + ' matches 3 run scoreboard players set $cfg.special ' + NS + ' 100');
  rows.push('scoreboard players set #10 ' + NS + ' 10');
  rows.push('scoreboard players operation $cfg.special_x10 ' + NS + ' = $cfg.special ' + NS);
  rows.push('scoreboard players operation $cfg.special_x10 ' + NS + ' *= #10 ' + NS);
  rows.push('');
  rows.push('# --- 取点高度带（pos/band 读 $band.*，并在取点时把 storage doom.nats:band 同步给宏用）');
  // v4.19：原来这一段被复制了两遍（v4.14 合并时的残留），去重
  for (const [k, cfgKey] of [['mode', 'band_mode'], ['yMin', 'band_ymin'], ['yMax', 'band_ymax'], ['jitter', 'band_jitter'], ['fallback', 'band_fallback']]) {
    rows.push('scoreboard players operation $band.' + k + ' ' + NS + ' = $cfg.' + cfgKey + ' ' + NS);
  }
  rows.push('');
  rows.push('# --- 按类别（maxInstancesPerChunk / despawnDistance）');
  for (const cat of ['monster', 'creature', 'ambient', 'water_creature', 'water_ambient', 'underground_water_creature', 'axolotls']) {
    rows.push(score('cap_' + cat, 'cap.' + cat));
    rows.push(over('cap_' + cat, 'cap.' + cat));
    rows.push(score('dist_' + cat, 'distance.' + cat));
    rows.push(over('dist_' + cat, 'distance.' + cat));
  }
  rows.push('');
  rows.push('# --- 按维度（海平面与怪物光照档；维度由 circ/snapshot 先写入 $snap.dim）');
  rows.push(score('sealevel', 'seaLevel.overworld'));
  rows.push(score('light', 'light.overworld'));
  rows.push(over('sealevel', 'seaLevel.overworld'));
  rows.push(over('light', 'light.overworld'));
  rows.push('execute if score $snap.dim ' + NS + ' matches 1 run ' + score('sealevel', 'seaLevel.the_nether').replace('execute store result score', 'execute store result score'));
  rows.push('execute if score $snap.dim ' + NS + ' matches 1 run ' + score('light', 'light.the_nether'));
  rows.push('execute if score $snap.dim ' + NS + ' matches 1 run ' + over('sealevel', 'seaLevel.the_nether'));
  rows.push('execute if score $snap.dim ' + NS + ' matches 1 run ' + over('light', 'light.the_nether'));
  rows.push('execute if score $snap.dim ' + NS + ' matches 2 run ' + score('sealevel', 'seaLevel.the_end'));
  rows.push('execute if score $snap.dim ' + NS + ' matches 2 run ' + score('light', 'light.the_end'));
  rows.push('execute if score $snap.dim ' + NS + ' matches 2 run ' + over('sealevel', 'seaLevel.the_end'));
  rows.push('execute if score $snap.dim ' + NS + ' matches 2 run ' + over('light', 'light.the_end'));
  rows.push('');
  rows.push('# --- v4.14f：**每个维度各存一份**海平面（多玩家分布在不同维度时，每次尝试要按"那个玩家的维度"取）');
  for (const [i, key] of [[0, 'overworld'], [1, 'the_nether'], [2, 'the_end']]) {
    rows.push(score('sea' + i, 'seaLevel.' + key));
    rows.push(over('sea' + i, 'seaLevel.' + key));
  }
  rows.push('execute if score $cfg.sea0 ' + NS + ' matches ..-1000 run scoreboard players set $cfg.sea0 ' + NS + ' 63');
  rows.push('execute if score $cfg.sea1 ' + NS + ' matches ..-1000 run scoreboard players set $cfg.sea1 ' + NS + ' 32');
  rows.push('execute if score $cfg.sea2 ' + NS + ' matches ..-1000 run scoreboard players set $cfg.sea2 ' + NS + ' 0');
  rows.push('');
  rows.push('# --- v4.19：**每个维度各存一份**世界下界（取点回退 pos/band_fallback 的均匀分布下界；check/sealevel 按 $snap.dim 取）');
  for (const [i, key] of [[0, 'overworld'], [1, 'the_nether'], [2, 'the_end']]) {
    rows.push(score('floor' + i, 'floorY.' + key));
    rows.push(over('floor' + i, 'floorY.' + key));
  }
  F['data/' + NS + '/function/cfg/apply.mcfunction'] = rows.join(LF) + LF;
}

// ---------------------------------------------------------------- 密度控制（v4.6）
F['data/' + NS + '/function/ctrl/tick.mcfunction'] = `# ${NS}:ctrl/tick —— 每分钟结算一次密度目标（由 core/tick 每 tick 调用）
scoreboard players add $ctrl.t ${NS} 1
scoreboard players operation $ctrl.t ${NS} %= #1200 ${NS}
execute if score $ctrl.t ${NS} matches 0 run function ${NS}:ctrl/settle
`;

F['data/' + NS + '/function/ctrl/settle.mcfunction'] = `# ${NS}:ctrl/settle —— 结算上一分钟的生成数与目标，AIMD 调 $eff.batch
# 本分钟生成数 = $spawned.total（累积、不被 reject_report 清零）之差
scoreboard players operation $ctrl.now ${NS} = $spawned.total ${NS}
scoreboard players operation $ctrl.now ${NS} -= $ctrl.last ${NS}
scoreboard players operation $ctrl.last ${NS} = $spawned.total ${NS}
execute if score $density ${NS} matches 1.. run function ${NS}:ctrl/aimd
`;

F['data/' + NS + '/function/ctrl/aimd.mcfunction'] = `# ${NS}:ctrl/aimd —— 低于目标就加批、超目标 25% 就减批（batch ∈ [1,40]）
execute if score $ctrl.now ${NS} < $density ${NS} if score $eff.batch ${NS} < $ctrl.maxBatch ${NS} run scoreboard players add $eff.batch ${NS} 1
scoreboard players operation $ctrl.hi ${NS} = $density ${NS}
scoreboard players operation $ctrl.hi ${NS} *= #5 ${NS}
scoreboard players operation $ctrl.hi ${NS} /= #4 ${NS}
# 超目标：按比例一步收缩（一分钟只降 1 会爬得太慢）
scoreboard players operation $ctrl.new ${NS} = $eff.batch ${NS}
scoreboard players operation $ctrl.new ${NS} *= $density ${NS}
execute if score $ctrl.now ${NS} matches 1.. if score $ctrl.now ${NS} > $ctrl.hi ${NS} run scoreboard players operation $ctrl.new ${NS} /= $ctrl.now ${NS}
execute if score $ctrl.new ${NS} matches ..0 run scoreboard players set $ctrl.new ${NS} 1
execute if score $ctrl.now ${NS} > $ctrl.hi ${NS} run scoreboard players operation $eff.batch ${NS} = $ctrl.new ${NS}
`;

F['data/' + NS + '/function/debug/density.mcfunction'] = `# ${NS}:debug/density —— 看密度控制现状（聊天栏 + 服务器日志）
execute store result storage ${NS}:rep density int 1 run scoreboard players get $density ${NS}
execute store result storage ${NS}:rep batch int 1 run scoreboard players get $eff.batch ${NS}
execute store result storage ${NS}:rep period int 1 run scoreboard players get $eff.period ${NS}
execute store result storage ${NS}:rep perMin int 1 run scoreboard players get $ctrl.now ${NS}
execute store result storage ${NS}:rep cap int 1 run scoreboard players get $cap.monster ${NS}
function ${NS}:debug/say_density with storage ${NS}:rep
tellraw @a [{"text":"[density] ","color":"dark_gray"},{"text":"目标/分钟=","color":"gray"},{"score":{"name":"$density","objective":"${NS}"},"color":"white"},{"text":"  上一分钟=","color":"gray"},{"score":{"name":"$ctrl.now","objective":"${NS}"},"color":"white"},{"text":"  batch=","color":"gray"},{"score":{"name":"$eff.batch","objective":"${NS}"},"color":"aqua"},{"text":"  period=","color":"gray"},{"score":{"name":"$eff.period","objective":"${NS}"},"color":"aqua"}]
`;

F['data/' + NS + '/function/debug/say_density.mcfunction'] = `# ${NS}:debug/say_density [MACRO] —— 打进服务器日志（无真人也能采）
$say [density] 目标/分钟=$(density) 上一分钟=$(perMin) batch=$(batch) period=$(period) cap.monster=$(cap)
`;
F['data/' + NS + '/function/core/tick.mcfunction'] = `# ${NS}:core/tick —— 每 tick
scoreboard players add $t ${NS} 1

# 快照节拍：默认 20 tick 一次（$snap_period 可覆盖）
execute unless score $snap_period ${NS} matches 1.. run scoreboard players set $snap_period ${NS} 20
scoreboard players operation $snap_phase ${NS} = $t ${NS}
scoreboard players operation $snap_phase ${NS} %= $snap_period ${NS}
execute if score $snap_phase ${NS} matches 0 run function ${NS}:circ/snapshot

# v4.27 容量计数拆拍（P0 性能）：21 条整图盒式选择器不再挤在快照那一拍，摊到 20 拍内每拍 1~2 条
#   （真机实测：修前那 1 Hz 的一拍 ≈820ms ⇒ P95≈940ms / avg≈51ms / tps 18.7；拆开后峰值 ≈41ms/拍）。
#   相位**固定 20 拍、与 $snap_period 解耦**：冻结快照时计数照样 1 Hz 刷新（多个 verify_* 的前提就是冻结节拍）。
#   执行上下文与修前一致（优先玩家所在维度），整图盒式选择器的语义不变。
scoreboard players add $cap_phase ${NS} 1
execute if score $cap_phase ${NS} matches 20.. run scoreboard players set $cap_phase ${NS} 0
execute at @a[gamemode=!spectator,limit=1] run function ${NS}:check/caps_scan
execute unless entity @a[gamemode=!spectator] run function ${NS}:check/caps_scan

# 刷怪节拍：与情形生效参数联动（$eff.period 由 circ/apply 在快照里写入）
# 密度控制（每分钟结算一次；$density=0 时只是空转）
function ${NS}:ctrl/tick

scoreboard players add $spawn_t ${NS} 1
scoreboard players operation $spawn_t ${NS} %= $eff.period ${NS}
execute if score $spawn_t ${NS} matches 0 run function ${NS}:spawn/batch

# 消失节拍：每 $despawn_period tick 遍历一次（参数在 despawn/setup 里）
scoreboard players add $despawn_t ${NS} 1
scoreboard players operation $despawn_t ${NS} %= $despawn_period ${NS}
execute if score $despawn_t ${NS} matches 0 run function ${NS}:despawn/tick
${RIG_TICK}`;

// ---------------------------------------------------------------- 情形引擎：快照
F['data/' + NS + '/function/circ/snapshot.mcfunction'] = `# ${NS}:circ/snapshot —— 采集环境快照（情形判定与 debug 的共同基础）
#
# 为什么要"实测"而不是估算：
#   原版 mobcap 的关键量 spawnableChunkCount 取决于**实际加载状态**，而加载状态由
#   view-distance / simulation-distance / 玩家分布共同决定 —— 这是单人与服务器差别的根源。
#   数据包能直接问游戏：\`execute if loaded <pos>\`，所以这里对每个玩家 17×17 区块逐一实测。

# 1. 玩家数（非旁观）
scoreboard players set $snap.players ${NS} 0
execute store result score $snap.players ${NS} if entity @a[gamemode=!spectator]

# 2. 天气：0=晴 1=雨 2=雷暴
scoreboard players set $snap.weather ${NS} 0
execute if predicate ${NS}:weather/rain run scoreboard players set $snap.weather ${NS} 1
execute if predicate ${NS}:weather/thunder run scoreboard players set $snap.weather ${NS} 2

# 3. 时间与月相（月相 = (daytime / 2400) % 8）
execute store result score $snap.daytime ${NS} run time query daytime
scoreboard players operation $snap.phase ${NS} = $snap.daytime ${NS}
scoreboard players operation $snap.phase ${NS} /= #2400 ${NS}
scoreboard players operation $snap.phase ${NS} %= #8 ${NS}

# 4. 维度：0=主世界 1=下界 2=末地
#    v4.14 修正：必须**在玩家位置**判定。core/tick 由 tick 函数标签调用，执行上下文是世界出生点
#    （永远在主世界）⇒ 老写法在玩家进下界后仍然把 $snap.dim 判成 0，下界的海平面/光照档全都用错。
execute at @a[gamemode=!spectator,limit=1] run function ${NS}:circ/detect_dim
execute unless entity @a[gamemode=!spectator] run scoreboard players set $snap.dim ${NS} 0

# 4b. 配置层：按当前维度折算 $cfg.*（必须在 dim 探测之后、容量与情形之前）
function ${NS}:cfg/apply

# 5. 已加载区块数（玩家 17×17 范围，逐一实测；多玩家取并集需按玩家分别扫描）
scoreboard players set $snap.chunks ${NS} 0
execute at @a[gamemode=!spectator,limit=1] run function ${NS}:circ/scan_chunks

# 6. 派生量：先把情形叠加成生效参数，再算容量（容量依赖 $eff.max.<cat>），最后缓存群系
# 顺序很重要：先判定情形（写 $circ.*），再叠加生效参数（读 $circ.* → $eff.*），最后算容量（读 $eff.max.*）
function ${NS}:circ/eval
function ${NS}:circ/apply
function ${NS}:check/sealevel
# v4.14d：容量计数必须在**玩家所在维度**里做（原版 SpawnState 是 per-level 的；
#   core/tick 的执行上下文在世界出生点 ⇒ 不加这一层就会拿主世界的生物数去卡下界的额度）
# v4.27：这里只算**容量公式**（纯算术）；21 条整图盒式选择器已拆到 core/tick → check/caps_scan，
#   每拍只跑当拍那一组（原来是 1 Hz 一次性全扫 ≈820ms ⇒ P95≈940ms 的尖峰来源）。
execute at @a[gamemode=!spectator,limit=1] run function ${NS}:check/caps_formula
execute unless entity @a[gamemode=!spectator] run function ${NS}:check/caps_formula
execute at @a[gamemode=!spectator,limit=1] run function ${NS}:biome/detect
# 玩家层（蝙蝠规则要低于地表，用玩家位置近似）与月相亮度（八分制 0..8，史莱姆规则要用）
execute store result score $snap.py ${NS} run data get entity @a[gamemode=!spectator,limit=1] Pos[1]
# 月相亮度（八分制）：相位 0..7 → 8,6,4,2,0,2,4,6（0=满月最亮、4=新月最暗）
scoreboard players set $snap.moon ${NS} 0
execute if score $snap.phase ${NS} matches 0 run scoreboard players set $snap.moon ${NS} 8
execute if score $snap.phase ${NS} matches 1 run scoreboard players set $snap.moon ${NS} 6
execute if score $snap.phase ${NS} matches 2 run scoreboard players set $snap.moon ${NS} 4
execute if score $snap.phase ${NS} matches 3 run scoreboard players set $snap.moon ${NS} 2
execute if score $snap.phase ${NS} matches 4 run scoreboard players set $snap.moon ${NS} 0
execute if score $snap.phase ${NS} matches 5 run scoreboard players set $snap.moon ${NS} 2
execute if score $snap.phase ${NS} matches 6 run scoreboard players set $snap.moon ${NS} 4
execute if score $snap.phase ${NS} matches 7 run scoreboard players set $snap.moon ${NS} 6
# 7. 被动生物节拍：源码判定 **gameTime** % 400 == 0（ServerChunkCache.tickChunks）
#    v4.14 修正：早期版本用 time query daytime —— 那是"一天内的时刻"，在 doDaylightCycle=false 或 /time set 之后
#    会与 gameTime 脱钩，导致被动生物节拍卡死。现在用 time query gametime（core/creature_tick）。
function ${NS}:core/creature_tick
scoreboard players operation $creature_gate ${NS} = $gt ${NS}
`;

// ---------------------------------------------------------------- 维度探测（v4.14）
// v4.20（E4×E7 交叉实测修）：把"本次尝试的维度"与"快照的维度"拆开。
//   旧写法两条路径都写 $snap.dim ⇒ 忙服务器上 circ/snapshot（每 20 tick）能在一次尝试中途把它改回主世界，
//   于是末地/下界的尝试被拿**主世界的计数与容量**判定 ⇒ 跨维度容量泄漏
//   （实测：末地堆到 500 只、快照 $cap.monster=40、$rej.5 恒为 0；冻结节拍下同样数值却正确拒 r5）。
F['data/' + NS + '/function/circ/detect_dim_att.mcfunction'] = `# ${NS}:circ/detect_dim_att —— 判定**本次尝试**所在维度（写 $att.dim：0 主世界 / 1 下界 / 2 末地）
#
# 由 pos/ctx 在选中玩家（at @s）之后调用；check/cap 与 check/sealevel 读它取 per-dim 参数。
# 与 circ/detect_dim（写 $snap.dim，供快照/情形层用）**分开**，避免快照在尝试中途改写维度。
scoreboard players set $att.dim ${NS} 0
execute if dimension minecraft:the_nether run scoreboard players set $att.dim ${NS} 1
execute if dimension minecraft:the_end run scoreboard players set $att.dim ${NS} 2
`;

F['data/' + NS + '/function/circ/detect_dim.mcfunction'] = `# ${NS}:circ/detect_dim —— 判定**执行位置**所在维度（写 $snap.dim：0 主世界 / 1 下界 / 2 末地）
scoreboard players set $snap.dim ${NS} 0
execute if dimension minecraft:the_nether run scoreboard players set $snap.dim ${NS} 1
execute if dimension minecraft:the_end run scoreboard players set $snap.dim ${NS} 2
`;

// 作者手动用：在当前维度里折算配置（例如 /execute in the_nether run function doom.nats:cfg/apply_here）
F['data/' + NS + '/function/cfg/apply_here.mcfunction'] = `# ${NS}:cfg/apply_here —— 先在当前执行位置探测维度，再折算配置
# 用途：地图作者手动改完 doom.nats:config 后，想按**某个维度**复核参数时调用。
function ${NS}:circ/detect_dim
function ${NS}:cfg/apply
`;

// ---------------------------------------------------------------- 17×17 区块扫描（生成 289 行）
{
  const rows = ['# ' + NS + ':circ/scan_chunks —— 以执行位置为中心，实测 17×17 区块的加载状态（289 次判定）', ''];
  for (let dz = -8; dz <= 8; dz++) {
    for (let dx = -8; dx <= 8; dx++) {
      const x = dx === 0 ? '~' : (dx > 0 ? '~' + dx * 16 : '~-' + -dx * 16);
      const z = dz === 0 ? '~' : (dz > 0 ? '~' + dz * 16 : '~-' + -dz * 16);
      rows.push('execute positioned ' + x + ' ~ ' + z + ' if loaded ~ ~ ~ run scoreboard players add $snap.chunks ' + NS + ' 1');
    }
  }
  rows.push('');
  F['data/' + NS + '/function/circ/scan_one.mcfunction'] = rows.join(LF);

  // 两种近似模式入口（原版是各玩家 17×17 的 Chebyshev 并集；数据包做不了方形相对判定，也给不出精确并集）
  F['data/' + NS + '/function/circ/scan_chunks.mcfunction'] = `# ${NS}:circ/scan_chunks —— 产出 $snap.chunks（对齐 spawnableChunkCount）
#
# 原版定义：各玩家所在区块的 17×17（Chebyshev 距离 8 区块）之**并集**，与 view/simulation distance 无关。
# 数据包的限制：唯一能相对执行位置判定的只有欧氏 distance，无法表达方形；也无法维护"已计区块集合"。
#   精确并集需要按绝对坐标做 dx/dz 盒式判定（289 次宏/快照 + 逐玩家），代价大，暂不实现。
# 因此提供两种近似（$chunks_mode）：
#   0（默认）只扫首个玩家 ⇒ 单人精确、多人**低估**
#   1         逐玩家累加   ⇒ 单人精确、多人**高估**（重叠重复计数）

execute unless score $chunks_mode ${NS} matches 0..1 run scoreboard players set $chunks_mode ${NS} 0
scoreboard players set $snap.chunks ${NS} 0
execute if score $chunks_mode ${NS} matches 0 at @a[gamemode=!spectator,limit=1] run function ${NS}:circ/scan_one
execute if score $chunks_mode ${NS} matches 1 as @a[gamemode=!spectator] at @s run function ${NS}:circ/scan_one
`;
}

// 情形定义已抽到 tools/lib/circ-defs.mjs（注册表/判定/生效三处同源）

// ---------------------------------------------------------------- 情形注册表装载（骨架）
F['data/' + NS + '/function/circ/load.mcfunction'] = `# ${NS}:circ/load —— 装载 Circumstance 注册表
#
# 条目结构：{ when: {...}, effects: {...} }
#   when  判定维度：weather(clear|rain|thunder) · time(day|night) · phase(月相 0..7) · dim(0|1|2)
#                  · players(1|many) · yBand(min..max) · biome(标签)
#   effects 覆盖项：period · cap_<category> · lightRule · allow/deny · chargeScale
#
# 注册方式：加一条 data modify + 一行 function ${NS}:circ/eval（见 eval 的遍历表）
data modify storage ${NS}:circ reg set value {}
data modify storage ${NS}:circ active set value {}

# 示例条目（可删）：雨夜提高怪物节拍与上限
data modify storage ${NS}:circ reg.rainy_night set value {when:{weather:1,time:1},effects:{period:3,cap_monster:90}}
# 示例条目：雷暴（原版 skyDarken=10 让刷怪更容易，这里显式化）
data modify storage ${NS}:circ reg.thunder set value {when:{weather:2},effects:{period:2,cap_monster:100}}
# 示例条目：多人（per-player cap 各自独立，这里放宽全局节拍）
data modify storage ${NS}:circ reg.multiplayer set value {when:{players:2},effects:{period:4}}

scoreboard players set $circ_loaded ${NS} 1
`;

{
  const rows = [
    '# ' + NS + ':circ/eval —— 判定所有情形（由 tools/gen_pack.mjs 从 CIRC 表展开，勿手改）',
    '#',
    '# 依赖 ' + NS + ':circ/snapshot 产出的快照分数：' + DOLLAR + 'snap.weather / daytime / dim / players / phase',
    '',
  ];
  for (const c of CIRC) {
    rows.push('# ' + c.id + '：' + (c.note || ''));
    rows.push('scoreboard players set ' + DOLLAR + 'circ.' + c.id + ' ' + NS + ' 0');
    // whenToCmd 里保留 ${NS} 占位符，这里统一替换（避免与生成器自身的模板字符串冲突）
    const cmd = whenToCmd(c.when, NS);
    if (cmd) rows.push('execute ' + cmd + ' run scoreboard players set ' + DOLLAR + 'circ.' + c.id + ' ' + NS + ' 1');
    rows.push('');
  }
  F['data/' + NS + '/function/circ/eval.mcfunction'] = rows.join(LF);
}

// ---------------------------------------------------------------- debug：接 doom.log
F['data/' + NS + '/function/debug/say_env.mcfunction'] = `# ${NS}:debug/say_env [MACRO] —— 环境快照打进服务器日志（无真人玩家时也能采）
$say [nats.env] players=$(players) chunks=$(chunks) weather=$(weather) phase=$(phase) dim=$(dim)
`;
F['data/' + NS + '/function/debug/env.mcfunction'] = `# ${NS}:debug:env —— 环境探针（单/多/服务器差异一目了然，输出走 doom.log）
function ${NS}:circ/snapshot
function doom.log:dump {key:"players", message:"${NS} 快照"}
function doom.log:dump {key:"weather", message:"0=晴 1=雨 2=雷暴"}
function doom.log:dump {key:"chunks", message:"17x17 范围内已加载区块数（实测）"}
function doom.log:dump {key:"phase", message:"月相 0..7"}
function doom.log:dump {key:"dim", message:"0=主世界 1=下界 2=末地"}
# 日志通道（say 会进服务器日志；tellraw 在**无真人玩家**的专用服务器上不落盘 ⇒ 自动化采不到）
execute store result storage ${NS}:rep players int 1 run scoreboard players get $snap.players ${NS}
execute store result storage ${NS}:rep chunks int 1 run scoreboard players get $snap.chunks ${NS}
execute store result storage ${NS}:rep weather int 1 run scoreboard players get $snap.weather ${NS}
execute store result storage ${NS}:rep phase int 1 run scoreboard players get $snap.phase ${NS}
execute store result storage ${NS}:rep dim int 1 run scoreboard players get $snap.dim ${NS}
function ${NS}:debug/say_env with storage ${NS}:rep
tellraw @a [{"text":"[nats.env] ","color":"dark_gray"},{"text":"players=","color":"gray"},{"score":{"name":"$snap.players","objective":"${NS}"},"color":"white"},{"text":" chunks=","color":"gray"},{"score":{"name":"$snap.chunks","objective":"${NS}"},"color":"white"},{"text":" weather=","color":"gray"},{"score":{"name":"$snap.weather","objective":"${NS}"},"color":"white"},{"text":" phase=","color":"gray"},{"score":{"name":"$snap.phase","objective":"${NS}"},"color":"white"},{"text":" dim=","color":"gray"},{"score":{"name":"$snap.dim","objective":"${NS}"},"color":"white"}]
`;

// ---------------------------------------------------------------- 生存直用模式（v4.12）
// 用户问「能不能直接当生存数据包用」。能，但有一件事必须自动做掉：关掉原版自然生成。
// 理由：本包用 summon 造生物，**不受 doMobSpawning 约束**；若原版还开着，就是双份刷怪 ——
// 分布、容量、性能三条线会同时失控。只关自然生成，不影响刷怪笼 / 结构生成 / 繁殖 / 指令召唤。
F['data/' + NS + '/function/mode/survival.mcfunction'] = `# ${NS}:mode/survival —— 生存直用：接管原版自然生成（装载时默认执行）
gamerule doMobSpawning false
scoreboard players set $mode.manual ${NS} 0
function ${NS}:circ/snapshot
say [nats] mode/survival —— 已接管自然生成（doMobSpawning=false）
`;

F['data/' + NS + '/function/mode/manual.mcfunction'] = `# ${NS}:mode/manual —— 以后装载不再自动改 gamerule（交由玩家/地图自己管）
scoreboard players set $mode.manual ${NS} 1
say [nats] mode/manual —— 本包不再自动改 doMobSpawning（请自行确认原版自然生成已关，否则会双份刷怪）
`;

F['data/' + NS + '/function/mode/off.mcfunction'] = `# ${NS}:mode/off —— 退场：静默清掉本包生物，并把原版自然生成还回去
function ${NS}:debug/clear
gamerule doMobSpawning true
say [nats] mode/off —— 已静默清场并把自然生成还给原版
`;

F['data/' + NS + '/function/mode/auto.mcfunction'] = `# ${NS}:mode/auto —— 恢复默认（装载时自动接管）
scoreboard players set $mode.manual ${NS} 0
function ${NS}:mode/survival
`;

// ---------------------------------------------------------------- 谓词
F['data/' + NS + '/predicate/weather/rain.json'] = j({ condition: 'minecraft:weather_check', raining: true });
F['data/' + NS + '/predicate/weather/thunder.json'] = j({ condition: 'minecraft:weather_check', raining: true, thundering: true });

// ---------------------------------------------------------------- 写出 / 校验
const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const files = { ...F };
const drift = [];
for (const [rel, content] of Object.entries(files)) {
  const p = path.join(PACK, ...rel.split('/'));
  if (checkOnly) {
    const old = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (old !== content) drift.push(rel);
    continue;
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
if (checkOnly) {
  if (drift.length) { console.log('与生成器不一致:'); for (const d of drift) console.log('  -', d); process.exit(1); }
  console.log('一致：' + Object.keys(files).length + ' 个文件');
} else {
  // 289 行判定主体在 circ/scan_one（由 gen_pos.mjs 生成），不在本文件的 F 里 —— 从磁盘读，避免汇总恒为 0
  const scanFile = path.join(PACK, 'data', NS, 'function/circ/scan_one.mcfunction');
  const scan = (fs.existsSync(scanFile) ? fs.readFileSync(scanFile, 'utf8') : '').split(LF).filter((l) => l.includes('if loaded')).length;
  console.log('=== gen_pack 完成 ===');
  console.log('输出:', PACK);
  console.log('文件:', Object.keys(files).length, '| 区块扫描判定行:', scan);
  console.log('调试接入: doom.log:info / doom.log:dump · 探针 ' + NS + ':debug/env');
}
