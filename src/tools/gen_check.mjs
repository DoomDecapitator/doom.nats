// gen_check.mjs — 生成 doom.nats（v4） 的「合法性链」。
//
//   node tools/gen_check.mjs [--check]
//
// 对齐源码（docs/09 第九节）：
//   isRightDistanceToPlayerAndSpawnPoint : distSq <= 576(24 格) 拒；出生点 24 格内拒
//                                          （出生点读不到 ⇒ 由作者在 cfg 里声明，v4.17 / reason=10）
//   isValidSpawnPostitionForType         : !canSpawnFarFromPlayer 时 distSq > despawnDistance²(128 格) 拒
//                                          → 刷怪表 → SpawnPlacements.isSpawnPositionOk → checkSpawnRules
//                                          → level.noCollision(实体 AABB)
//   isValidEmptySpawnBlock               : 非完整碰撞盒 / 非信号源 / 非流体 / 非 PREVENT_MOB_SPAWNING_INSIDE / 非伤害方块
//   SpawnState.canSpawnForCategoryGlobal : cap = maxInstancesPerChunk × spawnableChunkCount / 289（整数除法）
//
// 每步独立成函数、失败即写 $chk.reason（供 [nats.reject] 归因），不通过就短路。
import fs from 'node:fs';
import path from 'node:path';
import * as PKG from './lib/packdir.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
// v4.24：产物根目录由 lib/packdir.mjs 统一解析（DOOM_EXP=1 ⇒ pack/doom.nats-experimental 实验性变体）
const PACK = PKG.PACK;
const LF = String.fromCharCode(10);
const NS = 'doom.nats';
// v4.17：仅用于 _work/verify_aabb_cheap.mjs 的**前后对比基线** —— 置 1 时输出 v4.16 的 AABB 规则
//   （下方支撑只看 #standable；邻格没有 #narrow_partial 放行；#spawnable_at 仍含 water/snow）。
//   正常生成**不要**设这个变量；它只是让"红→绿"能在同一台实例、同一份脚本上量出来。
const LEGACY_AABB = !!process.env.LEGACY_AABB;
const F = {};
// v4.23 作者层小工具
const authorSlug = (type) => String(type).replace(/^minecraft:/, '').replace(/[^a-z0-9_/.-]/g, '_');
const weatherPred = (w) => (w === 'thunder' ? { condition: 'minecraft:weather_check', thundering: true }
  : w === 'rain' ? { condition: 'minecraft:weather_check', raining: true }
    : { condition: 'minecraft:weather_check', raining: false, thundering: false });
// 原版 location_check.biomes 只接受「单个标签」或「id 列表」两种形态，混写会加载失败 ⇒ 在这里就拦住
const biomeSet = (list) => {
  if (list.length === 1 && list[0].startsWith('#')) return list[0];
  const bad = list.find((x) => String(x).startsWith('#'));
  if (bad) throw new Error('biomeIn/biomeNot 里的标签必须单独使用（原版 biomes 谓词只接受单标签或 id 列表）：' + bad);
  return list;
};

// v4.13：逐实体规则表（与 gen_mobs.mjs 共用 _work/generated/entity-rules.json）
// 生成来源：tools/lib/entity-rules.mjs（证据 = 反编译源码的 check*SpawnRules + SpawnPlacements 注册表）
import { BELOW_TAGS, buildRuleTable, ruleOf, clusterOf, EXTRA_RULE_TYPES } from './lib/entity-rules.mjs';
// 直接由 roster 推导规则表（不依赖生成顺序：gen_mobs 只是把同一份表落盘做证据）
// v4.23 作者规则层（默认空白 ⇒ 下面所有扩充分支都不执行，产物逐字节不变）
import { AUTHOR, ruleLightWindows, capByYOf, describe as describeAuthor } from './lib/author-rules.mjs';

const _rosters = JSON.parse(fs.readFileSync(path.join(ROOT, '_work', 'generated', 'biome-rosters.json'), 'utf8')).rosters;
const _types = new Set();
for (const d of Object.values(_rosters)) for (const c of Object.values(d.categories)) for (const r of c.rows) _types.add(r.type);
for (const t of EXTRA_RULE_TYPES) _types.add(t);   // 与 gen_mobs 必须用同一张表
const _table = buildRuleTable(_types);
const RULES = { rules: _table.rules.map((r) => ({ id: r.id, sample: r.sample, ...r.rule, tagId: r.rule.tag ? BELOW_TAGS.indexOf(r.rule.tag) + 1 : 0 })) };


// ---- 常量与计数 ----
F['data/' + NS + '/function/check/setup.mcfunction'] = `# ${NS}:check/setup —— 合法性链的常量
scoreboard players set #289 ${NS} 289
scoreboard players set #24 ${NS} 24
scoreboard players set #128 ${NS} 128
# v4.17：出生点 24 格排除的整数距离用（4d² = 4dx² + (2dy+1)² + 4dz²，见 check/spawn24_near）
scoreboard players set #2 ${NS} 2
scoreboard players set #4 ${NS} 4
# 各类别的 maxInstancesPerChunk（源码确证：monster 70 / creature 10 / ambient 15）
scoreboard players set #cap.monster ${NS} 70
scoreboard players set #cap.creature ${NS} 10
scoreboard players set #cap.ambient ${NS} 15
# v4.24 运行时刻作者层：条件条目的权重区间（#wsum 之后的 #off..#hi）
scoreboard players set #off ${NS} 0
scoreboard players set #hi ${NS} 0
# 海平面相关的窗口不在 setup 里写死：由 check/sealevel 每拍按 $cfg.sealevel 折算（v4.14）
#   （原版 getSeaLevel() 来自噪声设置：主世界 63 / 下界 32 / 末地 0；cfg 层可按维度给值）
function ${NS}:check/sealevel
function ${NS}:check/cost_setup
`;

// ---- v4.26（P0）：容量计数必须「7 类别 × 3 维度」全量写入 ----
// 原版语义：SpawnState 是 **per-level** 的 —— 每个维度各有一份计数，且**7 个 MobCategory 各自**都有全局容量
//   （cap = maxInstancesPerChunk × spawnableChunkCount / 289）。check/cap 的三条分支因此分别读：
//     $att.dim 非 1/2（主世界）⇒ $cnt.<cat>   ·  =1（下界）⇒ $cnt.<cat>.nether   ·  =2（末地）⇒ $cnt.<cat>.end
// v4.25 及以前：只给 monster / creature / ambient 写了**主世界**计数（无后缀键），另外 4 类
//   （water_creature / water_ambient / underground_water_creature / axolotls）只有 .nether / .end
//   ⇒ 主世界分支读的 $cnt.<cat> **没有写入点** ⇒ 恒读 0（或读到陈旧值）⇒ 这 4 类的全局容量门形同不存在。
//   注意它是**静默**的：加载期不报错、reason 也不记 —— 只能靠真机 A/B 或静态防线（lint L15）发现。
// 现在由 MOB_CATS × CAP_DIM_SUFFIX 统一展开；键名沿用既有风格：主世界无后缀、下界 .nether、末地 .end。
const MOB_CATS = ['monster', 'creature', 'ambient', 'water_creature', 'water_ambient', 'underground_water_creature', 'axolotls'];
const CAP_DIM_SUFFIX = [['minecraft:overworld', ''], ['minecraft:the_nether', '.nether'], ['minecraft:the_end', '.end']];
// 构建期护栏：roster 里一旦出现没被容量表覆盖的类别，当场报错（别等真机上「门不存在」）
{
  const rosterCats = [...new Set(Object.values(_rosters).flatMap((r) => Object.keys(r.categories)))].sort();
  const unknown = rosterCats.filter((c) => !MOB_CATS.includes(c));
  if (unknown.length) throw new Error('biome-rosters 里出现未纳入容量计数的类别：' + unknown.join(', ') + '（要同步 gen_check.mjs 的 MOB_CATS）');
}
// 计数查询必须带**覆盖全图的盒子**（x/dx/y/dy/z/dz）：不带位置约束的 @e 会跨维度选实体，
//   execute in <维度> 也拦不住（v4.14g 真机实测，验证脚本 _work/dimtest7.mjs）。
const CNT_BOX = 'x=-30000000,y=-64,z=-30000000,dx=60000000,dy=400,dz=60000000,limit=500';
const cntBlock = MOB_CATS.flatMap((cat) => CAP_DIM_SUFFIX.flatMap(([dim, sfx]) => [
  'scoreboard players set $cnt.' + cat + sfx + ' ' + NS + ' 0',
  'execute in ' + dim + ' as @e[type=#' + NS + ':' + cat + ',nbt=!{PersistenceRequired:true},' + CNT_BOX + '] run scoreboard players add $cnt.' + cat + sfx + ' ' + NS + ' 1',
])).join(LF);

