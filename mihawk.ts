import { CONFIG } from '../config';
import { calculateMihawkHawkCrit } from '../rules';
import type { CharacterContext, CharacterModule } from './types';

// ============================================================================
// DRACULE MIHAWK — Yonko · "Ojos de Halcón" · Kokuto Yoru
// ============================================================================

interface YoruCrescentVFX {
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

interface YoruWaveProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  width: number;
  dmgMult: number;
  traveled: number;
  maxRange: number;
  life: number;
  maxLife: number;
  convergeGroup?: number;
  turnRate?: number;
  hitIds: any[];
  isTwin?: boolean;
  isSlowCarver?: boolean;
  carveTick?: number;
  dpsTick?: number;
  lastScarX?: number;
  lastScarY?: number;
}

interface YoruBeamSlash {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  life: number;
  maxLife: number;
}

interface YoruCanyon {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  life: number;
  maxLife: number;
  tick: number;
  dps?: number;
}

interface KogatanaSlit {
  x: number;
  y: number;
  angle: number;
  length: number;
  life: number;
  maxLife: number;
}

function clampX(x: number, pad = 32): number {
  return Math.max(CONFIG.ARENA_MARGIN_X + pad, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - pad, x));
}

function clampY(y: number, pad = 32): number {
  return Math.max(CONFIG.ARENA_MARGIN_Y + pad, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - pad, y));
}

function addPrecision(ctx: CharacterContext, amount: number): void {
  const p = ctx.player;
  p.custom.precision = Math.min(100, (p.custom.precision || 0) + amount);
}

function applyHawkMark(en: any, duration = 4.5): void {
  if (!en || en.hp <= 0) return;
  en.mihawkMarkTimer = Math.max(en.mihawkMarkTimer || 0, duration);
}

function pushYoruCrescent(
  p: CharacterContext['player'],
  x: number,
  y: number,
  angle: number,
  range: number,
  halfAngle: number,
  swingDir: 1 | -1,
  thickness = 24,
  life = 0.24
): void {
  const arr: YoruCrescentVFX[] = p.custom.crescents;
  if (arr.length >= 16) arr.shift();
  arr.push({ x, y, angle, range, halfAngle, swingDir, thickness, life, maxLife: life });
}

function pushKogatanaSlit(p: CharacterContext['player'], x: number, y: number, angle: number, length = 76): void {
  const arr: KogatanaSlit[] = p.custom.kogatanaSlits;
  if (arr.length >= 16) arr.shift();
  arr.push({ x, y, angle, length, life: 0.26, maxLife: 0.26 });
}

function executeKogatanaBlinkStrike(ctx: CharacterContext, aimAngle: number, wasCounter: boolean): void {
  const { state, player: p, audio } = ctx;
  p.custom.parryTimer = 0;
  const dist = 165;
  const startX = p.x;
  const startY = p.y;
  const endX = clampX(p.x + Math.cos(aimAngle) * dist, 38);
  const endY = clampY(p.y + Math.sin(aimAngle) * dist, 38);

  audio.playShing();
  audio.playSlash(1.45);
  p.invulnTimer = Math.max(p.invulnTimer, 0.25);

  const midX = (startX + endX) * 0.5;
  const midY = (startY + endY) * 0.5;
  for (let i = 0; i < 6; i++) {
    const ox = midX + (Math.random() - 0.5) * 90;
    const oy = midY + (Math.random() - 0.5) * 90;
    pushKogatanaSlit(p, ox, oy, aimAngle + (i - 2.5) * 0.48, 88);
  }
  pushKogatanaSlit(p, midX, midY, aimAngle, 185);

  let hitAny = false;
  state.enemies.forEach((en) => {
    if (en.hp <= 0) return;
    const nearLine = ctx.pointToSegmentDist(en.x, en.y, startX, startY, endX, endY) <= en.radius + 78;
    const nearEnd = Math.hypot(en.x - endX, en.y - endY) - en.radius <= 115;
    if (nearLine || nearEnd) {
      applyHawkMark(en, 5.5);
      const { amount } = ctx.calculatePlayerDamage(wasCounter ? 3.8 : 2.9, true, true);
      ctx.damageEnemy(en, amount, {
        isCrit: true,
        knockback: 45,
        sourceX: startX,
        sourceY: startY,
        pierceShield: true,
        ignoreArmorPct: 0.65,
        damageTextColor: '#FFD54F'
      });
      pushKogatanaSlit(p, en.x, en.y, Math.random() * Math.PI, 68);
      hitAny = true;
    }
  });

  p.x = endX;
  p.y = endY;
  if (hitAny) {
    state.hitstopTimer = 0.065;
    ctx.triggerScreenShake(6, 0.15);
    addPrecision(ctx, wasCounter ? 24 : 14);
  }
}

