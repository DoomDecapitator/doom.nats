# doom.nats:check/block —— 落位判定（reason=4，由 tools/gen_ctm_check.mjs 从规则表生成，勿手改）
#
# place 0=通用陆生 1=无落位限制 2=水中 3=水面窗口 4=陆生+专属标签 5=岩浆
# 详见 tools/lib/entity-rules.mjs 顶部（含源码出处）

# ---- v4.24 运行时刻作者层：额外落位面（storage doom.nats:author → entityRules.<实体>.belowAny，上限 8）
#   命中任一"作者点名的标签"即置 $chk.belowok=1，于是下面的"下方必须可站立"多一条放行条件。
#   空层时这两行是纯 no-op（belowok 恒 0）。
scoreboard players set $chk.belowok doom.nats 0
execute if score $auth.loaded doom.nats matches 1 if data storage doom.nats:author_rt w0 run function doom.nats:author/below_check

# ---- 位置与上方必须是"可生成空位"（place 0/1/4）
#   ⚠ v4.17 实测：`#minecraft:replaceable` **传递包含** water/lava/snow ⇒ 光靠白名单会误收流体与雪层。
#   原版 isValidEmptySpawnBlock 明列「流体非空 ⇒ false」；雪层有碰撞盒（0..2/16），最后的 noCollision(AABB) 会拒。
#   ⇒ 本体与上方都显式排除 water/lava/snow（与下面的 AABB 近似配套）。
execute if score $sel.place doom.nats matches 0 unless block ~ ~ ~ #doom.nats:spawnable_at run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 0 unless block ~ ~1 ~ #doom.nats:spawnable_at run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 0 if block ~ ~ ~ #doom.nats:water_fluid run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 0 if block ~ ~ ~ minecraft:lava run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 0 if block ~ ~ ~ minecraft:snow run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 0 if block ~ ~1 ~ #doom.nats:water_fluid run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 0 if block ~ ~1 ~ minecraft:lava run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 0 if block ~ ~1 ~ minecraft:snow run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 1 unless block ~ ~ ~ #doom.nats:spawnable_at run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 1 unless block ~ ~1 ~ #doom.nats:spawnable_at run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 1 if block ~ ~ ~ #doom.nats:water_fluid run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 1 if block ~ ~ ~ minecraft:lava run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 1 if block ~ ~ ~ minecraft:snow run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 1 if block ~ ~1 ~ #doom.nats:water_fluid run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 1 if block ~ ~1 ~ minecraft:lava run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 1 if block ~ ~1 ~ minecraft:snow run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 4 unless block ~ ~ ~ #doom.nats:spawnable_at run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 4 unless block ~ ~1 ~ #doom.nats:spawnable_at run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 4 if block ~ ~ ~ #doom.nats:water_fluid run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 4 if block ~ ~ ~ minecraft:lava run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 4 if block ~ ~ ~ minecraft:snow run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 4 if block ~ ~1 ~ #doom.nats:water_fluid run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 4 if block ~ ~1 ~ minecraft:lava run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 4 if block ~ ~1 ~ minecraft:snow run function doom.nats:check/fail {reason:4}

# ---- 下方必须可站立（ON_GROUND 的 1 判断；place 0/4）
# 原版是 state.isFaceSturdy(level,pos,UP) ≡ 支持形状的 UP 面满格 ⇒ **满碰撞立方**都算可站立。
#   #standable 是历史白名单；v4.17 起与 #full_collision 取**并集**：白名单外的完整方块（石砖族以外的一大批）
#   不再被误否决。半砖/楼梯（bottom 态）/栅栏/玻璃板/雪层**都不**满 UP 面 ⇒ 依旧不可站立（与原版一致）。
execute if score $sel.place doom.nats matches 0 unless block ~ ~-1 ~ #doom.nats:standable unless block ~ ~-1 ~ #doom.nats:full_collision unless score $chk.belowok doom.nats matches 1 run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 4 unless block ~ ~-1 ~ #doom.nats:standable unless block ~ ~-1 ~ #doom.nats:full_collision unless score $chk.belowok doom.nats matches 1 run function doom.nats:check/fail {reason:4}