// ---- 容量：按原版公式刷新（catenate 到快照节拍）----
F['data/' + NS + '/function/check/caps.mcfunction'] = `# ${NS}:check/caps —— 复刻 SpawnState.canSpawnForCategoryGlobal
#
#   cap = maxInstancesPerChunk × spawnableChunkCount / 289   （整数除法，源码逐字）
# spawnableChunkCount 由 ${NS}:circ/snapshot 实测（execute if loaded 数出来的），不是估算。
scoreboard players operation $cap.monster ${NS} = $snap.chunks ${NS}
scoreboard players operation $cap.monster ${NS} *= $eff.max_monster ${NS}
scoreboard players operation $cap.monster ${NS} /= #289 ${NS}
scoreboard players operation $cap.creature ${NS} = $snap.chunks ${NS}
scoreboard players operation $cap.creature ${NS} *= $eff.max_creature ${NS}
scoreboard players operation $cap.creature ${NS} /= #289 ${NS}
scoreboard players operation $cap.ambient ${NS} = $snap.chunks ${NS}
scoreboard players operation $cap.ambient ${NS} *= $eff.max_ambient ${NS}
scoreboard players operation $cap.ambient ${NS} /= #289 ${NS}
scoreboard players operation $cap.water_creature ${NS} = $snap.chunks ${NS}
scoreboard players operation $cap.water_creature ${NS} *= $eff.max_water_creature ${NS}
scoreboard players operation $cap.water_creature ${NS} /= #289 ${NS}
scoreboard players operation $cap.water_ambient ${NS} = $snap.chunks ${NS}
scoreboard players operation $cap.water_ambient ${NS} *= $eff.max_water_ambient ${NS}
scoreboard players operation $cap.water_ambient ${NS} /= #289 ${NS}
scoreboard players operation $cap.underground_water_creature ${NS} = $snap.chunks ${NS}
scoreboard players operation $cap.underground_water_creature ${NS} *= $eff.max_underground_water_creature ${NS}
scoreboard players operation $cap.underground_water_creature ${NS} /= #289 ${NS}
scoreboard players operation $cap.axolotls ${NS} = $snap.chunks ${NS}
scoreboard players operation $cap.axolotls ${NS} *= $eff.max_axolotls ${NS}
scoreboard players operation $cap.axolotls ${NS} /= #289 ${NS}

# 各类别当前计数（按注册表 tag 记数；每快照节拍刷一次）
# v4.14d：按「类别实体类型标签」计数，并跳过原版持久生物 —— 与 SpawnState.createState 一致：
#   原版遍历 level.getAllEntities()，把 MobCategory 匹配且**非** isPersistenceRequired()/requiresCustomPersistence() 的都计入。
#   早先只数本包自己生成的生物（tag=doom.nats.cat.*）⇒ 刷怪笼/结构/指令生成的同类生物不占额度（偏松）。
# v4.26（P0）：**7 类别 × 3 维度**全量写入（由 MOB_CATS × CAP_DIM_SUFFIX 展开，见本文件上方）。
#   主世界 = 无后缀键 $cnt.<cat>（check/cap 的第一分支就是读它）· 下界 = $cnt.<cat>.nether · 末地 = $cnt.<cat>.end。
#   此前 4 个水生类别缺主世界写入点 ⇒ 主世界分支恒读 0 ⇒ 容量门形同不存在（静默偏松、不报错）。
#   静态防线：lint_pack 的 L15（凡被读到的类别，三个维度都必须有 set + add 写入点；反向测试已验）。
# v4.14g：**每个维度各一份**计数（原版 SpawnState 是 per-level 的）。
#   真机实测的关键坑：**不带位置/体积约束的 @e 会跨维度选实体**（execute in <维度> 也不管用），
#     必须加一个覆盖全图的盒子（x/dx/y/dy/z/dz）才按「执行维度」限定；否则三个维度数出来是同一个全局值。
#   验证：_work/dimtest7.mjs（主世界/下界各放一个带标签的盔甲架，盒子查询各得 1，无约束查询得 2）。
${cntBlock}

`;

// ---- 每一步：失败写 reason 并短路 ----
F['data/' + NS + '/function/check/distance.mcfunction'] = `# ${NS}:check/distance —— 距离判定（reason=1 / 2 / 10）
# 24 格球内不得有玩家（源码：distSq <= 576 拒）；24 格之外、despawnDistance 之内才可生成
execute if entity @a[gamemode=!spectator,distance=..24] run function ${NS}:check/fail {reason:1}
execute unless entity @a[gamemode=!spectator,distance=..128] run function ${NS}:check/fail {reason:2}
# 世界出生点 24 格内同样不得生成（源码同一条 if 的第二个分支；$cfg.spawn24≥1 且作者声明了坐标才生效）
execute if score $chk.ok ${NS} matches 1 if score $cfg.spawn24 ${NS} matches 1.. run function ${NS}:check/spawn24
`;

// ---- v4.17（P1-5）：世界出生点 24 格排除（reason=10）----
// 源码（NaturalSpawner.isRightDistanceToPlayerAndSpawnPoint，1.21.6 named 208 行）：
//   level.getSharedSpawnPos().closerToCenterThan(new Vec3(pos.getX() + 0.5, pos.getY(), pos.getZ() + 0.5), 24.0) ⇒ 拒
//   BlockPos.distToCenterSqr 用的是"方块中心"（+0.5），所以 y 轴差是半格：2·dy = 2(spawnY-候选Y)+1。
// 数据包读不到 getSharedSpawnPos()（docs/19 Q1）⇒ 只能由作者在 doom.nats:config 声明坐标（默认关闭）。
// 候选点坐标 = $wx / $py / $wz（spawn/walk 维护的世界坐标；y 在 pack 内不变）。
// 整数实现：判拒条件 d² < 576 ⇔ 4dx² + (2dy)² + 4dz² < 2304（正好 24 格不算拒，与 vanilla 的 `<` 一致）。
F['data/' + NS + '/function/check/spawn24.mcfunction'] = `# ${NS}:check/spawn24 —— 世界出生点 24 格排除（reason=10）
#
# 由 check/distance 在 $chk.ok=1 且 $cfg.spawn24=1 时调用（顺序与原版一致：先玩家距离，再出生点）。
scoreboard players operation $s24.x ${NS} = $cfg.spawn_x ${NS}
scoreboard players operation $s24.x ${NS} -= $wx ${NS}
scoreboard players operation $s24.y ${NS} = $cfg.spawn_y ${NS}
scoreboard players operation $s24.y ${NS} -= $py ${NS}
scoreboard players operation $s24.z ${NS} = $cfg.spawn_z ${NS}
scoreboard players operation $s24.z ${NS} -= $wz ${NS}
# 预筛：任一轴 |Δ| > 24 ⇒ 该轴单独就 ≥ 25² > 576，不可能命中；同时把下面的平方限在 7009 以内（不溢出）
execute if score $s24.x ${NS} matches -24..24 if score $s24.y ${NS} matches -24..24 if score $s24.z ${NS} matches -24..24 run function ${NS}:check/spawn24_near
`;
F['data/' + NS + '/function/check/spawn24_near.mcfunction'] = `# ${NS}:check/spawn24_near —— 出生点距离的整数精确判定（由 check/spawn24 预筛后调用）
#
# 4d² = 4dx² + (2dy+1)² + 4dz²：y 轴的半格偏移照抄 vanilla 的 BlockPos.distToCenterSqr（+0.5）。
# |dx|,|dy|,|dz| ≤ 24 ⇒ 4d² ≤ 4·576 + 4·576 + 49² = 7009（int 不溢出）。
scoreboard players operation $s24.y ${NS} *= #2 ${NS}
scoreboard players add $s24.y ${NS} 1
scoreboard players operation $s24.x ${NS} *= $s24.x ${NS}
scoreboard players operation $s24.x ${NS} *= #4 ${NS}
scoreboard players operation $s24.z ${NS} *= $s24.z ${NS}
scoreboard players operation $s24.z ${NS} *= #4 ${NS}
scoreboard players operation $s24.y ${NS} *= $s24.y ${NS}
scoreboard players operation $s24.x ${NS} += $s24.y ${NS}
scoreboard players operation $s24.x ${NS} += $s24.z ${NS}
# vanilla：distSq < 576 才拒 ⇒ 4d² < 2304（= 正好 24 格不拒）
execute if score $s24.x ${NS} matches ..2303 run function ${NS}:check/fail {reason:10}
`;