function unleashWorldsStrongestSlash(ctx: CharacterContext): void {
  const { state, player: p, audio } = ctx;
  const aim = p.custom.h3Angle ?? ctx.getAimAngle();
  p.facingAngle = aim;

  audio.playExplosion(1.45);
  audio.playThunder();
  audio.playShing();
  ctx.triggerScreenShake(12, 0.28);
  ctx.triggerHaptic(30);
  state.hitstopTimer = 0.105;

  const length = 560;
  const halfWidth = 62;
  const x2 = clampX(p.x + Math.cos(aim) * length, 24);
  const y2 = clampY(p.y + Math.sin(aim) * length, 24);

  // Haz colosal de Yoru + cañón esmeralda persistente en el suelo
  if (p.custom.beamSlashes.length >= 6) p.custom.beamSlashes.shift();
  p.custom.beamSlashes.push({ x1: p.x, y1: p.y, x2, y2, width: 92, life: 0.42, maxLife: 0.42 });

  if (p.custom.canyons.length >= 6) p.custom.canyons.shift();
  p.custom.canyons.push({ x1: p.x, y1: p.y, x2, y2, width: 32, life: 3.6, maxLife: 3.6, tick: 0.28 });

  pushYoruCrescent(p, p.x, p.y, aim, 235, Math.PI * 0.55, 1, 34, 0.32);

  for (let i = 0; i < 14; i++) {
    const d = 40 + (i / 14) * 480;
    ctx.spawnParticle(
      p.x + Math.cos(aim) * d,
      p.y + Math.sin(aim) * d,
      i % 2 === 0 ? '#00E676' : '#111116',
      6,
      0.38,
      { shape: 'spark' }
    );
  }

  state.enemies.forEach((en) => {
    if (en.hp <= 0) return;
    if (ctx.pointToSegmentDist(en.x, en.y, p.x, p.y, x2, y2) <= en.radius + halfWidth) {
      applyHawkMark(en, 6.0);
      const isMarkedOrBoss = Boolean(en.isBoss || (en.mihawkMarkTimer || 0) > 0);
      const { amount, isCrit } = ctx.calculatePlayerDamage(isMarkedOrBoss ? 5.6 : 4.8, true, true);
      ctx.damageEnemy(en, amount, {
        isCrit,
        knockback: 155,
        sourceX: p.x,
        sourceY: p.y,
        stun: 1.1,
        pierceShield: true,
        ignoreArmorPct: 1.0,
        damageTextColor: '#00E676'
      });
    }
  });
  addPrecision(ctx, 20);
}

