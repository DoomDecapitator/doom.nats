# doom.nats — 原版自然生成复刻（CTM · 数据包）

> ## ⚠ 当前状态：**Beta（公测）**
> 已跑过完整的真机验收（数字见下），但仍是 Beta：**已知偏差逐条留档、未修完**（见
> [`doom.nats/AGENTS.md`](doom.nats/AGENTS.md) 的版本段与 [`reports/`](reports/) 下的逐轮报告）。
> **可以装进存档玩，但请先备份存档。**

用**纯数据包**复刻 Minecraft 原版的自然生成（NaturalSpawner 那一整套）：全局/本地容量、
区块可生成计数、光照与逐实体规则、结构 `spawn_overrides`（要塞/前哨站/沼泽小屋/海底神殿/远古城市/试炼密室）、
`finalizeSpawn` 组数据层（SpawnGroupData：婴儿率、共享变体、蜘蛛组效果…）、消失层（128 格硬消失、32 格掷骰）、
以及"情形引擎"（昼夜/天气/月相/维度/多人）驱动的参数折算。

- 目标版本：**Minecraft 1.21.6 / Fabric**（`pack_format 80`，命名空间 `doom.nats`）
- 产物：`v4/doom.nats/`（588 文件）—— **由生成器生成，不要手改**
- 开箱即用：`dist/doom.nats-v4.22-beta.zip` 直接丢进 `saves/<存档>/datapacks/`

## 安装

```
saves/<你的存档>/datapacks/
├── doom.nats-v4.22-beta.zip     ← 主包（本仓库 dist/）
└── doom.log/                     ← 日志/断言 API（打包在 harness/doom.log/，只有跑自动化才需要）
```

进游戏 `/reload`，然后：

```mcfunction
function doom.nats:mode/survival          # 生存直用：接管刷怪（默认）
function doom.nats:mode/auto              # 恢复默认（不接管）
function doom.nats:debug/env              # 环境快照（维度/海平面/容量/情形）
function doom.nats:debug/reject_report    # 生成失败归因直方图（reason=0..11）
function doom.nats:debug/clear            # 静默清掉本包生成物（跳过命名/有主/持久/拴绳）
```

配置（地图作者可覆盖，全部按维度取数）：

```mcfunction
data merge storage doom.nats:config {cap:{monster:70},persist:0,border:{centerX:0,centerZ:0,size:0}}
```

`border.size=0` = 关闭世界边界检查；`cap` 按类别覆盖 `maxInstancesPerChunk`；`sea0/sea1/sea2` 覆盖三维度海平面。

## 验收（2026-09-29 · 四道门 **4 PASS / 0 FAIL**）

| 门 | 结果 | 明细 |
|---|---|---|
| ① 静态 | ✅ | 9 个生成器 `--check` + lint + 语义闭包 = **0 error / 0 处待确认** |
| ② 引擎加载 | ✅ | 安装 + `/reload`：**`Failed to load function` 0 条** |
| ③ 真机专项 | ✅ | **18 个脚本 · 163 断言 0 FAIL**（385 s） |
| ④ 完整回归 | ✅ | `tools/regress.mjs --reuse --minutes 1 --curve 1` **20 步 0 FAIL**（316 s） |

完整记录：[`reports/验收-四道门-20260929.md`](reports/验收-四道门-20260929.md)（含每个脚本的断言数）·
门日志原文 [`reports/logs/`](reports/logs/)。

本轮挖出并修掉的（真 bug，每条都有"原版会怎样 / 本包会怎样 / 差在哪 / 数字"）：

| 编号 | 一句话 | 数字 |
|---|---|---|
| **P0 消失层** | 消失判据把**最近玩家**写成了"任一玩家"⇒ 多人（相距 >256 格）时**各自身边的生成物被对方判掉** | `verify_multibot` 1/3 → **4/0**；A/B 两处 128 格内 0/0 → **67/24** |
| **P0 维度竞态** | `$snap.dim` 被快照与尝试链共享 ⇒ 末地/下界拿**主世界**的容量与海平面判定 | 末地满 cap ⇒ 必拒 `reason=5`（`$rej.5` +168/24 次）；新增常驻回归 `verify_dim_att` **6/0** |
| P1 世界边界 | 原版三种落位都查 `worldborder.isWithinBounds`，本包此前没有 | 新增 `check/border`（`reason=11`，默认关闭） |
| P1 水生落位 | 落位判定读**方块**而非**流体**⇒ 海草/海带/气泡柱格被误拒 | 13 处判定改用 `#doom.nats:water_fluid`；E5 **4/4** |
| P1 取点回退 | 深水里"自动扫地面"扫不到 ⇒ 候选点被钉在水面层 ⇒ 深水零生成 | 回退原版式整列均匀：深度门通过率 **0/40 → 37/40** |

各轮完整报告：[`reports/极端场景测试总报告-20260929.md`](reports/极端场景测试总报告-20260929.md)、
[E1](reports/极端-E1-单群系维度-20260929.md)、[E2](reports/极端-E2-限制性维度-20260929.md)、
[E4](reports/极端-E4-容量密度-20260929.md)、[E5](reports/极端-E5-水生落位方块判定-20260929.md)、
[E7](reports/极端-E7-多机器人多维度-20260929.md)、[多玩家消失层诊断](reports/诊断-多玩家消失层-20260929.md)。

## 仓库结构

```
doom.nats/            开发目录：生成器 tools/ · 文档 docs/ · 开发约定与踩坑 AGENTS.md · 逐轮报告 reports/
  _work/generated/    生成器要读的 8 张数据表（373 KB，从原版注册表/数据整理；反编译产物不在本仓库）
v4/doom.nats/         由生成器产出的**可安装数据包**（588 文件，勿手改）
harness/doom.log/     测试用日志/断言 API（doom.log:info/dump/error + nats.debug:* 调试命令）
tests/                真机验收脚本（18 个 verify_*.mjs + 四道门 gate_merge.mjs + 锚点助手）
reports/              验收报告与门日志原文（reports/logs/）
dist/                 可直接安装的 zip
```

**改东西的正确姿势**：改生成器 → 重新生成 → `--check`（不要手改 `v4/` 里的产物）：

```bash
node doom.nats/tools/check_static.mjs      # 静态门：9 生成器 --check + lint + 语义闭包（期望 0 error）
node doom.nats/tools/check_closure.mjs     # 语义闭包（期望 0 处待确认）
node doom.nats/tools/lint_ctm.mjs          # 单跑 lint
```

真机验收需要一台可 RCON 的测试服（默认 25565/RCON 25575）+ mineflayer 机器人，见
[`tests/README.md`](tests/README.md)。

## 许可

**All Rights Reserved · Beta** —— 见 [LICENSE](LICENSE)。
可以自用/游玩/原样转发；二次发布修改版或商用请先取得许可。
本仓库不含 Minecraft/Mojang 资产，也不含反编译产物：`doom.nats/tools` 里的规则表是对**原版可观察行为**的复刻与归纳。
