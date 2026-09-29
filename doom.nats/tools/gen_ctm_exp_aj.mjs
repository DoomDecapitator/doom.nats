// gen_ctm_exp_aj.mjs —— 生成「实验性 AJ/BDEngine rig 桥接」（v4.25）。
//
//   DOOM_EXP=1 node tools/gen_ctm_exp_aj.mjs [--check]        # 只有实验性变体（v4x/doom.nats）才有这一层
//
// 契约：`rules/rigs.json` 为空/缺文件 ⇒ **不生成任何文件**（并清掉上一次生成留下的 exp/aj/**）。
// 只有 DOOM_EXP=1 且 rigs.json 非空时，才会产出 `doom.nats:exp/aj/**`。
//
// 机制（A 方案「真实体当内核，rig 当外观」）：
//   spawn/emit（该物种的 $sel.rig 存在时）→ exp/aj/emit_sel → exp/aj/emit/<id>
//     → execute summon <carrier> → exp/aj/post/<id>（= post/<slug> 标准收尾 + 内核 NBT/标签）
//       → exp/aj/rigsummon/<id>（**外部包**的召唤函数，例如 calamar:summon）
//       → 认领 rig 实体（根 + 半径内未归属的 display，跳过"已经是别人乘客"的骨骼）
//       → rig 全云直接当内核的乘客 → exp/aj/on_spawn/<id>（可选钩子，如启动第三方动画）
//   清扫：core/tick（仅实验性变体 + rigs 非空时多一行）→ exp/aj/tick（40t 分频）→ exp/aj/sweep
//     （从**活内核**做乘客闭包，没被波及的 rig/骨骼 = 孤儿 ⇒ kill）
//
// 真机实测（详见 reports/验收-实验性AJ桥接-*.md，都是本机 RCON 量出来的）：
//   · `ride <rig> mount <内核>` 可行；一个生物可以同时挂多个 display，且**多个乘客落在同一个挂载点上**
//     （实测 3 个乘客的 Pos 完全相同 ⇒ 模型相对布局由各自的 transformation 决定，不会被"乘客序号"打乱）；
//   · `minecraft:marker` **不能**当挂载枢纽（"Item Display couldn't start riding Marker"）⇒ 不做枢纽层；
//   · display 实体上**没有** `RootVehicle` NBT 字段（"Found no elements matching RootVehicle"）⇒ 不能用它判"是否被骑乘"，
//     清扫改成"活内核的乘客闭包"（见 sweep 的注释）。
import fs from 'node:fs';
import path from 'node:path';
import { PACK, EXP } from './lib/packdir.mjs';
import { EXP_RIGS, RIGS, DISPLAY_TYPE_TAG, findRigFunction } from './lib/exp-rigs.mjs';

const LF = String.fromCharCode(10);
const NS = 'doom.nats';
const F = {};

if (!EXP) {
  console.error('❌ gen_ctm_exp_aj 只用于实验性变体：请加 DOOM_EXP=1（见 tools/lib/packdir.mjs）。');
  console.error('   理由：实验性文件不能进默认产物 —— 默认变体里连 exp/ 目录都不该有。');
  process.exit(1);
}

// ---------------------------------------------------------------- 旧产物清理（幽灵文件，v4.18 的教训）
const AJ_DIR = path.join(PACK, 'data', NS, 'function', 'exp', 'aj');
function walk(d, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const pruneEmpty = (d) => {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) pruneEmpty(path.join(d, e.name));
  if (d !== AJ_DIR && fs.readdirSync(d).length === 0) fs.rmdirSync(d);
};
const produced = new Set();
const checkOnly = process.argv.slice(2).includes('--check');
const drift = [];

// ---------------------------------------------------------------- 未启用：什么都不生成
if (!EXP_RIGS.active) {
  const old = walk(AJ_DIR);
  if (checkOnly) {
    if (old.length) { console.log('未启用（' + EXP_RIGS.reason + '）但有 ' + old.length + ' 个陈旧文件：'); for (const p of old.slice(0, 8)) console.log('  -', path.relative(PACK, p)); process.exit(1); }
    console.log('实验性 AJ 桥接：未启用（' + EXP_RIGS.reason + '）⇒ 一致：0 个文件');
    process.exit(0);
  }
  if (old.length) {
    for (const p of old) fs.rmSync(p);
    pruneEmpty(AJ_DIR);
    console.log('实验性 AJ 桥接：未启用 ⇒ 已清理 ' + old.length + ' 个旧文件（' + path.relative(PACK, AJ_DIR).split(path.sep).join('/') + '）');
  } else {
    console.log('实验性 AJ 桥接：未启用（' + EXP_RIGS.reason + '）⇒ 不生成任何文件');
  }
  process.exit(0);
}

