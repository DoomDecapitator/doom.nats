# 诊断 · `in_fortress` 的「~17% 抖动」结案 —— 引擎 `isLoaded` 门 + 一个 forceload 坐标单位 bug

> 2026-09-29 · 结论：**抖动不是随机，也不是包缺陷。**
> ① 引擎语义：`location_check` 的 `structures`（以及 `biomes`）在**区块未加载**时**恒假**；
> ② 测试台 bug：`forceload add` 收的是**方块坐标**，旧脚本按"区块坐标"传 ⇒ 要塞区块**从来没被强加载**，
>    探针点里只有恰好被机器人视距覆盖的那部分返回真 ⇒ 读数被搅成"随机抖动"。
> 修掉 forceload 之后，同一台机器、同一个要塞、同一套判据：**表外 0/24 = 0.0%**，三条断言全绿。

---

## 一、原版会怎样

`net.minecraft.advancements.critereon.LocationPredicate#matches`（1.21.6 反编译，`LocationPredicate.java:49-53`）：

```java
BlockPos p = BlockPos.containing(x, y, z);
boolean loaded = level.isLoaded(p);
if (!this.biomes.isPresent() || loaded && this.biomes.get().contains(level.getBiome(p))) {
    if (!this.structures.isPresent() || loaded && level.structureManager()
            .getStructureWithPieceAt(p, this.structures.get()).isValid()) {
        …
```

两条要点：

1. **`structures` 与 `biomes` 都被 `loaded` 短路**：区块没加载 ⇒ 谓词**一律为假**（不是"查不到就当真/当假"，是直接假）。
2. 真值时走 `getStructureWithPieceAt` = **部件级（piece）**，与 `ChunkGenerator.getMobsAt` 的 piece 分支同义（§八 已更正过）。

**原版 CTM 为什么不会撞上这条**：原版刷怪只会在**已加载且 ticking** 的区块里尝试（候选区块来自玩家周围的 ChunkMap），
而方块谓词/结构谓词都在这类位置上求值 ⇒ `loaded` 恒真 ⇒ 语义上没有"抖动"这回事。

## 二、本包会怎样

本包的 `spawn/in_fortress.json` 就是 `{location_check:{predicate:{structures:["minecraft:fortress"]}}}`，
由引擎求值 ⇒ **语义与原版一致（忠实复刻）**；生产路径的尝试由玩家驱动、落点在玩家附近的加载范围内 ⇒ 同样撞不上这条。

## 三、差在哪

| 环节 | 现象 | 真因 |
|---|---|---|
| 早先的门读数 | `verify_fortress_e2e` ① 出现「表外 ≤25% 抖动」、`ghast`（群系表独有种）混入，被记为**待查** | **测试台**：探针点里处于未加载状态的返回假 ⇒ 读数混合 |
| 更早的根因 | v4.21b 记的"`forceload` 之后仍报 `if loaded = false`，只好靠机器人视距兜底" | 旧脚本把 `Math.floor(FX/16) ± 4`（**区块**坐标）传给了 `forceload add`，而该命令收的是**方块**坐标 ⇒ 实际只强加载了 `(-45,-44)` 那个方块所在的 `chunk[-3,-3]`，**要塞所在区块从未被加载** |
| 包本身 | —— | 无缺陷：谓词语义与原版一致 |

## 四、数字

### 4.1 受控复现（隔离实例 `_work/mcserver-fid`，RCON 25581；要塞点 `-648 58 -696`）

`_work/_infl_probe3.mjs`：每个条件对**同一个点**求值 200 次（命中计分板加一后回读，不用"输出是否为空"判成败）。

| 条件 | `loaded` | 命中 | 结论 |
|---|---|---|---|
| **A** 无 forceload、无玩家 | `false` | **0/200 = 0.0%** | 未加载 ⇒ 谓词恒假 |
| **B** forceload 该点所在区块 | `true` | **200/200 = 100.0%** | 加载 + 部件内 ⇒ 恒真 |
| **C** 只加载 5 个候选点中的 1 个 | 混合 | **80/200 = 40.0%** | 命中率 = 加载且部件内的点数比例 |
| **D** 撤掉 forceload 后每 0.5s 采样 12 次 | — | `000000000000` | 票据释放后立刻归零 |

