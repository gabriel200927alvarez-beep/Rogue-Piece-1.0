import { CONFIG } from '../config';
import type { CharacterContext, CharacterModule } from './types';

// ============================================================================
// CHARLOTTE LINLIN (BIG MOM) — Yonko · Soru Soru no Mi (Rework Completo con Escalado Gigante por Almas)
// ============================================================================

interface AlliedHomie {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  attackCd: number;
  kind: 'soul' | 'extra';
}

interface MomArcVFX {
  x: number;
  y: number;
  angle: number;
  range: number;
  halfAngle: number;
  swingDir: 1 | -1;
  color: string;
  subColor: string;
  life: number;
  maxLife: number;
}

interface MomBeamVFX {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angle: number;
  length: number;
  width: number;
  isMaser: boolean;
  life: number;
  maxLife: number;
}

interface MomBoltVFX {
  pts: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  life: number;
  maxLife: number;
}

interface SoulOrbVFX {
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

interface MomShockwaveVFX {
  x: number;
  y: number;
  radius: number;
  color: string;
  subColor: string;
  life: number;
  maxLife: number;
}

function clampX(x: number, pad = 28): number {
  return Math.max(CONFIG.ARENA_MARGIN_X + pad, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - pad, x));
}

function clampY(y: number, pad = 28): number {
  return Math.max(CONFIG.ARENA_MARGIN_Y + pad, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - pad, y));
}

function addSouls(ctx: CharacterContext, amount: number): void {
  const p = ctx.player;
  const prev = p.custom.almas || 0;
  p.custom.almas = Math.min(100, prev + amount);
  if (prev < 100 && p.custom.almas >= 100) {
    ctx.audio.playRoar();
    ctx.spawnFloatingText(p.x, p.y - 48, '👻 ¡ALMAS AL MÁXIMO (GIGANTE SUPREMA)!', '#FFD54F', 1.3);
  }
}

function getSoulMult(p: any) {
  const almas = p.custom.almas || 0;
  const s = 1.0 + (almas / 100) * 0.65; // Crece de 1.0x hasta 1.65x
  return {
    rangeMult: 1.0 + (almas / 100) * 0.6,
    widthMult: 1.0 + (almas / 100) * 0.5,
    dmgMult: 1.0 + (almas / 100) * 0.4,
    scale: s
  };
}

function pushMomArc(
  p: CharacterContext['player'],
  x: number,
  y: number,
  angle: number,
  range: number,
  halfAngle: number,
  swingDir: 1 | -1,
  color: string,
  subColor: string,
  life = 0.24
): void {
  const arr: MomArcVFX[] = p.custom.momArcs;
  if (arr.length >= 12) arr.shift();
  arr.push({ x, y, angle, range, halfAngle, swingDir, color, subColor, life, maxLife: life });
}

function pushMomBolt(
  p: CharacterContext['player'],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = '#FFEB3B',
  width = 4.0,
  life = 0.25
): void {
  const arr: MomBoltVFX[] = p.custom.momBolts;
  if (arr.length >= 16) arr.shift();
  const pts: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const jit = (Math.random() - 0.5) * Math.min(34, len * 0.22);
    pts.push({ x: x1 + dx * t + nx * jit, y: y1 + dy * t + ny * jit });
  }
  pts.push({ x: x2, y: y2 });
  arr.push({ pts, color, width, life, maxLife: life });
}

function pushShockwave(
  p: CharacterContext['player'],
  x: number,
  y: number,
  radius: number,
  color: string,
  subColor: string,
  life = 0.36
): void {
  const arr: MomShockwaveVFX[] = p.custom.shockwaves;
  if (arr.length >= 12) arr.shift();
  arr.push({ x, y, radius, color, subColor, life, maxLife: life });
}

