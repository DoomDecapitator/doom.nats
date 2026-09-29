#!/usr/bin/env node
/**
 * doom.nats/tools/install.mjs —— 把移植版装进某个 Minecraft 存档的 datapacks/ 做实测
 *
 *   node tools/install.mjs --variant ported|optimized --save "<存档目录>"   # 源：../ported|../optimized
 *   node tools/install.mjs --status  --save "<存档目录>"
 *
 * 默认存档：1.21.6-Fabric 0.16.14 的 natspawns 9_27（2026-09-27 建的实测存档）
 *
 * 它做的事（全是**复制/替换**，不回写源目录）：
 *   1. 删掉目标存档里已存在的 suso.nats/（换版本时避免两份混装）
 *   2. 从 ../<variant>/suso.nats 复制过去
 *   3. 检查/补装 zz-test-fixtures（补 RC4 专有的谓词 general:dimension_abyss，
 *      否则 dark_the_void（及其调用者 ns_ground_dark）在加载期整函数失效）
 *
 * ⚠ ported（忠实版）**不会**自己打开开关 ⇒ 进游戏后必须：
 *     /scoreboard players set $enable suso.nats 1
 *   optimized（v2）已在 setup 里默认置 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TOOL_DIR, '..'); // doom.nats/
const WORKSPACE = path.resolve(ROOT, '..'); // 工作区根：ported/ 与 optimized/ 在这里
const DEFAULT_SAVE =
  'C:/minecraft/Release 2.8.3.zip/.minecraft/versions/1.21.6-Fabric 0.16.14/saves/natspawns 9_27';

const argv = process.argv.slice(2);
const getArg = (n, d) => {
  const i = argv.indexOf(n);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};
const save = path.resolve(getArg('--save', DEFAULT_SAVE));
const variant = getArg('--variant', '');
const datapacks = path.join(save, 'datapacks');

const FIXTURE_MCMETA = {
  pack: {
    pack_format: 80,
    description: "test fixture: stub for RC4's general:dimension_abyss predicate (always false)",
  },
};
/** 恒假谓词：RC4 的深渊维度在本存档不存在，用「在平原 且 不在平原」占位，保证该表永不触发。 */
const FIXTURE_PREDICATE = {
  condition: 'minecraft:all_of',
  terms: [
    { condition: 'minecraft:location_check', predicate: { dimension: 'minecraft:overworld' } },
    {
      condition: 'minecraft:inverted',
      term: { condition: 'minecraft:location_check', predicate: { dimension: 'minecraft:overworld' } },
    },
  ],
};

const count = (dir) => {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    n += e.isDirectory() ? count(p) : 1;
  }
  return n;
};

const ensureFixture = () => {
  const dir = path.join(datapacks, 'zz-test-fixtures');
  fs.mkdirSync(path.join(dir, 'data/general/predicate'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'pack.mcmeta'), JSON.stringify(FIXTURE_MCMETA, null, 2) + '\n');
  fs.writeFileSync(
    path.join(dir, 'data/general/predicate/dimension_abyss.json'),
    JSON.stringify(FIXTURE_PREDICATE, null, 2) + '\n',
  );
  // v4.22：测试夹具再补一个"批量尝试"函数 —— 要塞/结构类端到端采样一次要几百上千轮，
  //   一轮一条 RCON 太慢（1000 轮 ≈ 2 分钟，超出门的单脚本超时）。这里把 40 轮打成一个函数，
  //   一次 RCON = 40 轮 ⇒ 采样快 40 倍。**只放在夹具包里**（不进 doom.nats 产物）。
  const rounds = ['# general:fortress_rounds —— 测试夹具：连跑 40 轮"一次 pack"（每轮 = 刷新 $att.dim + 生产宏 spawn/at）',
    '# 前置：storage doom.nats:pos 已设为候选原点；调用方负责冻结节拍与清场。',
    'function doom.nats:circ/detect_dim_att'];
  for (let i = 0; i < 40; i++) rounds.push('function doom.nats:spawn/at with storage doom.nats:pos');
  fs.mkdirSync(path.join(dir, 'data/general/function'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'data/general/function/fortress_rounds.mcfunction'), rounds.join('\n') + '\n');
  return dir;
};