{
  // ---- check/block：按 $sel.place（落位类型）与 $sel.tag（专属下方标签）分派
  // 对齐：SpawnPlacements.isSpawnPositionOk → SpawnPlacementTypes
  //   ON_GROUND: 下方 isValidSpawn（上表面完整 ∧ 自身发光 < 14，用 #standable 近似）
  //              ∧ 位置与上方都是 isValidEmptySpawnBlock（用 #spawnable_at 近似）
  //   IN_WATER : 位置是水 ∧ 上方不是红石导体（用 #standable 近似）
  //   IN_LAVA  : 位置是岩浆
  // 实体专属"下方标签"来自 vanilla 原标签（animals/foxes/rabbits/wolves/goats/camels/…）
  const rows = [
    '# ' + NS + ':check/block —— 落位判定（reason=4，由 tools/gen_check.mjs 从规则表生成，勿手改）',
    '#',
    '# place 0=通用陆生 1=无落位限制 2=水中 3=水面窗口 4=陆生+专属标签 5=岩浆',
    '# 详见 tools/lib/entity-rules.mjs 顶部（含源码出处）',
    '',
  ];
  const F4 = (cond) => 'execute ' + cond + ' run function ' + NS + ':check/fail {reason:4}';
  rows.push('# ---- v4.24 运行时刻作者层：额外落位面（storage ' + NS + ':author → entityRules.<实体>.belowAny，上限 8）');
  rows.push('#   命中任一"作者点名的标签"即置 $chk.belowok=1，于是下面的"下方必须可站立"多一条放行条件。');
  rows.push('#   空层时这两行是纯 no-op（belowok 恒 0）。');
  rows.push('scoreboard players set $chk.belowok ' + NS + ' 0');
  rows.push('execute if score $auth.loaded ' + NS + ' matches 1 if data storage ' + NS + ':author_rt w0 run function ' + NS + ':author/below_check');
  if (PKG.EXP) {
    rows.push('execute if score $exp.loaded ' + NS + ' matches 1 if data storage ' + NS + ':exp_rt w0 run function ' + NS + ':exp/below_check');
  }
  rows.push('');
  rows.push('# ---- 位置与上方必须是"可生成空位"（place 0/1/4）');
  rows.push('#   ⚠ v4.17 实测：`#minecraft:replaceable` **传递包含** water/lava/snow ⇒ 光靠白名单会误收流体与雪层。');
  rows.push('#   原版 isValidEmptySpawnBlock 明列「流体非空 ⇒ false」；雪层有碰撞盒（0..2/16），最后的 noCollision(AABB) 会拒。');
  rows.push('#   ⇒ 本体与上方都显式排除 water/lava/snow（与下面的 AABB 近似配套）。');
  for (const p of [0, 1, 4]) {
    rows.push(F4('if score $sel.place ' + NS + ' matches ' + p + ' unless block ~ ~ ~ #' + NS + ':spawnable_at'));
    rows.push(F4('if score $sel.place ' + NS + ' matches ' + p + ' unless block ~ ~1 ~ #' + NS + ':spawnable_at'));
    for (const pos of ['~ ~ ~', '~ ~1 ~']) {
      // E5：'minecraft:water' 换成流体语义标签（含 seagrass/kelp/bubble_column）—— 原版陆生生物不能生成在"流体非空"的方块里
      for (const blk of ['#' + NS + ':water_fluid', 'minecraft:lava', 'minecraft:snow']) {
        rows.push(F4('if score $sel.place ' + NS + ' matches ' + p + ' if block ' + pos + ' ' + blk));
      }
    }
  }
  rows.push('');
  rows.push('# ---- 下方必须可站立（ON_GROUND 的 1 判断；place 0/4）');
  rows.push('# 原版是 state.isFaceSturdy(level,pos,UP) ≡ 支持形状的 UP 面满格 ⇒ **满碰撞立方**都算可站立。');
  rows.push('#   #standable 是历史白名单；v4.17 起与 #full_collision 取**并集**：白名单外的完整方块（石砖族以外的一大批）');
  rows.push('#   不再被误否决。半砖/楼梯（bottom 态）/栅栏/玻璃板/雪层**都不**满 UP 面 ⇒ 依旧不可站立（与原版一致）。');
  // v4.23 作者层 belowAny：规则可以声明"额外算落位面"的方块标签（例：僵尸刷在树叶上 ⇒ #minecraft:leaves）。
  //   语义 = 并到 #standable ∪ #full_collision 之上（命中任一即放行）；默认没有这样的规则 ⇒ 走原路径（逐字节不变）。
  const BELOW_ANY = RULES.rules.filter((r) => (r.belowAny ?? []).length);
  if (BELOW_ANY.length) {
    rows.push('');
    rows.push('# ---- 作者层 belowAny：命中的"额外落位面"标签（rules/entity-rules.json）');
    rows.push('scoreboard players set $chk.belowok ' + NS + ' 0');
    for (const r of BELOW_ANY) {
      for (const raw of r.belowAny) {
        const t = raw.startsWith('#') ? raw : '#' + raw;
        rows.push('execute if score $sel.rule ' + NS + ' matches ' + r.id + ' if block ~ ~-1 ~ ' + t + ' run scoreboard players set $chk.belowok ' + NS + ' 1');
      }
      rows.push(F4('if score $sel.rule ' + NS + ' matches ' + r.id
        + ' unless block ~ ~-1 ~ #' + NS + ':standable'
        + ' unless block ~ ~-1 ~ #' + NS + ':full_collision'
        + ' unless score $chk.belowok ' + NS + ' matches 1'));
    }
    rows.push('');
    rows.push('# ---- 下方必须可站立（ON_GROUND 的 1 判断；place 0/4）—— 声明了 belowAny 的规则已在上一段单独判定');
    for (const p of [0, 4]) {
      rows.push(F4('if score $sel.place ' + NS + ' matches ' + p
        + ' unless block ~ ~-1 ~ #' + NS + ':standable'
        + ' unless block ~ ~-1 ~ #' + NS + ':full_collision'
        + ' unless score $chk.belowok ' + NS + ' matches 1'));
    }
  } else {
    for (const p of [0, 4]) {
      rows.push(LEGACY_AABB
        ? F4('if score $sel.place ' + NS + ' matches ' + p + ' unless block ~ ~-1 ~ #' + NS + ':standable'
          + ' unless score $chk.belowok ' + NS + ' matches 1')
        : F4('if score $sel.place ' + NS + ' matches ' + p
          + ' unless block ~ ~-1 ~ #' + NS + ':standable'
          + ' unless block ~ ~-1 ~ #' + NS + ':full_collision'
          + ' unless score $chk.belowok ' + NS + ' matches 1'));
    }
  }
  rows.push('');
  rows.push('# ---- 水中（IN_WATER）；上方不是红石导体 ⇒ 用 #standable 近似');
  // v4.19（E5 实测）：原版 SpawnPlacements.IN_WATER 读的是 **fluid state** —— seagrass/kelp/bubble_column 的流体都是水，
  //   只看方块会把这些格子误拒（海草在海底铺得很广 ⇒ 系统性砍掉一大片合法水生落位点）。
  //   ⚠ waterlogged 人工方块（板/楼梯）本包同样拒，但原版也拒（AABB 碰撞）⇒ 结局一致。
  rows.push(F4('if score $sel.place ' + NS + ' matches 2 unless block ~ ~ ~ #' + NS + ':water_fluid'));
  rows.push(F4('if score $sel.place ' + NS + ' matches 2 if block ~ ~1 ~ #' + NS + ':standable'));
  rows.push('');
  rows.push('# ---- 水面窗口（WaterAnimal/AgeableWaterCreature：seaLevel-13 ≤ y ≤ seaLevel ∧ 下方是水 ∧ 上方是水）');
  rows.push(F4('if score $sel.place ' + NS + ' matches 3 unless block ~ ~ ~ #' + NS + ':water_fluid'));
  rows.push(F4('if score $sel.place ' + NS + ' matches 3 unless block ~ ~-1 ~ #' + NS + ':water_fluid'));
  rows.push(F4('if score $sel.place ' + NS + ' matches 3 unless block ~ ~1 ~ #' + NS + ':water_fluid'));
  rows.push(F4('if score $sel.place ' + NS + ' matches 3 if score $py ' + NS + ' < $chk.sea_lo ' + NS));
  rows.push(F4('if score $sel.place ' + NS + ' matches 3 if score $py ' + NS + ' > $chk.sea_hi ' + NS));
  rows.push('');
  rows.push('# ---- 岩浆（IN_LAVA）');
  rows.push(F4('if score $sel.place ' + NS + ' matches 5 unless block ~ ~ ~ minecraft:lava'));
  rows.push('');
  rows.push('# ---- AABB 近似（原版 isValidSpawnPostitionForType 最后一步 level.noCollision(type.getSpawnAABB(x+0.5,y,z+0.5))）');
  rows.push('#   实体 AABB 以方块中心为原点、按 width 向两侧各展开 width/2 ⇒');
  rows.push('#     width > 1（蜘蛛 1.4 / 马 1.4 / 熊猫 1.3 / 乌龟 1.2 …）会跨进相邻方块的碰撞盒；');
  rows.push('#     width > 2（恶魂 4.0）跨两格；height > 2（末影人 2.9 / 骆驼 2.375 / 恶魂 4.0）需要第三格净空。');
  rows.push('#   近似：用 #spawnable_at（可生成空位 = 无碰撞盒）判定"该处没有碰撞盒"；');
  rows.push('#   v4.17（P1-7 便宜版）：再用 #narrow_partial 放行"居中窄条/薄片"方块（栅栏/栅栏门/墙/铁栏杆/玻璃板/');
  rows.push('#     锁链/火把/灯笼/花盆/蜡烛/按钮…）—— 宽体生物的 AABB 只伸进邻格一条窄缝（蜘蛛 1.4 ⇒ 伸进 0.2 格），');
  rows.push('#     原版几何上够不到这些碰撞盒，而旧实现按白名单会误否决（真机前后对比见 _work/verify_aabb_cheap.mjs）。');
  rows.push('#   半砖/楼梯/雪层/地毯**不**在放行清单里：它们占满 1×1 占地面积 ⇒ 边条照样会撞上，原版也会拒。');
  for (const [flag, dy, ox, oz] of [
    ['wide', 0, 1, 0], ['wide', 0, -1, 0], ['wide', 0, 0, 1], ['wide', 0, 0, -1],
    ['wide', 1, 1, 0], ['wide', 1, -1, 0], ['wide', 1, 0, 1], ['wide', 1, 0, -1],
    ['wide2', 0, 2, 0], ['wide2', 0, -2, 0], ['wide2', 0, 0, 2], ['wide2', 0, 0, -2],
  ]) {
    const dx = ox === 0 ? '' : '~' + (ox > 0 ? ox : '-' + -ox);
    const dz = oz === 0 ? '' : '~' + (oz > 0 ? oz : '-' + -oz);
    const pos = (dx || '~') + ' ' + (dy === 0 ? '~' : '~' + dy) + ' ' + (dz || '~');
    rows.push(LEGACY_AABB
      ? F4('if score $sel.' + flag + ' ' + NS + ' matches 1 unless block ' + pos + ' #' + NS + ':spawnable_at')
      : F4('if score $sel.' + flag + ' ' + NS + ' matches 1'
        + ' unless block ' + pos + ' #' + NS + ':spawnable_at'
        + ' unless block ' + pos + ' #' + NS + ':narrow_partial'));
  }
  // ⚠ `tall`（第三格，**本列**）**不**适用 #narrow_partial 放行：那一格被生物自己的躯体占据，
  //   居中窄条（栅栏/玻璃板/火把）照样与 AABB 相交 ⇒ 原版照样拒（真机前后对比已复验：D1/D3 必须否决）。
  //   ⇒ 这条与 v4.16 完全一致（保持严格），v4.17 只在 wide/wide2（**邻格**）放宽。
  rows.push(F4('if score $sel.tall ' + NS + ' matches 1 unless block ~ ~2 ~ #' + NS + ':spawnable_at'));

  rows.push('');
  rows.push('# ---- 实体专属下方标签（vanilla 原标签，只列出本包用到的）');
  const tagsUsed = [...new Set(RULES.rules.map((r) => r.tagId).filter(Boolean))].sort((a, b) => a - b);
  for (const id of tagsUsed) {
    rows.push(F4('if score $sel.tag ' + NS + ' matches ' + id + ' unless block ~ ~-1 ~ #' + BELOW_TAGS[id - 1]));
  }
  F['data/' + NS + '/function/check/block.mcfunction'] = rows.join(LF) + LF;
}

