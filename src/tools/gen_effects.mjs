// gen_effects.mjs — 生成 doom.nats（v4） 的「情形生效层」。
//
//   node tools/gen_effects.mjs [--check]
//
// 与 gen_pack.mjs 共用 tools/lib/circ-defs.mjs 的情形定义：**注册表、判定、生效三处同源**。
//
// 产出：
//   circ/apply          把当前 active 的情形叠加成生效参数（$eff.period / $eff.max.<cat> / $eff.light）
//   predicate/light/*   光照档谓词（数据包读不到亮度**数值**，只能按档位近似 —— 见 docs/09）
import fs from 'node:fs';
import path from 'node:path';
import * as PKG from './lib/packdir.mjs';
import { CIRC, DEFAULTS, effectLines } from './lib/circ-defs.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
// v4.24：产物根目录由 lib/packdir.mjs 统一解析（DOOM_EXP=1 ⇒ pack/doom.nats-experimental 实验性变体）
const PACK = PKG.PACK;
const LF = String.fromCharCode(10);
const NS = 'doom.nats';
const F = {};

// ---------------------------------------------------------------- 生效参数
{
  const rows = [
    '# ' + NS + ':circ/apply —— 把当前 active 的情形叠加成生效参数（由 tools/gen_effects.mjs 生成，勿手改）',
    '#',
    '# 顺序即优先级：先写默认值（= 原版语义），再按 CIRC 表的顺序逐条覆盖，后注册者优先。',
    '# 这些 $eff.* 是生成端唯一读取的参数源：core/tick 读 $eff.period，check/caps 读 $eff.max.<cat>，',
    '# check/light 读 $eff.light。情形不生效时即为原版行为。',
    '',
    '# ---- 默认值（原版语义）',
  ];
  // v4.14：默认值改为从 $cfg.*（配置层）取，不再写死；情形仍可覆盖
  const fromCfg = { period: 'period', max_monster: 'cap_monster', max_creature: 'cap_creature', max_ambient: 'cap_ambient', max_water_creature: 'cap_water_creature', max_water_ambient: 'cap_water_ambient', max_underground_water_creature: 'cap_underground_water_creature', max_axolotls: 'cap_axolotls', light: 'light', creature_gate: 'creature_gate' };
  for (const [key, cfgKey] of Object.entries(fromCfg)) {
    rows.push('scoreboard players operation $eff.' + key + ' ' + NS + ' = $cfg.' + cfgKey + ' ' + NS);
  }
  rows.push('# 兜底：配置层没写（=0）时用原版默认，避免整包静默不刷怪');
  rows.push('execute unless score $eff.period ' + NS + ' matches 1.. run scoreboard players set $eff.period ' + NS + ' ' + DEFAULTS.period);
  rows.push('execute unless score $eff.max_monster ' + NS + ' matches 1.. run scoreboard players set $eff.max_monster ' + NS + ' ' + DEFAULTS.max_monster);
  rows.push('execute unless score $eff.max_creature ' + NS + ' matches 1.. run scoreboard players set $eff.max_creature ' + NS + ' ' + DEFAULTS.max_creature);
  rows.push('execute unless score $eff.max_ambient ' + NS + ' matches 1.. run scoreboard players set $eff.max_ambient ' + NS + ' ' + DEFAULTS.max_ambient);
  rows.push('execute unless score $eff.light ' + NS + ' matches 0.. run scoreboard players set $eff.light ' + NS + ' ' + DEFAULTS.lightRule);
  rows.push('');
  for (const c of CIRC) {
    rows.push('# ---- ' + c.id + '：' + (c.note || ''));
    rows.push(...effectLines(c, NS));
    rows.push('');
  }
  F['data/' + NS + '/function/circ/apply.mcfunction'] = rows.join(LF);
}

// ---------------------------------------------------------------- 光照档谓词
// 原版是"综合亮度 <= monsterSpawnLightTest().sample(random)"：主世界/末地 uniform(0..7)、下界常量 7。
// 数据包的谓词只能判定区间、读不到数值，因此做成**档位**，由 $eff.light 选择。
for (const max of [0, 3, 7, 8, 11, 15]) {   // v4.13 补 8：PatrollingMonster 的方块光 ≤ 8 近似
  F['data/' + NS + '/predicate/light/tier_' + max + '.json'] = JSON.stringify({
    condition: 'minecraft:location_check',
    predicate: { light: { light: { max } } },
  }, null, 2) + LF;
}

