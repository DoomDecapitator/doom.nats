// _work/verify_author_rules.mjs —— 作者规则层（v4.23）真机验收：四个用例的 A/B 探针
//
//   RCON_PORT=25581 node _work/verify_author_rules.mjs --expect default|author
//
// 前置：隔离实例在跑（默认 25581 = _work/mcserver-fid），且**已经装好对应变体**的 doom.nats：
//   default ⇒ 仓库默认产物（rules/ 为空）；author ⇒ DOOM_RULES=rules/examples/full 生成的产物
//
// 为什么用"探针 + 固定 $rng"而不是等随机刷怪：本层改的是**判定与权重**，用固定 $rng / $py
//   可以精确断言"命中哪一条、退掉了哪一步"，而等随机要几分钟且结论弱。所有探针都调**产物里的真函数**
//   （mob/biome/**、check/block、check/light、check/entity），不重算语义。
//
// 踩坑记录（都踩过）：
//   · `data get storage` 的 SNBT 是 `key: value`（冒号后有空格）⇒ 正则要容错，否则一律 NaN；
//   · 注册表不能用 `data get storage doom.nats:mobs minecraft:zombie` 读（路径匹配不到），
//     规则 id 一律从**真分发表**里拿（调一行 → 读 `$sel.rule`）；
//   · 宏行（$ 开头）必须有 $(name) 占位符，否则整函数加载失败（lint L12）。
import fs from 'node:fs';
import { R } from './_root.mjs';
import { openRcon } from '../doom.nats/tools/mcrcon.mjs';

const EXPECT = (process.argv.includes('--expect') ? process.argv[process.argv.indexOf('--expect') + 1] : 'author');
const NS = 'doom.nats';
const LOG = process.env.MC_LOG || R('_work/mcserver-fid/logs/latest.log');
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail: String(detail) }); console.log((pass ? '✅ ' : '❌ ') + name + '  ' + detail); };

const r = await openRcon();
const cmd = async (c) => String(await r.send(c)).trim();
const score = async (h) => { const m = /has (-?\d+)/.exec(await cmd(`scoreboard players get ${h} ${NS}`)); return m ? Number(m[1]) : NaN; };
const set = (h, v) => cmd(`scoreboard players set ${h} ${NS} ${v}`);
const selNum = async (k) => { const m = new RegExp(k + ':\\s*(-?\\d+)').exec(await cmd(`data get storage ${NS}:sel`)); return m ? Number(m[1]) : NaN; };
const selStr = async (k) => { const m = new RegExp(k + ':\\s*"([^"]*)"').exec(await cmd(`data get storage ${NS}:sel`)); return m ? m[1] : ''; };

// ---------- 固定坐标的试验场（fid 是隔离副本）----------
// 建在出生点附近（那片区块本来就常驻加载；forceload 只作保险）
const LEAF = { x: -250, y: 120, z: -600 };   // 16×16 树叶台 + 四壁 + 顶 ⇒ 全黑密室
const GRASS = { x: -230, y: 120, z: -600 };  // 同上，地板是草方块（同一高度，光照条件一致）
const S = 15;                                 // 台子边长 - 1（16×16）
// 强加载 + **回读确认**（v4.22d：forceload 的区块不一定立刻 loaded；未加载时 if block 恒假）
async function blockIs(x, y, z, what) {
  const m = (() => { try { return fs.statSync(LOG).size; } catch { return 0; } })();
  await cmd(`execute if block ${x} ${y} ${z} ${what} run say VAR_BLK`);
  await sleep(300);
  const t = (() => { try { return fs.readFileSync(LOG).subarray(m).toString('utf8'); } catch { return ''; } })();
  return /VAR_BLK/.test(t);
}
async function ensureLoaded(px, py, pz) {
  await cmd('forceload add -256 -640 0 -512');
  for (let i = 0; i < 20; i++) {
    const m = (() => { try { return fs.statSync(LOG).size; } catch { return 0; } })();
    await cmd(`execute if loaded ${px} ${py} ${pz} run say VAR_LOADED_${i}`);
    await sleep(400);
    const t = (() => { try { return fs.readFileSync(LOG).subarray(m).toString('utf8'); } catch { return ''; } })();
    if (new RegExp('VAR_LOADED_' + i).test(t)) return true;
  }
  return false;
}

