# doom.nats · 原版自然生成复刻（数据包 · Minecraft 1.21.6）

**一句话**：用纯数据包复刻 Minecraft 原版的自然刷怪（全局容量、光照与逐实体规则、群系物种表、结构覆盖、消失层），并且**把规则开放给你**——在游戏里一条命令就能改，改完下一拍生效。

**默认什么都不改 = 和原版一样。** 这是每次发版都会自动验的一条契约。

## 下载哪个

| 下载这个 | 它是什么 | 适合谁 |
|---|---|---|
| **[doom.nats-v4.29.zip](https://github.com/DoomDecapitator/doom.nats/releases/download/v4.29/doom.nats-v4.29.zip)** | 默认变体：逐条复刻原版自然生成 | **绝大多数人**（推荐） |
| [doom.nats-v4x-experimental-v4.29.zip](https://github.com/DoomDecapitator/doom.nats/releases/download/v4.29/doom.nats-v4x-experimental-v4.29.zip) | 默认变体的全部内容 + 超出原版的能力（附近有谁才刷、出生特效、预设包） | 想玩花样，且**愿意在建世界时开启对应实验性玩法**的人 |
| [全部下载 / 校验值](https://github.com/DoomDecapitator/doom.nats/releases) | 两个 zip 的 sha256 附件 | 想确认下载完整的人 |

> 实验性变体带**引擎门**：世界没开对应实验性玩法就**装不上**（不是警告）。详见 [[实验性变体-v4x]]。
>
> **自定义外观（AJ 桥接）不在两个 zip 里**：源码在（`src/tools/gen_exp_aj.mjs`），但**未随 v4.25/v4.28/v4.29 成品发布**——需自备非空 `rules/rigs.json`（样例 `src/rules/examples/aj/rigs.json`）并用 `DOOM_EXP=1` 重跑 `gen_exp_aj`（配套 `gen_pack` / `gen_mobs`）才能产出；本仓 `src/rules/rigs.json` 就是 `{}`，故成品 zip 里 `exp/aj` 条目为 0。

## 三步装上

1. 解压 `doom.nats-v4.29.zip` → 得到 `doom.nats/` 文件夹
2. 把整个 `doom.nats/` 丢进 `<存档>/datapacks/`（服务器：`world/datapacks/`）
3. 进游戏 `/reload`

看到聊天栏出现这一行就装好了：

```
[nats] mode/survival —— 已接管自然生成（doMobSpawning=false）
```

## 下一步去哪

| 想干的事 | 看这页 |
|---|---|
| 装、升级、卸载 | [[安装与升级]] |
| 在游戏里改刷怪规则 | [[快速上手-在游戏里改规则]] |
| 每个字段是什么、能填什么 | [[规则字段参考]] |
| 复制就能用的例子 | [[示例库]] |
| 附近有狼才刷羊、出生放雷声 | [[实验性变体-v4x]] |
| 常见疑问（不刷怪、掉帧、多人） | [[FAQ]] |
| 验收口径与最近的数字 | [[版本与验收]] |
| 明确做不到的事 | [[已知限制]] |

## 两句话的注意事项

- **当前是 Beta（公测）**：已知偏差逐条留档、未修完。**可以装进存档玩，但请先备份存档。**
- **许可**：All Rights Reserved · Beta。可自用 / 游玩 / 原样转发；二次发布修改版或商用请先取得许可。

> 源码与生成器就在本仓库 [`src/`](https://github.com/DoomDecapitator/doom.nats/tree/main/src)；真机测试台与逐轮验收报告不随本仓库分发。本仓库只放玩家要的东西。