const T = { live: NS + '.exp.aj.live', rig: NS + '.exp.aj.rig', bone: NS + '.exp.aj.bone', child: NS + '.exp.aj.child', pre: NS + '.exp.aj.pre', root: NS + '.exp.aj.root', carrier: NS + '.exp.aj.carrier', anchor: NS + '.exp.aj.anchor' };

// ---------------------------------------------------------------- 1) 实体类型标签：rig 只可能是 display
F['data/' + NS + '/tags/entity_type/exp_aj_display.json'] = JSON.stringify({
  values: ['minecraft:block_display', 'minecraft:item_display', 'minecraft:text_display'],
}, null, 2) + LF;

// ---------------------------------------------------------------- 2) 分派：spawn/emit 在 $sel.rig 存在时进这里
F['data/' + NS + '/function/exp/aj/emit_sel.mcfunction'] = [
  '# ' + NS + ':exp/aj/emit_sel [MACRO] —— rig 物种的生成分派（@s = 玩家，位置 = 候选点）',
  '# 由 spawn/emit 在「$sel.rig 存在」时调用；$(rig) 来自 rules/rigs.json 的键。',
  '# 为什么要这一层：宏缺参会让整个函数中止 ⇒ 派发必须由**非宏**的 if data 守卫挡在前面。',
  '$function ' + NS + ':exp/aj/emit/$(rig) with storage ' + NS + ':sel',
  '',
].join(LF);

