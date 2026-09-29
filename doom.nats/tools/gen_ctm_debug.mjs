// gen_ctm_debug.mjs — 生成 CTM 版 doom.nats 的「诊断模式」（dryrun）。
//
//   node tools/gen_ctm_debug.mjs [--check]
//
// 动机：真机验证时最怕"跑了 spawn/try 却什么都没发生，也看不出为什么"。
// dryrun 不生成任何实体，只走一遍完整判定链并把每一步的结果打出来（同时进 doom.log 的 [dump]，
// 便于 collect.mjs 采集），因此能直接定位是光照档、落位标签、容量还是抽点的问题。
import fs from 'node:fs';
import path from 'node:path';
import * as PKG from './lib/packdir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
// v4.24：产物根目录由 lib/packdir.mjs 统一解析（DOOM_EXP=1 ⇒ v4x/doom.nats 实验性变体）
const PACK = PKG.PACK;
const LF = String.fromCharCode(10);
const NS = 'doom.nats';
const F = {};

// ---------------------------------------------------------------- 入口
F['data/' + NS + '/function/debug/dryrun.mcfunction'] = `# ${NS}:debug/dryrun —— 诊断模式：走完整判定链但不生成实体
#
# 用法：/function ${NS}:debug/dryrun
# 先抽点，再跳到那个点逐步判定，最后把每步结果打印出来（并写进 doom.log 的 [dump]）。
function doom.log:info {message:"${NS} dryrun：抽点 → 距离 → 群系 → 选物种 → 光照 → 落位 → 容量"}
function ${NS}:pos/pick
function doom.log:dump {key:"pos.ok", message:"1=抽到合格区块 0=没抽到（区块未加载）"}
execute if score $pos.ok ${NS} matches 1 run function ${NS}:debug/dryrun_at with storage ${NS}:pos
execute if score $pos.ok ${NS} matches 0 run tellraw @a [{"text":"[dryrun] ","color":"gold"},{"text":"抽不到合格区块 —— 检查玩家周围 17x17 是否已加载（/function ${NS}:debug/env 看 chunks）","color":"red"}]
`;

// ---------------------------------------------------------------- 跳到抽到的点
F['data/' + NS + '/function/debug/dryrun_at.mcfunction'] = `# ${NS}:debug/dryrun_at [MACRO] —— 跳到抽到的候选点
$execute positioned $(x) $(y) $(z) run function ${NS}:debug/dryrun_check
`;

// ---------------------------------------------------------------- 逐步判定 + 打印
F['data/' + NS + '/function/debug/dryrun_check.mcfunction'] = `# ${NS}:debug/dryrun_check —— 在候选点逐步判定并打印（复用生产用的 check/*，不另写一套）
scoreboard players set $chk.ok ${NS} 1
scoreboard players set $chk.reason ${NS} 0

# ⓪ v4.22：先刷新"本次尝试的维度"$att.dim —— debug 路径不走 spawn/try_at（那条链由 pos/ctx 刷新），
#   不刷的话 check/cap 会拿**上一次尝试/上一个维度**的 $cnt.<cat> 去比容量（实测：下界脚本跑完后
#   在只刷新了一次的主世界直接跑 dryrun，容量门读的是下界计数 ⇒ 报 r5 假红）。
function ${NS}:circ/detect_dim_att

# ① 距离：24 格内有人就拒（对齐 distSq <= 576）
execute if entity @a[gamemode=!spectator,distance=..24] run function ${NS}:check/fail {reason:1}

# ② 群系探测 + 选物种（对齐 getRandomSpawnMobAt 的位置：在距离检查之后、合法性之前）
execute at @s run function ${NS}:biome/detect
scoreboard players set $sel.ok ${NS} 0
execute if score $chk.ok ${NS} matches 1 run function ${NS}:biome/dispatch
execute if score $chk.ok ${NS} matches 1 unless score $sel.ok ${NS} matches 1 run scoreboard players set $chk.ok ${NS} 0

# ③ 落位：三处方块判定分别记分，便于看出是哪一处不过
scoreboard players set $dr.at ${NS} 0
scoreboard players set $dr.above ${NS} 0
scoreboard players set $dr.below ${NS} 0
execute if block ~ ~ ~ #${NS}:spawnable_at run scoreboard players set $dr.at ${NS} 1
execute if block ~ ~1 ~ #${NS}:spawnable_at run scoreboard players set $dr.above ${NS} 1
execute if block ~ ~-1 ~ #${NS}:standable run scoreboard players set $dr.below ${NS} 1
execute if score $dr.at ${NS} matches 0 run function ${NS}:check/fail {reason:4}
execute if score $chk.ok ${NS} matches 1 if score $dr.above ${NS} matches 0 run function ${NS}:check/fail {reason:4}
execute if score $chk.ok ${NS} matches 1 if score $dr.below ${NS} matches 0 run function ${NS}:check/fail {reason:4}

# ④ 光照与容量（这两步依赖前面的结果，放在最后跑）
execute if score $chk.ok ${NS} matches 1 run function ${NS}:check/light
execute if score $chk.ok ${NS} matches 1 run function ${NS}:check/cap with storage ${NS}:sel

# ⑤ 汇总打印（同时进 doom.log 供 collect.mjs 采集）
function doom.log:dump {key:"chk.ok", message:"1=全部通过（就会生成）0=被某一步拒了"}
function doom.log:dump {key:"chk.reason", message:"0抽点 1距离24 2出128 3光照 4落位方块 5全局容量 6本地容量"}
function doom.log:dump {key:"sel.ok", message:"1=该位置有可选物种"}
function doom.log:dump {key:"dr.block", message:"at/above/below：三处方块判定（1=通过）"}
tellraw @a [{"text":"[dryrun] ","color":"gold"},{"text":"ok=","color":"gray"},{"score":{"name":"$chk.ok","objective":"${NS}"},"color":"white"},{"text":" reason=","color":"gray"},{"score":{"name":"$chk.reason","objective":"${NS}"},"color":"white"},{"text":" 物种=","color":"gray"},{"nbt":"type","storage":"${NS}:sel","color":"aqua"},{"text":" 类别=","color":"gray"},{"nbt":"cat","storage":"${NS}:sel","color":"aqua"}]
tellraw @a [{"text":"[dryrun] ","color":"gold"},{"text":"落位 at/above/below = ","color":"gray"},{"score":{"name":"$dr.at","objective":"${NS}"},"color":"white"},{"text":"/","color":"gray"},{"score":{"name":"$dr.above","objective":"${NS}"},"color":"white"},{"text":"/","color":"gray"},{"score":{"name":"$dr.below","objective":"${NS}"},"color":"white"},{"text":"   光照档=","color":"gray"},{"score":{"name":"$chk.lighttier","objective":"${NS}"},"color":"white"},{"text":"  计数/上限=","color":"gray"},{"score":{"name":"$cnt.monster","objective":"${NS}"},"color":"white"},{"text":"/","color":"gray"},{"score":{"name":"$cap.monster","objective":"${NS}"},"color":"white"}]
`;

