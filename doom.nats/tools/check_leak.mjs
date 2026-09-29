// tools/check_leak.mjs —— 泄漏守门：仓库里不得出现「只用于实验」的内容标识与本机绝对路径。
//
//   node tools/check_leak.mjs            # 扫仓库根（默认 <repo>/..）
//   node tools/check_leak.mjs --fix-name # 只报告，不自动改（改内容请手工或脚本，并在提交信息里说明）
//
// 为什么有这条门：用户点名——**有些内容只有我们实验时才做/才用**（第三方 rig 包与其截图、测试试验场、
// 临时实例、_work 夹具）。它们只留在本地，不进仓库/产物/文档。脱敏后必须用**新提交**更正，不改写历史。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const IDS = [/\bgigantic/i, /\bcalamar\b/i, /\bbdengine\b/i, /巨人鱿鱼/, /All-Rights-Reserved/i];
const PATHS = [/[A-Za-z]:\\Users\\/, /\/c\/Users\//, /Downloads[\\/]datapack/];
const SELF = ['tools/check_leak.mjs'];
const isSelf = (rel) => SELF.some((s) => rel.endsWith(s));
let files = [];
try { files = execFileSync(process.env.DOOM_GIT || 'git', ['-c', 'core.quotepath=false', 'ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean); }
catch { console.error('（不在 git 仓库里：改用全目录扫描）'); files = []; }
if (!files.length) {
  const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === '.git' || e.name === 'node_modules') continue; const p = path.join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(path.relative(ROOT, p)); } return out; };
  files = walk(ROOT);
}
const hits = [];
for (const rel of files) {
  if (isSelf(rel.split(path.sep).join('/'))) continue;
  if (!/\.(md|json|mjs|js|mcfunction|txt|yml|yaml)$/.test(rel)) continue;
  let t = ''; try { t = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
  for (const re of IDS) if (re.test(t)) hits.push([rel, '实验内容标识：' + String(re)]);
  for (const re of PATHS) if (re.test(t)) hits.push([rel, '本机绝对路径：' + String(re)]);
}
if (hits.length) {
  console.log('❌ 泄漏检查：' + hits.length + ' 处');
  for (const [f, why] of hits.slice(0, 20)) console.log('  ' + f + ' :: ' + why);
  console.log('（只报告；改完内容用**新提交**更正，别 amend 已推送的历史）');
  process.exit(1);
}
console.log('✅ 泄漏检查：0 处（无实验内容标识 / 无本机绝对路径）');