// 常量：1000 / 代表距离（分桶近似用）
F['data/' + NS + '/function/check/cost_setup.mcfunction'] = `# ${NS}:check/cost_setup —— spawn cost 的分桶常量（1000/代表距离）
scoreboard players set #c8 ${NS} 125
scoreboard players set #c16 ${NS} 62
scoreboard players set #c24 ${NS} 41
scoreboard players set #c32 ${NS} 31
scoreboard players set #c48 ${NS} 20
scoreboard players set #c64 ${NS} 15
`;

F['data/' + NS + '/function/check/cost.mcfunction'] = `# ${NS}:check/cost —— spawn cost（reason=7）
#
# 原版：charge_new × Σ(q_i / r_i) ≤ energy_budget（1/r 三维权重、无衰减、每 tick 重建）。
# 同一群系内 q 恒定（warped_forest 全 1.0 / soul_sand_valley 全 0.7），故可化为 Σ(1/r) ≤ budget / q²，
# 阈值由 biome/distpatch 按当前群系写入 $cost.threshold（0 = 该群系不适用）。
# 近似之处：Σ(1/r) 用 6 个距离桶代替连续积分（原版是逐实体精确 1/r）。
execute if score $cost.threshold ${NS} matches 1.. run function ${NS}:check/cost_sum
execute if score $cost.threshold ${NS} matches 1.. if score $cost.sum ${NS} > $cost.threshold ${NS} run function ${NS}:check/fail {reason:7}
`;

F['data/' + NS + '/function/check/cost_sum.mcfunction'] = `# ${NS}:check/cost_sum —— Σ(1/r) 的分桶近似（每桶：个数 × 1000/代表距离）
scoreboard players set $cost.sum ${NS} 0
execute store result score $cost.n ${NS} if entity @e[tag=${NS}.spawned,distance=..8]
scoreboard players operation $cost.n ${NS} *= #c8 ${NS}
scoreboard players operation $cost.sum ${NS} += $cost.n ${NS}
execute store result score $cost.n ${NS} if entity @e[tag=${NS}.spawned,distance=..16]
scoreboard players remove $cost.n ${NS} 0
scoreboard players operation $cost.n ${NS} *= #c16 ${NS}
scoreboard players operation $cost.sum ${NS} += $cost.n ${NS}
execute store result score $cost.n ${NS} if entity @e[tag=${NS}.spawned,distance=..32]
scoreboard players operation $cost.n ${NS} *= #c32 ${NS}
scoreboard players operation $cost.sum ${NS} += $cost.n ${NS}
execute store result score $cost.n ${NS} if entity @e[tag=${NS}.spawned,distance=..64]
scoreboard players operation $cost.n ${NS} *= #c64 ${NS}
scoreboard players operation $cost.sum ${NS} += $cost.n ${NS}
# 说明：桶为累计式（..8 / ..16 / ..32 / ..64），此处按最简形式取上界桶，作者可按需细化
`;

{
  // ---- check/entity：逐实体规则（reason=9），由规则表生成
  // 每条规则 = 一组"否决条件"。光照不在这里（check/light 按 $sel.light 分派）。
  const rows = [
    '# ' + NS + ':check/entity —— 逐实体规则（reason=9，由 tools/gen_check.mjs 从规则表生成，勿手改）',
    '#',
    '# 规则编号 ↔ 实体 ↔ 源码出处见 doom.nats/_work/generated/entity-rules.json',
    '# 与 _work/ref/spawn-rules-digest.txt（44 条谓词的源码速览）',
    '',
  ];
  // ⚠ Brigadier 不接受连续两个空格（真机实测：`matches 3  run function` 直接整条命令解析失败）⇒ 统一折叠
  const rule = (id, cond) => ('execute if score $sel.rule ' + NS + ' matches ' + id + ' ' + cond + ' run function ').replace(/ {2,}/g, ' ');
  for (const r of RULES.rules) {
    const id = r.id;
    const notes = [];
    // 通用否决：50% / 月相 / 2-of-3 / 1-of-20（其它 1-of-N 由 deep 分支处理）
    for (const c of r.coins || []) {
      if (c === 'half') rows.push(rule(id, '') + NS + ':check/coin_half');
      if (c === 'moon') rows.push(rule(id, '') + NS + ':check/coin_moon');
      if (c === '2of3') rows.push(rule(id, '') + NS + ':check/coin_2of3');
      if (c === '1of20') rows.push(rule(id, '') + NS + ':check/coin_1of20');
      if (c === '1of15') rows.push(rule(id, '') + NS + ':check/coin_1of15');
    }
    // 需要看到天空（尸壳/流浪者：canSeeSky）
    if (r.sky) rows.push(rule(id, 'unless predicate ' + NS + ':spawn/can_see_sky') + NS + ':check/fail {reason:9}');
    // 守卫者：nextInt(20)==0 或"水下看不到天"
    if (r.noSky) rows.push(rule(id, 'if predicate ' + NS + ':spawn/can_see_sky') + NS + ':check/coin_1of20');
    // 下方的下界疣块否决（僵尸猪灵/猪灵/疣猪兽）
    if (r.notWart) rows.push(rule(id, 'if block ~ ~-1 ~ minecraft:nether_wart_block') + NS + ':check/fail {reason:9}');
    // 溺尸：1/40 + 深水（y < seaLevel-5）；#more_frequent_drowned_spawns 群系改 1/15
    // v4.19：补上 Drowned.checkDrownedSpawnRules 的**第一条**（两条分支共用）：
    //   if (!level.getFluidState(pos.below()).is(FluidTags.WATER) && !isSpawner(reason)) return false;
    //   ⇒ 脚下必须是水（流体级判定：水/气泡柱都算）。旧实现缺这条 ⇒ 一格深的浅水坑也能刷溺尸（原版不能）。
    //   放在分支分派**之前**，河流（1/15）与海洋（1/40 + 深水）两条路都会先过这道门。
    if (r.deep) {
      rows.push(rule(id, 'unless block ~ ~-1 ~ #' + NS + ':water_fluid') + NS + ':check/fail {reason:9}');
      rows.push(rule(id, 'unless predicate ' + NS + ':spawn/biome_more_drowned') + NS + ':check/drowned_deep');
      rows.push(rule(id, 'if predicate ' + NS + ':spawn/biome_more_drowned') + NS + ':check/coin_1of15');
    }
    // 河流群系：water_ambient 有 98% 概率直接不刷（BiomeTags.REDUCED_WATER_AMBIENT_SPAWNS）
    // ⚠ v4.19 修正极性：原版是「**在**该标签群系里**才**掷这个 98% 否决」（getRandomSpawnMobAt：
    //   category == WATER_AMBIENT && biome.is(REDUCED_WATER_AMBIENT_SPAWNS) && nextFloat() < 0.98F ⇒ empty）。
    //   旧写法用的是 unless ⇒ 极性反了：海洋（不在标签里）被白扣 98%（**大洋里几乎刷不出鱼**），
    //   河流反倒完全不设限（50 倍过量）。真机侧证：深海 4 分钟 batch=24 观测，一条鱼都没有。
    if (r.river98) rows.push(rule(id, 'if predicate ' + NS + ':spawn/biome_river') + NS + ':check/coin_1of50');
    // water_ambient：必须距玩家 ≤ 64（despawnDistance=64）
    if (r.d64) rows.push(rule(id, 'unless entity @a[gamemode=!spectator,distance=..64]') + NS + ':check/fail {reason:2}');
    // 5 格内不得有玩家（蠹虫/末影螨）
    if (r.noPlayer5) rows.push(rule(id, 'if entity @a[gamemode=!spectator,distance=..5]') + NS + ':check/fail {reason:9}');
    // y 窗口：发光鱿鱼 y ≤ seaLevel-33；海龟 y < seaLevel+4
    if (r.ySea) rows.push(rule(id, 'if score $py ' + NS + ' > $chk.sea_glow ' + NS) + NS + ':check/fail {reason:9}');
    if (r.yTurtle) rows.push(rule(id, 'if score $py ' + NS + ' >= $chk.sea_turtle ' + NS) + NS + ':check/fail {reason:9}');
    // 炽足兽：上方连续岩浆之后必须是空气
    if (r.lavaToAir) {
      const K = ('if score $sel.rule ' + NS + ' matches ' + id + ' ');
      rows.push('execute ' + K + 'if block ~ ~1 ~ minecraft:lava if block ~ ~2 ~ minecraft:lava if block ~ ~3 ~ minecraft:lava unless block ~ ~4 ~ minecraft:air run function ' + NS + ':check/fail {reason:9}');
      rows.push('execute ' + K + 'if block ~ ~1 ~ minecraft:lava if block ~ ~2 ~ minecraft:lava unless block ~ ~3 ~ minecraft:lava unless block ~ ~3 ~ minecraft:air run function ' + NS + ':check/fail {reason:9}');
      rows.push('execute ' + K + 'if block ~ ~1 ~ minecraft:lava unless block ~ ~2 ~ minecraft:lava unless block ~ ~2 ~ minecraft:air run function ' + NS + ':check/fail {reason:9}');
      rows.push('execute ' + K + 'unless block ~ ~1 ~ minecraft:lava unless block ~ ~1 ~ minecraft:air run function ' + NS + ':check/fail {reason:9}');
    }
    // 蝙蝠：必须低于地表（近似：不高于玩家所在层）
    if (r.belowSurface) rows.push(rule(id, 'if score $py ' + NS + ' > $snap.py ' + NS) + NS + ':check/fail {reason:9}');
    // 史莱姆：群系白名单 + 50<y<70（50% 与月相已在 coins 里）
    if (r.biome === 'slime') {
      rows.push(rule(id, 'unless predicate ' + NS + ':spawn/biome_slime') + NS + ':check/fail {reason:9}');
      rows.push(rule(id, 'if score $py ' + NS + ' matches ..50') + NS + ':check/fail {reason:9}');
      rows.push(rule(id, 'if score $py ' + NS + ' matches 70..') + NS + ':check/fail {reason:9}');
    }
    // 北极熊：群系标签决定用哪套"下方方块"
    if (r.biome === 'polar_bear') {
      rows.push(rule(id, 'if predicate ' + NS + ':spawn/biome_polar_alt unless block ~ ~-1 ~ #minecraft:polar_bears_spawnable_on_alternate') + NS + ':check/fail {reason:9}');
      rows.push(rule(id, 'unless predicate ' + NS + ':spawn/biome_polar_alt unless block ~ ~-1 ~ #minecraft:animals_spawnable_on') + NS + ':check/fail {reason:9}');
    }
    // ---- v4.23 作者层扩展（rules/entity-rules.json）：Y 窗口 / 亮度窗口 / 天气 / 群系白黑名单
    //   y 窗口用 $py（候选点 y，与 seaLevel 窗口同一口径）；亮度与天气直接走 location_check / weather_check 谓词。
    if (r.yMin != null) rows.push(rule(id, 'if score $py ' + NS + ' matches ..' + (r.yMin - 1)) + NS + ':check/fail {reason:9}');
    if (r.yMax != null) rows.push(rule(id, 'if score $py ' + NS + ' matches ' + (r.yMax + 1) + '..') + NS + ':check/fail {reason:9}');
    if (r.lightMax != null) rows.push(rule(id, 'unless predicate ' + NS + ':author/light_le_' + r.lightMax) + NS + ':check/fail {reason:3}');
    if (r.lightMin != null) rows.push(rule(id, 'unless predicate ' + NS + ':author/light_ge_' + r.lightMin) + NS + ':check/fail {reason:3}');
    if (r.weather) rows.push(rule(id, 'unless predicate ' + NS + ':author/weather_' + r.weather) + NS + ':check/fail {reason:9}');
    if (r.biomeIn) rows.push(rule(id, 'unless predicate ' + NS + ':author/rule_biome_' + authorSlug(id)) + NS + ':check/fail {reason:9}');
    if (r.biomeNot) rows.push(rule(id, 'if predicate ' + NS + ':author/rule_notbiome_' + authorSlug(id)) + NS + ':check/fail {reason:9}');
  }
  // v4.24 运行时刻规则补丁（storage ' + NS + ':author → entityRules.<实体>）：
  //   Y 窗口 / 亮度窗口 / 天气门走 rule_check（宏函数，值来自运行时刻）；群系白黑名单走 biome_check。
  //   只在"该物种有补丁"（$auth.loaded=1，由 author/row 置位）时调用 ⇒ 空层零行为差异。
  if (PKG.EXP) {
    rows.push('# ---- v4.24 实验性层（storage ' + NS + ':exp → entityRules.<实体>，仅在 enabled:1b 时生效）');
    rows.push('execute if score $exp.loaded ' + NS + ' matches 1 run function ' + NS + ':exp/rule_check with storage ' + NS + ':exp_rt cur');
    rows.push('execute if score $exp.loaded ' + NS + ' matches 1 run function ' + NS + ':exp/biome_check');
  }
  rows.push('# ---- v4.24 运行时刻作者层（storage ' + NS + ':author → entityRules.<实体>）');
  rows.push('execute if score $auth.loaded ' + NS + ' matches 1 run function ' + NS + ':author/rule_check with storage ' + NS + ':author_rt cur');
  rows.push('execute if score $auth.loaded ' + NS + ' matches 1 run function ' + NS + ':author/biome_check');
  F['data/' + NS + '/function/check/entity.mcfunction'] = rows.join(LF) + LF;
}


