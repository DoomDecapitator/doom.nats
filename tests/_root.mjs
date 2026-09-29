// _work/_root.mjs —— 可移植路径解析（测试脚本用）
//
// 为什么需要：这些脚本最早写死在作者机器的绝对路径（`<仓库根>/...`），
// 别人 clone 下来跑不了。本模块按「从脚本位置向上找仓库根」的方式解析，两种布局都能用：
//   · 作者工作区：<root>/doom.nats（生成器+文档+报告）+ <root>/v4/doom.nats（产物）+ <root>/_work（测试）
//   · 发布仓库：  <root>/doom.nats + <root>/v4 + <root>/tests（脚本副本）
//
// 环境变量：
//   DOOM_ROOT —— 显式指定仓库根（默认自动向上查找）
//   DOOM_OUT  —— 输出目录（默认：有 _work/ 就用 <root>，否则用 <root>/doom.nats，最后兜底 <root>/tests/_artifacts）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const findRoot = (start) => {
  let d = start;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(d, 'v4', 'doom.nats')) || fs.existsSync(path.join(d, 'doom.nats', 'tools'))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return start;
};

export const ROOT = process.env.DOOM_ROOT ? path.resolve(process.env.DOOM_ROOT) : findRoot(HERE);

// 读：按候选顺序找第一个存在的（`_work/xxx` 在发布树里就是 `doom.nats/_work/xxx` 或 `tests/xxx`）
export const R = (rel) => {
  const strip = rel.replace(/^_work\//, '');
  const cands = [rel, path.join('doom.nats', rel), path.join('tests', rel), strip, path.join('tests', strip), path.join('doom.nats', strip)];
  for (const c of cands) { const p = path.join(ROOT, c); if (fs.existsSync(p)) return p; }
  return path.join(ROOT, rel);
};

// 写：输出目录（自动建目录；发布树里写进 doom.nats/_work 或 tests/_artifacts）
export const OUT = (() => {
  if (process.env.DOOM_OUT) return path.resolve(process.env.DOOM_OUT);
  if (fs.existsSync(path.join(ROOT, '_work'))) return ROOT;
  if (fs.existsSync(path.join(ROOT, 'doom.nats', '_work'))) return path.join(ROOT, 'doom.nats');
  return path.join(ROOT, 'tests', '_artifacts');
})();

export const W = (rel) => {
  let r = rel;
  // 输出根已经落在 doom.nats/ 里时，去掉重复前缀
  if (path.basename(OUT) === 'doom.nats' && r.startsWith('doom.nats/')) r = r.slice('doom.nats/'.length);
  const p = path.join(OUT, r);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
};