// ---------------------------------------------------------------- 3) 每条 rig 的生成链
const report = [];
for (const r of RIGS) {
  const rootTag = r.rig_root_tag;
  // 3a) 内核召唤
  F['data/' + NS + '/function/exp/aj/emit/' + r.id + '.mcfunction'] = [
    '# ' + NS + ':exp/aj/emit/' + r.id + ' —— 生成「' + r.id + '」：真实体内核 ' + r.carrier + ' + rig ' + r.rig,
    '# 由 spawn/emit 调用（@s = 玩家）。内核走**原样**的 summon（finalizeSpawn 由引擎跑），rig 是外观层。',
    'execute summon ' + r.carrier + ' run function ' + NS + ':exp/aj/post/' + r.id + ' with storage ' + NS + ':sel',
    '',
  ].join(LF);
  // 3b) rig 召唤（外部包；单独一个文件 ⇒ 缺包时只本文件加载失败）
  F['data/' + NS + '/function/exp/aj/rigsummon/' + r.id + '.mcfunction'] = [
    '# ' + NS + ':exp/aj/rigsummon/' + r.id + ' —— 召唤第三方 rig（@s = 内核，位置 = 内核位置）',
    '# ⚠ 引用的 ' + r.rig + ' 属于**外部包**（Animated Java / BDEngine 导出）：没装那个包时，',
    '#   **只有本文件**加载失败（内核照常生成、判定链不受影响，只是没有外观）。',
    '# 宏参数按 AJ/BDEngine 约定放在 $(args)：rig_args=' + r.rig_args,
    'data modify storage ' + NS + ':exp_aj_args root set value ' + r.rig_args,
    'function ' + r.rig + ' with storage ' + NS + ':exp_aj_args root',
    '',
  ].join(LF);
  // 3c) 收尾 + 认领 + 挂载
  const L = [
    '# ' + NS + ':exp/aj/post/' + r.id + ' [MACRO] —— 内核生成后的收尾 + 召唤 rig + 挂载（@s = 刚生成的内核）',
    '# 顺序：标准收尾（标签/NBT/持久化/朝向/on_spawn）→ 作者 NBT → 内核打标 → 召唤 rig → 认领 → 挂载 → on_spawn 钩子',
    '$function ' + NS + ':post/$(slug) with storage ' + NS + ':sel',
  ];
  if (r.carrier_nbt) L.push('# 作者声明的内核 NBT（并入：隐形/静音/无 AI 之类）', 'data merge entity @s ' + r.carrier_nbt);
  L.push('tag @s add ' + T.carrier, 'tag @s add ' + T.carrier + '.' + r.id);
  if (!r.count_with_carrier) {
    L.push('# count_with_carrier=false：内核**不计入** mobcap —— 用原版机制（SpawnState 只数非 PersistenceRequired 的），',
      '#   代价：它同时也免疫消失层与 debug/clear（原版持久生物语义，见 rules/README.md）。',
      'data merge entity @s {PersistenceRequired:1b}');
  }
  L.push('# ① 认领本次召唤的 rig 实体（rig 的召唤在下面，夹在 pre 标记与认领之间）。',
    '#   做法：召唤前给场上**已有**的 display 打 pre 标记，召唤后把"没有 pre 标记"的整批认领 ⇒ 两种结构都覆盖：',
    '#   · BDEngine 型：骨架 = 多个并列 display（组实体 + 组实体自己的乘客方块）⇒ 全是新出现的，整批认领；',
    '#   · AJ 型：根 + 骨骼（骨骼是根的乘客）⇒ 也全是新出现的，整批认领；骨骼随后标成 child，不会被单独挂载。',
    '# 为什么不按"是不是乘客"判归属：BDEngine 的组实体自带乘客方块 ⇒ 那样会漏掉半个骨架',
    '#   （真机踩过：50 个 display 只认领到 18 个，其余被清扫层当孤儿收走）。',
    '# 为什么用"pre 前后差分"而不是半径：召唤在一次函数调用内完成，窗口内新出现的 display 只有本次 rig；',
    '#   半径法在"同点连生两只"时会串味（真机踩过：两个骨架共 100 只，只认到 50）。',
    'tag @e[type=#' + DISPLAY_TYPE_TAG + '] add ' + T.pre);
  if (r.mount) {
    L.push(
      '# ② 召唤 rig（外部包函数；独立文件 ⇒ 缺包时只那一行所属的文件失败）',
      'function ' + NS + ':exp/aj/rigsummon/' + r.id,
      'execute as @n[type=#' + DISPLAY_TYPE_TAG + ',tag=' + rootTag + ',distance=..0.01] run tag @s add ' + T.root,
      'execute as @e[type=#' + DISPLAY_TYPE_TAG + ',tag=!' + T.pre + '] run tag @s add ' + T.rig,
      'tag @e[type=#' + DISPLAY_TYPE_TAG + ',tag=' + T.pre + '] remove ' + T.pre,
      '# ③ 挂载：只挂"自己不是别人乘客"的那一批（AJ 的骨骼跟着根走、BDEngine 的方块跟着组实体走）。',
      '#   方向是 rig 骑内核（反过来内核就成了乘客，会被钉在不会自己走的 display 上）。',
      'execute as @e[tag=' + T.rig + '] on passengers run tag @s add ' + T.child,
      'tag @s add ' + T.anchor,
      'execute as @e[type=#' + DISPLAY_TYPE_TAG + ',tag=' + T.rig + ',tag=!' + T.child + '] run ride @s mount @n[tag=' + T.anchor + ',distance=..3]',
      'tag @s remove ' + T.anchor);
  } else {
    L.push('tag @e[type=#' + DISPLAY_TYPE_TAG + ',tag=' + T.pre + '] remove ' + T.pre,
      '# mount=false：只召唤外观、**不**由本桥接托管（不认领、不挂载、也不进清扫层）',
      '#   适用：第三方包自己管理 rig 的生命周期（例如它自己把生物 tp 到 rig 上）。',
      'function ' + NS + ':exp/aj/rigsummon/' + r.id);
  }
  L.push('# ④ on_spawn 钩子（@s 仍是内核；外部包缺席时同样只影响该钩子文件）',
    'function ' + NS + ':exp/aj/on_spawn/' + r.id, '');
  F['data/' + NS + '/function/exp/aj/post/' + r.id + '.mcfunction'] = L.join(LF);
  // 3d) on_spawn 钩子（总是生成：post/<id> 的调用点必须存在）
  F['data/' + NS + '/function/exp/aj/on_spawn/' + r.id + '.mcfunction'] = [
    '# ' + NS + ':exp/aj/on_spawn/' + r.id + ' —— 挂载完成后的钩子（@s = 内核，位置 = 内核位置）',
    r.on_spawn ? '# 来自 rules/rigs.json 的 on_spawn：' + r.on_spawn : '# 本条目没有配 on_spawn ⇒ 空钩子（什么都不做）',
    r.on_spawn ? 'function ' + r.on_spawn : '',
    '',
  ].join(LF);
  report.push({ id: r.id, carrier: r.carrier, rig: r.rig, rigFile: findRigFunction(r.rig), on_spawn: r.on_spawn, mount: r.mount, count: r.count_with_carrier });
}

