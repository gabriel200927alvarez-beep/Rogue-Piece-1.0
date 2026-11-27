import { CONFIG } from '../config';
import type { CharacterContext, CharacterModule } from './types';

// ============================================================================
// DONQUIXOTE DOFLAMINGO — Shichibukai · Ito Ito no Mi (Rework Completo)
// ============================================================================

interface StringArcVFX {
  x: number;
  y: number;
  angle: number;
  range: number;
  halfAngle: number;
  swingDir: 1 | -1;
  multiStrand: boolean;
  isHeated: boolean;
  life: number;
  maxLife: number;
}

interface StringBeamVFX {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  isOverheat: boolean;
  life: number;
  maxLife: number;
}

interface StringSpearProj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  length: number;
  dmgMult: number;
  traveled: number;
  maxRange: number;
  life: number;
  maxLife: number;
  hitIds: any[];
}

interface StringBurstVFX {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

function clampX(x: number, pad = 28): number {
  return Math.max(CONFIG.ARENA_MARGIN_X + pad, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - pad, x));
}

function clampY(y: number, pad = 28): number {
  return Math.max(CONFIG.ARENA_MARGIN_Y + pad, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - pad, y));
}

function addThreads(ctx: CharacterContext, amount: number): void {
  const p = ctx.player;
  const prev = p.custom.hilos || 0;
  p.custom.hilos = Math.min(100, prev + amount);
  if (prev < 100 && p.custom.hilos >= 100) {
    ctx.audio.playShing();
    ctx.spawnFloatingText(p.x, p.y - 46, '🧵 ¡HILOS AL MÁXIMO!', '#F48FB1', 1.15);
  }
}

function pushStringArc(
  p: CharacterContext['player'],
  x: number,
  y: number,
  angle: number,
  range: number,
  halfAngle: number,
  swingDir: 1 | -1,
  multiStrand = true,
  isHeated = false,
  life = 0.2
): void {
  const arr: StringArcVFX[] = p.custom.stringArcs;
  if (arr.length >= 14) arr.shift();
  arr.push({ x, y, angle, range, halfAngle, swingDir, multiStrand, isHeated, life, maxLife: life });
}

function pushStringBeam(
  p: CharacterContext['player'],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  isOverheat = false,
  life = 0.24
): void {
  const arr: StringBeamVFX[] = p.custom.stringBeams;
  if (arr.length >= 16) arr.shift();
  arr.push({ x1, y1, x2, y2, width, isOverheat, life, maxLife: life });
}

function pushStringBurst(p: CharacterContext['player'], x: number, y: number, radius: number, color = '#FF4081', life = 0.3): void {
  const arr: StringBurstVFX[] = p.custom.stringBursts;
  if (arr.length >= 12) arr.shift();
  arr.push({ x, y, radius, color, life, maxLife: life });
}