// v4.23 作者层 capByY：按 Y 段覆盖容量。默认无策略 ⇒ 下面 `${capNow}${capCmp}${lmax}${localMax}` 全为空/原值，模板逐字节与旧版一致。
const CAP_CATS = [...new Set(Object.values(_rosters).flatMap((r) => Object.keys(r.categories)))].sort();
const CAP_Y_ACTIVE = CAP_CATS.some((c) => capByYOf(c));
// ⚠ 宏行（$ 开头）里**必须**有 $(name) 占位符，否则整函数加载失败（lint L12 / No variables in macro）
//   ⇒ 临时分数名也带上 $(cat)：$cap.now_<cat> / $cap.lmax_<cat>（check/cap_y/<cat> 是非宏函数，直接写全名）
// v4.24：比较用的两个量统一成 $cap.now_$(cat) / $cap.lmax_$(cat)（先取引擎每拍算出的快照值）——
//   构建期 capByY 与运行时刻 capByY 都只**覆盖**这两个量，不再各走一条分支（空层逐条等价：只是多两次赋值）。
const capNow = '$scoreboard players operation $cap.now_$(cat) ' + NS + ' = $cap.$(cat) ' + NS + LF
  + '$scoreboard players operation $cap.lmax_$(cat) ' + NS + ' = $eff.max_$(cat) ' + NS + LF
  + (CAP_Y_ACTIVE ? '$function ' + NS + ':check/cap_y/$(cat)' + LF : '')
  // 运行时刻容量随 Y（storage ' + NS + ':author counts.capByY.<类别>）：只在作者真的给了该类别时才调用
  + '$execute if data storage ' + NS + ':author counts.capByY."$(cat)" run function ' + NS + ':author/cap_scan with storage ' + NS + ':sel' + LF
  + (PKG.EXP ? '$execute if score $exp.on ' + NS + ' matches 1 if data storage ' + NS + ':exp counts.capByY."$(cat)" run function ' + NS + ':exp/cap_scan with storage ' + NS + ':sel' + LF : '');
const capCmp = '$cap.now_$(cat) ' + NS;
const localMax = '$cap.lmax_$(cat) ' + NS;
const lmax = '';
if (CAP_Y_ACTIVE) {
  for (const cat of CAP_CATS) {
    const bands = capByYOf(cat) ?? [];
    const L = ['# ' + NS + ':check/cap_y/' + cat + ' —— 作者层：按 Y 段覆盖该类容量（rules/counts.json capByY.' + cat + '）',
      '# 由 check/cap 在比较前调用（$cap.now 已初始化为引擎快照算出的 $cap.' + cat + '；后面命中的段**依次覆盖**）。', ''];
    for (const b of bands) {
      const cond = b.yMin != null && b.yMax != null ? 'matches ' + b.yMin + '..' + b.yMax
        : b.yMax != null ? 'matches ..' + b.yMax
          : 'matches ' + (b.yMin ?? 0) + '..';
      if (b.max != null) L.push('execute if score $py ' + NS + ' ' + cond + ' run scoreboard players set $cap.now_' + cat + ' ' + NS + ' ' + b.max);
      if (b.localMax != null) L.push('execute if score $py ' + NS + ' ' + cond + ' run scoreboard players set $cap.lmax_' + cat + ' ' + NS + ' ' + b.localMax);
    }
    L.push('');
    F['data/' + NS + '/function/check/cap_y/' + cat + '.mcfunction'] = L.join(LF);
  }
  console.log('  作者层 capByY：' + CAP_CATS.filter((c) => capByYOf(c)).length + ' 个类别有 Y 段容量策略');
}