if (!fs.existsSync(datapacks)) {
  console.error(`找不到 datapacks 目录：${datapacks}`);
  process.exit(1);
}

if (argv.includes('--status') || !variant) {
  console.log(`存档：${save}`);
  for (const name of fs.readdirSync(datapacks)) {
    const p = path.join(datapacks, name);
    if (!fs.statSync(p).isDirectory()) continue;
    const desc = fs.existsSync(path.join(p, 'pack.mcmeta'))
      ? JSON.stringify(JSON.parse(fs.readFileSync(path.join(p, 'pack.mcmeta'), 'utf8')).pack?.description ?? '')
      : '(无 pack.mcmeta)';
    console.log(`  ${name.padEnd(20)} ${String(count(p)).padStart(4)} 文件  ${desc}`);
  }
  process.exit(0);
}

// 变体表：目录 / 包名 / 命名空间（v3 起包名与命名空间都换成 doom.nats）
const VARIANTS = {
  ported: { dir: 'ported', pack: 'suso.nats', ns: 'suso.nats', note: '忠实移植版' },
  optimized: { dir: 'optimized', pack: 'suso.nats', ns: 'suso.nats', note: 'v2 无假实体版' },
  v3: { dir: 'v3', pack: 'doom.nats', ns: 'doom.nats', note: 'v3 生物注册表 + 宏驱动' },
  v4: { dir: 'v4', pack: 'doom.nats', ns: 'doom.nats', note: 'v4 CTM 自然生成复刻' },
};
const V = VARIANTS[variant];
if (!V) {
  console.error('--variant 只能是 ' + Object.keys(VARIANTS).join(' / ') + '（收到 ' + variant + '）');
  console.error(`--variant 只能是 ported 或 optimized（收到 "${variant}"）`);
  process.exit(2);
}

const src = path.join(WORKSPACE, V.dir, V.pack);
if (!fs.existsSync(src)) {
  console.error(`源不存在：${src}（先跑 node tools/port.mjs / optimize.mjs）`);
  process.exit(1);
}

const dest = path.join(datapacks, V.pack);
  fs.rmSync(dest, { recursive: true, force: true });
// 变体互斥：所有变体共用同一份 objective/实体 tag 语义，混装会双份刷怪 ⇒ 先清掉其它变体
for (const v of Object.values(VARIANTS)) {
  const p = path.join(datapacks, v.pack);
  if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); console.log(`已移除：${p}`); }
}
fs.cpSync(src, dest, { recursive: true });
console.log(`已安装 ${variant}（${V.note}）→ ${dest}（${count(dest)} 文件，命名空间 ${V.ns}）`);

const fix = ensureFixture();
console.log(`夹具就位：${fix}`);

// 4. 测试基建（doom.log 日志/断言 API + nats.debug 调试命令）
const harnessSrc = path.join(WORKSPACE, 'harness', 'doom.log');
const harnessDest = path.join(datapacks, 'doom.log');
if (fs.existsSync(harnessSrc)) {
  if (fs.existsSync(harnessDest)) fs.rmSync(harnessDest, { recursive: true, force: true });
  fs.cpSync(harnessSrc, harnessDest, { recursive: true });
  console.log(`测试基建就位：${harnessDest}（${count(harnessDest)} 文件）`);
} else {
  console.warn(`⚠ 没找到 harness：${harnessSrc} —— 先跑 python tools/gen_harness.py`);
}
console.log(variant === 'ported'
  ? String.fromCharCode(10) + '⚠ 忠实版不会自己开开关 —— 进游戏后先执行：/scoreboard players set $enable ' + V.ns + ' 1'
  : String.fromCharCode(10) + V.note + (variant === 'v4'
    ? ' 无需开关：core/tick 会自动调度（验证用 /function doom.nats:debug/env、spawn/try、debug/reject_report）。'
    : ' 已在 setup 里默认置 $enable=1，进游戏直接观察即可。'));