async function buildRigs() {
  const loaded = await ensureLoaded(LEAF.x + 8, LEAF.y + 1, LEAF.z + 8);
  if (!loaded) { console.error('❌ 试验场区块未加载 ⇒ 中止（不许静默降级）'); process.exit(3); }
  await cmd(`fill ${LEAF.x} ${LEAF.y} ${LEAF.z} ${LEAF.x + S} ${LEAF.y} ${LEAF.z + S} minecraft:oak_leaves`);
  await cmd(`fill ${GRASS.x} ${GRASS.y} ${GRASS.z} ${GRASS.x + S} ${GRASS.y} ${GRASS.z + S} minecraft:grass_block`);
  await sleep(600);
  if (!(await blockIs(LEAF.x + 8, LEAF.y, LEAF.z + 8, 'minecraft:oak_leaves')) || !(await blockIs(GRASS.x + 8, GRASS.y, GRASS.z + 8, 'minecraft:grass_block'))) {
    console.error('❌ 台子没建起来（回读失败）⇒ 中止（不许静默降级）');
    process.exit(3);
  }
  for (const B of [LEAF, GRASS]) {
    await cmd(`fill ${B.x} ${B.y + 1} ${B.z} ${B.x + S} ${B.y + 4} ${B.z + S} minecraft:air`);
    await cmd(`fill ${B.x} ${B.y + 5} ${B.z} ${B.x + S} ${B.y + 5} ${B.z + S} minecraft:stone`);
    for (const dy of [1, 2, 3, 4]) {
      await cmd(`fill ${B.x} ${B.y + dy} ${B.z} ${B.x + S} ${B.y + dy} ${B.z} minecraft:stone`);
      await cmd(`fill ${B.x} ${B.y + dy} ${B.z + S} ${B.x + S} ${B.y + dy} ${B.z + S} minecraft:stone`);
      await cmd(`fill ${B.x} ${B.y + dy} ${B.z} ${B.x} ${B.y + dy} ${B.z + S} minecraft:stone`);
      await cmd(`fill ${B.x + S} ${B.y + dy} ${B.z} ${B.x + S} ${B.y + dy} ${B.z + S} minecraft:stone`);
    }
  }
}

// ---------- 判定三连（block → light → entity），返回 $chk ----------
async function judge(pos, y) {
  await set('$py', y);
  await set('$chk.ok', 1); await set('$chk.reason', 0);
  const px = pos.x + 8; const pz = pos.z + 8;      // 台子内部中心（远离墙，光照/碰撞都干净）
  await cmd(`execute positioned ${px} ${pos.y + 1} ${pz} run function ${NS}:check/sealevel`);
  for (const f of ['block', 'light', 'entity']) {
    await cmd(`execute positioned ${px} ${pos.y + 1} ${pz} run function ${NS}:check/${f}`);
    if ((await score('$chk.ok')) === 0) break;      // 短路，与 check/all 同序
  }
  return { ok: await score('$chk.ok'), reason: await score('$chk.reason') };
}

// ---------- 固定 $rng 调真分发表 ----------
async function dispatch(biomeFn, cat, rng, y, thunder) {
  await cmd('weather ' + (thunder ? 'thunder' : 'clear'));
  await sleep(6500);                               // 天气是**渐变**的（rainLevel/thunderLevel 每拍 ±0.01）⇒ 6.5s 才稳
  await set('$rng', rng);
  await set('$py', y);
  await cmd(`execute positioned ${LEAF.x + 8} ${y} ${LEAF.z + 8} run function ${NS}:mob/biome/${biomeFn}/${cat}`);
  return {
    slug: await selStr('slug'), type: await selStr('type'),
    min: await selNum('min'), max: await selNum('max'),
    rule: await score('$sel.rule'), place: await score('$sel.place'), light: await score('$sel.light'),
    raw: await cmd(`data get storage ${NS}:sel`),
  };
}

// ---------------------------------------------------------------- 开始
console.log('=== v4.23 作者规则层 · 真机验收（expect=' + EXPECT + '）===');
console.log('RCON_PORT=' + (process.env.RCON_PORT || 25575) + ' · 日志 ' + LOG);

// 0) 加载期门
const sizeBefore = (() => { try { return fs.statSync(LOG).size; } catch { return 0; } })();
await cmd('reload');
await sleep(1800);
let tail = '';
try { tail = fs.readFileSync(LOG).subarray(sizeBefore).toString('utf8'); } catch { /* ignore */ }
const badLoad = (tail.match(/Failed to load function/g) || []).length;
ok('0 加载期门：/reload 0 个 Failed to load function', badLoad === 0, '本轮 ' + badLoad + ' 个');