export const bigmomCharacter: CharacterModule = {
  id: 'bigmom',
  name: 'Big Mom',
  faction: 'pirates',
  rarity: 'yonko',
  portrait: '👑',
  portraitBg: 'linear-gradient(135deg, #AD1457 0%, #FFD54F 100%)',
  attackIcon: '👑',
  themeClass: 'theme-bigmom',
  color: '#EC407A',
  vestColor: '#FFD54F',
  hp: 150,
  damage: 16,
  speed: 5.0,
  armor: 13,
  dashCd: 2.2,
  autoAimRange: 350,
  skills: [
    { name: 'Soul Pocus', icon: '👻', cd: 8.0 },
    { name: 'Prominence', icon: '🌞', cd: 7.0 },
    { name: 'Tenjin Bolt', icon: '⚡', cd: 8.5 }
  ],
  cardMeta: {
    displayName: 'BIG MOM',
    zarparName: 'BIG MOM',
    epithet: 'Reina de Totto Land (Gigante por Almas)',
    nameColor: '#F48FB1',
    role: 'Yonko Invocadora / Cataclismo Homie Escalable',
    passiveText: 'Pasiva: Soru Soru no Mi (Revive 1× con robo de HP) + Crecimiento Gigante (hasta +65% tamaño y daño por Almas)',
    passiveColor: '#FFD54F',
    stats: { hp: 100, dmg: 96, vel: 76, arm: 94 },
    comboDesc:
      '<b>Combo 5 golpes escalable por Almas:</b> Cognac → Llama Solar → Rayo Indra → <b>Ikoku Sovereignty</b> → <b>Maser Cannon / Saber (con Hit-Stop y destello)</b>.',
    skillsDesc:
      '<b>H1:</b> Soul Pocus (250px+, roba almas, cura, despierta 🎩 ≥50) • <b>H2:</b> Heavenly Fire (🌞) • <b>H3:</b> Tenjin (-30 Almas, ⚡ 6 pilares divinos).'
  },

  createCustomState: () => ({
    almas: 0,
    soulScale: 1.0,
    prometheusTimer: 0,
    prometheusCd: 0,
    zeusTimer: 0,
    zeusCd: 0,
    napoleonTimer: 0,
    alliedHomies: [] as AlliedHomie[],
    momArcs: [] as MomArcVFX[],
    momBeams: [] as MomBeamVFX[],
    momBolts: [] as MomBoltVFX[],
    soulOrbs: [] as SoulOrbVFX[],
    shockwaves: [] as MomShockwaveVFX[],
    soruReviveUsed: false
  }),

  canUseSkill(ctx, idx) {
    if (idx === 2) {
      return (ctx.player.custom.almas || 0) >= 30;
    }
    return true;
  },

  getMoveSpeedMult: (p) => ((p.custom.zeusTimer || 0) > 0 ? 1.15 : 1.0),

  onCalculateDamage(p, isSkill) {
    const sm = getSoulMult(p);
    if (!isSkill && (p.custom.napoleonTimer || 0) > 0) {
      return { dmgMult: 1.2 * sm.dmgMult };
    }
    return { dmgMult: sm.dmgMult };
  },

  // ==========================================================================
  // COMBO BÁSICO ESCALADO POR ALMAS (5 GOLPES HOMIES + FINISHER HITSTOP)
  // ==========================================================================
  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const step = p.comboStep % 5;
    p.comboStep = (step + 1) % 5;
    p.attackCooldown = step === 4 ? 0.34 : 0.21;
    p.comboResetTimer = 0.85;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = 0.24;

    const sm = getSoulMult(p);
    const napoleonActive = (p.custom.napoleonTimer || 0) > 0;
    const reachBonus = napoleonActive ? 28 : 0;

    if (step === 0) {
      // Golpe 1: Napoleon Cognac Cleave
      audio.playSlash(1.1);
      audio.playPunch(0.9);
      const range = (155 + reachBonus) * sm.rangeMult;
      pushMomArc(p, p.x, p.y, aimAngle, range, Math.PI * 0.44, 1, '#EC407A', '#FFD54F', 0.22);
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, range, Math.PI * 0.44, 1.2 * sm.dmgMult, 42);
    } else if (step === 1) {
      // Golpe 2: Prometheus Heavenly Blaze
      audio.playFireCrackle();
      audio.playSlash(1.2);
      const range = (175 + reachBonus) * sm.rangeMult;
      pushMomArc(p, p.x, p.y, aimAngle, range, Math.PI * 0.48, -1, '#FF6D00', '#FFF59D', 0.24);
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, range, Math.PI * 0.48, 1.35 * sm.dmgMult, 38, false, 0, 0, {
        applyBurn: true,
        burnDps: 9 * sm.dmgMult,
        burnDuration: 2.8
      });
    } else if (step === 2) {
      // Golpe 3: Zeus Indra Arc
      audio.playThunder();
      const range = 235 * sm.rangeMult;
      const targets = state.enemies
        .filter((e: any) => {
          if (e.hp <= 0) return false;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          return Math.hypot(dx, dy) <= range && Math.abs(ctx.normalizeAngle(Math.atan2(dy, dx) - aimAngle)) <= Math.PI * 0.45;
        })
        .slice(0, 5);

      if (targets.length === 0) {
        pushMomBolt(p, p.x, p.y, p.x + Math.cos(aimAngle) * range, p.y + Math.sin(aimAngle) * range, '#FFEB3B', 4.2 * sm.widthMult, 0.24);
      }
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        pushMomBolt(p, p.x, p.y, t.x, t.y, '#FFEB3B', 4.5 * sm.widthMult, 0.26);
        pushShockwave(p, t.x, t.y, 58 * sm.rangeMult, '#FFEB3B', '#FFFFFF', 0.22);
        const { amount, isCrit } = ctx.calculatePlayerDamage(1.45 * sm.dmgMult, false);
        ctx.damageEnemy(t, amount, { isCrit, isNormalAttack: true, knockback: 26, zeusShockChunks: 2 });
      }
    } else if (step === 3) {
      // Golpe 4: IKOKU SOVEREIGNTY
      audio.playRoar();
      audio.playExplosion(1.3);
      ctx.triggerScreenShake(8, 0.2);
      state.hitstopTimer = 0.05;
      const len = (390 + reachBonus) * sm.rangeMult;
      const x2 = clampX(p.x + Math.cos(aimAngle) * len, 20);
      const y2 = clampY(p.y + Math.sin(aimAngle) * len, 20);
      p.custom.momBeams.push({
        x1: p.x,
        y1: p.y,
        x2,
        y2,
        angle: aimAngle,
        length: Math.hypot(x2 - p.x, y2 - p.y),
        width: 78 * sm.widthMult,
        isMaser: false,
        life: 0.34,
        maxLife: 0.34
      });
      ctx.damageEnemiesInLine(p.x, p.y, aimAngle, len, 46 * sm.widthMult, 1.85 * sm.dmgMult, 110, false, 0.25);
    } else {
      // Golpe 5 (Finisher): MASER CANNON / SABER SLAM — Activa destello de impacto y Hit-Stop
      ctx.triggerComboFinisherImpact?.(p.x + Math.cos(aimAngle) * 90, p.y + Math.sin(aimAngle) * 90, aimAngle, '#FFD54F');
      const allThree =
        (p.custom.prometheusTimer || 0) > 0 &&
        (p.custom.zeusTimer || 0) > 0 &&
        (p.custom.napoleonTimer || 0) > 0;

      if (allThree) {
        audio.playExplosion(1.55);
        audio.playThunder();
        audio.playRoar();
        ctx.triggerScreenShake(11, 0.28);
        ctx.triggerHaptic(26);
        const len = 420 * sm.rangeMult;
        const x2 = clampX(p.x + Math.cos(aimAngle) * len, 20);
        const y2 = clampY(p.y + Math.sin(aimAngle) * len, 20);
        p.custom.momBeams.push({
          x1: p.x,
          y1: p.y,
          x2,
          y2,
          angle: aimAngle,
          length: Math.hypot(x2 - p.x, y2 - p.y),
          width: 108 * sm.widthMult,
          isMaser: true,
          life: 0.44,
          maxLife: 0.44
        });
        for (let b = 0; b < 4; b++) {
          const d = (60 + b * 95) * sm.rangeMult;
          const bx = p.x + Math.cos(aimAngle) * d;
          const by = p.y + Math.sin(aimAngle) * d;
          pushMomBolt(p, bx, by, bx + (Math.random() - 0.5) * 90, by + (Math.random() - 0.5) * 90, '#FFEB3B', 3.6, 0.28);
        }
        ctx.damageEnemiesInLine(p.x, p.y, aimAngle, len, 60 * sm.widthMult, 3.3 * sm.dmgMult, 120, false, 1.0, {
          applyBurn: true,
          burnDps: 14 * sm.dmgMult,
          burnDuration: 3.0,
          pierceShield: true
        });
        ctx.spawnFloatingText(p.x, p.y - 54, '⚡🌞🎩 ¡MASER CANNON SUPREMO!', '#FFD54F', 1.35);
      } else {
        audio.playExplosion(1.3);
        audio.playThunder();
        const cx = clampX(p.x + Math.cos(aimAngle) * 90);
        const cy = clampY(p.y + Math.sin(aimAngle) * 90);
        const shockR = (160 + reachBonus) * sm.rangeMult;
        pushShockwave(p, cx, cy, shockR, '#EC407A', '#FFD54F', 0.34);
        pushMomBolt(p, cx, cy - 160, cx, cy, '#FFEB3B', 5.0 * sm.widthMult, 0.26);
        ctx.damageEnemiesInCircle(cx, cy, shockR, 2.25 * sm.dmgMult, 80 * sm.widthMult, false, 0.65, {
          applyBurn: true,
          burnDps: 10 * sm.dmgMult,
          burnDuration: 2.5
        });
      }
    }
  },

  // ==========================================================================
  // HABILIDADES H1 / H2 / H3 ESCALADAS
  // ==========================================================================
  onSkill(ctx, idx) {
    const { state, player: p, audio } = ctx;
    const sm = getSoulMult(p);

    if (idx === 0) {
      // H1: SOUL POCUS
      audio.playRoar();
      audio.playShing();
      ctx.triggerScreenShake(7, 0.2);
      const radius = 250 * sm.rangeMult;
      pushShockwave(p, p.x, p.y, radius, '#CE93D8', '#FFD54F', 0.42);

      let totalDealt = 0;
      let hits = 0;
      for (let i = 0; i < state.enemies.length; i++) {
        const en = state.enemies[i];
        if (en.hp <= 0) continue;
        if (Math.hypot(en.x - p.x, en.y - p.y) <= radius + en.radius) {
          const prevHp = en.hp;
          const isLowHp = en.hp / en.maxHp < 0.5;
          en.soulPocusMarked = true;
          const { amount, isCrit } = ctx.calculatePlayerDamage(1.8 * sm.dmgMult, true);
          ctx.damageEnemy(en, amount, {
            isCrit,
            knockback: 38,
            fearTimer: isLowHp ? 2.5 : 0.8,
            pierceShield: true
          });
          if (p.custom.soulOrbs.length < 18) {
            p.custom.soulOrbs.push({ x: en.x, y: en.y, life: 0.45, maxLife: 0.45 });
          }
          const dealt = Math.max(0, prevHp - Math.max(0, en.hp));
          totalDealt += dealt;
          hits++;
        }
      }

      if (totalDealt > 0) {
        const heal = Math.max(2, Math.round(totalDealt * 0.25));
        p.hp = Math.min(p.maxHp, p.hp + heal);
        ctx.spawnFloatingText(p.x, p.y - 40, `+${heal} 👻`, '#4CAF50', 1.05);
        ctx.updatePlayerHUD();
      }
      if (hits > 0) addSouls(ctx, hits * 4);

      if ((p.custom.almas || 0) >= 50) {
        p.custom.napoleonTimer = 10.0;
        ctx.spawnFloatingText(p.x, p.y - 56, '🎩 ¡NAPOLEÓN DESPERTADO!', '#FFD54F', 1.2);
      }
      if ((p.custom.almas || 0) >= 100) {
        const allies: AlliedHomie[] = p.custom.alliedHomies;
        if (allies.length < 5) {
          allies.push({
            x: p.x + 36,
            y: p.y - 20,
            life: 10.0,
            maxLife: 10.0,
            attackCd: 0.4,
            kind: 'extra'
          });
        }
      }
    } else if (idx === 1) {
      // H2: HEAVENLY FIRE: PROMINENCE
      audio.playFireCrackle();
      audio.playExplosion(1.3);
      ctx.triggerScreenShake(8, 0.22);
      p.custom.prometheusTimer = 12.0;
      p.custom.prometheusCd = 0.55;
      const radius = 230 * sm.rangeMult;
      pushShockwave(p, p.x, p.y, radius, '#FF6D00', '#FFF59D', 0.42);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        ctx.spawnParticle(p.x + Math.cos(a) * 90 * sm.rangeMult, p.y + Math.sin(a) * 90 * sm.rangeMult, k % 2 === 0 ? '#FF9800' : '#FFEA00', 6, 0.42, {
          shape: 'spark'
        });
      }
      let hits = 0;
      for (let i = 0; i < state.enemies.length; i++) {
        const en = state.enemies[i];
        if (en.hp <= 0) continue;
        if (Math.hypot(en.x - p.x, en.y - p.y) <= radius + en.radius) {
          const { amount, isCrit } = ctx.calculatePlayerDamage(2.15 * sm.dmgMult, true);
          ctx.damageEnemy(en, amount, {
            isCrit,
            knockback: 54,
            applyBurn: true,
            burnDps: 12 * sm.dmgMult,
            burnDuration: 3.5,
            pierceShield: true
          });
          hits++;
        }
      }
      if (hits > 0) addSouls(ctx, hits * 5);
      ctx.spawnFloatingText(p.x, p.y - 48, '🌞 ¡PROMINENCE SOLAR!', '#FFAB40', 1.25);
    } else if (idx === 2) {
      // H3: TENJIN (ZEUS TEMPEST)
      if ((p.custom.almas || 0) < 30) return true;
      p.custom.almas = Math.max(0, (p.custom.almas || 0) - 30);
      p.custom.zeusTimer = 12.0;
      p.custom.zeusCd = 0.5;
      audio.playExplosion(1.4);
      audio.playThunder();
      ctx.triggerScreenShake(10, 0.25);

      const radius = 360 * sm.rangeMult;
      const targets = state.enemies
        .filter((e: any) => e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) <= radius)
        .slice(0, 6);

      if (targets.length === 0) {
        for (let k = 0; k < 4; k++) {
          const ang = (k / 4) * Math.PI * 2 + 0.4;
          const tx = p.x + Math.cos(ang) * 140 * sm.rangeMult;
          const ty = p.y + Math.sin(ang) * 140 * sm.rangeMult;
          pushMomBolt(p, tx, ty - 220, tx, ty, '#FFEB3B', 5.5 * sm.widthMult, 0.34);
          pushShockwave(p, tx, ty, 88 * sm.rangeMult, '#FFEB3B', '#FFFFFF', 0.28);
        }
      } else {
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i];
          pushMomBolt(p, t.x + (Math.random() - 0.5) * 30, t.y - 240, t.x, t.y, '#FFEB3B', 5.8 * sm.widthMult, 0.34);
          pushShockwave(p, t.x, t.y, 92 * sm.rangeMult, '#FFEB3B', '#FFFFFF', 0.30);
          const { amount, isCrit } = ctx.calculatePlayerDamage(2.35 * sm.dmgMult, true);
          ctx.damageEnemy(t, amount, {
            isCrit,
            stun: 1.0,
            zeusShockChunks: 4,
            pierceShield: true
          });
        }
      }
      ctx.spawnFloatingText(p.x, p.y - 48, '⚡ ¡TENJIN FULGORA!', '#FFEB3B', 1.3);
    }
    ctx.updateHUD();
  },

  onEnemyKilled(ctx, en) {
    const p = ctx.player;
    addSouls(ctx, 12);
    if (en.soulPocusMarked) {
      const allies: AlliedHomie[] = p.custom.alliedHomies;
      if (allies.length < 5) {
        allies.push({
          x: en.x,
          y: en.y,
          life: 10.0,
          maxLife: 10.0,
          attackCd: 0.4,
          kind: 'soul'
        });
        ctx.spawnFloatingText(en.x, en.y - 36, '👻 ¡HOMIE ALIADO!', '#CE93D8', 0.95);
      }
    }
    ctx.updateHUD();
  },

  onBeforePlayerDamage(ctx, incomingDmg, _isBlunt, attacker) {
    const p = ctx.player;
    if (p.custom.soruReviveUsed) return {};

    const approxDmg = Math.max(1, Math.round(incomingDmg * (100 / (100 + p.armor))));
    if (p.hp - approxDmg <= 0) {
      p.custom.soruReviveUsed = true;
      const stealAmount = attacker?.maxHp
        ? Math.round(attacker.maxHp * 0.3)
        : Math.round(p.maxHp * 0.3);
      const healAmount = Math.max(Math.round(p.maxHp * 0.25), Math.min(Math.round(p.maxHp * 0.45), stealAmount));
      p.hp = Math.min(p.maxHp, Math.max(1, healAmount));
      p.invulnTimer = 1.5;

      if (attacker && attacker.hp > 0 && !attacker.isBoss) {
        attacker.hp = Math.max(1, attacker.hp - Math.round(attacker.maxHp * 0.3));
      }

      ctx.audio.playRoar();
      ctx.triggerScreenShake(9, 0.25);
      pushShockwave(p, p.x, p.y, 180, '#FFD54F', '#EC407A', 0.4);
      ctx.damageEnemiesInCircle(p.x, p.y, 180, 1.6, 65, true, 0.7);
      ctx.spawnFloatingText(p.x, p.y - 54, '👑 ¡SORU SORU NO MI!', '#FFD54F', 1.35);
      ctx.updatePlayerHUD();
      return { cancelled: true };
    }
    return {};
  },

  onUpdate(ctx, dt) {
    const { player: p } = ctx;

    // Actualizar escalado por Almas (Crece de 1.0x a 1.65x)
    const almas = p.custom.almas || 0;
    const soulScale = 1.0 + (almas / 100) * 0.65;
    p.custom.soulScale = soulScale;
    p.radius = Math.round(24 * soulScale * 10) / 10;

    // 1. Prometheus (12s)
    if (p.custom.prometheusTimer > 0) {
      p.custom.prometheusTimer = Math.max(0, p.custom.prometheusTimer - dt);
      p.custom.prometheusCd -= dt;
      if (p.custom.prometheusCd <= 0) {
        p.custom.prometheusCd = 1.25;
        const target = ctx.findNearestEnemy(320);
        if (target) {
          ctx.audio.playFireCrackle();
          pushShockwave(p, target.x, target.y, 68, '#FF9800', '#FFF59D', 0.24);
          const { amount, isCrit } = ctx.calculatePlayerDamage(0.7, true);
          ctx.damageEnemy(target, amount, { isCrit, applyBurn: true, burnDps: 8, burnDuration: 2.5 });
        }
      }
    }

    // 2. Zeus (12s)
    if (p.custom.zeusTimer > 0) {
      p.custom.zeusTimer = Math.max(0, p.custom.zeusTimer - dt);
      p.custom.zeusCd -= dt;
      if (p.custom.zeusCd <= 0) {
        p.custom.zeusCd = 1.05;
        const target = ctx.findNearestEnemy(300);
        if (target) {
          pushMomBolt(p, p.x, p.y - 20, target.x, target.y, '#FFEB3B', 3.6, 0.22);
          pushShockwave(p, target.x, target.y, 56, '#FFEB3B', '#FFFFFF', 0.22);
          const { amount, isCrit } = ctx.calculatePlayerDamage(0.65, true);
          ctx.damageEnemy(target, amount, { isCrit, zeusShockChunks: 2 });
        }
      }
    }

    if (p.custom.napoleonTimer > 0) {
      p.custom.napoleonTimer = Math.max(0, p.custom.napoleonTimer - dt);
    }

    // 3. Homies aliados
    const allies: AlliedHomie[] = p.custom.alliedHomies || [];
    for (let i = allies.length - 1; i >= 0; i--) {
      const h = allies[i];
      h.life -= dt;
      h.attackCd -= dt;
      const target = ctx.findNearestEnemy(380);
      if (target) {
        const ang = Math.atan2(target.y - h.y, target.x - h.x);
        const d = Math.hypot(target.x - h.x, target.y - h.y);
        if (d > target.radius + 20) {
          h.x += Math.cos(ang) * 195 * dt;
          h.y += Math.sin(ang) * 195 * dt;
        } else if (h.attackCd <= 0) {
          h.attackCd = 0.9;
          const { amount, isCrit } = ctx.calculatePlayerDamage(0.65, true);
          ctx.damageEnemy(target, amount, { isCrit, knockback: 16 });
        }
      }
      if (h.life <= 0) allies.splice(i, 1);
    }

    // 4. Orbes de alma
    const orbs: SoulOrbVFX[] = p.custom.soulOrbs || [];
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.life -= dt;
      o.x += (p.x - o.x) * Math.min(1, dt * 8);
      o.y += (p.y - o.y) * Math.min(1, dt * 8);
      if (o.life <= 0) orbs.splice(i, 1);
    }

    // 5. Decay VFX
    for (let i = p.custom.momArcs.length - 1; i >= 0; i--) {
      p.custom.momArcs[i].life -= dt;
      if (p.custom.momArcs[i].life <= 0) p.custom.momArcs.splice(i, 1);
    }
    for (let i = p.custom.momBeams.length - 1; i >= 0; i--) {
      p.custom.momBeams[i].life -= dt;
      if (p.custom.momBeams[i].life <= 0) p.custom.momBeams.splice(i, 1);
    }
    for (let i = p.custom.momBolts.length - 1; i >= 0; i--) {
      p.custom.momBolts[i].life -= dt;
      if (p.custom.momBolts[i].life <= 0) p.custom.momBolts.splice(i, 1);
    }
    for (let i = p.custom.shockwaves.length - 1; i >= 0; i--) {
      p.custom.shockwaves[i].life -= dt;
      if (p.custom.shockwaves[i].life <= 0) p.custom.shockwaves.splice(i, 1);
    }

    ctx.updateHUD();
  },

  onCleanupEffects(p) {
    if (p.custom) {
      p.custom.alliedHomies = [];
      p.custom.momArcs = [];
      p.custom.momBeams = [];
      p.custom.momBolts = [];
      p.custom.soulOrbs = [];
      p.custom.shockwaves = [];
    }
  },

  mountHUD(slotEl) {
    slotEl.innerHTML = `
      <div id="bigmom-soul-hud" class="char-resource-hud" style="display:flex;">
        <span style="font-size:12px;">👻</span>
        <div class="res-bar-outer" style="border-color:#EC407A; width:96px;">
          <div id="hud-bigmom-soul-fill" class="res-bar-fill" style="width:0%; background:linear-gradient(90deg, #AD1457, #FFD54F);"></div>
        </div>
        <span id="hud-bigmom-soul-text" class="res-text text-outline-sm" style="color:#F8BBD0;">ALMAS 0/100</span>
        <span id="hud-bigmom-homies" style="font-size:12px; margin-left:4px;"></span>
      </div>
    `;
  },

  updateHUD(p) {
    const fill = document.getElementById('hud-bigmom-soul-fill');
    const txt = document.getElementById('hud-bigmom-soul-text');
    const homiesEl = document.getElementById('hud-bigmom-homies');
    const val = Math.round(p.custom.almas || 0);
    const giantPct = Math.round(val * 0.65);
    if (fill) fill.style.width = `${Math.min(100, val)}%`;
    if (txt) txt.textContent = `👻 ALMAS: ${val}/100 · GIGANTE: +${giantPct}%`;
    if (homiesEl) {
      const icons: string[] = [];
      if ((p.custom.prometheusTimer || 0) > 0) icons.push('🌞');
      if ((p.custom.zeusTimer || 0) > 0) icons.push('⚡');
      if ((p.custom.napoleonTimer || 0) > 0) icons.push('🎩');
      homiesEl.textContent = icons.join('');
    }
  },

  drawWorldAfterPlayer({ ctx, player: p, t }) {
    const scale = p.custom.soulScale || 1.0;

    // 1. Arcos de Napoleón / Prometheus
    const arcs: MomArcVFX[] = p.custom.momArcs || [];
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
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 28 * Math.max(0.45, a);
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.88, minA, maxA);
      ctx.stroke();

      ctx.strokeStyle = c.subColor;
      ctx.lineWidth = 10 * a;
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.94, minA, maxA);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Ikoku Sovereignty & Maser Cannon
    const beams: MomBeamVFX[] = p.custom.momBeams || [];
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      const a = Math.max(0, b.life / b.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = b.isMaser ? '#AD1457' : '#EC407A';
      ctx.lineWidth = b.width * a;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      if (b.isMaser) {
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = b.width * 0.58 * a;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
      }

      ctx.strokeStyle = '#FFF59D';
      ctx.lineWidth = b.width * 0.28 * a;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Ondas Soul Pocus y Prominence
    const waves: MomShockwaveVFX[] = p.custom.shockwaves || [];
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      const a = Math.max(0, w.life / w.maxLife);
      const curR = w.radius * (0.3 + (1 - a) * 0.7);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 8 * a;
      ctx.beginPath();
      ctx.arc(w.x, w.y, curR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = w.subColor;
      ctx.lineWidth = 3 * a;
      ctx.beginPath();
      ctx.arc(w.x, w.y, curR * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Rayos
    const bolts: MomBoltVFX[] = p.custom.momBolts || [];
    for (let i = 0; i < bolts.length; i++) {
      const bt = bolts[i];
      const a = Math.max(0, bt.life / bt.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = bt.color;
      ctx.lineWidth = bt.width + 2.5;
      ctx.beginPath();
      bt.pts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.stroke();
      ctx.restore();
    }

    // 5. Orbes de alma
    const orbs: SoulOrbVFX[] = p.custom.soulOrbs || [];
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      ctx.save();
      ctx.fillStyle = '#E040FB';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 6. Prometheus & Zeus orbitando (escalados a su tamaño de gigante)
    const orbitDist = 38 * scale;
    if ((p.custom.prometheusTimer || 0) > 0) {
      const px = p.x + Math.cos(t * 2.1) * orbitDist;
      const py = p.y + Math.sin(t * 2.1) * orbitDist - 20 * scale;
      ctx.save();
      ctx.fillStyle = '#FF9800';
      ctx.strokeStyle = '#FFF59D';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(px, py, (12 + Math.sin(t * 6) * 2) * Math.min(1.4, scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if ((p.custom.zeusTimer || 0) > 0) {
      const zx = p.x + Math.cos(t * 2.1 + Math.PI) * (orbitDist + 4);
      const zy = p.y + Math.sin(t * 2.1 + Math.PI) * (orbitDist + 4) - 22 * scale;
      ctx.save();
      ctx.fillStyle = '#ECEFF1';
      ctx.strokeStyle = '#FFEB3B';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(zx - 6, zy, 8 * Math.min(1.4, scale), 0, Math.PI * 2);
      ctx.arc(zx + 6, zy, 8 * Math.min(1.4, scale), 0, Math.PI * 2);
      ctx.arc(zx, zy - 5, 9 * Math.min(1.4, scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const allies: AlliedHomie[] = p.custom.alliedHomies || [];
    for (let i = 0; i < allies.length; i++) {
      const h = allies[i];
      ctx.save();
      ctx.fillStyle = h.kind === 'extra' ? '#FFD54F' : '#CE93D8';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.x, h.y + Math.sin(t * 4 + i) * 3, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  },

  drawAura({ ctx, player: p, t }) {
    const scale = p.custom.soulScale || 1.0;
    if ((p.custom.almas || 0) > 0) {
      ctx.strokeStyle = 'rgba(224, 64, 251, 0.45)';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, (p.radius + 12) * scale + Math.sin(t * 4) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if ((p.custom.napoleonTimer || 0) > 0) {
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.85)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 9 + Math.sin(t * 3.5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  drawBody({ ctx, player: p }) {
    const scale = p.custom.soulScale || 1.0;
    ctx.save();
    ctx.scale(scale, scale);

    // Vestido rosa imponente 38x50
    ctx.fillStyle = '#EC407A';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-16, -23, 32, 46, 12);
    ctx.fill();
    ctx.stroke();

    // Cabello rosa flamante
    ctx.fillStyle = '#F48FB1';
    ctx.beginPath();
    ctx.arc(-4, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cabeza
    ctx.fillStyle = '#F6C9AB';
    ctx.beginPath();
    ctx.arc(4, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sombrero bicorne Napoleón
    ctx.fillStyle = '#AD1457';
    ctx.beginPath();
    ctx.ellipse(-2, 0, 9, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(-2, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // Espada Napoleón si está despertada
    if ((p.custom.napoleonTimer || 0) > 0) {
      ctx.strokeStyle = '#CFD8DC';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(10, 14);
      ctx.lineTo(36, 18);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawPreview(pctx) {
    pctx.fillStyle = '#EC407A';
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.roundRect(-14, -4, 28, 22, 9);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#F48FB1';
    pctx.beginPath();
    pctx.arc(0, -10, 12, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#F6C9AB';
    pctx.beginPath();
    pctx.arc(0, -8, 8.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    // Sombrero Napoleón
    pctx.fillStyle = '#AD1457';
    pctx.beginPath();
    pctx.ellipse(0, -19, 17, 6.5, 0, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
    pctx.fillStyle = '#FFD54F';
    pctx.beginPath();
    pctx.arc(0, -19, 3.2, 0, Math.PI * 2);
    pctx.fill();
  }
};
