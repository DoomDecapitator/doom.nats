// Convert entity-anchored region tests inside roster files into entity-free positional predicates.
//   `execute at @s[x=..,dx=..] <rest>`                       -> `execute if predicate <box> <rest>`
//   `execute if entity @s[x=..,dx=..] <rest>`                -> `execute if predicate <box> <rest>`
//   `execute unless entity @s[x=..,dx=..] <rest>`            -> `execute unless predicate <box> <rest>`
//   `execute if entity @s[predicate=P,x=..,dx=..] <rest>`    -> `execute if predicate <P+box> <rest>`
//   `execute unless entity @s[predicate=P,x=..,dx=..] ...`   -> `execute unless predicate <P+box> ...`
// The last two collapse "P AND box" into ONE location_check so that `unless` keeps its meaning.
import fs from 'node:fs';

const DIMENSION_OF = {
  'general:dimension_abyss': 'minecraft:abyss',
};

export function makePositional({ externalPredicateDir } = {}) {
  const boxes = new Map();       // slug -> predicate json
  const order = [];

  const num = (s) => Number(s);

  function boxSlug(b) {
    const f = (n) => String(n).replace(/-/g, 'm');
    return `box/x${f(b.x)}_y${f(b.y)}_z${f(b.z)}_dx${b.dx}_dy${b.dy}_dz${b.dz}`;
  }

  function emit(box, external) {
    const slug = boxSlug(box) + (external ? '__' + external.replace(/[^a-z0-9]+/gi, '_') : '');
    if (!boxes.has(slug)) {
      const pred = {
        condition: 'minecraft:location_check',
        predicate: {},
      };
      if (external) {
        const dim = resolveDimension(external);
        pred.predicate.dimension = dim;
      }
      pred.predicate.position = {
        x: { min: box.x, max: box.x + box.dx },
        y: { min: box.y, max: box.y + box.dy },
        z: { min: box.z, max: box.z + box.dz },
      };
      boxes.set(slug, pred);
      order.push(slug);
    }
    return `suso.nats:${slug}`;
  }

  function resolveDimension(id) {
    if (DIMENSION_OF[id]) return DIMENSION_OF[id];
    // try to read the sibling datapack definition that rc4 ships
    try {
      const p = externalPredicateDir && `${externalPredicateDir}/${id.split(':')[1]}.json`;
      if (p && fs.existsSync(p)) {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        const d = j?.predicate?.location?.dimension;
        if (d) return d;
      }
    } catch { /* fall through */ }
    return 'minecraft:overworld';
  }

  // returns { text, changed }
  function convertLine(line) {
    const t = line.trim();
    if (!t || t.startsWith('#')) return { text: line, changed: false };
    const m = /^execute\s+(at|if entity|unless entity)\s+@s\[([^\]]+)\]\s*(.*)$/.exec(t);
    if (!m) return { text: line, changed: false };
    const [, mode, argStr, rest] = m;

    const args = {};
    for (const part of argStr.split(',')) {
      const i = part.indexOf('=');
      if (i < 0) continue;
      args[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    const hasBox = ['x', 'dx'].some((k) => args[k] !== undefined);
    const external = args.predicate;
    if (!hasBox && !external) return { text: line, changed: false };

    let id;
    if (hasBox) {
      id = emit({ x: num(args.x ?? 0), y: num(args.y ?? 0), z: num(args.z ?? 0), dx: num(args.dx ?? 0), dy: num(args.dy ?? 0), dz: num(args.dz ?? 0) }, external);
    } else {
      id = external;      // bare `@s[predicate=P]` cannot run entity-free; leave a marker to fix upstream
      return { text: line, changed: false };
    }

    const cond = mode === 'unless entity' ? 'unless' : 'if';
    const out = `execute ${cond} predicate ${id}${rest ? ' ' + rest : ''}`;
    return { text: out, changed: true };
  }

  return { convertLine, boxes, order };
}

export { DIMENSION_OF };
