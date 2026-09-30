// gen_author.mjs —— 生成「运行时刻作者层」（v4.24 · 稳定面）：storage `doom.nats:author`。
//
//   node tools/gen_author.mjs [--check]           # 默认变体（pack/doom.nats）
//   DOOM_EXP=1 node tools/gen_author.mjs [--check] # 实验性变体（pack/doom.nats-experimental）
//
// 契约（SPEC-运行时作者层.md）：
//   · 本生成器**无条件**产出一套通用派发函数；**storage 为空时它们全部被守卫挡住**，
//     行为与"没有这一层"完全一致（由 _work/verify_author_runtime.mjs 的空层断言把守）。
//   · 只有**稳定面**能力在这里：逐实体补丁（belowAny / Y 窗口 / 亮度窗口 / 天气门 / 群系名单 /
//     place / light / persist）、条件条目、组大小与容量随 Y。
//   · 非原版能力（near 关系条件 / on_spawn 演出 / preset 预设）一律在**实验性层** `doom.nats:exp`
//     （见 tools/gen_exp.mjs 与 lib/author-runtime.mjs 的 exp 分支）。
//
// 判据谓词（亮度阶梯 + 天气门）是本层与实验性层的**共同基础**，放在这里生成：
//   亮度只能通过 `location_check.light` 谓词读，运行时刻用宏拼谓词 id 选中一档。
import fs from 'node:fs';
import path from 'node:path';
import { PACK, EXP } from './lib/packdir.mjs';
import { buildLayer } from './lib/author-runtime.mjs';

const LF = String.fromCharCode(10);
const NS = 'doom.nats';
const ROOT = path.resolve(import.meta.dirname, '..');
const GEN = path.join(ROOT, '_work', 'generated');
const F = {};

// ---- 判据谓词：亮度阶梯 0..15 + 天气门（any/clear/rain/thunder）----
{
  const j = (o) => JSON.stringify(o, null, 2) + LF;
  for (let n = 0; n <= 15; n++) {
    F['data/' + NS + '/predicate/author/run/light_le_' + n + '.json'] = j({ condition: 'minecraft:location_check', predicate: { light: { light: { max: n } } } });
    F['data/' + NS + '/predicate/author/run/light_ge_' + n + '.json'] = j({ condition: 'minecraft:location_check', predicate: { light: { light: { min: n } } } });
  }
  F['data/' + NS + '/predicate/author/run/weather_any.json'] = j({
    note: '恒真：任何天气都通过（= 没有天气门）',
    condition: 'minecraft:any_of',
    terms: [
      { condition: 'minecraft:weather_check', raining: true },
      { condition: 'minecraft:inverted', term: { condition: 'minecraft:weather_check', raining: true } },
    ],
  });
  F['data/' + NS + '/predicate/author/run/weather_clear.json'] = j({ condition: 'minecraft:weather_check', raining: false, thundering: false });
  F['data/' + NS + '/predicate/author/run/weather_rain.json'] = j({ condition: 'minecraft:weather_check', raining: true });
  F['data/' + NS + '/predicate/author/run/weather_thunder.json'] = j({ condition: 'minecraft:weather_check', raining: true, thundering: true });
}

// ---- 运行时刻层的函数（公共构建器）----
const mobsDoc = JSON.parse(fs.readFileSync(path.join(GEN, 'mobs.json'), 'utf8'));
const SLUGS = Object.entries(mobsDoc.mobs).map(([slug, m]) => [slug, m.type]).sort((a, b) => (a[1] < b[1] ? -1 : 1));
Object.assign(F, buildLayer({
  dir: 'author',
  title: '运行时刻作者层',
  storage: 'doom.nats:author',
  scratch: 'doom.nats:author_rt',
  input: 'doom.nats:author_in',
  score: '$auth',
  tagPrefix: 'doom.nats.author.',
  exp: false,
  entryIds: [],
  slugs: SLUGS,
}));

// ---- 写出 ----
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
  if (drift.length) { console.log('与生成器不一致 (' + drift.length + '):'); for (const d of drift.slice(0, 8)) console.log('  -', d); process.exit(1); }
  console.log('一致：' + Object.keys(F).length + ' 个文件');
} else {
  console.log('=== gen_author 完成（' + (EXP ? '实验性变体' : '默认变体') + '）===');
  console.log('输出:', PACK, '| 文件:', Object.keys(F).length);
  console.log('storage ' + NS + ':author（entityRules / entries / counts）· 判据谓词 ' + Object.keys(F).filter((k) => k.includes('/predicate/author/run/')).length + ' 个');
  console.log('派发链: mob/biome 命中行 → author/row → check/{block,entity,cap} → author/{below,biome,rule,cap}_* · spawn/emit → author/emit_rt');
}
