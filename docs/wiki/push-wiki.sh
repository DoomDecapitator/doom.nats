#!/usr/bin/env bash
# 把 docs/wiki/*.md 一次性推送到 GitHub Wiki。
# 前置条件：仓库的 Wiki 已存在（网页上点过一次 Create first page）。
set -euo pipefail

OWNER=DoomDecapitator
REPO=doom.nats
WIKI="https://github.com/${OWNER}/${REPO}.wiki.git"
HERE=$(cd "$(dirname "$0")" && pwd)
PAGES=(Home 安装与升级 快速上手-在游戏里改规则 规则字段参考 示例库 实验性变体-v4x FAQ 版本与验收 已知限制 _Sidebar _Footer)

if ! git ls-remote "$WIKI" >/dev/null 2>&1; then
  echo "Wiki 仓库还不可用：先在 https://github.com/${OWNER}/${REPO}/wiki 点一次 Create first page（保存任意占位内容即可）"
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git clone --depth 1 "$WIKI" "$TMP/wiki"
for p in "${PAGES[@]}"; do
  cp "$HERE/${p}.md" "$TMP/wiki/${p}.md"
done
cd "$TMP/wiki"
git add -A
if git diff --cached --quiet; then
  echo "Wiki 内容已是最新，无需推送"
  exit 0
fi
git -c user.name="doom.nats" -c user.email="noreply@github.com" commit -m "wiki: 同步玩家向文档（9 页 + 侧栏/页脚）"
git push origin HEAD
echo "已推送：https://github.com/${OWNER}/${REPO}/wiki"