// 冻结节拍（探针独占 $sel / $chk；末尾解冻）
await set('$snap_period', 20000); await set('$eff.period', 20000);
await buildRigs();

// ④ 先拿"真分发表"里的 zombie 那一条（顺带测 Y 段组大小）
const bands = [[-10, 4, 6], [30, 2, 3], [100, 1, 1]];
const rows4 = [];
for (const [y, mn, mx] of bands) {
  const D = await dispatch('deep_ocean', 'monster', 150, y, false);
  rows4.push({ y, slug: D.slug, got: `${D.min}/${D.max}`, want: EXPECT === 'author' ? `${mn}/${mx}` : '4/4', rule: D.rule, place: D.place });
}
ok('④ groupByY：组大小随 Y 段变化（同一条 zombie 行）', rows4.every((x) => x.slug === 'zombie' && x.got === x.want),
  rows4.map((x) => `y=${x.y} ${x.got}（期望 ${x.want}）`).join(' · '));
const ZOMBIE = { rule: rows4[0].rule, place: rows4[0].place };

// ① belowAny：用真表里 zombie 的规则 id + 落位，在树叶台上判定
{
  await set('$sel.rule', ZOMBIE.rule); await set('$sel.place', ZOMBIE.place);
  const R1 = await judge(LEAF, LEAF.y + 1);
  const pass = EXPECT === 'author' ? R1.ok === 1 : R1.ok === 0;
  ok('① belowAny：僵尸可站在树叶上（默认应否，author 应过）', pass,
    `rule=${ZOMBIE.rule} place=${ZOMBIE.place} ⇒ ok=${R1.ok} reason=${R1.reason}`);
}

// ② 雷暴 + 深海：条件条目（权重 120）+ 自定义 NBT
{
  const T = await dispatch('deep_ocean', 'monster', 600, 40, true);    // 600 ∈ 520..639（香草和 520 + 作者 120）
  const hitThunder = T.raw.includes('thunder_deep_royal');
  const N = await dispatch('deep_ocean', 'monster', 600, 40, false);   // 无雷暴 ⇒ #wsum=520 ⇒ 600%520=80 ⇒ 香草行
  const hitClear = N.raw.includes('thunder_deep_royal');
  const pass = EXPECT === 'author' ? (hitThunder && !hitClear) : (!hitThunder && !hitClear);
  ok('② 条件条目：雷暴才进池', pass, `雷暴:${hitThunder ? '命中' : '未命中'}(${T.slug}) · 非雷暴:${hitClear ? '命中' : '未命中'}(${N.slug})`);
  if (EXPECT === 'author') {
    ok('② 自定义 NBT 落地（三叉戟 + 自定义名 + 金头盔）',
      T.raw.includes('CustomName') && T.raw.includes('trident') && T.raw.includes('golden_helmet'),
      T.raw.slice(Math.max(0, T.raw.indexOf('CustomName')), Math.max(0, T.raw.indexOf('CustomName')) + 130));
  }
}

// ③ 发光鱿鱼：从真表拿它那一条（$rng=0 命中地下水的首条），再在暗草地上判定
{
  const D = await dispatch('lush_caves', 'underground_water_creature', 0, GRASS.y + 1, false);
  const isGlow = D.slug === 'glow_squid';
  const R3 = isGlow ? await judge(GRASS, GRASS.y + 1) : { ok: NaN, reason: NaN };
  const pass = isGlow && (EXPECT === 'author' ? R3.ok === 1 : R3.ok === 0);
  ok('③ 发光鱿鱼改落位：暗草地台（默认应否，author 应过）', pass,
    `$rng=0 抽到 ${D.slug} · place=${D.place} light=${D.light} ⇒ ok=${R3.ok} reason=${R3.reason}`);
}

// 解冻 + 收尾
await set('$snap_period', 20); await cmd(`function ${NS}:circ/snapshot`);
const fails = results.filter((x) => !x.pass);
console.log(`\n结论：${results.length - fails.length} PASS / ${fails.length} FAIL（expect=${EXPECT}）`);
for (const f of fails) console.log('  ❌ ' + f.name + ' :: ' + f.detail);
r.close();
process.exit(fails.length ? 1 : 0);