// ---------------------------------------------------------------- 4) 清扫：孤儿 rig（没有活内核的 rig 实体）
F['data/' + NS + '/function/exp/aj/tick.mcfunction'] = [
  '# ' + NS + ':exp/aj/tick —— rig 层节拍（由 core/tick 每 tick 调用；分频在本函数里做）',
  '# 为什么每 tick 调一次而不是挂第二个 tick 标签：整包只有一个 minecraft:tick 文件，两个生成器写它会漂移。',
  'scoreboard players add $aj.t ' + NS + ' 1',
  'execute if score $aj.t ' + NS + ' matches 40.. run scoreboard players set $aj.t ' + NS + ' 0',
  'execute if score $aj.t ' + NS + ' matches 0 run function ' + NS + ':exp/aj/sweep',
  '',
].join(LF);

F['data/' + NS + '/function/exp/aj/sweep.mcfunction'] = [
  '# ' + NS + ':exp/aj/sweep —— 清掉**没有活内核**的 rig 实体（内核消失/被回收后留下的外观）',
  '#',
  '# 判据：从「带 ' + T.carrier + ' 标签的活内核」出发，做**乘客闭包**（逐层 on passengers），',
  '#   被波及的实体打 live；没被打上的 rig/骨骼就是孤儿 ⇒ kill。',
  '# 为什么不用 RootVehicle：真机实测 display 实体上**没有**这个 NBT 字段',
  '#   （`data get entity @e[tag=…] RootVehicle` ⇒ "Found no elements matching RootVehicle"，哪怕它正在被骑）。',
  '# 内核被回收时引擎只把乘客 eject（不销毁）⇒ 外观会留在原地，这一层就是兜底。',
  'tag @e[tag=' + T.rig + '] remove ' + T.live,
  'tag @e[tag=' + T.child + '] remove ' + T.live,
  'execute as @e[tag=' + T.carrier + '] on passengers run tag @s add ' + T.live,
  'execute as @e[tag=' + T.live + '] on passengers run tag @s add ' + T.live,
  'execute as @e[tag=' + T.live + '] on passengers run tag @s add ' + T.live,
  'execute as @e[tag=' + T.live + '] on passengers run tag @s add ' + T.live,
  'execute as @e[tag=' + T.rig + ',tag=!' + T.live + '] run kill @s',
  'execute as @e[tag=' + T.child + ',tag=!' + T.live + '] run kill @s',
  '# 统计（给验收脚本/日志看）：本轮清扫后的残留数',
  'scoreboard players set $aj.left ' + NS + ' 0',
  'execute store result score $aj.left ' + NS + ' if entity @e[tag=' + T.rig + ']',
  '',
].join(LF);

