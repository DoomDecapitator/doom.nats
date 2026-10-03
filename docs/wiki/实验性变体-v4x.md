# 实验性变体 v4x

**结论**：实验性变体 = 默认变体 + **超出原版的能力**（附近有谁才刷、出生演出、预设包；自定义外观桥接**源码在、未随本版成品发布**，见下表）。它带**引擎门**：世界必须在**创建时**开启对应实验性玩法，否则包会被**拒绝加载**（不是警告）。

## 一、下载与安装

1. 下载 `dist/doom.nats-v4x-experimental-v4.25.zip`
2. 解压，把 `doom.nats/` 放进 `<存档>/datapacks/`（服务器 `world/datapacks/`）
3. **创建一个新世界**（或改 `level.dat` 的启用实验性玩法），开启对应的实验性玩法开关
4. `/reload`

> **老存档没开实验性玩法 ⇒ 装不上**。这不是 bug，是引擎门。想省事就用默认变体。

## 二、引擎门到底是什么

包的 `pack.mcmeta` 里声明了所需实验性旗标，游戏侧不满足就整包拒绝加载。

1.21.6 数据包可借用的原生旗标只有三个：

| 旗标 | 开了会同时拿到 |
|---|---|
| `minecart_improvements` | 矿车相关原版改动 |
| `redstone_experiments` | 红石相关原版改动 |
| `trade_rebalance` | 交易平衡调整 |

**注意**：开这个门意味着你的世界同时吃到对应的原版改动——这是"借路"，不是"干净开关"。

## 三、超出原版的能力

| 能力 | 怎么写 | 效果 |
|---|---|---|
| `near` | 条目里加 `when:{near:{type:"minecraft:wolf",radius:24,min:1}}` | **附近有什么才刷**（狼群附近才出羊） |
| `on_spawn` | 条目里加 `on_spawn:1b`，再在数据包里建 `data/doom.nats/function/exp/on_spawn/<条目 id>.mcfunction` | 出生演出：粒子 / 音效 / 播报 / 额外 NBT |
| 预设包 | `/data merge storage doom.nats:exp_in {name:"<名>"}` → `/function doom.nats:exp/preset` | 一键切换世界观：`blood_moon` / `storm_season` / `deep_dark`（实测入口，`exp/preset` 是无参宏派发） |
| 自定义外观（AJ 桥接） | 构建期规则 `rules/rigs.json` —— **源码在 `src/tools/gen_exp_aj.mjs`，未随 v4.25 成品发布**：本仓 `rules/rigs.json` 是 `{}`（成品 zip 里 `exp/aj` 条目 0 个），要用需自备非空配置（样例 `src/rules/examples/aj/rigs.json`）并 `DOOM_EXP=1` 重跑生成器 | 真实体当内核 + 骨架当外观（`ride` 挂载）：内核照常移动/消失，外观逐格跟随 |
| 从手上的生物采样 | `/function doom.nats:author/add_entry` | 把你手上生物的样子（含 NBT）直接变成一条规则 |

**自定义外观的两条关键行为**（实测于**用非空 rigs 配置构建的实验构建**，不是 v4.25 成品）：

- 位移误差 **0.0000 格**（逐格跟随）
- **容量只数内核**——你挂 10 个骨架不会把 mobcap 吃爆

## 四、复制就能用的两个例子

**附近有狼才刷羊**

```
/data modify storage doom.nats:author entries append value {id:"wolf_sheep",biome:"#minecraft:is_forest",category:"creature",mob:"minecraft:sheep",weight:10,when:{near:{type:"minecraft:wolf",radius:24,min:1}}}
```

**雷暴的深海，僵尸出场放闪电与雷鸣**
> `on_spawn:1b` 只是打开钩子；演出本身要写成函数文件 `data/doom.nats/function/exp/on_spawn/thunder_king.mcfunction`，里面放 `particle minecraft:flash ~ ~1 ~ 0 0 0 0 1` 与 `playsound minecraft:entity.lightning_bolt.thunder hostile @a ~ ~ ~ 1 1`。

```
/data modify storage doom.nats:author entries append value {id:"thunder_king",biome:"#minecraft:is_deep_ocean",category:"monster",mob:"minecraft:zombie",weight:60,when:{thundering:true},on_spawn:1b}
```

## 五、注意

- 运行时改的规则（含 `near` / `on_spawn` / 预设）在**默认变体里会被忽略**——不是不生效，是那套代码根本不在包里。
- `author/export` 能把当前覆盖打成一行可复制命令；但**用了实验性能力的导出，只在实验性变体的世界里能还原**。
- 默认变体与实验性变体**不要同时装**。
- 引擎门只认 `pack.mcmeta` 里声明的旗标；1.21.6 没有"只开数据包实验"的干净开关，请权衡后再上。

> 逐字段表（`src/rules/rigs.json`）见 [src/rules/README.md](https://github.com/DoomDecapitator/doom.nats/blob/main/src/rules/README.md)。