F['data/' + NS + '/function/check/cap.mcfunction'] = `# ${NS}:check/cap [MACRO] —— 容量判定（reason=5 全局 / 6 本地全满）
#
# 全局（SpawnState.canSpawnForCategoryGlobal）：cnt < maxInstancesPerChunk × spawnableChunkCount / 289
# 本地（LocalMobCapCalculator.canSpawn，源码确证）：**任一**附近玩家未满即通过 —— OR 语义
#   MobCounts.canSpawn: counts.getOrDefault(cat, 0) < cat.getMaxInstancesPerChunk()
#   即 per-player 的容量就是 maxInstancesPerChunk 本身，不再乘 chunks/289。
#   "附近" = 区块附近的玩家（chunkMap.getPlayersCloseForSpawning），等价于区块中心距玩家 < 128。
# v4.14g：先按当前尝试的维度把该维度的计数取到 $cnt.dim，再与全局容量比较
# v4.26：下面三条分支分别读 $cnt.$(cat) / $cnt.$(cat).nether / $cnt.$(cat).end —— 三者都必须在 check/caps 里有**写入点**，
#   否则该维度读到的是 0 或陈旧值 ⇒ 容量门形同不存在（v4.25 前 4 个水生类别的主世界分支就是这样静默失效的）。
#   （静态防线：lint_pack L15 要求「被读到的类别 × 三个维度」都有 set + add 写入点。）
$scoreboard players operation $cnt.dim ${NS} = $cnt.$(cat) ${NS}
$execute if score $att.dim ${NS} matches 1 run scoreboard players operation $cnt.dim ${NS} = $cnt.$(cat).nether ${NS}
$execute if score $att.dim ${NS} matches 2 run scoreboard players operation $cnt.dim ${NS} = $cnt.$(cat).end ${NS}
${capNow}${lmax}$execute if score $cnt.dim ${NS} >= ${capCmp} run function ${NS}:check/fail {reason:5}

scoreboard players set $local_ok ${NS} 0
execute if score $chk.ok ${NS} matches 1 as @a[gamemode=!spectator] at @s run function ${NS}:check/local_one with storage ${NS}:sel
execute if score $chk.ok ${NS} matches 1 if score $local_ok ${NS} matches 0 run function ${NS}:check/fail {reason:6}
`;

F['data/' + NS + '/function/check/local_one.mcfunction'] = `# ${NS}:check/local_one [MACRO] —— 单个玩家的本地容量（以该玩家为执行位置）
# 宏参数 cat 来自 ${NS}:sel；$eff.max_$(cat) 会被替换成 $eff.max_monster 之类的计分板 holder。
$execute store result score $cnt.local ${NS} if entity @e[type=#${NS}:$(cat),nbt=!{PersistenceRequired:true},distance=..128]
$execute if score $cnt.local ${NS} < ${localMax} run scoreboard players set $local_ok ${NS} 1
`;

F['data/' + NS + '/function/check/fail.mcfunction'] = `# ${NS}:check/fail [MACRO] —— 标记失败原因并短路
$scoreboard players set $chk.reason ${NS} \$(reason)
scoreboard players set $chk.ok ${NS} 0
`;

// ---- 串联 ----
// v4.19（E2c）：世界边界门（reason=11）。原版三处落位都查 isWithinBounds；本包此前完全没有这条判定。
//   判定与原版半开区间一致（x >= cx - size/2 ∧ x < cx + size/2）：整数式 (x-cx)*2 >= size 或 <= -size ⇒ 拒。
F['data/' + NS + '/function/check/border.mcfunction'] = `# ${NS}:check/border —— 世界边界（reason=11）
#
# 原版出处：SpawnPlacementTypes.ON_GROUND / IN_WATER / IN_LAVA 都要求 level.getWorldBorder().isWithinBounds(pos)；
#   WorldBorder.isWithinBounds(x,z) = x >= centerX - size/2 && x < centerX + size/2（半开区间）。
# 命令侧只能读 worldborder get 的尺寸、读不到中心 ⇒ centerX/centerZ/size 由作者在 doom.nats:config 里声明；
#   size=0（默认）= 不启用（老世界行为不变）。
scoreboard players set $bd.dx ${NS} 0
scoreboard players set $bd.dz ${NS} 0
execute if score $cfg.border_size ${NS} matches 1.. run scoreboard players operation $bd.dx ${NS} = $wx ${NS}
execute if score $cfg.border_size ${NS} matches 1.. run scoreboard players operation $bd.dx ${NS} -= $cfg.border_cx ${NS}
execute if score $cfg.border_size ${NS} matches 1.. run scoreboard players operation $bd.dx ${NS} *= #2 ${NS}
execute if score $cfg.border_size ${NS} matches 1.. run scoreboard players operation $bd.dz ${NS} = $wz ${NS}
execute if score $cfg.border_size ${NS} matches 1.. run scoreboard players operation $bd.dz ${NS} -= $cfg.border_cz ${NS}
execute if score $cfg.border_size ${NS} matches 1.. run scoreboard players operation $bd.dz ${NS} *= #2 ${NS}
# 左边界用"dx + size < 0"表达（避免引入 -1 常量）：合法区间是 -size <= dx < size
scoreboard players operation $bd.tx ${NS} = $bd.dx ${NS}
scoreboard players operation $bd.tx ${NS} += $cfg.border_size ${NS}
scoreboard players operation $bd.tz ${NS} = $bd.dz ${NS}
scoreboard players operation $bd.tz ${NS} += $cfg.border_size ${NS}
execute if score $cfg.border_size ${NS} matches 1.. if score $bd.dx ${NS} >= $cfg.border_size ${NS} run function ${NS}:check/fail {reason:11}
execute if score $cfg.border_size ${NS} matches 1.. if score $bd.tx ${NS} matches ..-1 run function ${NS}:check/fail {reason:11}
execute if score $cfg.border_size ${NS} matches 1.. if score $bd.dz ${NS} >= $cfg.border_size ${NS} run function ${NS}:check/fail {reason:11}
execute if score $cfg.border_size ${NS} matches 1.. if score $bd.tz ${NS} matches ..-1 run function ${NS}:check/fail {reason:11}
`;

F['data/' + NS + '/function/check/all.mcfunction'] = `# ${NS}:check/all —— 按源码顺序串联判定；任一步失败即短路并记下原因
scoreboard players set $chk.ok ${NS} 1
scoreboard players set $chk.reason ${NS} 0
execute if score $chk.ok ${NS} matches 1 run function ${NS}:check/distance
execute if score $chk.ok ${NS} matches 1 run function ${NS}:check/border
execute if score $chk.ok ${NS} matches 1 run function ${NS}:check/light
execute if score $chk.ok ${NS} matches 1 run function ${NS}:check/block
execute if score $chk.ok ${NS} matches 1 run function ${NS}:check/entity
execute if score $chk.ok ${NS} matches 1 run function ${NS}:check/cap with storage ${NS}:sel
execute if score $chk.ok ${NS} matches 1 run function ${NS}:check/cost
`;

// ---------------------------------------------------------------- 逐实体规则要用的谓词与掷币（v4.13）
// 群系标签直接用 vanilla 原标签判定（location_check.biomes 接受 "#ns:tag" 形式，
// 依据：HolderSetCodec 的 registryAwareCodec = either(TagKey, List<Holder>)）
const biomePred = (name, tag) => JSON.stringify({
  condition: 'minecraft:location_check',
  predicate: { biomes: tag },
}, null, 2) + LF;
F['data/' + NS + '/predicate/spawn/biome_slime.json'] = biomePred('slime', '#minecraft:allows_surface_slime_spawns');
F['data/' + NS + '/predicate/spawn/biome_river.json'] = biomePred('river', '#minecraft:reduce_water_ambient_spawns');
F['data/' + NS + '/predicate/spawn/biome_more_drowned.json'] = biomePred('drowned', '#minecraft:more_frequent_drowned_spawns');
F['data/' + NS + '/predicate/spawn/biome_polar_alt.json'] = biomePred('polar', '#minecraft:polar_bears_spawn_on_alternate_blocks');

