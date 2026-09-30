// tools/lib/packdir.mjs —— 产物根目录解析（v4.24 起有**两个**变体；v4.26 起同放在 pack/ 下）。
//
//   · 默认（原版复刻 + 本包稳定扩展）：`<repo>/pack/doom.nats`
//   · 实验性（非原版能力，带 pack.mcmeta `features` 引擎门）：`<repo>/pack/doom.nats-experimental`
//
// 环境变量：
//   DOOM_EXP=1   ⇒ 写实验性变体（生成器一律走这个入口，别再各自写死目录名）
//   DOOM_OUTDIR=<目录> ⇒ 覆盖产物根目录（验收脚本用来做隔离构建）
//
// 为什么两个变体是"物理分开的两份产物"：`pack.mcmeta` 的 `features` 字段是**整包级**的，
// 引擎要么收、要么拒（世界没开这个实验性玩法时，带 features 的包不会加载）。
// 所以"能不能装"由变体决定，"行为回不回滚"由运行时刻 storage 开关决定（见 docs/18）。
import path from 'node:path';

export const EXP = !!process.env.DOOM_EXP;
export const ROOT = path.resolve(import.meta.dirname, '..', '..');           // …/doom.nats
export const REPO = path.resolve(ROOT, '..');                                 // …/datapack
export const PACK = process.env.DOOM_OUTDIR
  ? path.resolve(process.env.DOOM_OUTDIR)
  : path.join(REPO, 'pack', EXP ? 'doom.nats-experimental' : 'doom.nats');
/** 变体名（写进产物描述与日志） */
export const VARIANT = EXP ? 'exp' : 'std';
