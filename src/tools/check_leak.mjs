// tools/check_leak.mjs —— 泄漏守门 + 仓库顶层结构守门。
//
//   node tools/check_leak.mjs                     # 扫仓库根（默认 <本文件>/../..）
//   DOOM_GIT=<git 的完整路径> node tools/check_leak.mjs     # 本机 git 不在 PATH 时
//   DOOM_ROOT=<仓库根> node tools/check_leak.mjs            # 检查另一个仓库（例如玩家向的 doom.nats）
//   DOOM_TOP=off node tools/check_leak.mjs                  # 跳过顶层结构检查（本机工作区用）
//
// 两条守门：
//   ① 内容泄漏：不得出现「只用于实验」的内容标识与本机绝对路径。
//      为什么：用户点名——有些内容只有我们实验时才做/才用（第三方 rig 包与其截图、测试试验场、临时实例、
//      _work 夹具）。它们只留在本地，不进仓库/产物/文档。脱敏后必须用**新提交**更正，不改写历史。
//   ② 顶层结构：仓库顶层只允许白名单里的文件与目录。
//      为什么：2026-09-29 有 9 个误建垃圾文件（shell 反引号被展开、CHANGELOG 被当脚本执行时正文里的 `>`
//      重定向创建出来的 `128`/`256`/中文片段）被一次 `git add -A` 混进仓库 ⇒ 从此顶层结构也要过门。
//      布局自动判定：有 <root>/pack/doom.nats 且没有 <root>/doom.nats/tools ⇒ 玩家向仓库（严格白名单）。
//      玩家向仓库顶层允许：README.md · LICENSE · CHANGELOG.md · .gitignore · .gitattributes · dist/ · docs/ · src/ · .github/
//      （src/ 自 2026-09-29 起：源码可见 —— 生成器 tools/ + 规则层 rules/ + 生成输入 _work/generated/）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const GIT = process.env.DOOM_GIT || 'git';
const ROOT = process.env.DOOM_ROOT ? path.resolve(process.env.DOOM_ROOT) : path.resolve(import.meta.dirname, '..', '..');
const IDS = [/rigns\d*/i, /巨型鱿鱼/, /modrinth/i, /thirdparty-rig/i,  // 示例 rig 的识别信息（用户要求：不留残余）
  /\bgigantic/i, /\bcalamar\b/i, /\bbdengine\b/i, /巨人鱿鱼/, /All-Rights-Reserved/i];
// 旧项目名：只在**玩家向仓库**里算泄漏（本机开发布局保留历史线引用，例如 port/optimize 工具）
const PUB_IDS = [
  new RegExp('\\b' + String.fromCharCode(115, 117, 115, 111) + '\\b', 'i'),
  new RegExp(String.fromCharCode(115, 117, 115, 111) + '\\.nats', 'i'),
];
const PATHS = [/[A-Za-z]:[\\/]Users[\\/]/, /\/c\/Users\//, /[\\/]Downloads[\\/]/];
// 自己（含三种布局下的相对路径）不参与扫描：本文件正文里就写着这些正则
// 公开仓库自 2026-09-29 起把源码放进 src/ ⇒ 那份副本的相对路径是 src/tools/check_leak.mjs
const SELF = ['tools/check_leak.mjs', 'doom.nats/tools/check_leak.mjs', 'src/tools/check_leak.mjs'];

// 顶层白名单（两份 profile 分开写：玩家向仓库不许出现本机开发布局那套目录）
// 玩家向仓库：2026-09-29 起多一个 src/ —— 用户要求"仓库还是要展示源码的"（生成器 + 规则层 + 生成器输入）
const ALLOW_PUB = ['README.md', 'LICENSE', 'CHANGELOG.md', '.gitignore', '.gitattributes', 'dist', 'docs', 'rules', '.github', 'src', 'doom.nats'];
// 本机开发布局：**不含 src**（源码在那儿本来就以 doom.nats/ 的形式在顶层；那里加 src 只会放宽那道门）
const ALLOW_DEV = ['README.md', 'LICENSE', 'CHANGELOG.md', '.gitignore', '.gitattributes', 'dist', 'docs', 'rules', '.github',
  'doom.nats', 'tests', 'harness', '.vscode', 'AGENTS.md', '_work', 'tools', 'pack', 'reports'];
// 布局：玩家向仓库里没有生成器（doom.nats/tools），但有 dist/（.github/ 放 Issue 模板，2026-09-29 起允许）
const IS_PUB = !fs.existsSync(path.join(ROOT, 'doom.nats', 'tools')) && fs.existsSync(path.join(ROOT, 'dist'));
const ALLOW = new Set(IS_PUB ? ALLOW_PUB : ALLOW_DEV);

const git = (args) => execFileSync(GIT, args, { cwd: ROOT, encoding: 'utf8' });
let files = [];
const top = new Set();      // 已跟踪的顶层条目
const topDirty = new Set(); // 未跟踪、也没被 .gitignore 忽略的顶层条目（下一次 `git add -A` 就会被带进仓库）
try {
  files = git(['-c', 'core.quotepath=false', 'ls-files']).split('\n').filter(Boolean);
  for (const f of files) top.add(f.split('/')[0]);
  for (const l of git(['status', '--porcelain', '--untracked-files=all']).split('\n')) {
    if (!l.startsWith('?? ')) continue;
    topDirty.add(l.slice(3).replace(/^"|"$/g, '').split('/')[0]);
  }
  for (const d of topDirty) top.add(d);
} catch (e) {
  console.error('（不在 git 仓库里 / 找不到 git：' + String(e.message).split('\n')[0] + ' ⇒ 结构检查改用全目录扫描）');
  files = [];
}
if (!files.length) {
  const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === '.git' || e.name === 'node_modules') continue; const p = path.join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(path.relative(ROOT, p)); } return out; };
  files = walk(ROOT);
  for (const e of fs.readdirSync(ROOT)) top.add(e);
}