export const doflamingoCharacter: CharacterModule = {
  id: 'doflamingo',
  name: 'Doflamingo',
  faction: 'pirates',
  rarity: 'shichibukai',
  portrait: '🦩',
  portraitBg: 'linear-gradient(135deg, #AD1457 0%, #F48FB1 100%)',
  attackIcon: '🧵',
  themeClass: 'theme-doflamingo',
  color: '#EC407A',
  vestColor: '#FFFFFF',
  hp: 95,
  damage: 15,
  speed: 6.5,
  armor: 7,
  dashCd: 1.7,
  autoAimRange: 350,
  skills: [
    { name: 'Parasite', icon: '🧵', cd: 7.5 },
    { name: 'God Thread', icon: '🔥', cd: 6.5 },
    { name: 'Birdcage', icon: '🕸️', cd: 13.0 }
  ],
  cardMeta: {
    displayName: 'DOFLAMINGO',
    zarparName: 'DOFLAMINGO',
    epithet: 'Demonio Celestial',
    nameColor: '#F48FB1',
    role: 'Shichibukai Despertar / Hilos',
    passiveText: 'Pasiva: Clon de Hilos (1×/run evita muerte con clon explosivo + teletransporte)',
    passiveColor: '#F8BBD0',
    stats: { hp: 74, dmg: 88, vel: 95, arm: 64 },
    comboDesc:
      '<b>Combo 4 golpes Ito:</b> Goshikito 5 hilos (155px) → <b>Tamaito</b> (3 balas láser 310px) → Athlete Despertar (175px) → <b>Overheat</b> (látigo ardiente 350px).',
    skillsDesc:
      '<b>H1:</b> Parasite (controla hasta 2-4 enemigos 300px) • <b>H2:</b> God Thread (Overheat 240px + 8 lanzas despertadas 330px + detona marioneta) • <b>H3:</b> Birdcage (-40 Hilos, 300px).'
  },

  // ==========================================================================
  // ESTADO PROPIO
  // ==========================================================================
  createCustomState: () => ({
    hilos: 0,
    birdcageZone: null as null | {
      x: number;
      y: number;
      radius: number;
      life: number;
      maxLife: number;
      tick: number;
    },
    stringArcs: [] as StringArcVFX[],
    stringBeams: [] as StringBeamVFX[],
    spears: [] as StringSpearProj[],
    stringBursts: [] as StringBurstVFX[],
    cloneUsed: false
  }),

  canUseSkill(ctx, idx) {
    if (idx === 2) {
      return (ctx.player.custom.hilos || 0) >= 40;
    }
    return true;
  },

  // ==========================================================================
  // COMBO BÁSICO REHECHO DESDE CERO (4 GOLPES DE HILOS Y DESPERTAR)
  // ==========================================================================
  onAttack(ctx, aimAngle) {
    const { player: p, audio } = ctx;
    const step = p.comboStep % 4;
    p.comboStep = (step + 1) % 4;
    p.attackCooldown = step === 3 ? 0.28 : 0.17;
    p.comboResetTimer = 0.78;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = 0.22;

    if (step === 0) {
      // Golpe 1: GOSHIKITO — Garras de 5 hilos luminosos paralelos (155px)
      audio.playSlash(1.45);
      audio.playShing();
      pushStringArc(p, p.x, p.y, aimAngle, 155, Math.PI * 0.42, 1, true, false, 0.2);
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 155, Math.PI * 0.42, 1.15, 24);
    } else if (step === 1) {
      // Golpe 2: TAMAITO — Ráfaga de 3 rayos bala de hilos en abanico (310px)
      audio.playShing();
      audio.playSlash(1.6);
      const fan = [-0.14, 0, 0.14];
      for (let i = 0; i < fan.length; i++) {
        const a = aimAngle + fan[i];
        const x2 = clampX(p.x + Math.cos(a) * 310, 20);
        const y2 = clampY(p.y + Math.sin(a) * 310, 20);
        pushStringBeam(p, p.x, p.y, x2, y2, 10, false, 0.18);
        ctx.damageEnemiesInLine(p.x, p.y, a, 310, 18, 0.82, 22, false, 0);
      }
    } else if (step === 2) {
      // Golpe 3: ATHLETE + BREAK WHITE — Patada giratoria + púas del Despertar (175px)
      audio.playPunch(1.15);
      audio.playSlash(1.35);
      pushStringArc(p, p.x, p.y, aimAngle, 175, Math.PI * 0.48, -1, true, true, 0.22);
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 175, Math.PI * 0.48, 1.4, 52, false, 0, 0, {
        applyBleed: true
      });
    } else {
      // Golpe 4 (Finisher): OVERHEAT — Látigo incandescente gigante (350px) + explosión en la punta
      audio.playShing();
      audio.playFireCrackle();
      audio.playExplosion(1.1);
      ctx.triggerScreenShake(6, 0.15);
      const len = 350;
      const x2 = clampX(p.x + Math.cos(aimAngle) * len, 20);
      const y2 = clampY(p.y + Math.sin(aimAngle) * len, 20);
      pushStringBeam(p, p.x, p.y, x2, y2, 28, true, 0.28);
      pushStringBurst(p, x2, y2, 95, '#FF5722', 0.28);
      ctx.damageEnemiesInLine(p.x, p.y, aimAngle, len, 32, 1.85, 58, false, 0, {
        applyBurn: true,
        burnDps: 9,
        burnDuration: 2.8
      });
      ctx.damageEnemiesInCircle(x2, y2, 95, 0.9, 45, false, 0, {
        applyBurn: true,
        burnDps: 8,
        burnDuration: 2.5
      });
    }
  },

  // ==========================================================================
  // HABILIDADES H1 / H2 / H3 REHECHAS DESDE CERO
  // ==========================================================================
  onSkill(ctx, idx, aimAngle) {
    const { state, player: p, audio } = ctx;

    if (idx === 0) {
      // H1: PARASITE — Controla hasta 2 enemigos no jefes en 300px (100 Hilos = 4 objetivos x 6s) + cortes Fullbright
      audio.playShing();
      const isFull = (p.custom.hilos || 0) >= 100;
      const maxTargets = isFull ? 4 : 2;
      const duration = isFull ? 6.0 : 3.5;
      const candidates = state.enemies
        .filter((e: any) => e.hp > 0 && !e.isBoss && Math.hypot(e.x - p.x, e.y - p.y) <= 300)
        .sort((a: any, b: any) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
        .slice(0, maxTargets);

      if (candidates.length === 0) {
        ctx.spawnFloatingText(p.x, p.y - 42, 'Sin objetivo para Parasite', '#F8BBD0', 0.9);
        return true;
      }

      for (let i = 0; i < candidates.length; i++) {
        const en = candidates[i];
        en.parasiteTimer = duration;
        en.parasiteAttackCd = 0.15;
        pushStringBurst(p, en.x, en.y, 64, '#FF4081', 0.26);
        addThreads(ctx, 12);
        ctx.spawnFloatingText(en.x, en.y - 44, '🧵 ¡PARASITE!', '#F48FB1', 1.05);
      }
      if (isFull) p.custom.hilos = 0;
    } else if (idx === 1) {
      // H2: GOD THREAD (16 HILOS SAGRADOS) — Barrido Overheat 240px + 8 lanzas del Despertar (330px) + detona marioneta
      audio.playFireCrackle();
      audio.playSlash(1.45);
      audio.playShing();
      ctx.triggerScreenShake(8, 0.2);

      const halfAng = Math.PI * 0.44;
      pushStringArc(p, p.x, p.y, aimAngle, 240, halfAng, 1, true, true, 0.28);
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 240, halfAng, 1.95, 65, false, 0, 0, {
        applyBurn: true,
        burnDps: 10,
        burnDuration: 3.0
      });

      // 8 Lanzas gigantes del Despertar disparadas en abanico
      for (let k = 0; k < 8; k++) {
        const offset = ((k - 3.5) / 3.5) * 0.52;
        const a = aimAngle + offset;
        p.custom.spears.push({
          x: p.x + Math.cos(a) * 20,
          y: p.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 760,
          vy: Math.sin(a) * 760,
          angle: a,
          length: 56,
          dmgMult: 1.1,
          traveled: 0,
          maxRange: 330,
          life: 0.48,
          maxLife: 0.48,
          hitIds: []
        });
      }

      const puppet = state.enemies.find((e: any) => e.hp > 0 && e.parasiteTimer > 0);
      if (puppet) {
        puppet.parasiteTimer = 0;
        const tx = clampX(p.x + Math.cos(aimAngle) * 170, puppet.radius);
        const ty = clampY(p.y + Math.sin(aimAngle) * 170, puppet.radius);
        puppet.x = tx;
        puppet.y = ty;
        audio.playExplosion(1.35);
        pushStringBurst(p, tx, ty, 120, '#EC407A', 0.34);
        ctx.damageEnemiesInCircle(tx, ty, 120, 1.85, 60, true, 0.55, { pierceShield: true });
      }
      ctx.spawnFloatingText(p.x, p.y - 46, '🔥 ¡GOD THREAD!', '#FF7043', 1.25);
    } else if (idx === 2) {
      // H3: TORIKAGO (BIRDCAGE) — -40 Hilos, cúpula cortante de 300px x 6.5s
      if ((p.custom.hilos || 0) < 40) return true;
      p.custom.hilos = Math.max(0, (p.custom.hilos || 0) - 40);
      audio.playRoar();
      audio.playShing();
      ctx.triggerScreenShake(8, 0.24);

      const zone = {
        x: p.x,
        y: p.y,
        radius: 300,
        life: 6.5,
        maxLife: 6.5,
        tick: 0.35
      };
      p.custom.birdcageZone = zone;

      for (let i = 0; i < state.enemies.length; i++) {
        const en = state.enemies[i];
        if (en.hp > 0 && Math.hypot(en.x - zone.x, en.y - zone.y) <= zone.radius) {
          en.birdcageLocked = true;
        }
      }
      ctx.spawnFloatingText(p.x, p.y - 54, '🕸️ ¡TORIKAGO!', '#F48FB1', 1.35);
    }
    ctx.updateHUD();
  },

  // ==========================================================================
  // HOOKS DE COMBATE, BIRDCAGE Y PASIVA CLON DE HILOS
  // ==========================================================================
  onAfterDamageEnemy(ctx) {
    addThreads(ctx, 3);
    ctx.updateHUD();
  },

  onEnemyKilled(ctx, en) {
    const p = ctx.player;
    if (en.birdcageLocked && p.custom.birdcageZone?.life > 0) {
      ctx.audio.playExplosion(1.2);
      pushStringBurst(p, en.x, en.y, 110, '#F48FB1', 0.32);
      ctx.damageEnemiesInCircle(en.x, en.y, 110, 1.75, 45, true, 0);
    }
  },

  onBeforePlayerDamage(ctx, incomingDmg) {
    const { state, player: p, audio } = ctx;

    for (let i = 0; i < state.enemies.length; i++) {
      if (state.enemies[i].parasiteTimer > 0) {
        state.enemies[i].parasiteTimer = 0;
      }
    }

    if (!p.custom.cloneUsed) {
      const approxDmg = Math.max(1, Math.round(incomingDmg * (100 / (100 + p.armor))));
      if (p.hp - approxDmg <= 0) {
        p.custom.cloneUsed = true;
        const oldX = p.x;
        const oldY = p.y;
        audio.playExplosion(1.4);
        audio.playTeleport();
        ctx.triggerScreenShake(7, 0.2);

        pushStringBurst(p, oldX, oldY, 120, '#FFFFFF', 0.34);
        ctx.damageEnemiesInCircle(oldX, oldY, 120, 2.2, 60, true, 1.0);

        const tpAng = p.facingAngle + Math.PI;
        p.x = clampX(oldX + Math.cos(tpAng) * 160, p.radius);
        p.y = clampY(oldY + Math.sin(tpAng) * 160, p.radius);
        p.hp = Math.min(p.maxHp, Math.max(1, Math.round(p.maxHp * 0.35)));
        p.invulnTimer = 1.5;
        ctx.spawnFloatingText(p.x, p.y - 48, '🧵 ¡CLON DE HILOS!', '#F48FB1', 1.3);
        ctx.updatePlayerHUD();
        return { cancelled: true };
      }
    }
    return {};
  },

  onUpdate(ctx, dt) {
    const { state, player: p } = ctx;

    // 1. Lanzas del Despertar (God Thread)
    const spears: StringSpearProj[] = p.custom.spears || [];
    for (let i = spears.length - 1; i >= 0; i--) {
      const sp = spears[i];
      const sx = sp.vx * dt;
      const sy = sp.vy * dt;
      sp.x += sx;
      sp.y += sy;
      sp.traveled += Math.hypot(sx, sy);
      sp.life -= dt;

      for (let j = 0; j < state.enemies.length; j++) {
        const en = state.enemies[j];
        if (en.hp <= 0 || sp.hitIds.includes(en)) continue;
        if (Math.hypot(en.x - sp.x, en.y - sp.y) <= en.radius + 26) {
          sp.hitIds.push(en);
          const { amount, isCrit } = ctx.calculatePlayerDamage(sp.dmgMult, true);
          ctx.damageEnemy(en, amount, {
            isCrit,
            knockback: 36,
            sourceX: sp.x,
            sourceY: sp.y,
            pierceShield: true
          });
        }
      }

      if (sp.life <= 0 || sp.traveled >= sp.maxRange) {
        spears.splice(i, 1);
      }
    }

    // 2. Birdcage (Torikago) cortando enemigos dentro
    const zone = p.custom.birdcageZone;
    if (zone) {
      zone.life -= dt;
      zone.tick -= dt;
      if (zone.tick <= 0) {
        zone.tick = 0.35;
        for (let i = 0; i < state.enemies.length; i++) {
          const en = state.enemies[i];
          if (en.hp <= 0) continue;
          if (Math.hypot(en.x - zone.x, en.y - zone.y) <= zone.radius + en.radius) {
            en.birdcageLocked = true;
            ctx.damageEnemy(en, 6, { damageTextColor: '#F48FB1' });
          }
        }
      }
      if (zone.life <= 0) {
        for (let i = 0; i < state.enemies.length; i++) {
          state.enemies[i].birdcageLocked = false;
        }
        p.custom.birdcageZone = null;
      }
    }

    // 3. Decay VFX
    for (let i = p.custom.stringArcs.length - 1; i >= 0; i--) {
      p.custom.stringArcs[i].life -= dt;
      if (p.custom.stringArcs[i].life <= 0) p.custom.stringArcs.splice(i, 1);
    }
    for (let i = p.custom.stringBeams.length - 1; i >= 0; i--) {
      p.custom.stringBeams[i].life -= dt;
      if (p.custom.stringBeams[i].life <= 0) p.custom.stringBeams.splice(i, 1);
    }
    for (let i = p.custom.stringBursts.length - 1; i >= 0; i--) {
      p.custom.stringBursts[i].life -= dt;
      if (p.custom.stringBursts[i].life <= 0) p.custom.stringBursts.splice(i, 1);
    }

    ctx.updateHUD();
  },

  onCleanupEffects(p) {
    if (p.custom) {
      p.custom.birdcageZone = null;
      p.custom.stringArcs = [];
      p.custom.stringBeams = [];
      p.custom.spears = [];
      p.custom.stringBursts = [];
    }
  },

  // ==========================================================================
  // HUD DINÁMICO (HILOS 0-100)
  // ==========================================================================
  mountHUD(slotEl) {
    slotEl.innerHTML = `
      <div id="doflamingo-thread-hud" class="char-resource-hud" style="display:flex;">
        <span style="font-size:12px;">🧵</span>
        <div class="res-bar-outer" style="border-color:#F48FB1; width:108px;">
          <div id="hud-doflamingo-thread-fill" class="res-bar-fill" style="width:0%; background:linear-gradient(90deg, #C2185B, #F8BBD0);"></div>
        </div>
        <span id="hud-doflamingo-thread-text" class="res-text text-outline-sm" style="color:#F8BBD0;">HILOS 0/100</span>
      </div>
    `;
  },

  updateHUD(p) {
    const fill = document.getElementById('hud-doflamingo-thread-fill');
    const txt = document.getElementById('hud-doflamingo-thread-text');
    const val = Math.round(p.custom.hilos || 0);
    if (fill) fill.style.width = `${Math.min(100, val)}%`;
    if (txt) txt.textContent = val >= 100 ? 'HILOS 100/100 🧵' : `HILOS ${val}/100`;
  },

  // ==========================================================================
  // RENDERIZADO DE TORIKAGO, HILOS Y SPRITE EXISTENTE (32x44 px)
  // ==========================================================================
  drawWorldBeforePlayer({ ctx, player: p, t }) {
    const zone = p.custom.birdcageZone;
    if (!zone) return;
    ctx.save();
    ctx.globalAlpha = Math.min(0.88, zone.life / 0.8);
    ctx.fillStyle = 'rgba(236, 64, 122, 0.12)';
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#F8BBD0';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 64, 129, 0.55)';
    ctx.lineWidth = 1.8;
    for (let s = 0; s < 16; s++) {
      const a = (s / 16) * Math.PI * 2 + t * 0.25;
      ctx.beginPath();
      ctx.moveTo(zone.x, zone.y - 28);
      ctx.lineTo(zone.x + Math.cos(a) * zone.radius, zone.y + Math.sin(a) * zone.radius);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawWorldAfterPlayer({ ctx, state, player: p }) {
    // 1. Hilos de Parasite desde los dedos de Doflamingo a sus marionetas
    for (let i = 0; i < state.enemies.length; i++) {
      const en = state.enemies[i];
      if (en.hp > 0 && en.parasiteTimer > 0) {
        ctx.save();
        ctx.strokeStyle = '#FF4081';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([7, 4]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(en.x, en.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Arcos de 5 hilos (Goshikito y Athlete)
    const arcs: StringArcVFX[] = p.custom.stringArcs || [];
    const strandCols = ['#FF1744', '#FFFFFF', '#FFD54F', '#F06292', '#EC407A'];
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

      if (c.isHeated) {
        ctx.strokeStyle = '#FF5722';
        ctx.lineWidth = 24 * a;
        ctx.beginPath();
        ctx.arc(0, 0, c.range * 0.9, minA, maxA);
        ctx.stroke();
      }

      const count = c.multiStrand ? 5 : 2;
      for (let s = 0; s < count; s++) {
        const r = c.range * (0.76 + s * 0.055);
        ctx.strokeStyle = strandCols[s % strandCols.length];
        ctx.lineWidth = 3.2 * a;
        ctx.beginPath();
        ctx.arc(0, 0, r, minA, maxA);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Haces de Tamaito y Látigo Overheat
    const beams: StringBeamVFX[] = p.custom.stringBeams || [];
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      const a = Math.max(0, b.life / b.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = b.isOverheat ? '#FF3D00' : '#F06292';
      ctx.lineWidth = b.width * a;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      ctx.strokeStyle = b.isOverheat ? '#FFF59D' : '#FFFFFF';
      ctx.lineWidth = Math.max(2.5, b.width * 0.36 * a);
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Lanzas del Despertar (God Thread)
    const spears: StringSpearProj[] = p.custom.spears || [];
    for (let i = 0; i < spears.length; i++) {
      const sp = spears[i];
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(sp.angle);
      ctx.fillStyle = '#F8BBD0';
      ctx.strokeStyle = '#EC407A';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(sp.length * 0.55, 0);
      ctx.lineTo(-sp.length * 0.45, -8);
      ctx.lineTo(-sp.length * 0.3, 0);
      ctx.lineTo(-sp.length * 0.45, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 5. Estallidos de hilos
    const bursts: StringBurstVFX[] = p.custom.stringBursts || [];
    for (let i = 0; i < bursts.length; i++) {
      const bt = bursts[i];
      const a = Math.max(0, bt.life / bt.maxLife);
      const curR = bt.radius * (0.35 + (1 - a) * 0.65);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = bt.color;
      ctx.lineWidth = 6 * a;
      ctx.beginPath();
      ctx.arc(bt.x, bt.y, curR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5 * a;
      ctx.beginPath();
      ctx.arc(bt.x, bt.y, curR * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  },

  drawBody({ ctx }) {
    // Abrigo de plumas rosa #EC407A / #F48FB1 (32x44)
    ctx.fillStyle = '#EC407A';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-16, -21, 30, 42, 12);
    ctx.fill();
    ctx.stroke();

    // Detalle esponjoso de plumas
    ctx.fillStyle = '#F48FB1';
    ctx.beginPath();
    ctx.arc(-8, -14, 7, 0, Math.PI * 2);
    ctx.arc(-8, 14, 7, 0, Math.PI * 2);
    ctx.fill();

    // Camisa blanca y cuerpo
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(-2, -13, 14, 26, 6);
    ctx.fill();
    ctx.stroke();

    // Cabeza rubia
    ctx.fillStyle = '#F3C1A0';
    ctx.beginPath();
    ctx.arc(4, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FDD835';
    ctx.beginPath();
    ctx.arc(-1, 0, 9.5, Math.PI * 0.45, Math.PI * 1.55);
    ctx.fill();

    // Gafas puntiagudas rojas/blancas
    ctx.fillStyle = '#E91E63';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(7, -8);
    ctx.lineTo(14, -3);
    ctx.lineTo(8, -1);
    ctx.closePath();
    ctx.moveTo(7, 8);
    ctx.lineTo(14, 3);
    ctx.lineTo(8, 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },

  drawPreview(pctx) {
    // Abrigo de plumas rosa
    pctx.fillStyle = '#EC407A';
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.roundRect(-14, -4, 28, 22, 10);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#FFFFFF';
    pctx.fillRect(-5, -2, 10, 17);

    // Cabeza y cabello rubio
    pctx.fillStyle = '#F3C1A0';
    pctx.beginPath();
    pctx.arc(0, -10, 9, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#FDD835';
    pctx.beginPath();
    pctx.arc(0, -14, 9.5, Math.PI, Math.PI * 2);
    pctx.fill();

    // Gafas puntiagudas
    pctx.fillStyle = '#E91E63';
    pctx.strokeStyle = '#FFFFFF';
    pctx.lineWidth = 1.5;
    pctx.beginPath();
    pctx.moveTo(-8, -12);
    pctx.lineTo(-1, -10);
    pctx.lineTo(-7, -8);
    pctx.closePath();
    pctx.moveTo(8, -12);
    pctx.lineTo(1, -10);
    pctx.lineTo(7, -8);
    pctx.closePath();
    pctx.fill();
    pctx.stroke();
  }
};