// ---- v4.23 作者层谓词：只在 rules/entity-rules.json 真用到时才生成（默认一个都不生成）
{
  const used = ruleLightWindows();
  const seen = new Set();
  for (const [type, w] of used) {
    const s = authorSlug(type);
    const put = (rel, obj) => { const k = rel + JSON.stringify(obj); if (!seen.has(k)) { seen.add(k); F['data/' + NS + '/predicate/' + rel] = JSON.stringify(obj, null, 2) + LF; } };
    if (w.lightMax != null) put('author/light_le_' + w.lightMax + '.json', { condition: 'minecraft:location_check', predicate: { light: { light: { max: w.lightMax } } } });
    if (w.lightMin != null) put('author/light_ge_' + w.lightMin + '.json', { condition: 'minecraft:location_check', predicate: { light: { light: { min: w.lightMin } } } });
    if (w.weather) put('author/weather_' + w.weather + '.json', weatherPred(w.weather));
    if (w.biomeIn) put('author/rule_biome_' + s + '.json', { condition: 'minecraft:location_check', predicate: { biomes: biomeSet(w.biomeIn) } });
    if (w.biomeNot) put('author/rule_notbiome_' + s + '.json', { condition: 'minecraft:location_check', predicate: { biomes: biomeSet(w.biomeNot) } });
  }
}
// 下界要塞：location_check.structures 接受 id 列表（HolderSet：either(TagKey, List)）
F['data/' + NS + '/predicate/spawn/in_fortress.json'] = JSON.stringify({
  condition: 'minecraft:location_check',
  predicate: { structures: ['minecraft:fortress'] },
}, null, 2) + LF;
F['data/' + NS + '/predicate/spawn/can_see_sky.json'] = JSON.stringify({
  condition: 'minecraft:location_check',
  predicate: { can_see_sky: true },
}, null, 2) + LF;
// 掷币（否决式：命中即 fail reason=9）
const coin = (name, lines, note) => {
  F['data/' + NS + '/function/check/' + name + '.mcfunction'] = ['# ' + NS + ':check/' + name + ' —— ' + note, ...lines].join(LF) + LF;
};
coin('coin_half', [
  'execute store result score $coin ' + NS + ' run random value 0..1',
  'execute if score $coin ' + NS + ' matches 0 run function ' + NS + ':check/fail {reason:9}',
], '50% 否决（蝙蝠 nextBoolean / 史莱姆 nextFloat()<0.5）');
coin('coin_moon', [
  '# 月相亮度 0..8（$snap.moon）：random(0..7) >= moon ⇒ 否决（等价 nextFloat() < moonBrightness）',
  'execute store result score $coin ' + NS + ' run random value 0..7',
  'execute if score $coin ' + NS + ' >= $snap.moon ' + NS + ' run function ' + NS + ':check/fail {reason:9}',
], '月相门（史莱姆）');
coin('coin_2of3', [
  'execute store result score $coin ' + NS + ' run random value 0..2',
  'execute if score $coin ' + NS + ' matches 0 run function ' + NS + ':check/fail {reason:9}',
], '2/3 通过（豹猫 nextInt(3) != 0）');
coin('coin_1of20', [
  'execute store result score $coin ' + NS + ' run random value 0..19',
  'execute if score $coin ' + NS + ' matches 1.. run function ' + NS + ':check/fail {reason:9}',
], '1/20 通过（恶魂 nextInt(20) == 0、守卫者同）');
coin('coin_1of15', [
  'execute store result score $coin ' + NS + ' run random value 0..14',
  'execute if score $coin ' + NS + ' matches 1.. run function ' + NS + ':check/fail {reason:9}',
], '1/15 通过（溺尸 · 高溺尸群系 nextInt(15) == 0）');
coin('coin_1of50', [
  'execute store result score $coin ' + NS + ' run random value 0..49',
  'execute if score $coin ' + NS + ' matches 1.. run function ' + NS + ':check/fail {reason:9}',
], '2% 通过（河流 water_ambient：nextFloat() < 0.98 直接不刷）');
F['data/' + NS + '/function/check/drowned_deep.funplaceholder'] = '';
delete F['data/' + NS + '/function/check/drowned_deep.funplaceholder'];
F['data/' + NS + '/function/check/drowned_deep.mcfunction'] = [
  '# ' + NS + ':check/drowned_deep —— 溺尸的自然刷怪门：1/40 掷币 + y < seaLevel-5（isDeepEnoughToSpawn）',
  'execute store result score $coin ' + NS + ' run random value 0..39',
  'execute if score $coin ' + NS + ' matches 1.. run function ' + NS + ':check/fail {reason:9}',
  'execute if score $py ' + NS + ' >= $chk.sea_deep ' + NS + ' run function ' + NS + ':check/fail {reason:9}',
].join(LF) + LF;


// ---------------------------------------------------------------- 海平面窗口（v4.14，按 $cfg.sealevel 每拍折算）
F['data/' + NS + '/function/check/sealevel.mcfunction'] = `# ${NS}:check/sealevel —— 由 $cfg.sealevel 折算各"海平面窗口"
#
# 原版出处：
#   WaterAnimal / AgeableWaterCreature : seaLevel-13 ≤ y ≤ seaLevel
#   GlowSquid                          : y ≤ seaLevel-33
#   Turtle                             : y < seaLevel+4
#   Drowned.isDeepEnoughToSpawn        : y < seaLevel-5
# 海平面本身来自噪声设置（主世界 63 / 下界 32 / 末地 0），现已进配置层 ⇒ 地图可覆盖。
# v4.14f：以 $snap.dim 选 per-dim 海平面（多玩家跨维度时，每次尝试都会先跑 pos/ctx 把维度改成"那个玩家的"）
scoreboard players operation $chk.sealevel ${NS} = $cfg.sea0 ${NS}
execute if score $att.dim ${NS} matches 1 run scoreboard players operation $chk.sealevel ${NS} = $cfg.sea1 ${NS}
execute if score $att.dim ${NS} matches 2 run scoreboard players operation $chk.sealevel ${NS} = $cfg.sea2 ${NS}
scoreboard players operation $chk.sea_lo ${NS} = $chk.sealevel ${NS}
scoreboard players remove $chk.sea_lo ${NS} 13
scoreboard players operation $chk.sea_hi ${NS} = $chk.sealevel ${NS}
scoreboard players operation $chk.sea_glow ${NS} = $chk.sealevel ${NS}
scoreboard players remove $chk.sea_glow ${NS} 33
scoreboard players operation $chk.sea_turtle ${NS} = $chk.sealevel ${NS}
scoreboard players add $chk.sea_turtle ${NS} 4
scoreboard players operation $chk.sea_deep ${NS} = $chk.sealevel ${NS}
scoreboard players remove $chk.sea_deep ${NS} 5
# v4.19：维度的世界下界（取点回退 pos/band_fallback 用它当均匀分布的下界；主世界 -64 / 下界 0 / 末地 0）
scoreboard players operation $chk.floorY ${NS} = $cfg.floor0 ${NS}
execute if score $att.dim ${NS} matches 1 run scoreboard players operation $chk.floorY ${NS} = $cfg.floor1 ${NS}
execute if score $att.dim ${NS} matches 2 run scoreboard players operation $chk.floorY ${NS} = $cfg.floor2 ${NS}
`;
// ---- 谓词 ----
// 光照：主世界/末地的区间近似（0..7）；下界单独一份（<=7，但方块光不设限）

// 落位：可生成空位 = 非完整碰撞盒（用方块标签近似）+ 非流体；下方必须可站立
F['data/' + NS + '/predicate/spawn/bright_enough.json'] = JSON.stringify({
  // 原版 Animal.isBrightEnoughToSpawn = getRawBrightness(pos, 0) > 8（不扣 skyDarken）。
  // 谓词读不到 raw 亮度，只能近似：综合亮度 ≥ 9（含 skyDarken）**或**该点能看到天空（白天/夜里 raw 都是 15）。
  condition: 'minecraft:any_of',
  terms: [
    { condition: 'minecraft:location_check', predicate: { light: { light: { min: 9 } } } },
    { condition: 'minecraft:location_check', predicate: { can_see_sky: true } },
  ],
}, null, 2) + LF;
F['data/' + NS + '/predicate/spawn/empty_here.json'] = JSON.stringify({
  condition: 'minecraft:location_check',
  predicate: { block: { blocks: ['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air', 'minecraft:short_grass', 'minecraft:tall_grass', 'minecraft:fern'] } },
}, null, 2) + LF;
// 可站立的下方方块（对齐 on_ground 的"1"判断：上表面完整支撑；带标签可按地图扩充）
const STANDABLE_VALUES = [
    // 常规完整碰撞面（工具 propose_tags.mjs 在真实地形上验证过覆盖面；雪片/水/树叶等**不在**此列）
    '#minecraft:dirt', '#minecraft:base_stone_overworld', '#minecraft:sand', '#minecraft:stone_bricks',
    '#minecraft:planks', '#minecraft:logs', '#minecraft:wool', '#minecraft:terracotta',
    'minecraft:grass_block', 'minecraft:gravel', 'minecraft:snow_block', 'minecraft:clay', 'minecraft:soul_sand',
    'minecraft:mud', 'minecraft:netherrack', 'minecraft:end_stone', 'minecraft:moss_block', 'minecraft:bedrock',
    'minecraft:deepslate', 'minecraft:tuff', 'minecraft:calcite', 'minecraft:blackstone', 'minecraft:basalt',
    // 冷原/冰原：ice 家族是完整方块（实测工具在雪原地形里占比 40% 却曾被漏掉）
    'minecraft:ice', 'minecraft:packed_ice', 'minecraft:blue_ice', 'minecraft:frosted_ice',
    // 其它常见地基
    'minecraft:obsidian', 'minecraft:crying_obsidian', 'minecraft:magma_block', 'minecraft:bone_block',
    'minecraft:amethyst_block', 'minecraft:smooth_basalt', 'minecraft:dripstone_block',
    'minecraft:packed_mud', 'minecraft:mud_bricks', 'minecraft:farmland', 'minecraft:dirt_path',
    'minecraft:honeycomb_block', 'minecraft:ochre_froglight', 'minecraft:verdant_froglight', 'minecraft:pearlescent_froglight',
    // 地狱/末地（那两维在测试世界里还没生成过区域，先按已知完整方块族预置；地图做完再跑 propose_tags 复验）
    '#minecraft:base_stone_nether', '#minecraft:nylium', '#minecraft:wart_blocks',
    'minecraft:shroomlight', 'minecraft:glowstone', 'minecraft:gilded_blackstone', 'minecraft:ancient_debris',
    'minecraft:sculk', 'minecraft:sculk_catalyst', 'minecraft:hay_block', 'minecraft:dried_kelp_block',
    'minecraft:honey_block', 'minecraft:slime_block', 'minecraft:target', 'minecraft:bookshelf',
    'minecraft:crafting_table', 'minecraft:furnace', 'minecraft:barrel', 'minecraft:redstone_lamp',
    'minecraft:melon', 'minecraft:pumpkin', 'minecraft:coal_block', 'minecraft:iron_block', 'minecraft:gold_block',
    'minecraft:diamond_block', 'minecraft:emerald_block', 'minecraft:lapis_block', 'minecraft:redstone_block',
    'minecraft:netherite_block', 'minecraft:copper_block', 'minecraft:exposed_copper', 'minecraft:weathered_copper', 'minecraft:oxidized_copper',
    'minecraft:prismarine', 'minecraft:dark_prismarine', 'minecraft:nether_bricks', 'minecraft:red_nether_bricks',
    'minecraft:quartz_block', 'minecraft:smooth_quartz', 'minecraft:sandstone', 'minecraft:red_sandstone',
];
F['data/' + NS + '/tags/block/standable.json'] = JSON.stringify({ values: STANDABLE_VALUES }, null, 2) + LF;