let bad = 0;

// ① 内容泄漏
const hits = [];
for (const rel of files) {
  if (SELF.includes(rel.split(path.sep).join('/'))) continue;
  if (!/\.(md|json|mjs|js|mcfunction|txt|yml|yaml)$/.test(rel)) continue;
  let t = ''; try { t = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
  for (const re of IDS) if (re.test(t)) hits.push([rel, '实验内容标识：' + String(re)]);
  for (const re of (IS_PUB ? PUB_IDS : [])) if (re.test(t)) hits.push([rel, '旧项目名（玩家向仓库不许出现）：' + String(re)]);
  for (const re of PATHS) if (re.test(t)) hits.push([rel, '本机绝对路径：' + String(re)]);
}
if (hits.length) {
  bad += hits.length;
  console.log('❌ 泄漏检查：' + hits.length + ' 处');
  for (const [f, why] of hits.slice(0, 20)) console.log('  ' + f + ' :: ' + why);
  console.log('（只报告；改完内容用**新提交**更正，别 amend 已推送的历史）');
} else {
  console.log('✅ 泄漏检查：0 处（无实验内容标识 / 无本机绝对路径）');
}

// ② 顶层结构
if (process.env.DOOM_TOP === 'off') {
  console.log('⏭  顶层结构检查：已按 DOOM_TOP=off 跳过（本机工作区含大量非仓库目录）');
} else {
  const stray = [...top].filter((t) => t && !ALLOW.has(t) && !topDirty.has(t)).sort();
  const dirty = [...topDirty].filter((t) => t && !ALLOW.has(t)).sort();
  if (dirty.length) {
    console.log('⚠️  顶层结构（未跟踪，只警告）：' + dirty.length + ' 个顶级条目没被提交但躺在工作目录里 —— 别 `git add -A`');
    for (const s of dirty.slice(0, 20)) console.log('  ' + s + '  (未跟踪)');
  }
  if (stray.length) {
    bad += stray.length;
    console.log('❌ 顶层结构：' + stray.length + ' 个**已提交**的顶级条目不在白名单里（' + (IS_PUB ? '玩家向仓库' : '本机开发布局') + '布局）');
    for (const s of stray.slice(0, 20)) console.log('  ' + s);
    console.log('  白名单：' + [...ALLOW].sort().join(' / '));
    console.log('  （顶层多出来的东西十有八九是 shell 反引号/重定向误建的垃圾 —— 别 `git add -A` 蒙混过去）');
  } else {
    console.log('✅ 顶层结构：' + top.size + ' 个顶级条目全在白名单内（' + (IS_PUB ? '玩家向仓库' : '本机开发布局') + '布局 · 扫描 ' + files.length + ' 个文件）');
  }
}

process.exit(bad ? 1 : 0);
