# `_work/`（本仓库只保留**生成器要用的数据表**）

完整开发目录（反编译产物、第三方参考包、测试世界、探针脚本……）**不在本仓库**。
这里放的是 `tools/gen_ctm_*.mjs` 作为**输入**读取的 8 张数据表（373 KB，纯 JSON，从原版注册表/数据导出后整理）：

| 文件 | 用途 |
|---|---|
| `mobs.json` | 生物基础表（尺寸/类别/组大小…） |
| `biome-rosters.json` | 各群系各类别的刷怪名册（权重） |
| `biomes.json` / `biomes.vanilla.json` | 群系集合与对照 |
| `biome-index.json` | 群系 ↔ 索引（产物里也有一份 `data/doom.nats/biome-index.json`） |
| `entity-categories.json` | 实体 → 类别（cap 计数用） |
| `entity-rules.json` | 逐实体规则表（33 条，见 `AGENTS.md` 的 v4.13 段） |
| `hitboxes.json` | 碰撞盒（AABB 近似判定用） |

有了这些，`node tools/check_static.mjs`（9 个生成器 `--check` + lint + 语义闭包）可以在本仓库里**独立跑通**：

```bash
node doom.nats/tools/check_static.mjs       # 期望：结论 0 error
node doom.nats/tools/check_closure.mjs      # 期望：0 处待确认
node doom.nats/tools/lint_ctm.mjs           # 期望：0 error
```

> 反编译的 Minecraft 源码（`_work/decomp/`）**不随本仓库分发**：它们属于 Mojang 的代码，
> 仅在本地用于"读原版实现"。本仓库里的规则表是**对原版可观察行为的复刻与归纳**，不是源码拷贝。