// ---------------------------------------------------------------- 5) 状态 / 帮助
const COUNTS = ['rigs', 'roots', 'carriers', 'live', 'orphan'];
F['data/' + NS + '/function/exp/aj/count.mcfunction'] = [
  '# ' + NS + ':exp/aj/count —— rig 层计数（写进 ' + NS + ':exp_aj_rt，供 say/验收读取）',
  'scoreboard players set $aj.rigs ' + NS + ' 0',
  'execute store result score $aj.rigs ' + NS + ' if entity @e[tag=' + T.rig + ']',
  'scoreboard players set $aj.roots ' + NS + ' 0',
  'execute store result score $aj.roots ' + NS + ' if entity @e[tag=' + T.root + ']',
  'scoreboard players set $aj.carriers ' + NS + ' 0',
  'execute store result score $aj.carriers ' + NS + ' if entity @e[tag=' + T.carrier + ']',
  'scoreboard players set $aj.live ' + NS + ' 0',
  'execute store result score $aj.live ' + NS + ' if entity @e[tag=' + T.rig + ',tag=' + T.live + ']',
  'scoreboard players set $aj.orphan ' + NS + ' 0',
  'execute store result score $aj.orphan ' + NS + ' if entity @e[tag=' + T.rig + ',tag=!' + T.live + ']',
  ...COUNTS.map((k) =>
    'execute store result storage ' + NS + ':exp_aj_rt s.' + k + ' int 1 run scoreboard players get $aj.' + k + ' ' + NS),
  'execute store result storage ' + NS + ':exp_aj_rt s.left int 1 run scoreboard players get $aj.left ' + NS,
  '',
].join(LF);

F['data/' + NS + '/function/exp/aj/say_status.mcfunction'] = [
  '# ' + NS + ':exp/aj/say_status [MACRO] —— 把计数打进服务器日志（无真人也能采）',
  '$say [nats.aj] rigs=$(rigs) roots=$(roots) mounted=$(live) carriers=$(carriers) orphan=$(orphan) swept_left=$(left)',
  '',
].join(LF);

F['data/' + NS + '/function/exp/aj/status.mcfunction'] = [
  '# ' + NS + ':exp/aj/status —— rig 层状态（聊天栏 + 日志）',
  'function ' + NS + ':exp/aj/count',
  'tellraw @s [{"text":"=== ' + NS + ' 实验性 AJ 桥接 ===","color":"gold"},{"text":" display "},{"score":{"name":"$aj.rigs","objective":"' + NS + '"},"color":"aqua"},{"text":" · 根 "},{"score":{"name":"$aj.roots","objective":"' + NS + '"},"color":"aqua"},{"text":" · 已挂载 "},{"score":{"name":"$aj.live","objective":"' + NS + '"},"color":"green"},{"text":" · 内核 "},{"score":{"name":"$aj.carriers","objective":"' + NS + '"},"color":"white"},{"text":" · 孤儿 "},{"score":{"name":"$aj.orphan","objective":"' + NS + '"},"color":"red"},{"text":" · 残留 "},{"score":{"name":"$aj.left","objective":"' + NS + '"},"color":"red"}]',
  'function ' + NS + ':exp/aj/say_status with storage ' + NS + ':exp_aj_rt s',
  '',
].join(LF);

F['data/' + NS + '/function/exp/aj/help.mcfunction'] = [
  '# ' + NS + ':exp/aj/help —— 实验性 AJ 桥接用法（构建期配置在 rules/rigs.json，改完要 DOOM_EXP=1 重生成）',
  'tellraw @s [{"text":"=== 实验性 AJ 桥接（真实体当内核 + rig 当外观）===","color":"gold"}]',
  'tellraw @s [{"text":"配置：rules/rigs.json 的每条 = {carrier, rig, carrier_nbt?, rig_root_tag?, on_spawn?, cat?, count_with_carrier?, mount?}","color":"gray"}]',
  'tellraw @s [{"text":"链路：spawn/emit → exp/aj/emit/<id> → execute summon <内核> → exp/aj/post/<id> → rigsummon/<id> → 认领 → 挂载","color":"gray"}]',
  'tellraw @s [{"text":"清扫：exp/aj/tick（40t）→ exp/aj/sweep —— 从活内核做乘客闭包，杀掉落单的 ' + T.rig + ' / ' + T.child + '","color":"gray"}]',
  ...RIGS.map((r) => 'tellraw @s [{"text":"· ' + r.id + '：内核 ' + r.carrier + ' + rig ' + r.rig
    + (r.mount ? '（挂载）' : '（不挂载）') + (String(r.count_with_carrier) === 'false' ? '（内核不计容量）' : '') + '","color":"aqua"}]'),
  'tellraw @s [{"text":"零依赖占位 rig：function ' + NS + ':exp/aj/placeholder/summon（手搓 display 骨架，回归用）","color":"dark_aqua"}]',
  'function ' + NS + ':exp/aj/status',
  '',
].join(LF);

