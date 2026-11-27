import { CONFIG } from '../config';
import type { CharacterContext, CharacterModule } from './types';

// ============================================================================
// AOKIJI (KUZAN) — Almirante de la Marina · Hie Hie no Mi (Rework Completo)
// ============================================================================

interface IceZone {
  x: number;
  y: number;
  radius: number;
  dps: number;
  slowPct: number;
  life: number;
  maxLife: number;
  tick: number;
}

interface IceArcVFX {
  x: number;
  y: number;
  angle: number;
  range: number;
  halfAngle: number;
  swingDir: 1 | -1;
  thickness: number;
  life: number;
  maxLife: number;
}

interface IceProjectile {
  kind: 'pheasant' | 'spear';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  dmgMult: number;
  traveled: number;
  maxRange: number;
  life: number;
  maxLife: number;
  trailTick: number;
  hitIds: any[];
  isSkill: boolean;
}

interface IceCrystalVFX {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  isFractal?: boolean;
}

function clampX(x: number, pad = 28): number {
  return Math.max(CONFIG.ARENA_MARGIN_X + pad, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - pad, x));
}

function clampY(y: number, pad = 28): number {
  return Math.max(CONFIG.ARENA_MARGIN_Y + pad, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - pad, y));
}

function addIce(ctx: CharacterContext, amount: number): void {
  const p = ctx.player;
  const prev = p.custom.hielo || 0;
  p.custom.hielo = Math.min(100, prev + amount);
  if (prev < 100 && p.custom.hielo >= 100) {
    ctx.audio.playShing();
    ctx.spawnFloatingText(p.x, p.y - 46, '❄️ ¡HIELO AL MÁXIMO!', '#80DEEA', 1.15);
  }
}

function freezeEnemy(ctx: CharacterContext, en: any, duration: number): void {
  if (!en || en.hp <= 0) return;
  const wasFrozen = Boolean(en.frozen);
  en.frozen = true;
  en.frozenTimer = Math.max(en.frozenTimer || 0, duration);
  en.aokijiMarkTimer = Math.max(en.aokijiMarkTimer || 0, 3.5);
  en.telegraphTimer = 0;
  if (!wasFrozen) {
    addIce(ctx, 10);
    ctx.spawnFloatingText(en.x, en.y - 42, '❄️ CONGELADO', '#80DEEA', 0.9);
  }
}

function pushIceArc(
  p: CharacterContext['player'],
  x: number,
  y: number,
  angle: number,
  range: number,
  halfAngle: number,
  swingDir: 1 | -1,
  thickness = 22,
  life = 0.22
): void {
  const arr: IceArcVFX[] = p.custom.iceArcs;
  if (arr.length >= 14) arr.shift();
  arr.push({ x, y, angle, range, halfAngle, swingDir, thickness, life, maxLife: life });
}

function pushIceZone(
  p: CharacterContext['player'],
  x: number,
  y: number,
  radius: number,
  dps: number,
  slowPct: number,
  life: number
): void {
  const zones: IceZone[] = p.custom.iceZones;
  if (zones.length >= 12) zones.shift();
  zones.push({
    x: clampX(x, 20),
    y: clampY(y, 20),
    radius,
    dps,
    slowPct,
    life,
    maxLife: life,
    tick: 0.4
  });
}

function pushCrystal(p: CharacterContext['player'], x: number, y: number, radius: number, life = 0.45, isFractal = false): void {
  const arr: IceCrystalVFX[] = p.custom.crystals;
  if (arr.length >= 12) arr.shift();
  arr.push({ x, y, radius, life, maxLife: life, isFractal });
}