// ---------------------------------------------------------------- 光照判定：按档位选择
F['data/' + NS + '/function/check/light.mcfunction'] = `# ${NS}:check/light —— 光照判定（reason=3，按 $sel.light 分派）
#
# v4.13 关键修正：光照要求是**逐实体**的，不是全局的。
#   之前所有物种共用一档（默认 7）⇒ 动物同时被要求"亮 ≥ 9（check/block）**且**暗 ≤ 7"，永远刷不出来。
#   现在按实体规则里的 light 字段分派（表见 tools/lib/entity-rules.mjs）：
#     0 none   无光照要求（岩浆怪/恶魂/猪灵族/豹猫/炽足兽/水生…）
#     1 dark   综合亮度 ≤ $eff.light 档（Monster.isDarkEnoughToSpawn 的档位近似）
#     2 bright 亮度 ≥ 9 或能看到天空（Animal.isBrightEnoughToSpawn = getRawBrightness(pos,0) > 8 的近似）
#     3 bat    亮度 ≤ 3（万圣节 7；50% 掷币在 check/entity）
#     4 slime  亮度 ≤ 7（原版是 ≤ nextInt(8) 的采样比较；50% 与月相在 check/entity）
#     5 glow   亮度必须为 0（GlowSquid.checkGlowSquidSpawnRules）
#     6 bl8    方块光 ≤ 8 的近似（PatrollingMonster.checkPatrollingMonsterSpawnRules）
scoreboard players set $chk.lighttier ${NS} 7
execute if score $eff.light ${NS} matches 0 run scoreboard players set $chk.lighttier ${NS} 0
execute if score $eff.light ${NS} matches 1..3 run scoreboard players set $chk.lighttier ${NS} 3
execute if score $eff.light ${NS} matches 4..7 run scoreboard players set $chk.lighttier ${NS} 7
execute if score $eff.light ${NS} matches 8..11 run scoreboard players set $chk.lighttier ${NS} 11
execute if score $eff.light ${NS} matches 12.. run scoreboard players set $chk.lighttier ${NS} 15

execute if score $sel.light ${NS} matches 1 if score $chk.lighttier ${NS} matches 0 unless predicate ${NS}:light/tier_0 run function ${NS}:debug/light_fail {tier:0}
execute if score $sel.light ${NS} matches 1 if score $chk.lighttier ${NS} matches 3 unless predicate ${NS}:light/tier_3 run function ${NS}:debug/light_fail {tier:3}
execute if score $sel.light ${NS} matches 1 if score $chk.lighttier ${NS} matches 7 unless predicate ${NS}:light/tier_7 run function ${NS}:debug/light_fail {tier:7}
execute if score $sel.light ${NS} matches 1 if score $chk.lighttier ${NS} matches 11 unless predicate ${NS}:light/tier_11 run function ${NS}:debug/light_fail {tier:11}
execute if score $sel.light ${NS} matches 1 if score $chk.lighttier ${NS} matches 15 unless predicate ${NS}:light/tier_15 run function ${NS}:debug/light_fail {tier:15}

execute if score $sel.light ${NS} matches 2 unless predicate ${NS}:spawn/bright_enough run function ${NS}:debug/light_fail {tier:9}
execute if score $sel.light ${NS} matches 3 unless predicate ${NS}:light/tier_3 run function ${NS}:debug/light_fail {tier:3}
execute if score $sel.light ${NS} matches 4 unless predicate ${NS}:light/tier_7 run function ${NS}:debug/light_fail {tier:7}
execute if score $sel.light ${NS} matches 5 unless predicate ${NS}:light/tier_0 run function ${NS}:debug/light_fail {tier:0}
execute if score $sel.light ${NS} matches 6 unless predicate ${NS}:light/tier_8 run function ${NS}:debug/light_fail {tier:8}
`;

// ---------------------------------------------------------------- 光照失败档位计数（调试，不改生成语义）
// 只有"没通过"时才多一次宏调用；失败链本身仍走 check/fail {reason:3}，因此统计不会影响合法性链的顺序。
F['data/' + NS + '/function/debug/light_fail.mcfunction'] = `# ${NS}:debug/light_fail [MACRO] —— 记录失败档位（$lit.<tier>），再走 reason=3 的失败链
$scoreboard players add $lit.$(tier) ${NS} 1
function ${NS}:check/fail {reason:3}
`;

// ---------------------------------------------------------------- 写出
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
  console.log('=== gen_effects 完成 ===');
  console.log('输出:', PACK, '| 文件:', Object.keys(F).length, '（apply + 5 个光照档 + light 判定）');
  console.log('生效参数默认值:', JSON.stringify(DEFAULTS));
}