# ---- 水中（IN_WATER）；上方不是红石导体 ⇒ 用 #standable 近似
execute if score $sel.place doom.nats matches 2 unless block ~ ~ ~ #doom.nats:water_fluid run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 2 if block ~ ~1 ~ #doom.nats:standable run function doom.nats:check/fail {reason:4}

# ---- 水面窗口（WaterAnimal/AgeableWaterCreature：seaLevel-13 ≤ y ≤ seaLevel ∧ 下方是水 ∧ 上方是水）
execute if score $sel.place doom.nats matches 3 unless block ~ ~ ~ #doom.nats:water_fluid run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 3 unless block ~ ~-1 ~ #doom.nats:water_fluid run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 3 unless block ~ ~1 ~ #doom.nats:water_fluid run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 3 if score $py doom.nats < $chk.sea_lo doom.nats run function doom.nats:check/fail {reason:4}
execute if score $sel.place doom.nats matches 3 if score $py doom.nats > $chk.sea_hi doom.nats run function doom.nats:check/fail {reason:4}

# ---- 岩浆（IN_LAVA）
execute if score $sel.place doom.nats matches 5 unless block ~ ~ ~ minecraft:lava run function doom.nats:check/fail {reason:4}

# ---- AABB 近似（原版 isValidSpawnPostitionForType 最后一步 level.noCollision(type.getSpawnAABB(x+0.5,y,z+0.5))）
#   实体 AABB 以方块中心为原点、按 width 向两侧各展开 width/2 ⇒
#     width > 1（蜘蛛 1.4 / 马 1.4 / 熊猫 1.3 / 乌龟 1.2 …）会跨进相邻方块的碰撞盒；
#     width > 2（恶魂 4.0）跨两格；height > 2（末影人 2.9 / 骆驼 2.375 / 恶魂 4.0）需要第三格净空。
#   近似：用 #spawnable_at（可生成空位 = 无碰撞盒）判定"该处没有碰撞盒"；
#   v4.17（P1-7 便宜版）：再用 #narrow_partial 放行"居中窄条/薄片"方块（栅栏/栅栏门/墙/铁栏杆/玻璃板/
#     锁链/火把/灯笼/花盆/蜡烛/按钮…）—— 宽体生物的 AABB 只伸进邻格一条窄缝（蜘蛛 1.4 ⇒ 伸进 0.2 格），
#     原版几何上够不到这些碰撞盒，而旧实现按白名单会误否决（真机前后对比见 _work/verify_aabb_cheap.mjs）。
#   半砖/楼梯/雪层/地毯**不**在放行清单里：它们占满 1×1 占地面积 ⇒ 边条照样会撞上，原版也会拒。
execute if score $sel.wide doom.nats matches 1 unless block ~1 ~ ~ #doom.nats:spawnable_at unless block ~1 ~ ~ #doom.nats:narrow_partial run function doom.nats:check/fail {reason:4}
execute if score $sel.wide doom.nats matches 1 unless block ~-1 ~ ~ #doom.nats:spawnable_at unless block ~-1 ~ ~ #doom.nats:narrow_partial run function doom.nats:check/fail {reason:4}
execute if score $sel.wide doom.nats matches 1 unless block ~ ~ ~1 #doom.nats:spawnable_at unless block ~ ~ ~1 #doom.nats:narrow_partial run function doom.nats:check/fail {reason:4}
execute if score $sel.wide doom.nats matches 1 unless block ~ ~ ~-1 #doom.nats:spawnable_at unless block ~ ~ ~-1 #doom.nats:narrow_partial run function doom.nats:check/fail {reason:4}
execute if score $sel.wide doom.nats matches 1 unless block ~1 ~1 ~ #doom.nats:spawnable_at unless block ~1 ~1 ~ #doom.nats:narrow_partial run function doom.nats:check/fail {reason:4}
execute if score $sel.wide doom.nats matches 1 unless block ~-1 ~1 ~ #doom.nats:spawnable_at unless block ~-1 ~1 ~ #doom.nats:narrow_partial run function doom.nats:check/fail {reason:4}
execute if score $sel.wide doom.nats matches 1 unless block ~ ~1 ~1 #doom.nats:spawnable_at unless block ~ ~1 ~1 #doom.nats:narrow_partial run function doom.nats:check/fail {reason:4}
execute if score $sel.wide doom.nats matches 1 unless block ~ ~1 ~-1 #doom.nats:spawnable_at unless block ~ ~1 ~-1 #doom.nats:narrow_partial run function doom.nats:check/fail {reason:4}
execute if score $sel.wide2 doom.nats matches 1 unless block ~2 ~ ~ #doom.nats:spawnable_at unless block ~2 ~ ~ #doom.nats:narrow_partial run function doom.nats:check/fail {reason:4}
execute if score $sel.wide2 doom.nats matches 1 unless block ~-2 ~ ~ #doom.nats:spawnable_at unless block ~-2 ~ ~ #doom.nats:narrow_partial run function doom.nats:check/fail {reason:4}
execute if score $sel.wide2 doom.nats matches 1 unless block ~ ~ ~2 #doom.nats:spawnable_at unless block ~ ~ ~2 #doom.nats:narrow_partial run function doom.nats:check/fail {reason:4}
execute if score $sel.wide2 doom.nats matches 1 unless block ~ ~ ~-2 #doom.nats:spawnable_at unless block ~ ~ ~-2 #doom.nats:narrow_partial run function doom.nats:check/fail {reason:4}
execute if score $sel.tall doom.nats matches 1 unless block ~ ~2 ~ #doom.nats:spawnable_at run function doom.nats:check/fail {reason:4}