// v4.20（E5）水生落位的**流体语义**标签：原版 SpawnPlacements.IN_WATER 读的是 fluid state，
//   海草/海带/气泡柱的流体都是水 ⇒ 只看方块会把这些格子误拒。
//   ⚠ v4.24 修正：这个文件以前是**手写进产物**的（没有任何生成器产出它）⇒ 变体构建（v4x）里缺它、
//     check/entity 直接整函数加载失败（真机：Unknown block tag 'doom.nats:water_fluid'）。
//     现在收进生成器，两个变体都有。
F['data/' + NS + '/tags/block/water_fluid.json'] = JSON.stringify({
  values: ['minecraft:water', 'minecraft:seagrass', 'minecraft:tall_seagrass', 'minecraft:kelp', 'minecraft:kelp_plant', 'minecraft:bubble_column'],
}, null, 2) + LF;

// 可生成空位（对齐 isValidEmptySpawnBlock：非完整碰撞盒 ∧ 非流体；此处用"可替换/空气类"近似）
// v4.17（P1-7）修两处**误收**：
//   · `minecraft:water` —— 原版 isValidEmptySpawnBlock 会因"流体非空"直接否决（陆生生物不能生成在水方块里），
//     旧实现把 water 放进白名单 ⇒ 水下方是实心方块时会被误判为可生成（place 0/1/4 都会）。
//   · `minecraft:snow`（雪层）—— 它有碰撞盒（0..2/16），最后的 noCollision(AABB) 会否决它；
//     旧实现把它当"空位"⇒ 误收。真正的雪原地形里，落位面是雪层**下方**的方块，不受影响。
F['data/' + NS + '/tags/block/spawnable_at.json'] = JSON.stringify({
  values: ['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air', '#minecraft:replaceable',
    '#minecraft:flowers', '#minecraft:saplings', 'minecraft:short_grass', 'minecraft:tall_grass',
    'minecraft:fern', 'minecraft:large_fern', '#minecraft:crops',
    ...(LEGACY_AABB ? ['minecraft:snow', 'minecraft:water'] : [])],
}, null, 2) + LF;

// ---- v4.17（P1-7）：满碰撞方块标签 + AABB 便宜版的"居中窄条"放行清单 ----
// full_collision：default state 的碰撞盒 = **完整立方**。判据出处：
//   SpawnPlacementTypes.ON_GROUND → BlockState.isValidSpawn = state.isFaceSturdy(level,pos,UP)
//   → BlockBehaviour$BlockStateBase:536 isFaceSturdy(...,Direction.UP)（3 参版）= SupportType.FULL
//   → SupportType.FULL.isSupporting = Block.isFaceFull(state.getBlockSupportShape(level,pos), UP)
//   → Block.isFaceFull(VoxelShape,Direction) = isShapeFullBlock(shape.getFaceShape(dir))（:280-286）
//   半砖(bottom)/楼梯(bottom)/栅栏/玻璃板/雪层 的 UP 面**不满格** ⇒ 不可站立；
//   完整立方（含 top 半砖/正向楼梯）满格 ⇒ 可站立。数据包没法按 blockstate 判，故本标签按 **default state** 归类，
//   并把"top 半砖、double 半砖"这类特例写成已知偏差（docs/19 §七）。
//   ⚠ 不是完备清单（无法枚举碰撞形状）：缺失项只会让"下方可站立"判据**偏严**（不会误收）。
const FULL_COLLISION = [...new Set([
  // 1) standable 的全部条目（家族 + 字面 id）—— 直接复用，**由构造保证** standable ⊆ full_collision
  ...STANDABLE_VALUES,
  // 2) v4.17 新增：常见完整方块（原先缺 ⇒ 下方支撑判据偏严；只收"确信是完整立方"的）
  'minecraft:stone', 'minecraft:cobblestone', 'minecraft:mossy_cobblestone', 'minecraft:bricks',
  'minecraft:smooth_stone', 'minecraft:glass', 'minecraft:tinted_glass',
  'minecraft:chiseled_stone_bricks', 'minecraft:cracked_stone_bricks', 'minecraft:mossy_stone_bricks',
  'minecraft:polished_andesite', 'minecraft:polished_diorite', 'minecraft:polished_granite', 'minecraft:polished_deepslate',
  'minecraft:polished_tuff', 'minecraft:tuff_bricks', 'minecraft:chiseled_tuff', 'minecraft:chiseled_tuff_bricks',
  'minecraft:purpur_block', 'minecraft:purpur_pillar', 'minecraft:end_stone_bricks', 'minecraft:prismarine_bricks',
  'minecraft:quartz_bricks', 'minecraft:quartz_pillar', 'minecraft:chiseled_quartz_block',
  'minecraft:cut_sandstone', 'minecraft:chiseled_sandstone', 'minecraft:smooth_sandstone',
  'minecraft:cut_red_sandstone', 'minecraft:chiseled_red_sandstone', 'minecraft:smooth_red_sandstone',
  'minecraft:coal_ore', 'minecraft:iron_ore', 'minecraft:copper_ore', 'minecraft:gold_ore', 'minecraft:redstone_ore',
  'minecraft:lapis_ore', 'minecraft:diamond_ore', 'minecraft:emerald_ore',
  'minecraft:deepslate_coal_ore', 'minecraft:deepslate_iron_ore', 'minecraft:deepslate_gold_ore', 'minecraft:deepslate_diamond_ore',
  'minecraft:deepslate_emerald_ore', 'minecraft:deepslate_lapis_ore', 'minecraft:deepslate_redstone_ore',
  'minecraft:nether_gold_ore', 'minecraft:nether_quartz_ore',
  'minecraft:beacon', 'minecraft:sea_lantern', 'minecraft:note_block', 'minecraft:jukebox', 'minecraft:observer',
  'minecraft:piston', 'minecraft:sticky_piston', 'minecraft:dispenser', 'minecraft:dropper', 'minecraft:lodestone',
  'minecraft:respawn_anchor', 'minecraft:blast_furnace', 'minecraft:smoker',
])];
// narrow_partial：碰撞盒是"居中窄条/薄片"的方块 —— 宽体/高体生物的 AABB 只伸进邻格一条窄缝
//   （蜘蛛 width 1.4 ⇒ 从格心伸进邻格 0.2），几何上够不到这些碰撞盒 ⇒ 原版 noCollision 不会因它们否决。
//   这不是"满碰撞"，恰恰是"非满碰撞里**不会**挡住邻格边条"的那一类；半砖/楼梯/雪层/地毯占满 1×1 占地面积，
//   边条照样会撞上 ⇒ **不在此列**（保持否决，与原版一致）。
const NARROW_PARTIAL = [
  '#minecraft:fences', '#minecraft:fence_gates', '#minecraft:walls', 'minecraft:iron_bars', 'minecraft:chain',
  'minecraft:glass_pane', 'minecraft:white_stained_glass_pane', 'minecraft:orange_stained_glass_pane',
  'minecraft:magenta_stained_glass_pane', 'minecraft:light_blue_stained_glass_pane', 'minecraft:yellow_stained_glass_pane',
  'minecraft:lime_stained_glass_pane', 'minecraft:pink_stained_glass_pane', 'minecraft:gray_stained_glass_pane',
  'minecraft:light_gray_stained_glass_pane', 'minecraft:cyan_stained_glass_pane', 'minecraft:purple_stained_glass_pane',
  'minecraft:blue_stained_glass_pane', 'minecraft:brown_stained_glass_pane', 'minecraft:green_stained_glass_pane',
  'minecraft:red_stained_glass_pane', 'minecraft:black_stained_glass_pane',
  'minecraft:torch', 'minecraft:wall_torch', 'minecraft:soul_torch', 'minecraft:soul_wall_torch',
  'minecraft:redstone_torch', 'minecraft:redstone_wall_torch',
  'minecraft:lantern', 'minecraft:soul_lantern', 'minecraft:end_rod', 'minecraft:lightning_rod',
  '#minecraft:buttons', 'minecraft:lever', 'minecraft:tripwire_hook',
  '#minecraft:flower_pots', '#minecraft:candles',
];
F['data/' + NS + '/tags/block/full_collision.json'] = JSON.stringify({ values: FULL_COLLISION }, null, 2) + LF;
F['data/' + NS + '/tags/block/narrow_partial.json'] = JSON.stringify({
  note: 'AABB 便宜版的放行清单：碰撞盒为"居中窄条/薄片"的方块（宽体生物够不到边条）。判据与出处见 gen_check.mjs 顶部注释',
  values: NARROW_PARTIAL,
}, null, 2) + LF;
// 不变式（生成期断言）：standable 里的**字面**条目必须在 full_collision 里 ⊆
//   （家族标签（#…）无法低成本展开，故只查字面 id；两者取并集使用，漏项只会偏严）
{
  const standableValues = JSON.parse(F['data/' + NS + '/tags/block/standable.json']).values;
  const missing = standableValues.filter((v) => !v.startsWith('#') && !FULL_COLLISION.includes(v));
  if (missing.length) { console.error('❌ standable ⊄ full_collision，缺: ' + missing.join(', ')); process.exit(1); }
}

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
  if (drift.length) { console.log('与生成器不一致:'); for (const d of drift) console.log('  -', d); process.exit(1); }
  console.log('一致：' + Object.keys(F).length + ' 个文件');
} else {
  console.log('=== gen_check 完成 ===');
  console.log('输出:', PACK, '| 文件:', Object.keys(F).length);
  console.log('合法性链: distance → light → block → cap（每步可归因）');
}