// ---------------------------------------------------------------- 6) 占位 rig（零依赖回归；手搓 display 骨架）
// 契约与第三方导出一致：根带 aj.global.root 标签；其余部件是**并列 display**（靠 transformation 定位），
// 这样"认领半径 + 整云挂载"这条链在没有第三方包时也能被验证。
F['data/' + NS + '/function/exp/aj/placeholder/summon.mcfunction'] = [
  '# ' + NS + ':exp/aj/placeholder/summon —— 占位 rig（**零依赖**：只用原版 display 实体手搓的可辨认骨架）',
  '# 用途：① 没有第三方包时的桥接回归 ② 判断"挂载/跟随/清扫"是桥接的问题还是某个具体 rig 的问题。',
  '# 造型：红色躯干 + 黄色头 + 蓝色手臂（全部 block_display），根是不可见的 item_display。',
  '# 位置：全部在召唤点（相对布局由各自的 transformation.translation 决定 ⇒ 与 BDEngine 导出的结构同型）。',
  'summon minecraft:item_display ~ ~ ~ {Tags:["aj.global.root","aj.new","' + NS + '.exp.aj.placeholder"],teleport_duration:1,transformation:{translation:[0f,0f,0f],left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],scale:[0f,0f,0f]}}',
  'summon minecraft:block_display ~ ~ ~ {Tags:["aj.new","' + NS + '.exp.aj.placeholder"],teleport_duration:1,block_state:{Name:"minecraft:red_concrete"},transformation:{translation:[0f,1.2f,0f],left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],scale:[0.6f,0.9f,0.6f]}}',
  'summon minecraft:block_display ~ ~ ~ {Tags:["aj.new","' + NS + '.exp.aj.placeholder"],teleport_duration:1,block_state:{Name:"minecraft:yellow_concrete"},transformation:{translation:[0f,2.0f,0f],left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],scale:[0.35f,0.35f,0.35f]}}',
  'summon minecraft:block_display ~ ~ ~ {Tags:["aj.new","' + NS + '.exp.aj.placeholder"],teleport_duration:1,block_state:{Name:"minecraft:blue_concrete"},transformation:{translation:[0.72f,1.2f,0f],left_rotation:[0f,0f,0f,1f],right_rotation:[0f,0f,0f,1f],scale:[0.18f,0.7f,0.18f]}}',
  '',
].join(LF);

// ---------------------------------------------------------------- 写出（含 --check 漂移 + 陈旧文件）
produced.clear();
for (const rel of Object.keys(F)) produced.add(path.join(PACK, ...rel.split('/')));
const oldFiles = walk(AJ_DIR).filter((p) => !produced.has(p));
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
  if (oldFiles.length) { console.log('陈旧文件 (' + oldFiles.length + '):'); for (const p of oldFiles.slice(0, 8)) console.log('  -', path.relative(PACK, p).split(path.sep).join('/')); }
  if (drift.length) { console.log('与生成器不一致 (' + drift.length + '):'); for (const d of drift.slice(0, 8)) console.log('  -', d); }
  if (drift.length || oldFiles.length) process.exit(1);
  console.log('一致：' + Object.keys(F).length + ' 个文件');
  process.exit(0);
}
for (const p of oldFiles) fs.rmSync(p);
pruneEmpty(AJ_DIR);

console.log('=== gen_ctm_exp_aj 完成（实验性变体 · rig 桥接）===');
console.log('输出:', PACK, '| 文件:', Object.keys(F).length, '| rig 条目:', RIGS.length, '| 清理陈旧文件:', oldFiles.length);
for (const r of report) {
  console.log('  · ' + r.id + '：内核 ' + r.carrier + ' + rig ' + r.rig
    + (r.mount ? '（挂载）' : '（不挂载）') + ' · 容量计入内核=' + r.count + ' · on_spawn=' + (r.on_spawn ?? '（无）')
    + ' · rig 函数' + (r.rigFile ? '已找到: ' + path.relative(path.resolve(PACK, '..', '..'), r.rigFile).split(path.sep).join('/') : '**未在已知目录找到**（运行期需手动装第三方包，否则 rigsummon/<id> 会加载失败）'));
}
