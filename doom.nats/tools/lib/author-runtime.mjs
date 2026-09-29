// tools/lib/author-runtime.mjs —— 「运行时刻作者层」的**唯一**构建器（v4.24）。
//
// 为什么做成库：本包有两个变体，两层运行时刻配置需要**同一套机制**：
//   · 默认变体：`doom.nats:author`（原版复刻 + 本包稳定扩展）—— 函数在 `doom.nats:author/*`
//   · 实验性变体：`doom.nats:exp`（非原版能力：near 关系条件 / on_spawn 演出 / preset 预设）
//     —— 函数在 `doom.nats:exp/*`，实体标签 `doom.nats.exp.*`，storage `doom.nats:exp`
// 两份产物**不共用函数**（命名隔离），但共用同一份实现与同一套真机验证过的机制。
//
// 数据形状（与 rules/*.json 同构，可直接把 JSON 灌进 storage）：
//   storage = {
//     entityRules: { "<实体 id>": { belowAny:[…≤8], yMin, yMax, lightMin, lightMax, weather,
//                                    biomeIn:[…≤4], biomeNot:[…≤4], place, light, persist } },
//     entries:     [ { id, mob, biome|biomes, category, weight, min, max, nbt, when:{…}, on_spawn } ],
//     counts:      { groupByY: { "<实体 id>": [ {yMin,yMax,min,max} ≤8 ] },
//                    capByY:   { "<类别>":   [ {yMin,yMax,max,localMax} ≤8 ] } }
//   }
//   实验性层额外多一个总开关：`enabled: 1b`（缺失或 0 ⇒ 整层不生效 = 行为回滚到原版/稳定层）。
//
// 真机机制（2026-09-29 在隔离实例 fid 上逐条验过，脚本 `_work/_probe_mech.mjs`）：
//   · 宏能把 storage 里的**字符串**替换进 NBT 路径与命令参数 ⇒ `entityRules."$(type)"`、
//     `if biome ~ ~ ~ $(b)`、`predicate …/light_le_$(lightMax)` 都成立；
//   · 宏**缺参** ⇒ 被调函数整个中止（"Failed to instantiate"）⇒ 每个宏调用都必须先守卫，
//     且被调函数的宏源里**所有**占位符都必须存在（统一用 `merge value {默认…}` 补齐）；
//   · 嵌套调用里失败**不会**中止调用者 ⇒ 最坏影响被限制在被调函数内（on_spawn 缺文件即此情形）；
//   · `data modify … merge value/from storage` 递归合并且会创建缺失的父路径；
//   · `merge from storage <id> <path>` 的源必须是复合标签（否则 "Expected object"）⇒ 一律 `if data` 守卫。
const LF = String.fromCharCode(10);

// 数组上限：SPEC 规定额外落位面标签 ≤8、Y 段 ≤8；群系白/黑名单同类上限 4。
export const CAP_TAGS = 8;
export const CAP_BANDS = 8;
export const CAP_BIOMES = 4;
const LO = -2147483648;
const HI = 2147483647;

/**
 * @param {object} cfg
 *   dir        函数子目录（author | exp）
 *   title      人类可读层名
 *   storage    配置 storage（doom.nats:author | doom.nats:exp）
 *   scratch    运行缓存 storage
 *   input      命令面入参 storage
 *   score      计分板 holder 前缀（$auth | $exp）
 *   tagPrefix  作者标签前缀（doom.nats.author. | doom.nats.exp.）
 *   exp        true ⇒ 生成实验性附加能力（enabled 总开关 / near / on_spawn / preset）
 *   entryIds   构建期条目 id（生成 on_spawn 占位函数）
 *   slugs      [[slug, type], …] 生物注册表（实体 id → slug 反查）
 *   presets    {名称: 预设对象}（仅 exp）
 */