// ---------------------------------------------------------------- 清理机制（v4.11）
F['data/' + NS + '/function/debug/clear.mcfunction'] = `# ${NS}:debug/clear —— 清掉本包生成的全部生物（静默移除，无掉落/经验）
#
# 与 /kill @e[tag=…] 的区别：kill 会掉战利品并触发死亡逻辑（僵尸烧掉、掉落物进世界），
# 而清理/消失应当用 discard 语义 —— 这里统一走 ${NS}:util/void_kill（丢出世界）。
# 保留 doom.nats.persistent（被标记持久的生物不会被清）。
scoreboard players set $clear.n ${NS} 0
execute as @e[tag=${NS}.spawned,tag=!${NS}.persistent,nbt=!{PersistenceRequired:true},limit=2000] run scoreboard players add $clear.n ${NS} 1
execute as @e[tag=${NS}.spawned,tag=!${NS}.persistent,nbt=!{PersistenceRequired:true},limit=2000] unless data entity @s Passengers at @s unless data entity @s Passengers run function ${NS}:util/void_kill
# 掉落物：只清本包生物掉的东西（用标签区分不了，默认不动 —— 需要时用 parameter）
execute store result storage ${NS}:rep n int 1 run scoreboard players get $clear.n ${NS}
function ${NS}:debug/say_clear with storage ${NS}:rep
tellraw @a [{"text":"[nats] 已静默清理本包生物：","color":"gray"},{"score":{"name":"$clear.n","objective":"${NS}"},"color":"white"},{"text":" 只（无掉落）","color":"gray"}]
`;

F['data/' + NS + '/function/debug/say_clear.mcfunction'] = `# ${NS}:debug/say_clear [MACRO] —— 打进服务器日志
$say [nats.clear] 已静默清理 $(n) 只（void_kill，无掉落）
`;
// ---------------------------------------------------------------- 一条命令全跑（真机验证入口）
F['data/' + NS + '/function/debug/all.mcfunction'] = `# ${NS}:debug/all —— 真机验证入口：一次跑完环境 / 注册表 / 诊断 / 归因 / 消失 五项
function ${NS}:debug/env
function ${NS}:debug/mobs
function ${NS}:debug/dryrun
function ${NS}:debug/reject_report
function ${NS}:debug/despawn_report
`;

const checkOnly = process.argv.slice(2).includes('--check');
const drift = [];
for (const [rel, content] of Object.entries(F)) {
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
  console.log('一致：' + Object.keys(F).length + ' 个文件');
} else {
  console.log('=== gen_ctm_debug 完成 ===');
  console.log('输出:', PACK, '| 文件:', Object.keys(F).length, '（dryrun / dryrun_at / dryrun_check / all）');
}