# ---- 实体专属下方标签（vanilla 原标签，只列出本包用到的）
execute if score $sel.tag doom.nats matches 1 unless block ~ ~-1 ~ #minecraft:animals_spawnable_on run function doom.nats:check/fail {reason:4}
execute if score $sel.tag doom.nats matches 2 unless block ~ ~-1 ~ #minecraft:foxes_spawnable_on run function doom.nats:check/fail {reason:4}
execute if score $sel.tag doom.nats matches 3 unless block ~ ~-1 ~ #minecraft:rabbits_spawnable_on run function doom.nats:check/fail {reason:4}
execute if score $sel.tag doom.nats matches 4 unless block ~ ~-1 ~ #minecraft:wolves_spawnable_on run function doom.nats:check/fail {reason:4}
execute if score $sel.tag doom.nats matches 5 unless block ~ ~-1 ~ #minecraft:goats_spawnable_on run function doom.nats:check/fail {reason:4}
execute if score $sel.tag doom.nats matches 7 unless block ~ ~-1 ~ #minecraft:armadillo_spawnable_on run function doom.nats:check/fail {reason:4}
execute if score $sel.tag doom.nats matches 8 unless block ~ ~-1 ~ #minecraft:parrots_spawnable_on run function doom.nats:check/fail {reason:4}
execute if score $sel.tag doom.nats matches 9 unless block ~ ~-1 ~ #minecraft:frogs_spawnable_on run function doom.nats:check/fail {reason:4}
execute if score $sel.tag doom.nats matches 10 unless block ~ ~-1 ~ #minecraft:mooshrooms_spawnable_on run function doom.nats:check/fail {reason:4}
execute if score $sel.tag doom.nats matches 11 unless block ~ ~-1 ~ #minecraft:axolotls_spawnable_on run function doom.nats:check/fail {reason:4}
execute if score $sel.tag doom.nats matches 12 unless block ~ ~-1 ~ #minecraft:bats_spawnable_on run function doom.nats:check/fail {reason:4}
execute if score $sel.tag doom.nats matches 14 unless block ~ ~-1 ~ #minecraft:sand run function doom.nats:check/fail {reason:4}