export const mihawkCharacter: CharacterModule = {
  id: 'mihawk',
  name: 'Dracule Mihawk',
  faction: 'pirates',
  rarity: 'yonko',
  portrait: '🦅',
  portraitBg: 'linear-gradient(135deg, #6A1B32 0%, #111116 65%, #004D40 100%)',
  attackIcon: '🗡️',
  themeClass: 'theme-mihawk',
  color: '#00E676',
  vestColor: '#6A1B32',
  hp: 105,
  damage: 20,
  speed: 5.0,
  armor: 11,
  dashCd: 2.0,
  autoAimRange: 380,
  skills: [
    { name: 'Kogatana', icon: '✝️', cd: 6.5 },
    { name: 'Tri-Crescent', icon: '🌙', cd: 8.5 },
    { name: 'Yoru Cut', icon: '⚡', cd: 8.5 }
  ],
  cardMeta: {
    displayName: 'DRACULE MIHAWK',
    zarparName: 'MIHAWK',
    epithet: 'Ojos de Halcón · Espadachín Supremo',
    nameColor: '#69F0AE',
    role: 'Yonko Tirador-Espadachín / Precisión',
    passiveText: 'Pasiva: Ojos de Halcón (marca objetivos: +35% crit y 50% perf. armadura)',
    passiveColor: '#FFD54F',
    stats: { hp: 85, dmg: 100, vel: 74, arm: 82 },
    comboDesc:
      '<b>Combo 4 golpes Yoru:</b> Arco Negro-Esmeralda (165px) → Reverso → Estocada Marcadora (215px) → <b>3 Ondas en Abanico</b> (335px).',
    skillsDesc:
      '<b>H1:</b> Kogatana Counter (parry + destello) • <b>H2:</b> Tri-Crescent (3 cortes gigantes lentos DPS que rompen el suelo, 470px) • <b>H3:</b> World\'s Strongest Slash (560px).'
  },

  // ==========================================================================
  // ESTADO PROPIO Y LIMPIEZA
  // ==========================================================================
  createCustomState: () => ({
    precision: 0,
    parryTimer: 0,
    h3WindupTimer: 0,
    h3Angle: 0,
    crescents: [] as YoruCrescentVFX[],
    waves: [] as YoruWaveProjectile[],
    beamSlashes: [] as YoruBeamSlash[],
    canyons: [] as YoruCanyon[],
    kogatanaSlits: [] as KogatanaSlit[]
  }),

  onCleanupEffects(p) {
    p.custom.parryTimer = 0;
    p.custom.h3WindupTimer = 0;
    p.custom.crescents = [];
    p.custom.waves = [];
    p.custom.beamSlashes = [];
    p.custom.canyons = [];
    p.custom.kogatanaSlits = [];
  },

  canAttack: (p) => (p.custom.h3WindupTimer || 0) <= 0,
  isMovementLocked: (p) => (p.custom.h3WindupTimer || 0) > 0,

  getCameraZoom(p) {
    if ((p.custom.h3WindupTimer || 0) > 0) return 0.90;
    return 1.0;
  },

  // ==========================================================================
  // PASIVA OJOS DE HALCÓN + CONTRAATAQUE KOGATANA
  // ==========================================================================
  onCalculateDamage(p) {
    const res = calculateMihawkHawkCrit(p.custom.precision || 0, false);
    return {
      dmgMult: res.dmgMult,
      extraCritChance: res.extraCritChance,
      critMult: 1.7
    };
  },

  onModifyDamageEnemy(p, en, opts) {
    const marked = (en?.mihawkMarkTimer || 0) > 0;
    const res = calculateMihawkHawkCrit(p.custom.precision || 0, marked);
    return {
      dmgMult: marked ? 1.2 : 1.0,
      ignoreArmorPct: Math.max(opts.ignoreArmorPct || 0, res.ignoreArmorPct),
      damageTextColor: marked ? '#00E676' : opts.damageTextColor
    };
  },

  onBeforePlayerDamage(ctx, _incoming, _isBlunt, attacker) {
    const p = ctx.player;
    if ((p.custom.parryTimer || 0) > 0) {
      ctx.spawnFloatingText(p.x, p.y - 48, '✝️ ¡CONTRAATAQUE KOGATANA!', '#FFD54F', 1.25);
      const ang = attacker ? Math.atan2(attacker.y - p.y, attacker.x - p.x) : ctx.getAimAngle();
      executeKogatanaBlinkStrike(ctx, ang, true);
      return { cancelled: true, dmgMult: 0 };
    }
    return {};
  },

  onAfterDamageEnemy(ctx) {
    addPrecision(ctx, 5);
  },

  onEnemyKilled(ctx) {
    addPrecision(ctx, 14);
  },

  // ==========================================================================
  // COMBO BÁSICO MONUMENTAL CON KOKUTO YORU (4 GOLPES)
  // ==========================================================================
  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const step = p.comboStep % 4;
    p.comboStep = (step + 1) % 4;
    p.comboResetTimer = 1.1;
    p.attackCooldown = step === 3 ? 0.36 : 0.23;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = 0.25;

    if (step === 0) {
      // Golpe 1: Gran arco negro-esmeralda de Yoru
      audio.playSlash(1.1);
      pushYoruCrescent(p, p.x, p.y, aimAngle, 165, Math.PI * 0.44, 1, 24, 0.22);
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 165, Math.PI * 0.44, 1.15, 44);
    } else if (step === 1) {
      // Golpe 2: Arco inverso
      audio.playSlash(1.2);
      pushYoruCrescent(p, p.x, p.y, aimAngle, 175, Math.PI * 0.48, -1, 26, 0.23);
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 175, Math.PI * 0.48, 1.25, 48);
    } else if (step === 2) {
      // Golpe 3: Estocada quirúrgica larga que aplica Marca de Halcón
      p.momentumTimer = 0.10;
      p.momentumDirX = Math.cos(aimAngle);
      p.momentumDirY = Math.sin(aimAngle);
      audio.playShing();
      audio.playSlash(1.35);
      const x2 = clampX(p.x + Math.cos(aimAngle) * 215, 24);
      const y2 = clampY(p.y + Math.sin(aimAngle) * 215, 24);
      if (p.custom.beamSlashes.length >= 6) p.custom.beamSlashes.shift();
      p.custom.beamSlashes.push({ x1: p.x, y1: p.y, x2, y2, width: 26, life: 0.2, maxLife: 0.2 });

      state.enemies.forEach((en) => {
        if (en.hp <= 0) return;
        if (ctx.pointToSegmentDist(en.x, en.y, p.x, p.y, x2, y2) <= en.radius + 30) {
          applyHawkMark(en, 5.0);
          const { amount, isCrit } = ctx.calculatePlayerDamage(1.45, false);
          ctx.damageEnemy(en, amount, {
            isCrit,
            knockback: 38,
            sourceX: p.x,
            sourceY: p.y,
            isNormalAttack: true,
            ignoreArmorPct: 0.4
          });
        }
      });
    } else {
      // Golpe 4 (Finisher): 3 Ondas Crecientes Esmeralda en abanico (335px)
      audio.playSlash(1.45);
      audio.playShing();
      ctx.triggerScreenShake(5, 0.14);
      state.hitstopTimer = 0.05;
      pushYoruCrescent(p, p.x, p.y, aimAngle, 190, Math.PI * 0.56, 1, 28, 0.25);

      const waveArr: YoruWaveProjectile[] = p.custom.waves;
      const fanAngles = [-0.22, 0, 0.22];
      fanAngles.forEach((offset, idx) => {
        if (waveArr.length >= 16) waveArr.shift();
        const a = aimAngle + offset;
        const isCenter = idx === 1;
        waveArr.push({
          x: p.x + Math.cos(a) * 24,
          y: p.y + Math.sin(a) * 24,
          vx: Math.cos(a) * 690,
          vy: Math.sin(a) * 690,
          angle: a,
          width: isCenter ? 76 : 62,
          dmgMult: isCenter ? 1.75 : 1.45,
          traveled: 0,
          maxRange: 335,
          life: 0.56,
          maxLife: 0.56,
          hitIds: []
        });
      });
    }
  },

  // ==========================================================================
  // HABILIDADES H1 / H2 / H3
  // ==========================================================================
  onSkillReactivate(ctx, idx) {
    const p = ctx.player;
    if (idx === 0 && (p.custom.parryTimer || 0) > 0) {
      executeKogatanaBlinkStrike(ctx, ctx.getAimAngle(), false);
      return true;
    }
    return false;
  },

  onSkill(ctx, idx, aimAngle) {
    const { player: p, audio } = ctx;

    if (idx === 0) {
      // H1: KOGATANA COUNTER — Postura de parry (0.28s auto-remate si no golpean, o parry instantáneo)
      p.custom.parryTimer = 0.28;
      p.custom.parryAngle = aimAngle;
      audio.playShing();
      ctx.spawnFloatingText(p.x, p.y - 44, '✝️ KOGATANA', '#FFD54F', 1.05);
      return false;
    }

    if (idx === 1) {
      // H2: TRI-CRESCENT — 3 cortes gigantes en abanico, lentos (DPS continuo), que rompen el suelo y llegan lejos (470px)
      audio.playSlash(1.3);
      audio.playExplosion(1.15);
      audio.playShing();
      ctx.triggerScreenShake(8, 0.22);
      pushYoruCrescent(p, p.x, p.y, aimAngle, 210, Math.PI * 0.62, 1, 34, 0.30);

      const waveArr: YoruWaveProjectile[] = p.custom.waves;
      const spreadAngles = [-0.30, 0, 0.30];
      spreadAngles.forEach((offset) => {
        if (waveArr.length >= 16) waveArr.shift();
        const a = aimAngle + offset;
        const sx = p.x + Math.cos(a) * 28;
        const sy = p.y + Math.sin(a) * 28;
        waveArr.push({
          x: sx,
          y: sy,
          vx: Math.cos(a) * 255,
          vy: Math.sin(a) * 255,
          angle: a,
          width: 112,
          dmgMult: 0.72,
          traveled: 0,
          maxRange: 470,
          life: 1.9,
          maxLife: 1.9,
          hitIds: [],
          isTwin: true,
          isSlowCarver: true,
          carveTick: 0.08,
          dpsTick: 0,
          lastScarX: sx,
          lastScarY: sy
        });
      });
      ctx.spawnFloatingText(p.x, p.y - 46, '🌙 ¡TRI-CRESCENT!', '#69F0AE', 1.25);
      return false;
    }

    if (idx === 2) {
      // H3: WORLD'S STRONGEST SLASH — Breve carga dramática (0.24s) + corte colosal de 560px
      p.custom.h3WindupTimer = 0.24;
      p.custom.h3Angle = aimAngle;
      p.facingAngle = aimAngle;
      p.superArmorTimer = Math.max(p.superArmorTimer, 0.5);
      audio.playLaserCharge();
      ctx.spawnFloatingText(p.x, p.y - 52, '🦅 ¡WORLD\'S STRONGEST SLASH!', '#00E676', 1.3);
      return false;
    }
  },

  // ==========================================================================
  // ACTUALIZACIÓN POR FRAME
  // ==========================================================================
  onUpdate(ctx, dt) {
    const { state, player: p, audio } = ctx;

    // 1. Decay de marcas Ojos de Halcón en enemigos
    for (let i = 0; i < state.enemies.length; i++) {
      const en = state.enemies[i];
      if ((en.mihawkMarkTimer || 0) > 0) {
        en.mihawkMarkTimer = Math.max(0, en.mihawkMarkTimer - dt);
      }
    }

    // 2. Postura Kogatana Counter -> si termina sin ser golpeado, dispara el destello quirúrgico
    if ((p.custom.parryTimer || 0) > 0) {
      p.custom.parryTimer -= dt;
      if (p.custom.parryTimer <= 0) {
        executeKogatanaBlinkStrike(ctx, p.custom.parryAngle ?? ctx.getAimAngle(), false);
      }
    }

    // 3. Carga dramática de H3
    if ((p.custom.h3WindupTimer || 0) > 0) {
      p.custom.h3WindupTimer -= dt;
      if (Math.random() < 0.75) {
        const a = Math.random() * Math.PI * 2;
        ctx.spawnParticle(p.x + Math.cos(a) * 44, p.y + Math.sin(a) * 44, '#00E676', 4.2, 0.2, {
          vx: -Math.cos(a) * 140,
          vy: -Math.sin(a) * 140
        });
      }
      if (p.custom.h3WindupTimer <= 0) {
        p.custom.h3WindupTimer = 0;
        unleashWorldsStrongestSlash(ctx);
      }
    }

    // 4. Proyectiles de onda creciente Yoru
    const waves: YoruWaveProjectile[] = p.custom.waves;
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      if (w.turnRate) {
        const spd = Math.hypot(w.vx, w.vy);
        w.angle += w.turnRate * dt;
        w.vx = Math.cos(w.angle) * spd;
        w.vy = Math.sin(w.angle) * spd;
      }
      const stepX = w.vx * dt;
      const stepY = w.vy * dt;
      w.x += stepX;
      w.y += stepY;
      w.traveled += Math.hypot(stepX, stepY);
      w.life -= dt;

      if (Math.random() < (w.isSlowCarver ? 0.8 : 0.5)) {
        ctx.spawnParticle(
          w.x + (Math.random() - 0.5) * w.width * 0.5,
          w.y + (Math.random() - 0.5) * w.width * 0.5,
          w.isSlowCarver && Math.random() < 0.35 ? '#FFD54F' : '#00E676',
          w.isSlowCarver ? 4.4 : 3.5,
          0.26,
          { shape: 'spark' }
        );
      }

      if (w.isSlowCarver) {
        // Romper el suelo continuamente dejando grietas esmeralda bajo las 3 ondas gigantes
        w.carveTick = (w.carveTick || 0) - dt;
        if (w.carveTick <= 0) {
          w.carveTick = 0.14;
          const sx = w.lastScarX ?? w.x;
          const sy = w.lastScarY ?? w.y;
          if (Math.hypot(w.x - sx, w.y - sy) >= 24) {
            if (p.custom.canyons.length >= 26) p.custom.canyons.shift();
            p.custom.canyons.push({
              x1: sx,
              y1: sy,
              x2: w.x,
              y2: w.y,
              width: 24,
              life: 2.6,
              maxLife: 2.6,
              tick: 0.25,
              dps: 8
            });
            w.lastScarX = w.x;
            w.lastScarY = w.y;
          }
        }

        // Daño DPS continuo mientras el corte gigante atraviesa a los enemigos
        w.dpsTick = (w.dpsTick || 0) - dt;
        if (w.dpsTick <= 0) {
          w.dpsTick = 0.20;
          for (let j = 0; j < state.enemies.length; j++) {
            const en = state.enemies[j];
            if (en.hp <= 0) continue;
            if (Math.hypot(en.x - w.x, en.y - w.y) <= en.radius + w.width * 0.58) {
              applyHawkMark(en, 5.0);
              const { amount, isCrit } = ctx.calculatePlayerDamage(w.dmgMult, true);
              ctx.damageEnemy(en, amount, {
                isCrit,
                knockback: 26,
                sourceX: w.x,
                sourceY: w.y,
                pierceShield: true,
                ignoreArmorPct: 0.5,
                damageTextColor: '#69F0AE'
              });
            }
          }
        }
      } else {
        for (let j = 0; j < state.enemies.length; j++) {
          const en = state.enemies[j];
          if (en.hp <= 0 || w.hitIds.includes(en)) continue;
          if (Math.hypot(en.x - w.x, en.y - w.y) <= en.radius + w.width * 0.55) {
            w.hitIds.push(en);
            applyHawkMark(en, 4.5);
            const { amount, isCrit } = ctx.calculatePlayerDamage(w.dmgMult, Boolean(w.isTwin));
            ctx.damageEnemy(en, amount, {
              isCrit,
              knockback: 56,
              sourceX: w.x,
              sourceY: w.y,
              isNormalAttack: !w.isTwin,
              pierceShield: Boolean(w.isTwin)
            });
          }
        }
      }

      if (w.life <= 0 || w.traveled >= w.maxRange) {
        if (w.isSlowCarver) {
          const sx = w.lastScarX ?? w.x;
          const sy = w.lastScarY ?? w.y;
          if (p.custom.canyons.length >= 26) p.custom.canyons.shift();
          p.custom.canyons.push({
            x1: sx,
            y1: sy,
            x2: w.x,
            y2: w.y,
            width: 26,
            life: 2.6,
            maxLife: 2.6,
            tick: 0.25,
            dps: 8
          });
          audio.playExplosion(0.85);
          ctx.damageEnemiesInCircle(w.x, w.y, 90, 0.95, 65, true, 0.35, { pierceShield: true });
        }
        waves.splice(i, 1);
      }
    }

    // 5. Cañones esmeralda persistentes (H2 y H3)
    const canyons: YoruCanyon[] = p.custom.canyons;
    for (let i = canyons.length - 1; i >= 0; i--) {
      const c = canyons[i];
      c.life -= dt;
      c.tick -= dt;
      if (c.tick <= 0) {
        c.tick = 0.32;
        const dmg = c.dps || 6;
        state.enemies.forEach((en) => {
          if (en.hp > 0 && ctx.pointToSegmentDist(en.x, en.y, c.x1, c.y1, c.x2, c.y2) <= en.radius + c.width) {
            en.slowTimer = Math.max(en.slowTimer || 0, 0.5);
            en.slowMult = Math.min(en.slowMult || 1, 0.6);
            ctx.damageEnemy(en, dmg, { isCrit: false, knockback: 0, damageTextColor: '#69F0AE' });
          }
        });
      }
      if (c.life <= 0) canyons.splice(i, 1);
    }

    // 6. Decay VFX
    for (let i = p.custom.crescents.length - 1; i >= 0; i--) {
      p.custom.crescents[i].life -= dt;
      if (p.custom.crescents[i].life <= 0) p.custom.crescents.splice(i, 1);
    }
    for (let i = p.custom.beamSlashes.length - 1; i >= 0; i--) {
      p.custom.beamSlashes[i].life -= dt;
      if (p.custom.beamSlashes[i].life <= 0) p.custom.beamSlashes.splice(i, 1);
    }
    for (let i = p.custom.kogatanaSlits.length - 1; i >= 0; i--) {
      p.custom.kogatanaSlits[i].life -= dt;
      if (p.custom.kogatanaSlits[i].life <= 0) p.custom.kogatanaSlits.splice(i, 1);
    }
  },

  // ==========================================================================
  // RENDERIZADO PERSONALIZADO (YORU, CAÑÓN, RETÍCULAS DE HALCÓN)
  // ==========================================================================
  drawWorldBeforePlayer({ ctx, player: p }) {
    const canyons: YoruCanyon[] = p.custom.canyons || [];
    for (let i = 0; i < canyons.length; i++) {
      const c = canyons[i];
      const a = Math.max(0, Math.min(1, c.life / c.maxLife));
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#050807';
      ctx.lineWidth = c.width + 10;
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();

      ctx.strokeStyle = '#00E676';
      ctx.lineWidth = c.width * 0.45;
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();
      ctx.restore();
    }
  },

  drawWorldAfterPlayer({ ctx, state, player: p, t }) {
    // 1. Retícula dorada Ojos de Halcón sobre enemigos marcados
    for (let i = 0; i < state.enemies.length; i++) {
      const en = state.enemies[i];
      if (en.hp > 0 && (en.mihawkMarkTimer || 0) > 0) {
        ctx.save();
        ctx.translate(en.x, en.y);
        ctx.rotate(t * 2.2);
        ctx.strokeStyle = '#FFD54F';
        ctx.lineWidth = 2.0;
        const r = en.radius + 7;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        for (let k = 0; k < 4; k++) {
          const ang = (k * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * (r - 4), Math.sin(ang) * (r - 4));
          ctx.lineTo(Math.cos(ang) * (r + 5), Math.sin(ang) * (r + 5));
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 2. Arcos monumentales de Kokuto Yoru
    const cres: YoruCrescentVFX[] = p.custom.crescents || [];
    for (let i = 0; i < cres.length; i++) {
      const c = cres[i];
      const prog = 1 - c.life / c.maxLife;
      const a = Math.max(0, c.life / c.maxLife);
      const head = Math.min(1, prog / 0.34);
      const tail = Math.max(0, (prog - 0.24) / 0.76) * 0.62;
      const sA = c.swingDir * (-c.halfAngle + 2 * c.halfAngle * tail);
      const eA = c.swingDir * (-c.halfAngle + 2 * c.halfAngle * head);
      const minA = Math.min(sA, eA);
      const maxA = Math.max(sA, eA);

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0D0E12';
      ctx.lineWidth = (c.thickness + 8) * Math.max(0.45, a);
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.88, minA, maxA);
      ctx.stroke();

      ctx.strokeStyle = '#00E676';
      ctx.lineWidth = c.thickness * 0.58 * Math.max(0.45, a);
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.93, minA, maxA);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3 * a;
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.96, minA, maxA);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Ondas crecientes voladoras
    const waves: YoruWaveProjectile[] = p.custom.waves || [];
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      const a = Math.max(0.2, Math.min(1, w.life / (w.maxLife * 0.35)));
      const hw = w.width * 0.5;
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.angle);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#0D0E12';
      ctx.strokeStyle = '#00E676';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.quadraticCurveTo(6, -hw * 0.78, -28, -hw);
      ctx.quadraticCurveTo(-6, 0, -28, hw);
      ctx.quadraticCurveTo(6, hw * 0.78, 22, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#B9F6CA';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.quadraticCurveTo(6, -hw * 0.52, -14, -hw * 0.68);
      ctx.quadraticCurveTo(0, 0, -14, hw * 0.68);
      ctx.quadraticCurveTo(6, hw * 0.52, 18, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. Haces rectos de Yoru (H3 y golpe 3)
    const beams: YoruBeamSlash[] = p.custom.beamSlashes || [];
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      const a = Math.max(0, b.life / b.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#090A0E';
      ctx.lineWidth = (b.width + 14) * a;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      ctx.strokeStyle = '#00E676';
      ctx.lineWidth = b.width * 0.68 * a;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(3, b.width * 0.22 * a);
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Cortes dorados Kogatana
    const slits: KogatanaSlit[] = p.custom.kogatanaSlits || [];
    for (let i = 0; i < slits.length; i++) {
      const s = slits[i];
      const a = Math.max(0, s.life / s.maxLife);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#FFD54F';
      ctx.beginPath();
      ctx.moveTo(-s.length * 0.5, 0);
      ctx.quadraticCurveTo(0, -5 * a, s.length * 0.5, 0);
      ctx.quadraticCurveTo(0, 5 * a, -s.length * 0.5, 0);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(-s.length * 0.38, 0);
      ctx.quadraticCurveTo(0, -2 * a, s.length * 0.38, 0);
      ctx.quadraticCurveTo(0, 2 * a, -s.length * 0.38, 0);
      ctx.fill();
      ctx.restore();
    }
  },

  drawAura({ ctx, player: p, t }) {
    if ((p.custom.parryTimer || 0) > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if ((p.custom.precision || 0) >= 60 || (p.custom.h3WindupTimer || 0) > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = '#00E676';
      ctx.lineWidth = 2.4;
      ctx.globalAlpha = 0.6 + Math.sin(t * 10) * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  },

  drawBody({ ctx, player: p, cfg }) {
    const swing = p.attackAnimTimer > 0 ? Math.sin((p.attackAnimTimer / 0.25) * Math.PI) * 0.75 : 0;
    const raisingH3 = (p.custom.h3WindupTimer || 0) > 0;

    // Kokuto Yoru (Gran Espada Negra con cruceta dorada y filo verde-esmeralda)
    ctx.save();
    ctx.rotate(raisingH3 ? -0.9 : -0.35 + swing);
    ctx.strokeStyle = '#0B0B0F';
    ctx.lineWidth = 7.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, 14);
    ctx.lineTo(42, 14);
    ctx.stroke();
    ctx.strokeStyle = (p.custom.precision || 0) >= 60 ? '#00E676' : '#546E7A';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(4, 11.5);
    ctx.lineTo(42, 11.5);
    ctx.stroke();
    // Cruceta dorada
    ctx.strokeStyle = '#FFD54F';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(4, 24);
    ctx.stroke();
    ctx.restore();

    // Abrigo burdeos-negro de Mihawk
    ctx.fillStyle = cfg.vestColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Colgante Kogatana dorado en el pecho
    ctx.strokeStyle = '#FFD54F';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(8, -4);
    ctx.lineTo(8, 4);
    ctx.moveTo(5, -1);
    ctx.lineTo(11, -1);
    ctx.stroke();

    // Sombrero negro con pluma blanca y ojos de halcón dorados
    ctx.fillStyle = '#141418';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 14.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ECEFF1';
    ctx.beginPath();
    ctx.ellipse(-7, -8, 6.5, 2.5, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Ojos de Halcón amarillos
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(7, -3.5, 2.1, 0, Math.PI * 2);
    ctx.arc(7, 3.5, 2.1, 0, Math.PI * 2);
    ctx.fill();
  },

  drawPreview(pctx, t, cfg) {
    const gleam = 0.65 + Math.sin(t * 2.5) * 0.25;
    // Kokuto Yoru en diagonal atrás
    pctx.save();
    pctx.strokeStyle = '#0A0A0E';
    pctx.lineWidth = 5;
    pctx.lineCap = 'round';
    pctx.beginPath();
    pctx.moveTo(-18, 18);
    pctx.lineTo(22, -22);
    pctx.stroke();
    pctx.strokeStyle = `rgba(0, 230, 118, ${gleam})`;
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.moveTo(-4, 4);
    pctx.lineTo(22, -22);
    pctx.stroke();
    pctx.strokeStyle = '#FFD54F';
    pctx.lineWidth = 3;
    pctx.beginPath();
    pctx.moveTo(-14, 6);
    pctx.lineTo(-4, 16);
    pctx.stroke();
    pctx.restore();

    // Abrigo burdeos
    pctx.fillStyle = cfg.vestColor;
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.arc(0, 3, 12.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    // Sombrero de ala ancha + pluma
    pctx.fillStyle = '#141418';
    pctx.beginPath();
    pctx.ellipse(0, -6, 15, 7, 0, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
    pctx.fillStyle = '#ECEFF1';
    pctx.beginPath();
    pctx.ellipse(-9, -11, 5.5, 2.2, -0.3, 0, Math.PI * 2);
    pctx.fill();

    // Ojos dorados
    pctx.fillStyle = '#FFD54F';
    pctx.beginPath();
    pctx.arc(-3.5, -2, 1.8, 0, Math.PI * 2);
    pctx.arc(3.5, -2, 1.8, 0, Math.PI * 2);
    pctx.fill();
  },

  // ==========================================================================
  // HUD ESPECÍFICO
  // ==========================================================================
  mountHUD(slotEl) {
    slotEl.innerHTML = `
      <div class="char-resource-hud" id="mihawk-edge-hud" style="display:flex;">
        <div class="res-bar-outer" style="border-color:#00E676;">
          <div id="hud-mihawk-fill" class="res-bar-fill" style="background:linear-gradient(90deg,#6A1B32,#00E676);"></div>
        </div>
        <span id="hud-mihawk-text" class="res-text text-outline-sm" style="color:#B9F6CA;">🦅 FILO 0/100</span>
      </div>
    `;
  },

  updateHUD(p) {
    const hud = document.getElementById('mihawk-edge-hud');
    const fill = document.getElementById('hud-mihawk-fill');
    const txt = document.getElementById('hud-mihawk-text');
    const val = Math.round(p.custom.precision || 0);
    if (hud) hud.classList.toggle('mihawk-sharp', val >= 60);
    if (fill) fill.style.width = `${val}%`;
    if (txt) txt.textContent = `🦅 FILO ${val}/100`;
  }
};