C 的逐点明细（**同一状态重复 40 次没有任何抖动**，全部 0% 或 100%）：

```
x=-648 loaded=true  → 40/40   （部件内）
x=-632 loaded=true  →  0/40   （已加载，但在部件外 —— 这就是 piece 边界）
x=-616 loaded=true  → 40/40   （部件内）
x=-600 loaded=false →  0/40   （未加载）
x=-584 loaded=false →  0/40   （未加载）
```

⇒ 「17%」这种数字 = **那批探针点里恰好处于"已加载 ∧ 部件内"的比例**，是可解释的确定性结果，
不是随机、更不是包的行为漂移。

### 4.2 端到端（主测试服 25565 · 同一要塞）

| 运行 | 脚本状态 | 强加载回读 | ① 表外占比 | 汇总 |
|---|---|---|---|---|
| **今晨验收门**（`gate-accept2`，旧脚本） | `forceload` 坐标单位错、靠机器人视距兜底 | 未断言（实测常 `not loaded`） | **0/24 = 0.0%** ✅ | 3 PASS / 0 FAIL |
| **本轮重跑**（主服 25565，新脚本） | `±64 方块` + `loaded` 硬断言 | **`loaded=true`** | **0/24 = 0.0%** ✅ | **3 PASS / 0 FAIL** |
| 本轮隔离实例 `fid`（新脚本） | 同上 | `loaded=true` | 1/24 = 4.2%（`ghast`） | 0 PASS / 3 FAIL |

**诚实标注（别把这行读成"修前 4.2% → 修后 0%"）**：

- 「~17% 抖动」是**更早一轮**（判据收敛之前）的记录；**今晨的验收门里 ① 已经是 `0/24 = 0.0%`**。
- 上表第三行那次 `4.2%` 是**隔离实例 `fid`** 上的读数：fid 没有门里的前置（`mode/*` 配置、机器人锚点、批次节奏），
  4200 轮**一只都没生成**（`+0`），属**环境差异**，**不作为判据证据**；把它当"修前"是错的。
- 本轮真正的交付是两件事：**机制查清**（4.1 的受控复现：谓词 = 已加载 ∧ 部件内，逐点零抖动）+
  **测试台 bug 修掉**（`forceload` 坐标单位 + `loaded` 硬断言），并把「待查」正式结案。

## 五、改了哪些文件

| 文件 | 改动 |
|---|---|
| `_work/verify_fortress_e2e.mjs` | `forceload add` 改用**方块**坐标（±64 方块 = 9×9 = 81 区块 ≤256 上限）；强加载后**硬断言**要塞点 `loaded`，不满足 `exit 1`；注释改成 v4.22d 的正确解释；收尾 `forceload remove` 同步 |
| `_work/_infl_probe3.mjs`（新） | 上面的受控复现脚本（可复跑：`RCON_PORT=25581 node _work/_infl_probe3.mjs`） |
| `doom.nats/docs/19` | §八 后补一节「加载态门」结案 |
| `doom.nats/AGENTS.md` | 陷阱清单新增两条（见下） |
| `doom.nats/reports/极端场景测试总报告-20260929.md` | 「待查」一行改为结案 + 数字 |

## 六、两条可复用的教训

1. **`forceload add <x1> <z1> [<x2> <z2>]` 收的是方块坐标**（内部折算区块）。按区块坐标传会"静默地加载错的地方"——
   命令成功、回显 `Marked chunk [...]`，但标的是另一个区块。**凡是靠 forceload 的用例，都要在强加载之后
   `data get block` 回读一次 `loaded`，不满足就失败**（`That position is not loaded` 是唯一可靠的信号）。
2. **数据包的结构/群系谓词带 `isLoaded` 门**：位置所在区块没加载 ⇒ `structures`/`biomes` 恒假。
   所以任何"在任意坐标戳谓词"的测试，都先把那个坐标的区块**强加载**，否则读数是加载态的混合值；
   反过来，生产路径（玩家附近的尝试）不受影响 —— 这也解释了历史上若干"奇怪的假红"（例如 `verify_dims` ③ 的高度图抖动）。