export const aokijiCharacter: CharacterModule = {
  id: 'aokiji',
  name: 'Aokiji',
  faction: 'marines',
  rarity: 'almirante',
  portrait: '❄️',
  portraitBg: 'linear-gradient(135deg, #0277BD 0%, #80DEEA 100%)',
  attackIcon: '❄️',
  themeClass: 'theme-aokiji',
  color: '#29B6F6',
  vestColor: '#1A237E',
  hp: 100,
  damage: 14,
  speed: 5.5,
  armor: 9,
  dashCd: 1.8,
  autoAimRange: 350,
  skills: [
    { name: 'Ice Age', icon: '🧊', cd: 9.0 },
    { name: 'Ice Shatter', icon: '🗡️', cd: 6.5 },
    { name: 'Partisan', icon: '🔱', cd: 11.0 }
  ],
  cardMeta: {
    displayName: 'AOKIJI',
    zarparName: 'AOKIJI',
    epithet: 'Faisán Azul',
    nameColor: '#80DEEA',
    role: 'Almirante Hielo / Control Glacial',
    passiveText: 'Pasiva: Logia de Hielo (-20% daño + escarcha + marca +15% daño)',
    passiveColor: '#B2EBF2',
    stats: { hp: 82, dmg: 85, vel: 85, arm: 78 },
    comboDesc:
      '<b>Combo 4 golpes Glacial:</b> Ice Saber (150px) → Reverso Cristal → <b>Ice Time Capsule</b> (congela 100px) → <b>Pheasant Beckon</b> (faisán helado 360px).',
    skillsDesc:
      '<b>H1:</b> Ice Age (fractales 275px + glaciar) • <b>H2:</b> Ice Shatter (arco 210px, 3× y estallido a congelados) • <b>H3:</b> Partisan (7 lanzas 380px; 100 Hielo = Cero Absoluto).'
  },

  // ==========================================================================
  // ESTADO PROPIO
  // ==========================================================================
  createCustomState: () => ({
    hielo: 0,
    iceZones: [] as IceZone[],
    iceArcs: [] as IceArcVFX[],
    projectiles: [] as IceProjectile[],
    crystals: [] as IceCrystalVFX[]
  }),

  // ==========================================================================
  // COMBO BÁSICO GLACIAL REHECHO (4 GOLPES ESPECTACULARES)
  // ==========================================================================
  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const step = p.comboStep % 4;
    p.comboStep = (step + 1) % 4;
    p.attackCooldown = step === 3 ? 0.30 : 0.19;
    p.comboResetTimer = 0.82;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = 0.22;

    if (step === 0) {
      // Golpe 1: Ice Saber — Arco cristalino amplio (150px)
      audio.playSlash(1.25);
      audio.playShing();
      pushIceArc(p, p.x, p.y, aimAngle, 150, Math.PI * 0.42, 1, 22, 0.2);
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 150, Math.PI * 0.42, 1.15, 24, false, 0, 0, {
        aokijiMarkTimer: 3.5
      });
    } else if (step === 1) {
      // Golpe 2: Ice Saber Twin Cross — Doble tajo cruzado glacial (160px)
      audio.playSlash(1.35);
      pushIceArc(p, p.x, p.y, aimAngle, 160, Math.PI * 0.46, -1, 24, 0.22);
      pushIceArc(p, p.x, p.y, aimAngle + 0.1, 130, Math.PI * 0.36, 1, 14, 0.2);
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 160, Math.PI * 0.46, 1.25, 28, false, 0, 0, {
        aokijiMarkTimer: 4.0
      });
    } else if (step === 2) {
      // Golpe 3: Ice Time Capsule — Prisma hexagonal de hielo que encierra y congela adelante
      audio.playShing();
      const target = ctx.findNearestEnemyInCone(220, aimAngle, Math.PI / 3) || ctx.findNearestEnemy(200);
      const cx = target ? target.x : clampX(p.x + Math.cos(aimAngle) * 115);
      const cy = target ? target.y : clampY(p.y + Math.sin(aimAngle) * 115);
      pushCrystal(p, cx, cy, 100, 0.44, false);
      pushIceZone(p, cx, cy, 88, 6, 0.35, 3.2);
      for (let i = 0; i < state.enemies.length; i++) {
        const en = state.enemies[i];
        if (en.hp <= 0) continue;
        if (Math.hypot(en.x - cx, en.y - cy) <= 100 + en.radius) {
          const { amount, isCrit } = ctx.calculatePlayerDamage(1.35, false);
          ctx.damageEnemy(en, amount, { isCrit, isNormalAttack: true, knockback: 12 });
          freezeEnemy(ctx, en, 1.8);
        }
      }
    } else {
      // Golpe 4 (Finisher): ICE BLOCK: PHEASANT BECKON — Faisán alado de hielo volando 360px
      audio.playShing();
      audio.playExplosion(1.1);
      ctx.triggerScreenShake(6, 0.16);
      pushIceArc(p, p.x, p.y, aimAngle, 145, Math.PI * 0.45, 1, 20, 0.2);
      p.custom.projectiles.push({
        kind: 'pheasant',
        x: p.x + Math.cos(aimAngle) * 24,
        y: p.y + Math.sin(aimAngle) * 24,
        vx: Math.cos(aimAngle) * 700,
        vy: Math.sin(aimAngle) * 700,
        angle: aimAngle,
        radius: 50,
        dmgMult: 1.85,
        traveled: 0,
        maxRange: 360,
        life: 0.56,
        maxLife: 0.56,
        trailTick: 0,
        hitIds: [],
        isSkill: false
      });
    }
    ctx.updateHUD();
  },

  // ==========================================================================
  // HABILIDADES H1 / H2 / H3 REHECHAS DESDE CERO
  // ==========================================================================
  onSkill(ctx, idx, aimAngle) {
    const { state, player: p, audio } = ctx;

    if (idx === 0) {
      // H1: ICE AGE — Fractales de hielo radiales (275px), congela 3.0s y crea glaciar duradero
      audio.playExplosion(1.25);
      audio.playShing();
      ctx.triggerScreenShake(8, 0.22);
      pushCrystal(p, p.x, p.y, 275, 0.58, true);
      pushIceZone(p, p.x, p.y, 255, 8, 0.45, 4.8);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        ctx.spawnParticle(p.x + Math.cos(a) * 120, p.y + Math.sin(a) * 120, '#E1F5FE', 5, 0.42, { shape: 'spark' });
      }
      for (let i = 0; i < state.enemies.length; i++) {
        const en = state.enemies[i];
        if (en.hp <= 0) continue;
        if (Math.hypot(en.x - p.x, en.y - p.y) <= 275 + en.radius) {
          const { amount, isCrit } = ctx.calculatePlayerDamage(1.85, true);
          ctx.damageEnemy(en, amount, { isCrit, knockback: 32, pierceShield: true });
          freezeEnemy(ctx, en, 3.0);
          if (!en.isBoss) {
            const ang = Math.atan2(en.y - p.y, en.x - p.x);
            en.slipperyTimer = 1.2;
            en.slideVx = Math.cos(ang) * 175;
            en.slideVy = Math.sin(ang) * 175;
          }
        }
      }
      ctx.spawnFloatingText(p.x, p.y - 48, '🧊 ¡ICE AGE!', '#80DEEA', 1.3);
    } else if (idx === 1) {
      // H2: ICE SABER: SHATTER — Enorme guadaña glaciar (210px) que fractura congelados en explosión de diamantes
      audio.playShing();
      audio.playSlash(1.45);
      ctx.triggerScreenShake(6, 0.16);
      const halfAng = Math.PI * 0.42;
      pushIceArc(p, p.x, p.y, aimAngle, 210, halfAng, 1, 32, 0.26);

      let hits = 0;
      const shatterPoints: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < state.enemies.length; i++) {
        const en = state.enemies[i];
        if (en.hp <= 0) continue;
        const dx = en.x - p.x;
        const dy = en.y - p.y;
        if (Math.hypot(dx, dy) - en.radius <= 210) {
          if (Math.abs(ctx.normalizeAngle(Math.atan2(dy, dx) - aimAngle)) <= halfAng) {
            const wasFrozen = Boolean(en.frozen);
            const mult = wasFrozen ? 5.6 : 2.15;
            const { amount, isCrit } = ctx.calculatePlayerDamage(mult, true);
            ctx.damageEnemy(en, amount, {
              isCrit,
              knockback: 54,
              shatterFreeze: wasFrozen,
              ignoreFreezeMitigation: true,
              pierceShield: true
            });
            if (wasFrozen) shatterPoints.push({ x: en.x, y: en.y });
            hits++;
          }
        }
      }
      // Explosión de esquirlas alrededor de cada enemigo congelado fracturado
      for (let s = 0; s < shatterPoints.length; s++) {
        const sp = shatterPoints[s];
        pushCrystal(p, sp.x, sp.y, 95, 0.35, true);
        ctx.damageEnemiesInCircle(sp.x, sp.y, 95, 1.3, 45, true, 0.5, { ignoreFreezeMitigation: true });
      }
      if (hits > 0) addIce(ctx, hits * 6);
      ctx.spawnFloatingText(p.x, p.y - 46, '🗡️ ¡ICE SHATTER!', '#B2EBF2', 1.25);
    } else if (idx === 2) {
      // H3: ICE BLOCK: PARTISAN — Halo de 7 tridentes de hielo en abanico (380px) + Cero Absoluto a 100 Hielo
      audio.playShing();
      audio.playExplosion(1.2);
      ctx.triggerScreenShake(7, 0.2);

      const fan = [-0.42, -0.28, -0.14, 0, 0.14, 0.28, 0.42];
      for (let s = 0; s < fan.length; s++) {
        const a = aimAngle + fan[s];
        p.custom.projectiles.push({
          kind: 'spear',
          x: p.x + Math.cos(a) * 26,
          y: p.y + Math.sin(a) * 26,
          vx: Math.cos(a) * 760,
          vy: Math.sin(a) * 760,
          angle: a,
          radius: 26,
          dmgMult: 1.55,
          traveled: 0,
          maxRange: 380,
          life: 0.54,
          maxLife: 0.54,
          trailTick: 0.1,
          hitIds: [],
          isSkill: true
        });
      }
      pushIceZone(p, p.x + Math.cos(aimAngle) * 190, p.y + Math.sin(aimAngle) * 190, 165, 9, 0.45, 5.0);

      if ((p.custom.hielo || 0) >= 100) {
        p.custom.hielo = 0;
        ctx.triggerScreenShake(10, 0.28);
        pushCrystal(p, p.x, p.y, 460, 0.65, true);
        for (let i = 0; i < state.enemies.length; i++) {
          const en = state.enemies[i];
          if (en.hp <= 0) continue;
          en.frozen = true;
          en.frozenTimer = Math.max(en.frozenTimer || 0, 2.5);
          en.aokijiMarkTimer = Math.max(en.aokijiMarkTimer || 0, 4.0);
        }
        ctx.spawnFloatingText(p.x, p.y - 54, '❄️ ¡CERO ABSOLUTO!', '#FFFFFF', 1.4);
      } else {
        ctx.spawnFloatingText(p.x, p.y - 46, '🔱 ¡PARTISAN!', '#29B6F6', 1.25);
      }
    }
    ctx.updateHUD();
  },

  // ==========================================================================
  // HOOKS DE COMBATE Y LOGIA DE HIELO
  // ==========================================================================
  onBeforePlayerDamage(ctx, _incomingDmg, _isBlunt, attacker) {
    const p = ctx.player;
    ctx.audio.playShing();
    pushCrystal(p, p.x, p.y, 95, 0.28, false);
    ctx.damageEnemiesInCircle(p.x, p.y, 95, 0.75, 28, true, 0, {
      aokijiMarkTimer: 2.5
    });
    if (attacker && attacker.hp > 0) {
      attacker.aokijiMarkTimer = Math.max(attacker.aokijiMarkTimer || 0, 2.5);
    }
    return { dmgMult: 0.8 };
  },

  onEnemyTick(p, en) {
    const zones: IceZone[] = p.custom.iceZones || [];
    let slowMult = 1.0;
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      if (Math.hypot(en.x - z.x, en.y - z.y) <= z.radius + en.radius) {
        slowMult = Math.min(slowMult, 1 - z.slowPct);
      }
    }
    return slowMult < 1 ? { speedMult: slowMult } : {};
  },

  onUpdate(ctx, dt) {
    const { state, player: p } = ctx;

    // 1. Proyectiles glaciales (Pheasant Beckon y Partisan Spears)
    const projs: IceProjectile[] = p.custom.projectiles || [];
    for (let i = projs.length - 1; i >= 0; i--) {
      const pr = projs[i];
      const sx = pr.vx * dt;
      const sy = pr.vy * dt;
      pr.x += sx;
      pr.y += sy;
      pr.traveled += Math.hypot(sx, sy);
      pr.life -= dt;
      pr.trailTick -= dt;

      if (pr.kind === 'pheasant' && pr.trailTick <= 0) {
        pr.trailTick = 0.09;
        pushIceZone(p, pr.x, pr.y, 44, 6, 0.35, 2.8);
      }
      if (Math.random() < 0.65) {
        ctx.spawnParticle(pr.x, pr.y, Math.random() < 0.5 ? '#E1F5FE' : '#29B6F6', 3.8, 0.24, { shape: 'spark' });
      }

      for (let j = 0; j < state.enemies.length; j++) {
        const en = state.enemies[j];
        if (en.hp <= 0 || pr.hitIds.includes(en)) continue;
        if (Math.hypot(en.x - pr.x, en.y - pr.y) <= en.radius + pr.radius) {
          pr.hitIds.push(en);
          const { amount, isCrit } = ctx.calculatePlayerDamage(pr.dmgMult, pr.isSkill);
          ctx.damageEnemy(en, amount, {
            isCrit,
            knockback: pr.kind === 'pheasant' ? 42 : 34,
            sourceX: pr.x,
            sourceY: pr.y,
            isNormalAttack: !pr.isSkill,
            aokijiMarkTimer: 4.0,
            pierceShield: pr.isSkill
          });
          if (pr.kind === 'pheasant') {
            freezeEnemy(ctx, en, 1.9);
          }
        }
      }

      if (pr.life <= 0 || pr.traveled >= pr.maxRange) {
        if (pr.kind === 'pheasant') {
          pushCrystal(p, pr.x, pr.y, 105, 0.38, true);
        }
        projs.splice(i, 1);
      }
    }

    // 2. Zonas glaciares
    const zones: IceZone[] = p.custom.iceZones || [];
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      z.life -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.45;
        const tickDmg = Math.max(2, Math.round(z.dps * 0.45));
        for (let eIdx = 0; eIdx < state.enemies.length; eIdx++) {
          const en = state.enemies[eIdx];
          if (en.hp <= 0) continue;
          if (Math.hypot(en.x - z.x, en.y - z.y) <= z.radius + en.radius) {
            ctx.damageEnemy(en, tickDmg, {});
          }
        }
      }
      if (z.life <= 0) zones.splice(i, 1);
    }

    // 3. Decay arcos y cristales
    const arcs: IceArcVFX[] = p.custom.iceArcs || [];
    for (let i = arcs.length - 1; i >= 0; i--) {
      arcs[i].life -= dt;
      if (arcs[i].life <= 0) arcs.splice(i, 1);
    }
    const crys: IceCrystalVFX[] = p.custom.crystals || [];
    for (let i = crys.length - 1; i >= 0; i--) {
      crys[i].life -= dt;
      if (crys[i].life <= 0) crys.splice(i, 1);
    }

    if (Math.random() < 0.16) {
      ctx.spawnParticle(p.x + Math.cos(p.facingAngle) * 14, p.y + Math.sin(p.facingAngle) * 14, '#E1F5FE', 2.4, 0.28);
    }
    ctx.updateHUD();
  },

  onCleanupEffects(p) {
    if (p.custom) {
      p.custom.iceZones = [];
      p.custom.iceArcs = [];
      p.custom.projectiles = [];
      p.custom.crystals = [];
    }
  },

  // ==========================================================================
  // HUD DINÁMICO (HIELO 0-100)
  // ==========================================================================
  mountHUD(slotEl) {
    slotEl.innerHTML = `
      <div id="aokiji-ice-hud" class="char-resource-hud" style="display:flex;">
        <span style="font-size:12px;">❄️</span>
        <div class="res-bar-outer" style="border-color:#29B6F6; width:108px;">
          <div id="hud-aokiji-ice-fill" class="res-bar-fill" style="width:0%; background:linear-gradient(90deg, #0277BD, #80DEEA);"></div>
        </div>
        <span id="hud-aokiji-ice-text" class="res-text text-outline-sm" style="color:#B2EBF2;">HIELO 0/100</span>
      </div>
    `;
  },

  updateHUD(p) {
    const hud = document.getElementById('aokiji-ice-hud');
    const fill = document.getElementById('hud-aokiji-ice-fill');
    const txt = document.getElementById('hud-aokiji-ice-text');
    const val = Math.round(p.custom.hielo || 0);
    if (hud) hud.classList.toggle('aokiji-full-ice', val >= 100);
    if (fill) fill.style.width = `${Math.min(100, val)}%`;
    if (txt) txt.textContent = val >= 100 ? 'HIELO 100/100 ❄️' : `HIELO ${val}/100`;
  },

  // ==========================================================================
  // RENDERIZADO GLACIAL EN MUNDO Y SPRITE EXISTENTE (32x44 px)
  // ==========================================================================
  drawWorldBeforePlayer({ ctx, player: p }) {
    const zones: IceZone[] = p.custom.iceZones || [];
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      ctx.save();
      ctx.globalAlpha = Math.min(0.85, z.life / Math.min(1.0, z.maxLife));
      const grad = ctx.createRadialGradient(z.x, z.y, z.radius * 0.15, z.x, z.y, z.radius);
      grad.addColorStop(0, 'rgba(225, 245, 254, 0.55)');
      grad.addColorStop(0.65, 'rgba(41, 182, 246, 0.34)');
      grad.addColorStop(1, 'rgba(41, 182, 246, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#E1F5FE';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius * 0.94, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  },

  drawWorldAfterPlayer({ ctx, player: p }) {
    // 1. Arcos cristalinos de Ice Saber
    const arcs: IceArcVFX[] = p.custom.iceArcs || [];
    for (let i = 0; i < arcs.length; i++) {
      const c = arcs[i];
      const prog = 1 - c.life / c.maxLife;
      const a = Math.max(0, c.life / c.maxLife);
      const head = Math.min(1, prog / 0.34);
      const tail = Math.max(0, (prog - 0.22) / 0.78) * 0.6;
      const sA = c.swingDir * (-c.halfAngle + 2 * c.halfAngle * tail);
      const eA = c.swingDir * (-c.halfAngle + 2 * c.halfAngle * head);
      const minA = Math.min(sA, eA);
      const maxA = Math.max(sA, eA);

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0288D1';
      ctx.lineWidth = (c.thickness + 8) * Math.max(0.45, a);
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.88, minA, maxA);
      ctx.stroke();

      ctx.strokeStyle = '#80DEEA';
      ctx.lineWidth = c.thickness * 0.65 * Math.max(0.45, a);
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.92, minA, maxA);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3.5 * a;
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.96, minA, maxA);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Proyectiles esculpidos: Faisán Azul alado y Tridentes Partisan
    const projs: IceProjectile[] = p.custom.projectiles || [];
    for (let i = 0; i < projs.length; i++) {
      const pr = projs[i];
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.angle);

      if (pr.kind === 'pheasant') {
        // Faisán alado de hielo translúcido
        ctx.fillStyle = 'rgba(128, 222, 234, 0.88)';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(42, 0);
        ctx.lineTo(6, -12);
        ctx.lineTo(-24, -52);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-38, 0);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-24, 52);
        ctx.lineTo(6, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(34, 0);
        ctx.lineTo(-12, -7);
        ctx.lineTo(-12, 7);
        ctx.closePath();
        ctx.fill();
      } else {
        // Tridente glacial Partisan
        ctx.fillStyle = '#80DEEA';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(6, -9);
        ctx.lineTo(14, -14);
        ctx.lineTo(-24, -4);
        ctx.lineTo(-24, 4);
        ctx.lineTo(14, 14);
        ctx.lineTo(6, 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Fractales de Ice Age y cristales hexagonales
    const crys: IceCrystalVFX[] = p.custom.crystals || [];
    for (let i = 0; i < crys.length; i++) {
      const c = crys[i];
      const a = Math.max(0, c.life / c.maxLife);
      const curR = c.radius * (0.4 + (1 - a) * 0.6);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = a;

      // Polígono cristalino hexagonal
      ctx.fillStyle = `rgba(178, 235, 242, ${0.32 * a})`;
      ctx.strokeStyle = '#E1F5FE';
      ctx.lineWidth = 3.2 * a;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2;
        const rx = Math.cos(ang) * curR;
        const ry = Math.sin(ang) * curR;
        if (k === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (c.isFractal) {
        ctx.strokeStyle = '#80DEEA';
        ctx.lineWidth = 2.6 * a;
        for (let s = 0; s < 8; s++) {
          const sa = (s / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(sa) * curR * 1.05, Math.sin(sa) * curR * 1.05);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  },

  drawAura({ ctx, player: p, t }) {
    if ((p.custom.hielo || 0) >= 100) {
      ctx.strokeStyle = 'rgba(128, 222, 234, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 9 + Math.sin(t * 3.5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  drawBody({ ctx }) {
    // Capa de Almirante
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-20, -21, 15, 42, 6);
    ctx.fill();
    ctx.stroke();

    // Chaleco azul marino y camisa celeste gélido
    ctx.fillStyle = '#1A237E';
    ctx.beginPath();
    ctx.roundRect(-13, -19, 26, 38, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#29B6F6';
    ctx.fillRect(-2, -16, 11, 32);

    // Cabeza y cabello oscuro rizado
    ctx.fillStyle = '#1B2230';
    ctx.beginPath();
    ctx.arc(-2, 0, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#C99B78';
    ctx.beginPath();
    ctx.arc(3, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Antifaz verde característico en la frente
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.roundRect(-2, -9, 6, 18, 3);
    ctx.fill();
    ctx.stroke();
  },

  drawPreview(pctx) {
    pctx.fillStyle = '#1A237E';
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.roundRect(-12, -5, 24, 21, 7);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#29B6F6';
    pctx.fillRect(-5, -3, 10, 16);

    pctx.fillStyle = '#1B2230';
    pctx.beginPath();
    pctx.arc(0, -11, 11.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#C99B78';
    pctx.beginPath();
    pctx.arc(0, -9, 8.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    // Antifaz verde en la frente
    pctx.fillStyle = '#4CAF50';
    pctx.beginPath();
    pctx.roundRect(-7, -18, 14, 5, 2.5);
    pctx.fill();
    pctx.stroke();
  }
};
