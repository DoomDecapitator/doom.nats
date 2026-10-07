# doom.nats

用数据包复刻 Minecraft 原版的自然刷怪。容量、区块计数、光照与逐实体规则、结构覆盖、消失层都在，规则可以改。

[![最新版本](https://img.shields.io/github/v/release/DoomDecapitator/doom.nats?include_prereleases&label=%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC)](https://github.com/DoomDecapitator/doom.nats/releases)
[![Minecraft](https://img.shields.io/badge/Minecraft-1.21.5%20%E2%80%93%2026.3-3C8527)](docs/25-兼容与版本.md)
[![许可](https://img.shields.io/badge/%E8%AE%B8%E5%8F%AF-All%20Rights%20Reserved%20%C2%B7%20Beta-c0392b)](docs/26-致谢与许可.md)

Minecraft 1.21.5 到 26.3 都能用，按版本区间分五份。

## 下载哪个

先看你的 MC 版本。

| 你的版本 | 下这个 |
|---|---|
| 1.21.5 | `dist/doom.nats-v4.30.0-mc1.21.5.zip` |
| 1.21.6 / 1.21.7 / 1.21.8 | `dist/doom.nats-v4.30.0-mc1.21.6-1.21.8.zip` |
| 1.21.9 / 1.21.10 | `dist/doom.nats-v4.30.0-mc1.21.9-1.21.10.zip` |
| 1.21.11 到 26.2 | `dist/doom.nats-v4.30.0-mc1.21.11-26.2.zip` |
| 26.3 | `dist/doom.nats-v4.30.0-mc26.3.zip` |

配套的文件建议一起装，不分版本：

| 文件 | 作用 |
|---|---|
| `dist/doom.log-multi.zip` | 日志通道。不装的话，包出错时看不到原因 |
| `dist/doom.nats-selftest.zip` | 自断言套件。跑一句命令就知道包有没有正常工作 |

还有一个实验性变体 `dist/doom.nats-v4x-experimental-v4.30.0.zip`，多出 `near`（附近有什么才刷）、`on_spawn`（出生特效）和几个预设。装它必须在创建世界时开启对应实验性玩法，否则包会被拒绝加载。详见[实验性变体](docs/wiki/实验性变体-v4x.md)。

多份包只能装一份。它们共用同一个命名空间，装两份会互相覆盖。

## 安装

1. 下载对应版本的 zip，解压出一个 `doom.nats/` 文件夹
2. 整个文件夹放进 `<存档>/datapacks/`。服务器放 `world/datapacks/`
3. 进游戏跑 `/reload`

装好会在聊天栏看到一句就绪提示。没看到就去 `logs/latest.log` 找加载报错。

想确认它真的在跑，跑 `/function doom.nats:debug/all`，看两个数：`$spawned.total` 一直在涨，`$cnt.monster` 停在上限附近（默认 70）。装机后 30 秒内应该能从 48 爬到 70。

卸载就是删掉 `datapacks/doom.nats/`，`/reload`，再跑 `/function doom.nats:mode/auto` 把原版刷怪还回去。

## 调刷怪数量

想让怪多点或少点，不用改规则，跑这五条之一：

| 命令 | 效果 |
|---|---|
| `/function doom.nats:scale/sparse` | 上限减半 |
| `/function doom.nats:scale/normal` | 回到原版 |
| `/function doom.nats:scale/dense` | 一倍半 |
| `/function doom.nats:scale/horde` | 两倍半，同时加快刷怪节奏 |
| `/function doom.nats:scale/extreme` | 四倍 |

切换后聊天栏会提示当前档位，`/reload` 之后还保留。

想自己填数字：

```
/data modify storage doom.nats:config qty set value 150
/function doom.nats:cfg/apply
```

`qty` 是百分比，`100` 是原样，范围 `1` 到 `1000`。它只改容量上限，也就是“最多几只”。想改“刷多快”用 `density`、`batch`、`period`，见[玩家可改清单](docs/21-玩家可改清单.md)。

调小档位后，场上已有的怪不会立刻消失，会按消失层的节奏慢慢减到新上限。

## 改规则

三条路，按生效时机选。

| 改法 | 什么时候生效 | 入口 |
|---|---|---|
| 在游戏里改（推荐） | 下一拍 | `/data modify storage doom.nats:author ...`。`/function doom.nats:author/show` 看现状，`author/reset` 一键回原版 |
| 改运行时刻旋钮 | 立刻 | 计分板开关。清单见[玩家可改清单](docs/21-玩家可改清单.md) |
| 改构建期规则 | 要重新生成包 | `src/rules/*.json`。字段表见 [src/rules/README.md](src/rules/README.md) |

两条能直接复制的例子：

```
# 让僵尸也能刷在树叶上
/data modify storage doom.nats:author entityRules."minecraft:zombie".belowAny set value ["#minecraft:leaves"]

# 雷暴时深海多出一种僵尸
/data modify storage doom.nats:author entries append value {id:"storm",biome:"#minecraft:is_deep_ocean",category:"monster",mob:"minecraft:zombie",weight:100000,when:{thundering:true}}
```

全部示例在[示例库](docs/wiki/示例库.md)。

有两个地方容易写错。

第一，字段名分两层。游戏里改的条目，群系字段叫 `biome`，是单数，填一个群系 id 或 `#标签`；要多个群系就写多条。一次刷几只写 `min` 和 `max`。而 `biomes`（数组）、`group`、`place`、`light`、`tag`、`cluster`、`coins`、`ySea` 这些是构建期 `rules/*.json` 的写法，写进 storage 不会报错，但也不会生效。

第二，`weight` 不是“和原有物种按比例分池”。实测命中率大约是 `weight / 1000000`。要它真刷出来就填十万量级：`100000` 约 10%，`900000` 约 90%（实测 180 秒里烈焰人从 22 只涨到 32 只）。填 `40` 这种小数字等于不刷。对照表见[规则字段参考](docs/wiki/规则字段参考.md)。

## 校验下载

`dist/SHA256SUMS.txt` 里是当前所有发布物的 sha256。在仓库根目录跑：

```
sha256sum -c dist/SHA256SUMS.txt
```

Windows PowerShell：

```powershell
Get-Content dist/SHA256SUMS.txt | ForEach-Object {
  $h, $f = $_ -split '\s+'
  "$f => " + $(if ((Get-FileHash "dist/$f" -Algorithm SHA256).Hash.ToLower() -eq $h) {'OK'} else {'MISMATCH'})
}
```

全部输出 `OK` 就是完整下载，出现 `MISMATCH` 就重新下。

## 版本对照

| MC 版本 | data pack version | 包 | `min_format` / `max_format` |
|---|---|---|---|
| 1.21.5 | 71 | `doom.nats-v4.30.0-mc1.21.5.zip` | `[71,0]` 到 `[71,0]` |
| 1.21.6 | 80 | `doom.nats-v4.30.0-mc1.21.6-1.21.8.zip` | `[80,0]` 到 `81` |
| 1.21.7 / 1.21.8 | 81 | 同上 | `[80,0]` 到 `81` |
| 1.21.9 / 1.21.10 | 88.0 | `doom.nats-v4.30.0-mc1.21.9-1.21.10.zip` | `[88,0]` 到 `[88,0]` |
| 1.21.11 到 26.2 | 94.1 到 107.0 | `doom.nats-v4.30.0-mc1.21.11-26.2.zip` | `[94,1]` 到 `[107,0]` |
| 26.3 | 121.0 | `doom.nats-v4.30.0-mc26.3.zip` | `[121,0]` 到 `[121,0]` |

五份包共用同一套函数逻辑，差别只有 `pack.mcmeta` 和几处版本相关改写（`chain` 改名成 `iron_chain`、gamerule `doMobSpawning` 改名成 `spawn_mobs`、predicate 的 `condition` 改成 `type`）。`ports/` 里存着每份包的源码树，可以逐文件核对。

区间是实测边界，不要装到区间外。装错了会因为原版 ID 或 gamerule 已改名而加载失败。

> 2026-10-05 勘误：本表曾把 1.21.11 到 26.3 写成同一个区间，那是错的。1.21.11–26.2 和 26.3 之间隔着 predicate 注册表 schema 变更，不能合并。原来的 `-mc1.21.11-26.3.zip` 已下架，它标错了适用区间。

## 做不到的

全新的模型、贴图、AI、寻路（数据包管不了客户端资源和实体行为）；给本来没有这类生物的群系加怪（要改世界生成）；让生物之间产生因果关系，比如“蜘蛛吃虫”（那是行为层的事）。

## 源码在哪

| 目录 | 里面是什么 |
|---|---|
| [`doom.nats/`](doom.nats/data/doom.nats/function) | 数据包本体，能直接点开看每个函数文件 |
| [`src/`](src/) | JavaScript 生成器、规则层、生成输入 |
| [`dist/`](dist/) | 成品 zip |

只想玩就下 `dist/` 里的 zip。想自己改包，照 [src/README.md](src/README.md) 的三步走：跑生成器、`check_static`、装包打包。

真机测试台、逐轮验收报告、CI 是作者本机的东西，不随仓库分发。验收口径和每个版本的真机数字都在那里。

## 文档

| 想看什么 | 去哪 |
|---|---|
| 安装、升级、卸载 | [docs/wiki/安装与升级.md](docs/wiki/安装与升级.md)、[docs/16-生存直用手册.md](docs/16-生存直用手册.md) |
| 在游戏里改规则 | [docs/wiki/示例库.md](docs/wiki/示例库.md)、[docs/wiki/规则字段参考.md](docs/wiki/规则字段参考.md) |
| 能改的一切 | [docs/24-玩家能改动的一切.md](docs/24-玩家能改动的一切.md) |
| 逐实体与原版的差异 | [docs/17-逐实体刷怪规则核对.md](docs/17-逐实体刷怪规则核对.md) |
| 版本与兼容 | [docs/25-兼容与版本.md](docs/25-兼容与版本.md)、[CHANGELOG](CHANGELOG.md) |
| 许可与致谢 | [docs/26-致谢与许可.md](docs/26-致谢与许可.md) |
| 全部文档 | [docs/README.md](docs/README.md) |

Wiki 图文版在 <https://github.com/DoomDecapitator/doom.nats/wiki>。打不开的话，`docs/wiki/` 里就是那 9 页的 Markdown 源。

## 仓库结构

```
README.md  LICENSE  CHANGELOG.md   说明 / 许可 / 变更日志
dist/                              唯一下载物：各个 zip 和 SHA256SUMS.txt
ports/                             每个 MC 版本区间的包源码树
doom.nats/                         数据包本体副本，可以直接浏览
src/                               源码：生成器 tools/ + 规则层 rules/ + 生成输入
docs/                              玩家向文档，docs/wiki/ 是 Wiki 的 Markdown 源
.github/ISSUE_TEMPLATE/            报 bug 和提功能的表单
```

`.gitignore` 挡掉本地产物，`.gitattributes` 让产物按字节比对、不做行尾转换。

## 报问题

走 [Issues](https://github.com/DoomDecapitator/doom.nats/issues/new/choose) 的表单。会问你版本、变体、`logs/latest.log` 片段和截图。按表单填能快很多。

## 许可

All Rights Reserved · Beta。自用、游玩、原样转发可以；二次发布修改版或商用请先取得许可。

本包不含 Minecraft 和 Mojang 的资产，也不含反编译产物，随包发布的只有数据包本体。全文见 [docs/26-致谢与许可.md](docs/26-致谢与许可.md)。