export function buildLayer(cfg) {
  const { dir, title, storage, scratch: RT, input: IN, score: S, tagPrefix } = cfg;
  const exp = !!cfg.exp;
  const NS = 'doom.nats';
  const FUNC = 'data/' + NS + '/function/' + dir + '/';
  const F = {};

  const H = (name, ...lines) => ['# ' + NS + ':' + dir + '/' + name, ...lines].join(LF) + LF;

  // ---------------------------------------------------------------- 1) 装载 / 展示 / 重置 / 导出 / 帮助
  const summaryScan = [
    '# 覆盖摘要（同时供 load 与 show 用）：条目数用固定槽位枚举（上限 ' + CAP_TAGS + '），不做运行期遍历。',
    'scoreboard players set ' + S + '.n ' + NS + ' 0',
    ...Array.from({ length: CAP_TAGS }, (_, i) =>
      'execute if data storage ' + storage + ' entries[' + i + '] run scoreboard players set ' + S + '.n ' + NS + ' ' + (i + 1)),
    'scoreboard players set ' + S + '.f1 ' + NS + ' 0',
    'execute if data storage ' + storage + ' entityRules run scoreboard players set ' + S + '.f1 ' + NS + ' 1',
    'scoreboard players set ' + S + '.f2 ' + NS + ' 0',
    'execute if data storage ' + storage + ' counts.groupByY run scoreboard players set ' + S + '.f2 ' + NS + ' 1',
    'scoreboard players set ' + S + '.f3 ' + NS + ' 0',
    'execute if data storage ' + storage + ' counts.capByY run scoreboard players set ' + S + '.f3 ' + NS + ' 1',
    ...(exp ? [
      'scoreboard players set ' + S + '.on ' + NS + ' 0',
      // 注意：execute if data storage <id>{…} 是非法语法（真机报 trailing data）⇒ 用 data get 把开关读成分数
      'execute if data storage ' + storage + ' enabled run execute store result score ' + S + '.on ' + NS + ' run data get storage ' + storage + ' enabled',
    ] : []),
    'execute store result storage ' + RT + ' sum.n int 1 run scoreboard players get ' + S + '.n ' + NS,
    'execute store result storage ' + RT + ' sum.rules int 1 run scoreboard players get ' + S + '.f1 ' + NS,
    'execute store result storage ' + RT + ' sum.gy int 1 run scoreboard players get ' + S + '.f2 ' + NS,
    'execute store result storage ' + RT + ' sum.cap int 1 run scoreboard players get ' + S + '.f3 ' + NS,
    ...(exp ? ['execute store result storage ' + RT + ' sum.on int 1 run scoreboard players get ' + S + '.on ' + NS] : []),
  ];
  F[FUNC + 'summary.mcfunction'] = H('summary —— 数一遍当前覆盖', '# 结果写 ' + RT + ':sum（n / rules / gy / cap' + (exp ? ' / on' : '') + '）') + summaryScan.join(LF) + LF;

  F[FUNC + 'say_summary.mcfunction'] = [
    '# ' + NS + ':' + dir + '/say_summary [MACRO] —— 摘要打进服务器日志（无真人也能采）',
    '# 用法：function ' + NS + ':' + dir + '/say_summary with storage ' + RT + ' sum',
    '$say [nats.' + dir + '] entries=$(n) entityRules=$(rules) groupByY=$(gy) capByY=$(cap)' + (exp ? ' enabled=$(on)' : ''),
    '',
  ].join(LF);

  F[FUNC + 'load.mcfunction'] = H('load —— 装载/刷新' + title + '（默认空 ⇒ 完全静默）',
    '# 由 core/setup 在每次装载时调用；玩家改完 storage 也可以手动跑一次（不跑也生效：判定当场读 storage）。',
    '# "装载"做的事：清掉上一次的运行缓存 + 重算覆盖摘要 + 打一行日志。',
    '# 注意：data remove storage <id> 必须带 path（真机实测：不带 path 报 Unknown or incomplete command）',
    'data remove storage ' + RT + ' cur',
    'data remove storage ' + RT + ' hit',
    'data remove storage ' + RT + ' gy',
    'data remove storage ' + RT + ' cap',
    'scoreboard players set ' + S + '.loaded ' + NS + ' 0',
    'scoreboard players set ' + S + '.hit ' + NS + ' 0',
    'scoreboard players set ' + S + '.hook ' + NS + ' 0',
    'scoreboard players set ' + S + '.cap ' + NS + ' -1',
    'scoreboard players set ' + S + '.lmax ' + NS + ' -1',
    'scoreboard players set $chk.belowok ' + NS + ' 0',
    'function ' + NS + ':' + dir + '/summary',
    'execute if score ' + S + '.n ' + NS + ' matches 1.. run function ' + NS + ':' + dir + '/say_summary with storage ' + RT + ' sum',
    'execute if score ' + S + '.f1 ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/say_summary with storage ' + RT + ' sum',
    'execute if score ' + S + '.f2 ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/say_summary with storage ' + RT + ' sum',
    'execute if score ' + S + '.f3 ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/say_summary with storage ' + RT + ' sum',
    ...(exp ? ['execute if score ' + S + '.on ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/say_summary with storage ' + RT + ' sum'] : []),
    '');
  F[FUNC + 'show.mcfunction'] = H('show —— 打印当前覆盖（聊天栏 + 日志）',
    '# 完整 SNBT 用 `data get storage` 打给执行者（可直接复制去别处）；摘要打给聊天栏与日志。',
    'function ' + NS + ':' + dir + '/summary',
    'tellraw @s [{"text":"=== ' + NS + ' ' + title + ' ===","color":"aqua"},{"text":"  条目 ","color":"gray"},{"score":{"name":"' + S + '.n","objective":"' + NS + '"}},{"text":" 条 · entityRules ","color":"gray"},{"score":{"name":"' + S + '.f1","objective":"' + NS + '"}},{"text":" · groupByY ","color":"gray"},{"score":{"name":"' + S + '.f2","objective":"' + NS + '"}},{"text":" · capByY ","color":"gray"},{"score":{"name":"' + S + '.f3","objective":"' + NS + '"}}' + (exp ? ',{"text":" · 实验性开关 ","color":"gold"},{"score":{"name":"' + S + '.on","objective":"' + NS + '"}}' : '') + ']',
    'data get storage ' + storage,
    ...(exp ? [
      '# SPEC 追加 #4 第 3 条：show 里要能看到"实验性开关 + 最近一次命中的条目"（开关已在上面的 tellraw 里）',
      'execute if data storage ' + RT + ' hit.id run tellraw @s [{"text":"  最近一次命中的条目：","color":"gold"},{"nbt":"hit.id","storage":"' + RT + '","interpret":false}]',
      'execute unless data storage ' + RT + ' hit.id run tellraw @s [{"text":"  最近一次命中的条目：（还没有命中过）","color":"dark_gray"}]',
    ] : []),
    'function ' + NS + ':' + dir + '/say_summary with storage ' + RT + ' sum',
    '',
  );

  F[FUNC + 'reset.mcfunction'] = H('reset —— 清空本层（回到上一层行为）',
    '# 契约：reset 之后与"从来没有这一层"逐条一致（' + (exp ? '回到稳定层 = 原版语义' : '回到原版') + '）。',
    '# 注意：data remove storage <id> 必须带 path ⇒ 按本层的三个键逐个删（作者额外塞的键不在契约内）',
    'data remove storage ' + storage + ' entityRules',
    'data remove storage ' + storage + ' entries',
    'data remove storage ' + storage + ' counts',
    'function ' + NS + ':' + dir + '/load',
    'say [nats.' + dir + '] reset：' + title + '已清空',
    'tellraw @s [{"text":"' + title + '已清空：storage ' + storage + ' 删除。","color":"green"}]',
    '',
  );

  F[FUNC + 'export.mcfunction'] = H('export —— 把当前覆盖打成一条可复制的命令',
    '# 输出一条 `/data modify storage ' + storage + ' set value {…}`：粘到任何存档/别的实例都能复现同一套覆盖。',
    'scoreboard players set ' + S + '.f0 ' + NS + ' 0',
    'execute if data storage ' + storage + ' entityRules run scoreboard players set ' + S + '.f0 ' + NS + ' 1',
    'execute if data storage ' + storage + ' entries[0] run scoreboard players set ' + S + '.f0 ' + NS + ' 1',
    'execute if data storage ' + storage + ' counts run scoreboard players set ' + S + '.f0 ' + NS + ' 1',
    'execute if score ' + S + '.f0 ' + NS + ' matches 1 run data modify storage ' + RT + ' export set value {}',
    'execute if score ' + S + '.f0 ' + NS + ' matches 1 run data modify storage ' + RT + ' export.x set from storage ' + storage,
    'execute unless score ' + S + '.f0 ' + NS + ' matches 1 run tellraw @s [{"text":"（本层为空，没有可导出的覆盖）","color":"gray"}]',
    'execute if score ' + S + '.f0 ' + NS + ' matches 1 run tellraw @s [{"text":"/data modify storage ' + storage + ' set value ","color":"gray"},{"nbt":"x","storage":"' + RT + '","interpret":false}]',
    'execute if score ' + S + '.f0 ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/export_say with storage ' + RT + ' export',
    '',
  );
  F[FUNC + 'export_say.mcfunction'] = [
    '# ' + NS + ':' + dir + '/export_say [MACRO] —— 把导出的 SNBT 打进日志（无真人也能采）',
    '# 用法：function ' + NS + ':' + dir + '/export_say with storage ' + RT + ' export',
    '$say [nats.' + dir + '] export=$(x)',
    '',
  ].join(LF);

  // ---------------------------------------------------------------- 2) 命令面
  F[FUNC + 'add_below_tag.mcfunction'] = H('add_below_tag [MACRO] —— 追加一条"额外落位面"标签',
    '# 用法：data merge storage ' + IN + ' {type:"minecraft:zombie",tag:"#minecraft:leaves"}',
    '#       function ' + NS + ':' + dir + '/add_below_tag',
    '$execute unless data storage ' + storage + ' entityRules."$(type)".belowAny run data modify storage ' + storage + ' entityRules."$(type)".belowAny set value []',
    '$execute if data storage ' + storage + ' entityRules."$(type)".belowAny[' + CAP_TAGS + '] run tellraw @s [{"text":"belowAny 已满（上限 ' + CAP_TAGS + ' 条）","color":"red"}]',
    '$execute unless data storage ' + storage + ' entityRules."$(type)".belowAny[' + CAP_TAGS + '] run data modify storage ' + storage + ' entityRules."$(type)".belowAny append value "$(tag)"',
    'say [nats.' + dir + '] add_below_tag 已写入（改 storage 即刻生效）',
    '',
  );

  F[FUNC + 'set_group_by_y.mcfunction'] = H('set_group_by_y [MACRO] —— 追加一段"每次生几只"的 Y 段',
    '# 用法：data merge storage ' + IN + ' {type:"minecraft:zombie",yMin:1,yMax:63,min:2,max:3}',
    '#       function ' + NS + ':' + dir + '/set_group_by_y   （段按写入顺序求值，后面的覆盖前面的）',
    '$execute unless data storage ' + storage + ' counts.groupByY."$(type)" run data modify storage ' + storage + ' counts.groupByY."$(type)" set value []',
    '$execute if data storage ' + storage + ' counts.groupByY."$(type)"[' + CAP_BANDS + '] run tellraw @s [{"text":"该物种的 Y 段已满（上限 ' + CAP_BANDS + ' 段）","color":"red"}]',
    '$execute unless data storage ' + storage + ' counts.groupByY."$(type)"[' + CAP_BANDS + '] run data modify storage ' + storage + ' counts.groupByY."$(type)" append value {yMin:$(yMin),yMax:$(yMax),min:$(min),max:$(max)}',
    'say [nats.' + dir + '] set_group_by_y 已写入（改 storage 即刻生效）',
    '',
  );

  F[FUNC + 'set_cap_y.mcfunction'] = H('set_cap_y [MACRO] —— 追加一段"该类容量"的 Y 段',
    '# 用法：data merge storage ' + IN + ' {category:"monster",yMax:0,max:200,localMax:140}',
    '#       function ' + NS + ':' + dir + '/set_cap_y   （max=全局容量 / localMax=每玩家上限；两个都能单独给）',
    '$execute unless data storage ' + storage + ' counts.capByY."$(category)" run data modify storage ' + storage + ' counts.capByY."$(category)" set value []',
    '$execute if data storage ' + storage + ' counts.capByY."$(category)"[' + CAP_BANDS + '] run tellraw @s [{"text":"该类别的 Y 段已满（上限 ' + CAP_BANDS + ' 段）","color":"red"}]',
    '$execute unless data storage ' + storage + ' counts.capByY."$(category)"[' + CAP_BANDS + '] run data modify storage ' + storage + ' counts.capByY."$(category)" append value {yMin:$(yMin),yMax:$(yMax),max:$(max),localMax:$(localMax)}',
    'say [nats.' + dir + '] set_cap_y 已写入（改 storage 即刻生效）',
    '',
  );

  F[FUNC + 'add_entry.mcfunction'] = H('add_entry [MACRO] —— 追加一条"条件刷怪条目"',
    '# 用法：data modify storage ' + IN + ' entry set value {id:"x",mob:"minecraft:zombie",biome:"#minecraft:is_overworld",category:"monster",weight:40,when:{thundering:1b},nbt:"{CustomName:\'{\\"text\\":\\"X\\"}\'}"}',
    '#       function ' + NS + ':' + dir + '/add_entry',
    '# 整条条目按原样追加（与 rules/entries.json 同构）⇒ 缺的字段由判定层补默认值。',
    'execute unless data storage ' + storage + ' entries run data modify storage ' + storage + ' entries set value []',
    'execute if data storage ' + storage + ' entries[' + CAP_TAGS + '] run tellraw @s [{"text":"条目已满（上限 ' + CAP_TAGS + ' 条）","color":"red"}]',
    '$execute unless data storage ' + storage + ' entries[' + CAP_TAGS + '] run data modify storage ' + storage + ' entries append value $(entry)',
    'say [nats.' + dir + '] add_entry 已写入（改 storage 即刻生效）',
    '',
  );

  if (exp) {
    F[FUNC + 'enable.mcfunction'] = H('enable —— 打开实验性总开关（实验性能力只在这个开关为 1 时生效）',
      '# 引擎级 `features` 决定"能不能装"；这个开关决定"行为回不回滚"，两者配合见 docs/18。',
      'data modify storage ' + storage + ' enabled set value 1b',
      'function ' + NS + ':' + dir + '/load',
      'tellraw @s [{"text":"实验性层：已开启（非原版能力生效）","color":"gold"}]',
      '',
    );
    F[FUNC + 'disable.mcfunction'] = H('disable —— 关掉实验性总开关（= 行为回滚到稳定层/原版）',
      '# 条目与规则都留着不动，只是整层不再参与判定 ⇒ 一个命令即可回滚。',
      'data modify storage ' + storage + ' enabled set value 0b',
      'function ' + NS + ':' + dir + '/load',
      'tellraw @s [{"text":"实验性层：已关闭（行为回到稳定层/原版）","color":"gold"}]',
      '',
    );
  }

  const help = [
    'tellraw @s [{"text":"=== ' + NS + ' ' + title + '（改 storage 即刻生效，不用重生成包）===","color":"aqua"}]',
    'tellraw @s [{"text":"[1] 直接改 storage：","color":"yellow"},{"text":"data modify storage ' + storage + ' entityRules.\\"minecraft:zombie\\".belowAny set value [\\"#minecraft:leaves\\"]","color":"gray"}]',
    'tellraw @s [{"text":"[2] 条目：","color":"yellow"},{"text":"data modify storage ' + IN + ' entry set value {id:\\"x\\",mob:\\"minecraft:zombie\\",biome:\\"#minecraft:is_overworld\\",category:\\"monster\\",weight:40,when:{thundering:1b}} + function ' + NS + ':' + dir + '/add_entry","color":"gray"}]',
    'tellraw @s [{"text":"[3] 额外落位面：","color":"yellow"},{"text":"{type:\\"minecraft:zombie\\",tag:\\"#minecraft:leaves\\"} + ' + NS + ':' + dir + '/add_below_tag","color":"gray"}]',
    'tellraw @s [{"text":"[4] 组大小随 Y：","color":"yellow"},{"text":"{type:\\"minecraft:zombie\\",yMax:0,min:4,max:6} + ' + NS + ':' + dir + '/set_group_by_y","color":"gray"}]',
    'tellraw @s [{"text":"[5] 容量随 Y：","color":"yellow"},{"text":"{category:\\"monster\\",yMax:0,max:200,localMax:140} + ' + NS + ':' + dir + '/set_cap_y","color":"gray"}]',
    'tellraw @s [{"text":"[6] 看/导出/重置：","color":"yellow"},{"text":"function ' + NS + ':' + dir + '/show · export · reset","color":"gray"}]',
    'tellraw @s [{"text":"字段（entityRules）：belowAny(≤8) yMin yMax lightMin lightMax weather(thunder|rain|clear) biomeIn(≤4) biomeNot(≤4) place light persist","color":"white"}]',
    'tellraw @s [{"text":"字段（entries）：id mob biome category weight min max nbt when{thundering raining yMin yMax lightMin lightMax}","color":"white"}]',
    'tellraw @s [{"text":"上限：条目 ≤8 · Y 段 ≤8 · 落位面标签 ≤8 · 群系白/黑名单各 ≤4。未列出的构建期字段（coins/cluster/deep…）请在 rules/ 里改。","color":"dark_gray"}]',
  ];
  if (exp) {
    help.splice(6, 0,
      'tellraw @s [{"text":"[6] 总开关：","color":"yellow"},{"text":"function ' + NS + ':' + dir + '/enable · disable（关掉 = 行为回滚）","color":"gray"}]',
      'tellraw @s [{"text":"[7] 实验性能力（开关为 1 才生效）：条目 when.near{type,radius,min,max}（关系条件，非原版）· 条目 on_spawn:1b + 自查 ' + NS + ':' + dir + '/on_spawn/<id> 文件（演出钩子）· function ' + NS + ':' + dir + '/preset","color":"gold"}]',
    );
    help[help.length - 1] = 'tellraw @s [{"text":"上限：条目 ≤8 · Y 段 ≤8 · 落位面标签 ≤8 · 群系白/黑名单各 ≤4。未列出的构建期字段（coins/cluster/deep…）请在 rules/ 里改。","color":"dark_gray"}]';
  }
  F[FUNC + 'help.mcfunction'] = H('help —— ' + title + '用法', ...(exp ? ['# 标 gold 的那些是**非原版**能力：只在 `enabled:1b` 时生效。'] : [])) + help.join(LF) + LF;

  // ---------------------------------------------------------------- 2b) 命令面演示（也是"命令面函数被 with 调用"的真实调用点）
  // 为什么需要：add_below_tag / set_group_by_y / set_cap_y / add_entry 是**玩家入口**（由玩家用
  //   `/function … with storage <入参 storage>` 调用），包里没有别的调用点；没有调用点时静态门 L5 会
  //   报"含宏行但没有任何 with 调用"。这里给一个真用得上的演示：先写一份示例覆盖，再逐个走命令面。
  //   需要显式开闸（$auth.demo/$exp.demo = 1），默认不会自己跑，最后用 reset 一键清掉。
  F[FUNC + 'demo.mcfunction'] = H('demo —— 命令面演示（必须显式开闸，会写入本层覆盖）',
    '# 用法：scoreboard players set ' + S + '.demo ' + NS + ' 1',
    '#       function ' + NS + ':' + dir + '/demo',
    '#       function ' + NS + ':' + dir + '/reset      ← 演示完想还原就跑这个',
    'execute unless score ' + S + '.demo ' + NS + ' matches 1 run tellraw @s [{"text":"演示未开闸：先 scoreboard players set ' + S + '.demo ' + NS + ' 1","color":"yellow"}]',
    'execute if score ' + S + '.demo ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/demo_run',
    'execute if score ' + S + '.demo ' + NS + ' matches 1 run scoreboard players set ' + S + '.demo ' + NS + ' 0',
    '');
  F[FUNC + 'demo_run.mcfunction'] = H('demo_run —— 演示体（逐条走命令面；带开闸守卫，关闸即 no-op）') + [
    'execute if score ' + S + '.demo ' + NS + ' matches 1 run data merge storage ' + IN + ' {type:"minecraft:zombie",tag:"#minecraft:leaves"}',
    'execute if score ' + S + '.demo ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/add_below_tag with storage ' + IN,
    'execute if score ' + S + '.demo ' + NS + ' matches 1 run data merge storage ' + IN + ' {type:"minecraft:zombie",yMin:0,yMax:63,min:2,max:3}',
    'execute if score ' + S + '.demo ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/set_group_by_y with storage ' + IN,
    'execute if score ' + S + '.demo ' + NS + ' matches 1 run data merge storage ' + IN + ' {category:"monster",yMin:0,yMax:63,max:120,localMax:70}',
    'execute if score ' + S + '.demo ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/set_cap_y with storage ' + IN,
    'execute if score ' + S + '.demo ' + NS + ' matches 1 run data modify storage ' + IN + ' entry set value {id:"demo_zombie",mob:"minecraft:zombie",biome:"#minecraft:is_overworld",category:"monster",weight:20}',
    'execute if score ' + S + '.demo ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/add_entry with storage ' + IN,
    'execute if score ' + S + '.demo ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/show',
    ...(exp ? [
      'execute if score ' + S + '.demo ' + NS + ' matches 1 run data merge storage ' + IN + ' {name:"blood_moon"}',
      'execute if score ' + S + '.demo ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/preset with storage ' + IN,
    ] : []),
    '',
  ].join(LF);

  // ---------------------------------------------------------------- 3) 选中物种后的装载（规则补丁 + groupByY）
  F[FUNC + 'row.mcfunction'] = H('row [MACRO] —— 选中物种后的运行时刻装载（每组一次）',
    '# 用法：function ' + NS + ':' + dir + '/row with storage ' + NS + ':sel',
    '# ① 规则补丁：先铺默认值（保证宏占位符齐全），再合并该物种的补丁',
    'data modify storage ' + RT + ' cur set value {yMin:' + LO + ',yMax:' + HI + ',lightMax:15,lightMin:0,weather:"any",place:"",light:"",persist:0}',
    'scoreboard players set ' + S + '.loaded ' + NS + ' 0',
    '$execute if data storage ' + storage + ' entityRules."$(type)" run data modify storage ' + RT + ' cur merge from storage ' + storage + ' entityRules."$(type)"',
    '$execute if data storage ' + storage + ' entityRules."$(type)" run function ' + NS + ':' + dir + '/rule_on',
    'execute if score ' + S + '.loaded ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/rule_place',
    '# ② 组大小随 Y（counts.groupByY.<实体>）',
    'data remove storage ' + RT + ' gy',
    '$execute if data storage ' + storage + ' counts.groupByY."$(type)" run data modify storage ' + RT + ' gy set from storage ' + storage + ' counts.groupByY."$(type)"',
    ...Array.from({ length: CAP_BANDS }, (_, i) =>
      'execute if data storage ' + RT + ' gy[' + i + '] run function ' + NS + ':' + dir + '/gy_' + i),
    '',
  );

  F[FUNC + 'rule_on.mcfunction'] = H('rule_on —— 展开规则补丁里的数组（belowAny / biomeIn / biomeNot）',
    '# 数组元素是**字符串**，不能直接当宏源（宏源必须是复合标签）⇒ 逐个包成 {t:…}/{b:…} 再交给宏。',
    '# 上限：落位面标签 ' + CAP_TAGS + ' 条、群系白/黑名单各 ' + CAP_BIOMES + ' 条。',
    'scoreboard players set ' + S + '.loaded ' + NS + ' 1',
    'scoreboard players set $chk.belowok ' + NS + ' 0',
    ...Array.from({ length: CAP_TAGS }, (_, i) => [
      'data remove storage ' + RT + ' w' + i,
      'execute if data storage ' + RT + ' cur.belowAny[' + i + '] run data modify storage ' + RT + ' w' + i + '.t set from storage ' + RT + ' cur.belowAny[' + i + ']',
    ]).flat(),
    'data remove storage ' + RT + ' v',
    ...Array.from({ length: CAP_BIOMES }, (_, i) =>
      'execute if data storage ' + RT + ' cur.biomeIn[' + i + '] run data modify storage ' + RT + ' v.m' + i + '.b set from storage ' + RT + ' cur.biomeIn[' + i + ']'),
    'data remove storage ' + RT + ' n',
    ...Array.from({ length: CAP_BIOMES }, (_, i) =>
      'execute if data storage ' + RT + ' cur.biomeNot[' + i + '] run data modify storage ' + RT + ' n.m' + i + '.b set from storage ' + RT + ' cur.biomeNot[' + i + ']'),
    '',
  );

  F[FUNC + 'rule_place.mcfunction'] = H('rule_place —— 规则补丁里的 place / light / persist（字符串→枚举值）',
    '# 与构建期 rules/entity-rules.json 的 place/light 词表同一套编号（见 rules/README.md）。',
    '# place 0=通用陆生 1=无落位限制 2=水中 3=水面窗口 4=陆生+专属标签 5=岩浆',
    'execute if data storage ' + RT + ' cur{place:"ground"} run scoreboard players set $sel.place ' + NS + ' 0',
    'execute if data storage ' + RT + ' cur{place:"any"} run scoreboard players set $sel.place ' + NS + ' 1',
    'execute if data storage ' + RT + ' cur{place:"water"} run scoreboard players set $sel.place ' + NS + ' 2',
    'execute if data storage ' + RT + ' cur{place:"water_surface"} run scoreboard players set $sel.place ' + NS + ' 3',
    'execute if data storage ' + RT + ' cur{place:"below_tag"} run scoreboard players set $sel.place ' + NS + ' 4',
    'execute if data storage ' + RT + ' cur{place:"lava"} run scoreboard players set $sel.place ' + NS + ' 5',
    ...['none', 'dark', 'bright', 'bat', 'slime', 'glow', 'bl8'].map((l, i) =>
      'execute if data storage ' + RT + ' cur{light:"' + l + '"} run scoreboard players set $sel.light ' + NS + ' ' + i),
    'execute if data storage ' + RT + ' cur{persist:1b} run data modify storage ' + NS + ':sel nbt.PersistenceRequired set value 1b',
    '',
  );

  for (let i = 0; i < CAP_BANDS; i++) {
    F[FUNC + 'gy_' + i + '.mcfunction'] = H('gy_' + i + ' —— counts.groupByY 第 ' + i + ' 段',
      '# 由 row 逐段调用（顺序即优先级：后面的段覆盖前面的段）。') + [
      'data modify storage ' + RT + ' b set value {yMin:' + LO + ',yMax:' + HI + ',min:1,max:1}',
      'data modify storage ' + RT + ' b merge from storage ' + RT + ' gy[' + i + ']',
      'execute if data storage ' + RT + ' gy[' + i + '].min if data storage ' + RT + ' gy[' + i + '].max run function ' + NS + ':' + dir + '/band_group with storage ' + RT + ' b',
      '',
    ].join(LF);
  }
  F[FUNC + 'band_group.mcfunction'] = [
    '# ' + NS + ':' + dir + '/band_group [MACRO] —— 把一段"每次生几只"写进 ' + NS + ':sel（覆盖香草 min/max）',
    '# 用法：function ' + NS + ':' + dir + '/band_group with storage ' + RT + ' b',
    '$execute if score $py ' + NS + ' matches $(yMin)..$(yMax) run data merge storage ' + NS + ':sel {min:$(min),max:$(max)}',
    '',
  ].join(LF);

  // ---------------------------------------------------------------- 4) 额外落位面 / 群系名单 / 标量窗口
  F[FUNC + 'below_check.mcfunction'] = H('below_check —— 规则补丁里的 belowAny：逐条 `if block ~ ~-1 ~ <标签>`',
    '# 调用点：check/block 开头（仅当该物种有补丁且首个槽位存在时）。命中即置 $chk.belowok=1，',
    '# 于是 place 0/4 的"下方必须可站立"判定多一条放行条件（与构建期 belowAny 同语义）。') + [
    ...Array.from({ length: CAP_TAGS }, (_, i) =>
      'execute if data storage ' + RT + ' w' + i + ' run function ' + NS + ':' + dir + '/below_one with storage ' + RT + ' w' + i),
    '',
  ].join(LF);
  F[FUNC + 'below_one.mcfunction'] = [
    '# ' + NS + ':' + dir + '/below_one [MACRO] —— 单条额外落位面判定',
    '# 用法：function ' + NS + ':' + dir + '/below_one with storage ' + RT + ':w<i>（{t:"#minecraft:leaves"}）',
    '$execute if block ~ ~-1 ~ $(t) run scoreboard players set $chk.belowok ' + NS + ' 1',
    '',
  ].join(LF);

  F[FUNC + 'biome_check.mcfunction'] = H('biome_check —— 规则补丁里的群系白/黑名单',
    '# 白名单"非空且没命中 ⇒ 拒"；黑名单"命中 ⇒ 拒"。reason 与构建期一致（9）。') + [
    'scoreboard players set ' + S + '.bok ' + NS + ' 0',
    ...Array.from({ length: CAP_BIOMES }, (_, i) =>
      'execute if data storage ' + RT + ' v.m' + i + ' run function ' + NS + ':' + dir + '/biome_in_one with storage ' + RT + ' v.m' + i),
    ...Array.from({ length: CAP_BIOMES }, (_, i) =>
      'execute if score $chk.ok ' + NS + ' matches 1 if data storage ' + RT + ' n.m' + i + ' run function ' + NS + ':' + dir + '/biome_not_one with storage ' + RT + ' n.m' + i),
    'execute if score $chk.ok ' + NS + ' matches 1 if score ' + S + '.bok ' + NS + ' matches 0 if data storage ' + RT + ' v.m0 run function ' + NS + ':check/fail {reason:9}',
    '',
  ].join(LF);
  F[FUNC + 'biome_in_one.mcfunction'] = [
    '# ' + NS + ':' + dir + '/biome_in_one [MACRO] —— 白名单单条：命中即置 ' + S + '.bok=1',
    '# 用法：function ' + NS + ':' + dir + '/biome_in_one with storage ' + RT + ':v.m<i>（{b:"#minecraft:is_overworld"}）',
    '$execute if biome ~ ~ ~ $(b) run scoreboard players set ' + S + '.bok ' + NS + ' 1',
    '',
  ].join(LF);
  F[FUNC + 'biome_not_one.mcfunction'] = [
    '# ' + NS + ':' + dir + '/biome_not_one [MACRO] —— 黑名单单条：命中即否决（reason=9，与构建期同码）',
    '# 用法：function ' + NS + ':' + dir + '/biome_not_one with storage ' + RT + ':n.m<i>（{b:"minecraft:desert"}）',
    '$execute if biome ~ ~ ~ $(b) run function ' + NS + ':check/fail {reason:9}',
    '',
  ].join(LF);

  F[FUNC + 'rule_check.mcfunction'] = [
    '# ' + NS + ':' + dir + '/rule_check [MACRO] —— 运行时刻规则补丁的 Y 窗口 / 亮度窗口 / 天气门',
    '# 用法：function ' + NS + ':' + dir + '/rule_check with storage ' + RT + ' cur',
    '# 说明：' + RT + ':cur 的 yMin/yMax/lightMax/lightMin/weather 一定是"默认值 + 作者值"（见 row），',
    '#   所以宏占位符必定齐全；窗口用"正条件 + 取反否决"表达，避免运行时刻算 yMin-1。',
    '$execute if score $chk.ok ' + NS + ' matches 1 unless score $py ' + NS + ' matches $(yMin).. run function ' + NS + ':check/fail {reason:9}',
    '$execute if score $chk.ok ' + NS + ' matches 1 unless score $py ' + NS + ' matches ..$(yMax) run function ' + NS + ':check/fail {reason:9}',
    '$execute if score $chk.ok ' + NS + ' matches 1 unless predicate ' + NS + ':author/run/light_le_$(lightMax) run function ' + NS + ':check/fail {reason:3}',
    '$execute if score $chk.ok ' + NS + ' matches 1 unless predicate ' + NS + ':author/run/light_ge_$(lightMin) run function ' + NS + ':check/fail {reason:3}',
    '$execute if score $chk.ok ' + NS + ' matches 1 unless predicate ' + NS + ':author/run/weather_$(weather) run function ' + NS + ':check/fail {reason:9}',
    '',
  ].join(LF);

  // ---------------------------------------------------------------- 5) 条件条目
  const CATS = ['monster', 'creature', 'ambient', 'axolotls', 'underground_water_creature', 'water_creature', 'water_ambient'];
  for (const cat of CATS) {
    const L = [
      '# ' + NS + ':' + dir + '/entry_scan_' + cat + ' —— 运行时刻条件条目（类别 ' + cat + '，槽位 0..' + (CAP_TAGS - 1) + '）',
      '# 调用点：mob/biome/<群系>/' + cat + ' 的表头（由 gen_ctm_mobs 生成，带 `if data storage ' + storage + ' entries[0]` 守卫）。',
      '# 语义与构建期 entries.json 一致：**条件成立才把权重并入 #wsum**，命中区间紧接香草区间之后，',
      '#   `#off` 只在条件成立时前进 ⇒ 先按条件过滤候选表、再按权重掷，逐点等价（不会出现空档）。',
      'scoreboard players set ' + S + '.hit ' + NS + ' 0',
      'scoreboard players set ' + S + '.hook ' + NS + ' 0',
      'data modify storage ' + RT + ' e set value {cat:"' + cat + '"}',
    ];
    for (let i = 0; i < CAP_TAGS; i++) {
      L.push('execute if data storage ' + storage + ' entries[' + i + '] run function ' + NS + ':' + dir + '/entry_prep_' + i);
      L.push('execute if data storage ' + storage + ' entries[' + i + '] if data storage ' + RT + ' e.mob if data storage ' + RT + ' e.biome run function ' + NS + ':' + dir + '/entry_hit with storage ' + RT + ' e');
    }
    L.push('');
    F[FUNC + 'entry_scan_' + cat + '.mcfunction'] = L.join(LF);
  }

  for (let i = 0; i < CAP_TAGS; i++) {
    const prep = [
      'data modify storage ' + RT + ' e merge value {id:"",mob:"",biome:"",category:"",weight:1,min:1,max:1,when:{thundering:0,raining:0,yMin:' + LO + ',yMax:' + HI + ',lightMax:15,lightMin:0}}',
      'data modify storage ' + RT + ' e merge from storage ' + storage + ' entries[' + i + ']',
      'execute if data storage ' + storage + ' entries[' + i + '].when run data modify storage ' + RT + ' e.when merge from storage ' + storage + ' entries[' + i + '].when',
      'execute store result storage ' + RT + ' e.yMin int 1 run data get storage ' + RT + ' e.when.yMin',
      'execute store result storage ' + RT + ' e.yMax int 1 run data get storage ' + RT + ' e.when.yMax',
      'execute store result storage ' + RT + ' e.lightMax int 1 run data get storage ' + RT + ' e.when.lightMax',
      'execute store result storage ' + RT + ' e.lightMin int 1 run data get storage ' + RT + ' e.when.lightMin',
      'execute store result storage ' + RT + ' e.th int 1 run data get storage ' + RT + ' e.when.thundering',
      'execute store result storage ' + RT + ' e.ra int 1 run data get storage ' + RT + ' e.when.raining',
      'execute store result score ' + S + '.w ' + NS + ' run data get storage ' + RT + ' e.weight',
    ];
    if (exp) {
      prep.push(
        'execute if data storage ' + storage + ' entries[' + i + '].on_spawn run data modify storage ' + RT + ' e merge value {hook:1}',
        '# near（实验性 · 非原版）：默认值 + 合并（type 不补默认 —— 没有 type 就不做这条判定）',
        'data remove storage ' + RT + ' near',
        'execute if data storage ' + storage + ' entries[' + i + '].when.near run data modify storage ' + RT + ' near merge value {radius:24,min:1,max:' + HI + '}',
        'execute if data storage ' + storage + ' entries[' + i + '].when.near run data modify storage ' + RT + ' near merge from storage ' + storage + ' entries[' + i + '].when.near',
      );
    }
    F[FUNC + 'entry_prep_' + i + '.mcfunction'] = H('entry_prep_' + i + ' —— 规范化第 ' + i + ' 条（补默认值 + 摊平 when）',
      '# 规范化是必须的：宏源里**所有**占位符都必须存在，否则整个 entry_hit 会因 "Missing argument" 中止。',
      '# 摊平：when.* ⇒ 顶层 yMin/yMax/lightMax/lightMin（宏占位符只认顶层键）。') + prep.join(LF) + LF + '';
  }

  F[FUNC + 'entry_hit.mcfunction'] = H('entry_hit [MACRO] —— 一条运行时刻条目的条件判定 + 加权派发',
    '# 用法：function ' + NS + ':' + dir + '/entry_hit with storage ' + RT + ' e',
    '# 条件（全部 AND）：类别匹配 + 群系匹配 + 天气 + Y 窗口 + 亮度窗口' + (exp ? ' + near（可选，实验性）' : '') + '。') + [
    'scoreboard players set ' + S + '.ok ' + NS + ' 1',
    '$execute unless data storage ' + RT + ' e{category:"$(cat)"} run scoreboard players set ' + S + '.ok ' + NS + ' 0',
    '$execute unless biome ~ ~ ~ $(biome) run scoreboard players set ' + S + '.ok ' + NS + ' 0',
    'execute if score ' + S + '.ok ' + NS + ' matches 1 if score ' + S + '.th ' + NS + ' matches 1 unless predicate ' + NS + ':weather/thunder run scoreboard players set ' + S + '.ok ' + NS + ' 0',
    'execute if score ' + S + '.ok ' + NS + ' matches 1 if score ' + S + '.ra ' + NS + ' matches 1 unless predicate ' + NS + ':weather/rain run scoreboard players set ' + S + '.ok ' + NS + ' 0',
    '$execute if score ' + S + '.ok ' + NS + ' matches 1 unless score $py ' + NS + ' matches $(yMin).. run scoreboard players set ' + S + '.ok ' + NS + ' 0',
    '$execute if score ' + S + '.ok ' + NS + ' matches 1 unless score $py ' + NS + ' matches ..$(yMax) run scoreboard players set ' + S + '.ok ' + NS + ' 0',
    '$execute if score ' + S + '.ok ' + NS + ' matches 1 unless predicate ' + NS + ':author/run/light_le_$(lightMax) run scoreboard players set ' + S + '.ok ' + NS + ' 0',
    '$execute if score ' + S + '.ok ' + NS + ' matches 1 unless predicate ' + NS + ':author/run/light_ge_$(lightMin) run scoreboard players set ' + S + '.ok ' + NS + ' 0',
    ...(exp ? [
      '# near（实验性 · 非原版语义）：每次尝试最多 1 次计数查询',
      'execute if score ' + S + '.ok ' + NS + ' matches 1 if data storage ' + RT + ' near.type run function ' + NS + ':' + dir + '/near with storage ' + RT + ' near',
    ] : []),
    '# 条件成立 ⇒ 并入权重和，命中区间 = #off..#hi（#off 只在条件成立时前进 ⇒ 多条目之间无空档）',
    'execute if score ' + S + '.ok ' + NS + ' matches 1 run scoreboard players operation #hi ' + NS + ' = #off ' + NS,
    'execute if score ' + S + '.ok ' + NS + ' matches 1 run scoreboard players operation #hi ' + NS + ' += ' + S + '.w ' + NS,
    'execute if score ' + S + '.ok ' + NS + ' matches 1 run scoreboard players operation #wsum ' + NS + ' += ' + S + '.w ' + NS,
    'execute if score ' + S + '.ok ' + NS + ' matches 1 if score $rng ' + NS + ' >= #off ' + NS + ' if score $rng ' + NS + ' < #hi ' + NS + ' run function ' + NS + ':' + dir + '/entry_take with storage ' + RT + ' e',
    'execute if score ' + S + '.ok ' + NS + ' matches 1 run scoreboard players operation #off ' + NS + ' += ' + S + '.w ' + NS,
    '',
  ].join(LF);

  if (exp) {
    F[FUNC + 'near.mcfunction'] = [
      '# ' + NS + ':' + dir + '/near [MACRO] —— 关系条件 when.near（**实验性 · 非原版**：原版里没有这种耦合）',
      '# 用法：function ' + NS + ':' + dir + '/near with storage ' + RT + ':near（{type:"#doom.nats:creature",radius:24,min:1,max:…}）',
      '# 语义：以**候选点**为圆心数一次实体（type 可为实体标签或 id），要求 min ≤ 数量 ≤ max。',
      '$execute store result score ' + S + '.near ' + NS + ' if entity @e[type=$(type),distance=..$(radius)]',
      '$execute if score ' + S + '.ok ' + NS + ' matches 1 unless score ' + S + '.near ' + NS + ' matches $(min).. run scoreboard players set ' + S + '.ok ' + NS + ' 0',
      '$execute if score ' + S + '.ok ' + NS + ' matches 1 unless score ' + S + '.near ' + NS + ' matches ..$(max) run scoreboard players set ' + S + '.ok ' + NS + ' 0',
      '',
    ].join(LF);
  }

  F[FUNC + 'entry_take.mcfunction'] = H('entry_take [MACRO] —— 命中后写 ' + NS + ':sel（含自定义 NBT 与作者标签）',
    '# 用法：function ' + NS + ':' + dir + '/entry_take with storage ' + RT + ' e',
    '# 与构建期条目一致：写 type/cat/min/max/nbt（本包标签 + ' + tagPrefix + '<id>）。',
    '# slug 不在这里写 —— 先反查注册表（SpawnGroupData 与 post/<slug> 用），查不到就留空（跳过组数据层）。',
    '# ⚠ nbt 必须整体替换（data merge 递归 ⇒ 上一条目残留的键会累加到下一只）⇒ 拆成 merge + set',
    '$data merge storage ' + NS + ':sel {type:"$(mob)",cat:"$(cat)",min:$(min),max:$(max),authorId:"$(id)"}',
    '$data modify storage ' + NS + ':sel nbt set value {Tags:["' + NS + '.spawned","' + NS + '.cat.$(cat)","' + tagPrefix + '$(id)"]}',
    'scoreboard players set $sel.ok ' + NS + ' 1',
    'scoreboard players set ' + S + '.hit ' + NS + ' 1',
    ...(exp ? ['execute if data storage ' + RT + ' e.hook run scoreboard players set ' + S + '.hook ' + NS + ' 1'] : []),
    'data modify storage ' + RT + ' hit set from storage ' + RT + ' e',
    'function ' + NS + ':' + dir + '/lookup',
    'execute if data storage ' + RT + ' e.slug run function ' + NS + ':' + dir + '/entry_rule with storage ' + RT + ' e',
    '# 该物种的运行时刻规则补丁与 groupByY 同样适用于条目（与构建期"条目级覆盖"的差别见 rules/README.md）',
    'execute if data storage ' + NS + ':sel type run function ' + NS + ':' + dir + '/row with storage ' + NS + ':sel',
    '',
  );

  F[FUNC + 'lookup.mcfunction'] = H('lookup —— 实体 id → 注册表 slug（构建期冻结的表，' + cfg.slugs.length + ' 条）',
    '# 只有"运行时刻条目命中"这一条路径会走这里（每组最多 1 次），所以这是一次性成本。',
    '# 注册表键 = slug（= post/<slug> 与 grp/* 的派发键）；条目里的 mob 不在注册表里时 slug 留空。') + [
    ...cfg.slugs.map(([slug, type]) =>
      'execute if data storage ' + RT + ' e{mob:"' + type + '"} run data modify storage ' + RT + ' e.slug set value "' + slug + '"'),
    '',
  ].join(LF);

  F[FUNC + 'entry_rule.mcfunction'] = [
    '# ' + NS + ':' + dir + '/entry_rule [MACRO] —— 把注册表里的原版规则数据搬到 $sel（rule/place/light/tag/grp1/cluster/wide…）',
    '# 用法：function ' + NS + ':' + dir + '/entry_rule with storage ' + RT + ':e（e.slug 已由 lookup 写好）',
    '$data modify storage ' + RT + ' e.rt set from storage ' + NS + ':mobs."$(slug)".rt',
    'execute store result score $sel.rule ' + NS + ' run data get storage ' + RT + ' e.rt.rule',
    'execute store result score $sel.place ' + NS + ' run data get storage ' + RT + ' e.rt.place',
    'execute store result score $sel.light ' + NS + ' run data get storage ' + RT + ' e.rt.light',
    'execute store result score $sel.tag ' + NS + ' run data get storage ' + RT + ' e.rt.tag',
    'execute store result score $sel.grp1 ' + NS + ' run data get storage ' + RT + ' e.rt.grp1',
    'execute store result score $sel.cluster ' + NS + ' run data get storage ' + RT + ' e.rt.cluster',
    'execute store result score $sel.wide ' + NS + ' run data get storage ' + RT + ' e.rt.wide',
    'execute store result score $sel.wide2 ' + NS + ' run data get storage ' + RT + ' e.rt.wide2',
    'execute store result score $sel.tall ' + NS + ' run data get storage ' + RT + ' e.rt.tall',
    '',
  ].join(LF);

  // ---------------------------------------------------------------- 6) 容量随 Y
  F[FUNC + 'cap_scan.mcfunction'] = [
    '# ' + NS + ':' + dir + '/cap_scan [MACRO] —— 运行时刻容量随 Y（counts.capByY.<类别>）',
    '# 用法：function ' + NS + ':' + dir + '/cap_scan with storage ' + NS + ':sel（由 check/cap 守卫后调用）',
    '# 段按顺序求值、后面的覆盖前面的；只给 max 或只给 localMax 都行（另一项沿用引擎快照值）。',
    'scoreboard players set ' + S + '.cap ' + NS + ' -1',
    'scoreboard players set ' + S + '.lmax ' + NS + ' -1',
    '$data modify storage ' + RT + ' cap set from storage ' + storage + ' counts.capByY."$(cat)"',
    ...Array.from({ length: CAP_BANDS }, (_, i) =>
      'execute if data storage ' + RT + ' cap[' + i + '] run function ' + NS + ':' + dir + '/cap_' + i),
    '$execute if score ' + S + '.cap ' + NS + ' matches 0.. run scoreboard players operation $cap.now_$(cat) ' + NS + ' = ' + S + '.cap ' + NS,
    '$execute if score ' + S + '.lmax ' + NS + ' matches 0.. run scoreboard players operation $cap.lmax_$(cat) ' + NS + ' = ' + S + '.lmax ' + NS,
    '',
  ].join(LF);
  for (let i = 0; i < CAP_BANDS; i++) {
    F[FUNC + 'cap_' + i + '.mcfunction'] = H('cap_' + i + ' —— counts.capByY 第 ' + i + ' 段',
      '# 由 cap_scan 逐段调用（顺序即优先级）。') + [
      'data modify storage ' + RT + ' b set value {yMin:' + LO + ',yMax:' + HI + ',max:-1,localMax:-1}',
      'data modify storage ' + RT + ' b merge from storage ' + RT + ' cap[' + i + ']',
      'execute if data storage ' + RT + ' cap[' + i + '].max run function ' + NS + ':' + dir + '/band_cap_max with storage ' + RT + ' b',
      'execute if data storage ' + RT + ' cap[' + i + '].localMax run function ' + NS + ':' + dir + '/band_cap_lmax with storage ' + RT + ' b',
      '',
    ].join(LF);
  }
  F[FUNC + 'band_cap_max.mcfunction'] = [
    '# ' + NS + ':' + dir + '/band_cap_max [MACRO] —— 一段里命中 Y 区间就给出全局容量',
    '# 用法：function ' + NS + ':' + dir + '/band_cap_max with storage ' + RT + ' b',
    '$execute if score $py ' + NS + ' matches $(yMin)..$(yMax) run scoreboard players set ' + S + '.cap ' + NS + ' $(max)',
    '',
  ].join(LF);
  F[FUNC + 'band_cap_lmax.mcfunction'] = [
    '# ' + NS + ':' + dir + '/band_cap_lmax [MACRO] —— 一段里命中 Y 区间就给出每玩家上限',
    '# 用法：function ' + NS + ':' + dir + '/band_cap_lmax with storage ' + RT + ' b',
    '$execute if score $py ' + NS + ' matches $(yMin)..$(yMax) run scoreboard players set ' + S + '.lmax ' + NS + ' $(localMax)',
    '',
  ].join(LF);

  // ---------------------------------------------------------------- 7) 生成端（条目命中后的 summon）
  F[FUNC + 'emit_rt.mcfunction'] = [
    '# ' + NS + ':' + dir + '/emit_rt [MACRO] —— 运行时刻条目的生成（由 spawn/emit 在 ' + S + '.hit=1 时调用）',
    '# 用法：function ' + NS + ':' + dir + '/emit_rt with storage ' + NS + ':sel',
    '# 与香草路径的差别：不走 post/<slug> 的"组数据层"包装（条目自带 slug 时才走组数据）。',
    '$execute summon $(type) run function ' + NS + ':' + dir + '/post_rt with storage ' + NS + ':sel',
    '',
  ].join(LF);
  F[FUNC + 'post_rt.mcfunction'] = [
    '# ' + NS + ':' + dir + '/post_rt [MACRO] —— 运行时刻条目生成后的收尾（@s = 新生成的那只）',
    '# 用法：function ' + NS + ':' + dir + '/post_rt with storage ' + NS + ':sel',
    '# 顺序对齐 post/<slug>：先生成物标签 → 再作者的 NBT（写了 Tags 会覆盖本包标签）→ 持久化 → 朝向' + (exp ? ' → on_spawn' : '') + '。',
    '$data merge entity @s {Tags:["' + NS + '.spawned","' + NS + '.cat.$(cat)","' + tagPrefix + '$(authorId)"]}',
    'execute if data storage ' + RT + ' hit.nbt run function ' + NS + ':' + dir + '/nbt_apply with storage ' + RT + ' hit',
    'execute if score $cfg.persist ' + NS + ' matches 1 run data merge entity @s {PersistenceRequired:1b}',
    '$tp @s ~ ~ ~ $(rot) 0',
    ...(exp ? ['execute if score ' + S + '.hook ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/on_spawn_go with storage ' + RT + ' hit'] : []),
    '',
  ].join(LF);
  F[FUNC + 'nbt_apply.mcfunction'] = [
    '# ' + NS + ':' + dir + '/nbt_apply [MACRO] —— 把作者条目里的自定义 NBT **并入**刚生成的实体',
    '# 用法：function ' + NS + ':' + dir + '/nbt_apply with storage ' + RT + ':hit（hit.nbt 是一条 SNBT 字符串）',
    '# 这一行就是 SPEC 要求的 `$data merge entity @s $(nbt)`：宏把 storage 里的字符串原样替换成 SNBT。',
    '$data merge entity @s $(nbt)',
    '',
  ].join(LF);

  if (exp) {
    // 香草路径的收尾包装：让 on_spawn 钩子跑在"@s = 新实体"的上下文里
    F[FUNC + 'post_chain.mcfunction'] = [
      '# ' + NS + ':' + dir + '/post_chain [MACRO] —— 香草生成路径的收尾包装（post/<slug> + on_spawn 钩子）',
      '# 用法：function ' + NS + ':' + dir + '/post_chain with storage ' + NS + ':sel（由 spawn/emit_vanilla 的 execute summon 调用，@s=新实体）',
      '# 为什么要这一层：on_spawn 必须跑在"@s = 新实体"的上下文里，而 spawn/emit 的 @s 是玩家。',
      '$function ' + NS + ':post/$(slug) with storage ' + NS + ':sel',
      'execute if score ' + S + '.hook ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/on_spawn_go with storage ' + RT + ' hit',
      '',
    ].join(LF);
    F[FUNC + 'on_spawn_go.mcfunction'] = [
      '# ' + NS + ':' + dir + '/on_spawn_go [MACRO] —— on_spawn 演出钩子派发（@s = 刚生成的实体）',
      '# 用法：function ' + NS + ':' + dir + '/on_spawn_go with storage ' + RT + ':hit（hit.id = 条目 id）',
      '# 契约：没有 ' + NS + ':' + dir + '/on_spawn/<id> 这个函数时，**只有本函数中止**（真机验过：嵌套失败不会中止调用者），',
      '#   实体的生成与收尾照常完成 ⇒ 空钩子 = 与上一层一致的生成行为。',
      '$function ' + NS + ':' + dir + '/on_spawn/$(id)',
      '',
    ].join(LF);
    const ids = [...new Set(cfg.entryIds || [])].filter((id) => /^[a-z0-9_./-]+$/.test(id));
    for (const id of ids) {
      F[FUNC + 'on_spawn/' + id + '.mcfunction'] = H('on_spawn/' + id + ' —— 条件条目「' + id + '」命中生成后的演出钩子（@s = 新生成的实体）',
        '# 构建期条目 id 的空钩子占位：默认什么都不做 ⇒ 与稳定层/原版一致。',
        '# 想加演出就写在下面（粒子/音效/播报/额外 NBT 都行），例如：',
        '#   particle minecraft:flame ~ ~1 ~ 0.2 0.2 0.2 0.02 20',
        '#   playsound minecraft:entity.blaze.shoot hostile @a ~ ~ ~ 1 1',
        '#   tellraw @a {"text":"深层的东西醒了…","color":"dark_red"}') + LF;
    }
    F[FUNC + 'on_spawn/_example.mcfunction'] = H('on_spawn/_example —— 运行时刻条目的 on_spawn 钩子模板（复制成 <你的条目 id>.mcfunction 即可）',
      '# 运行时刻追加的条目（add_entry）如果写了 on_spawn:1b，就必须存在同名文件：',
      '#   data/' + NS + '/function/' + dir + '/on_spawn/<条目 id>.mcfunction',
      '# 否则只有钩子派发那一步静默跳过（生成的实体照常保留），其余流程不受影响。',
      '# @s = 刚生成的那只生物；这里默认什么都不做。') + LF;
  }

  // ---------------------------------------------------------------- 8) 预设（仅实验性层）
  if (exp && cfg.presets && Object.keys(cfg.presets).length) {
    const snbtV = (v) => {
      if (v === null) return 'null';
      if (typeof v === 'boolean') return v ? '1b' : '0b';
      if (typeof v === 'number') return String(v);
      if (typeof v === 'string') return JSON.stringify(v);
      if (Array.isArray(v)) return '[' + v.map(snbtV).join(',') + ']';
      return '{' + Object.entries(v).map(([k, x]) => (/^[A-Za-z0-9_.+-]+$/.test(k) ? k : JSON.stringify(k)) + ':' + snbtV(x)).join(',') + '}';
    };
    for (const [name, p] of Object.entries(cfg.presets)) {
      const L = ['# 预设：' + (p.note || '（自定义预设）'), '# merge 语义：可叠加，reset/enable 一键还原', ''];
      for (const [type, patch] of Object.entries(p.entityRules || {})) L.push('data modify storage ' + storage + ' entityRules merge value ' + snbtV({ [type]: patch }));
      for (const key of ['groupByY', 'capByY']) {
        for (const [k, bands] of Object.entries((p.counts || {})[key] || {})) {
          L.push('data modify storage ' + storage + ' counts.' + key + ' merge value ' + snbtV({ [k]: bands }));
        }
      }
      (p.entries || []).forEach((e) => {
        L.push('execute unless data storage ' + storage + ' entries[' + CAP_TAGS + '] run data modify storage ' + storage + ' entries set value []');
        L.push('execute unless data storage ' + storage + ' entries[' + CAP_TAGS + '] run data modify storage ' + storage + ' entries append value ' + snbtV(e));
      });
      L.push('data modify storage ' + storage + ' enabled set value 1b');
      L.push('function ' + NS + ':' + dir + '/load', '');
      F[FUNC + 'preset/' + name + '.mcfunction'] = H('preset/' + name + ' —— 预设「' + name + '」',
        '# 由 ' + NS + ':' + dir + '/preset 调用（merge 语义：可叠加；reset 一键还原）') + L.join(LF);
    }
    F[FUNC + 'preset.mcfunction'] = [
      '# ' + NS + ':' + dir + '/preset [MACRO] —— 应用一个预设',
      '# 用法：data merge storage ' + IN + ' {name:"blood_moon"}',
      '#       function ' + NS + ':' + dir + '/preset     （内置：' + Object.keys(cfg.presets).join(' / ') + '）',
      '# 名字校验的写法：不能写 if data storage <id>{name:…}（storage 的 data 谓词**必须带 path**，真机报 trailing data）',
      '#   ⇒ 改成"先派发、成功才置 ' + S + '.p=1"：名字未知时只有 preset_do 自己中止（嵌套失败不连坐调用者），',
      '#     于是 ' + S + '.p 仍是 0，下面那行就给出可用的名字清单。',
      'scoreboard players set ' + S + '.p ' + NS + ' 0',
      'execute if data storage ' + IN + ' name run function ' + NS + ':' + dir + '/preset_do with storage ' + IN,
      'execute if score ' + S + '.p ' + NS + ' matches 1 run function ' + NS + ':' + dir + '/say_summary with storage ' + RT + ' sum',
      'execute if score ' + S + '.p ' + NS + ' matches 0 run tellraw @s [{"text":"未知或缺失的预设名。可用：' + Object.keys(cfg.presets).join(' / ') + '","color":"red"}]',
      '',
    ].join(LF);
    F[FUNC + 'preset_do.mcfunction'] = [
      '# ' + NS + ':' + dir + '/preset_do [MACRO] —— 按名字派发预设；名字不存在时**只有本函数中止**（调用者照常继续）',
      '# 用法：function ' + NS + ':' + dir + '/preset_do with storage ' + IN,
      '$function ' + NS + ':' + dir + '/preset/$(name)',
      '# 走到这一行说明派发成功（宏行失败会让整函数中止）⇒ 置成功标记',
      'scoreboard players set ' + S + '.p ' + NS + ' 1',
      '',
    ].join(LF);
  }

  return F;
}
