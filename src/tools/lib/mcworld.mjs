// Synthetic Minecraft world model for headless datapack execution.
// Deliberately small: only what 早期作品线 actually queries (block tags, biome, light, players).
import fs from 'node:fs';
import path from 'node:path';

export class World {
  constructor(opts = {}) {
    this.groundY = opts.groundY ?? 63;         // topmost solid block layer
    this.biome = opts.biome ?? 'minecraft:forest';
    this.light = opts.light ?? 0;              // block light at and above groundY+1
    this.solidBlock = opts.solidBlock ?? 'minecraft:stone';
    this.freeBlock = opts.freeBlock ?? 'minecraft:air';
    this.daytime = opts.daytime ?? 0;          // /time query daytime 的返回值（6000 正午 / 18000 午夜）
    this.weather = opts.weather ?? 0;          // 0=晴 1=雨 2=雷暴（weather_check 谓词用）
    this.solidTag = opts.solidTag ?? new Set();
    this.freeTag = opts.freeTag ?? new Set();
    this.entities = [];                        // {uuid,type,tags,nbt,pos,rot}
    this.players = [];
    this.queries = { block: 0, predicate: 0, entity: 0 };
  }

  // 从包结构里认出在测命名空间（v3 起包名不再等于旧命名空间）
  static detectNamespace(packDir) {
    const dataDir = path.join(packDir, 'data');
    for (const e of fs.readdirSync(dataDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (fs.existsSync(path.join(dataDir, e.name, 'tags', 'block', 'free.json'))) return e.name;
    }
    return '早期作品线';
  }

  static loadTags(packDir, ns = World.detectNamespace(packDir)) {
    const dir = path.join(packDir, 'data', ns, 'tags', 'block');
    const rd = (f) => new Set(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).values.map((v) => String(v)));
    return { solidTag: rd('solid.json'), freeTag: rd('free.json') };
  }

  blockAt(x, y, z) {
    this.queries.block++;
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    if (by <= this.groundY) return this.solidBlock;
    return this.freeBlock;
  }
  isSolid(x, y, z) { return this.solidTag.has(this.blockAt(x, y, z)); }
  isFree(x, y, z) { return this.freeTag.has(this.blockAt(x, y, z)); }
  biomeAt() { return this.biome; }
  lightAt(x, y, z) { return Math.floor(y) > this.groundY ? this.light : 0; }
}
