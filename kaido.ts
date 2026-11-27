import { CONFIG } from '../config';
import { calculateKaidoEmpowerment, drainKaidoFury } from '../rules';
import type { CharacterModule, CharacterContext } from './types';

function initDragonSegments(p: CharacterContext['player']): void {
  const segCount = 14;
  const backAng = (p.facingAngle || 0) + Math.PI;
  const segs: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < segCount; i++) {
    segs.push({
      x: p.x + Math.cos(backAng) * (i * 15),
      y: p.y + Math.sin(backAng) * (i * 15)
    });
  }
  p.custom.dragonSegments = segs;
}

function updateDragonSegments(p: CharacterContext['player'], t: number): void {
  if (!Array.isArray(p.custom.dragonSegments) || p.custom.dragonSegments.length === 0) {
    initDragonSegments(p);
  }
  const segs: Array<{ x: number; y: number }> = p.custom.dragonSegments;
  segs[0].x = p.x;
  segs[0].y = p.y;
  const spacing = 15;

  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1];
    const cur = segs[i];
    if (p.custom.dragonTwister) {
      // Coil gracefully around the cyclone during Dragon Twister
      const coilAng = (p.facingAngle || 0) + Math.PI + i * 0.42 + t * 1.4;
      const coilR = 14 + i * 4.2;
      const tx = p.x + Math.cos(coilAng) * coilR;
      const ty = p.y + Math.sin(coilAng) * coilR;
      cur.x += (tx - cur.x) * 0.35;
      cur.y += (ty - cur.y) * 0.35;
    } else {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.001) {
        const ang = Math.atan2(dy, dx);
        const sway = Math.sin(t * 2.2 - i * 0.55) * 1.8;
        cur.x = prev.x + Math.cos(ang) * spacing + Math.cos(ang + Math.PI / 2) * sway;
        cur.y = prev.y + Math.sin(ang) * spacing + Math.sin(ang + Math.PI / 2) * sway;
      } else {
        const backAng = (p.facingAngle || 0) + Math.PI;
        cur.x = prev.x + Math.cos(backAng) * spacing;
        cur.y = prev.y + Math.sin(backAng) * spacing;
      }
    }
  }
}

function endDragonTransformation(ctx: CharacterContext, manualCancel = false): void {
  const { player: p, audio } = ctx;
  if (!p.custom.dragonActive) return;
  p.custom.dragonActive = false;
  p.custom.fury = 0;
  p.custom.dragonTwister = null;
  p.custom.flameBarrage = null;
  p.armor = Math.max(0, p.armor - (p.custom.dragonArmorBonus || 0));
  p.custom.dragonArmorBonus = 0;
  p.skillCds[2] = p.skillMaxCds[2]; // 20s cooldown
  audio.playExhale();
  ctx.spawnFloatingText(
    p.x,
    p.y - 48,
    manualCancel ? '🐉 Forma Dragón Cancelada' : 'Fin de Forma Dragón',
    '#80D8FF',
    1.1
  );
  ctx.updateHUD();
  ctx.updateCooldownUI();
}

export const kaidoCharacter: CharacterModule = {
  id: 'kaido',
  name: 'Kaido',
  rarity: 'yonko',
  portrait: '🐉',
  portraitBg: 'linear-gradient(135deg, #4A148C 0%, #B71C1C 60%, #FF6F00 100%)',
  attackIcon: '🔨',
  themeClass: 'theme-kaido',
  color: '#B71C1C',
  vestColor: '#4A148C',
  hp: 135,
  damage: 16,
  speed: 5.5,
  armor: 14,
  dashCd: 2.2,
  autoAimRange: 320,
  skills: [
    { name: 'Bolo Breath', icon: '🔥', cd: 8.5 },
    { name: 'Ragnaraku', icon: '⚡', cd: 10.0 },
    { name: 'Dragon Form', icon: '🐉', cd: 20.0 }
  ],
  cardMeta: {
    displayName: 'KAIDO',
    zarparName: 'KAIDO',
    epithet: 'Rey de las Bestias',
    nameColor: '#FF5252',
    role: 'Criatura Más Fuerte / Emperador',
    passiveText: 'Pasiva: Escamas de Oni + FURY en Golpes/Kills',
    passiveColor: '#FFD54F',
    stats: { hp: 100, dmg: 99, vel: 77, arm: 88 },
    comboDesc:
      '<b>Kanabo (5 golpes):</b> Swing Haoshoku, barrido rompe-guardia, slam sísmico, empuje frontal y <b>Thunder Bagua</b> • <b>Dragón:</b> Garras azur, coletazo y choque.',
    skillsDesc:
      '<b>H1:</b> Bolo Breath / Demolition Gust • <b>H2:</b> Ragnaraku / Blazing Twister Barrage • <b>H3:</b> Forma Dragón (consume FURY).'
  },

  createCustomState: () => ({
    fury: 0,
    furyHitStreak: 0,
    furyStreakTimer: 0,
    dragonActive: false,
    dragonBuildTimer: 0,
    dragonArmorBonus: 0,
    kaidoCameraZoom: 1.0,
    dragonSegments: [] as Array<{ x: number; y: number }>,
    kanaboChargeGlow: 0,

    // Base H1: Bolo Breath
    boloState: null as null | {
      phase: 'charge' | 'fire';
      timer: number;
      maxTimer: number;
      tickTimer: number;
      angle: number;
      beamLen: number;
      beamHalfW: number;
    },

    // Base H2: Ragnaraku leap & slam
    ragnarakuJump: null as null | {
      phase: 'windup' | 'leap';
      timer: number;
      startX: number;
      startY: number;
      targetX: number;
      targetY: number;
      scale: number;
    },

    // Dragon H1: Dragon Twister / Demolition Gust
    dragonTwister: null as null | {
      timer: number;
      duration: number;
      tickTimer: number;
      x: number;
      y: number;
      radius: number;
      angle: number;
    },

    // Dragon H2: Flame Dragon / Blazing Twister Barrage
    flameBarrage: null as null | {
      phase: 'charge' | 'rush';
      timer: number;
      maxTimer: number;
      startX: number;
      startY: number;
      targetX: number;
      targetY: number;
      angle: number;
      hitSet: Set<any>;
    },

    // Ground craters & scorch embers
    kaidoCraters: [] as Array<{ x: number; y: number; radius: number; life: number; maxLife: number; isFlame?: boolean }>,
    kaidoScorchZones: [] as Array<{ x: number; y: number; radius: number; life: number; maxLife: number; tickTimer: number }>
  }),

  canAttack: (p) =>
    !p.custom.boloState &&
    !p.custom.ragnarakuJump &&
    !p.custom.flameBarrage,

  canDash: (p) =>
    !p.custom.boloState &&
    !p.custom.ragnarakuJump &&
    !p.custom.flameBarrage,

  canUseSkill(ctx, idx) {
    const p = ctx.player;
    if (p.custom.boloState || p.custom.ragnarakuJump || p.custom.flameBarrage) return false;
    if (idx === 2 && !p.custom.dragonActive && (p.custom.fury || 0) <= 0) return false;
    return true;
  },

  isMovementLocked: (p) =>
    Boolean(p.custom.boloState || p.custom.ragnarakuJump || p.custom.flameBarrage),

  isFacingLocked: (p) =>
    Boolean(p.custom.boloState || p.custom.ragnarakuJump || p.custom.flameBarrage),

  getMoveSpeedMult(p) {
    if (p.custom.dragonActive) return 1.24;
    return 1.0;
  },

  getCameraZoom: (p) => (typeof p.custom.kaidoCameraZoom === 'number' ? p.custom.kaidoCameraZoom : 1.0),

  getBodyScale(p) {
    if (p.custom.ragnarakuJump) return p.custom.ragnarakuJump.scale || 1.0;
    return 1.0;
  },

  onDash(ctx) {
    const { player: p, audio } = ctx;
    const isDragon = Boolean(p.custom.dragonActive);
    p.customDashDist = isDragon ? 245 : 205;
    p.dashDurationMax = 0.17;
    p.invulnTimer = Math.max(p.invulnTimer, 0.24);
    p.superArmorTimer = Math.max(p.superArmorTimer, 0.30);
    audio.playDash();
    audio.playFwoosh();

    const backAng = p.facingAngle + Math.PI;
    for (let k = 0; k < 14; k++) {
      const spread = backAng + (Math.random() - 0.5) * 0.85;
      const spd = 160 + Math.random() * 190;
      const col = isDragon
        ? (k % 2 === 0 ? '#80D8FF' : '#FF5252')
        : (k % 2 === 0 ? '#D50000' : '#FFFFFF');
      ctx.spawnParticle(p.x, p.y, col, 4.5, 0.24, {
        shape: 'spark',
        vx: Math.cos(spread) * spd,
        vy: Math.sin(spread) * spd
      });
    }
  },

  onDashHitEnemy(ctx, en) {
    const { player: p } = ctx;
    const { amount, isCrit } = ctx.calculatePlayerDamage(0.70, false);
    ctx.damageEnemy(en, amount, {
      isCrit,
      knockback: 115,
      sourceX: p.x,
      sourceY: p.y
    });
    ctx.spawnParticle(en.x, en.y, p.custom.dragonActive ? '#00B0FF' : '#FF1744', 5, 0.25, { shape: 'spark' });
  },

  onDashEnd(ctx) {
    const { state, player: p } = ctx;
    const isDragon = Boolean(p.custom.dragonActive);
    state.slashEffects.push({
      x: p.x,
      y: p.y,
      angle: 0,
      range: isDragon ? 68 : 48,
      isCircular: true,
      color: isDragon ? '#80D8FF' : '#BCAAA4',
      life: 0.22,
      maxLife: 0.22,
      type: 'ring'
    });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      ctx.spawnParticle(
        p.x + Math.cos(a) * 18,
        p.y + Math.sin(a) * 18,
        k % 2 === 0 ? '#D7CCC8' : (isDragon ? '#80D8FF' : '#8D6E63'),
        4.8,
        0.28
      );
    }
  },

  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const isDragon = Boolean(p.custom.dragonActive);

    if (isDragon) {
      // DRAGON FORM 3-STEP BASIC COMBO
      const step = p.comboStep % 3;
      p.comboStep = (step + 1) % 3;
      p.comboResetTimer = 1.0;
      p.attackAnimTimer = 0.26;
      p.superArmorTimer = Math.max(p.superArmorTimer, 0.30);

      if (step === 0) {
        // Dragon Claw Rake
        p.attackCooldown = 0.32;
        p.attackCooldownMax = 0.32;
        audio.playSlash(1.25);
        state.hitstopTimer = 0.04;
        state.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: aimAngle,
          range: 225,
          halfAngle: (78 * Math.PI) / 180,
          color: '#00B0FF',
          life: 0.24,
          maxLife: 0.24,
          type: 'kaido_dragon_claw'
        });
        for (let k = 0; k < 10; k++) {
          const a = aimAngle + (Math.random() - 0.5) * 1.6;
          ctx.spawnParticle(p.x + Math.cos(a) * 120, p.y + Math.sin(a) * 120, k % 2 === 0 ? '#80D8FF' : '#FF1744', 5, 0.28, { shape: 'spark' });
        }
        ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 225, (78 * Math.PI) / 180, 1.45, 75);
      } else if (step === 1) {
        // Dragon Tail Whip
        p.attackCooldown = 0.36;
        p.attackCooldownMax = 0.36;
        audio.playFwoosh();
        audio.playSlash(1.4);
        state.hitstopTimer = 0.05;
        state.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: aimAngle,
          range: 255,
          halfAngle: (110 * Math.PI) / 180,
          color: '#0288D1',
          life: 0.28,
          maxLife: 0.28,
          type: 'kaido_dragon_tail'
        });
        for (let k = 0; k < 14; k++) {
          const a = aimAngle + (Math.random() - 0.5) * 2.4;
          ctx.spawnParticle(p.x + Math.cos(a) * 145, p.y + Math.sin(a) * 145, k % 2 === 0 ? '#FFFFFF' : '#00B0FF', 5.2, 0.32);
        }
        ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 255, (110 * Math.PI) / 180, 1.65, 120, false, 0, 0, {
          ignoreArmorPct: 0.40
        });
      } else {
        // Coiling Body Crush / Shockwave
        p.attackCooldown = 0.44;
        p.attackCooldownMax = 0.44;
        audio.playExplosion(1.45);
        audio.playThunder();
        ctx.triggerScreenShake(8, 0.20);
        state.hitstopTimer = 0.08;
        state.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: 0,
          range: 215,
          isCircular: true,
          color: '#FF1744',
          life: 0.32,
          maxLife: 0.32,
          type: 'kaido_ragnaraku_impact'
        });
        for (let k = 0; k < 20; k++) {
          const a = (k / 20) * Math.PI * 2;
          ctx.spawnParticle(p.x + Math.cos(a) * 95, p.y + Math.sin(a) * 95, k % 2 === 0 ? '#00B0FF' : '#FF1744', 6, 0.38);
        }
        ctx.damageEnemiesInCircle(p.x, p.y, 215, 2.05, 155, false, 0.65, {
          pierceShield: true
        });
      }
      return;
    }

    // BASE ONI FORM 5-STEP KANABO COMBO
    const step = p.comboStep % 5;
    p.comboStep = (step + 1) % 5;
    p.comboResetTimer = 1.15;
    p.attackAnimTimer = step === 4 ? 0.32 : 0.25;
    p.kanaboSwingDir = step === 1 ? -1 : 1;
    p.superArmorTimer = Math.max(p.superArmorTimer, 0.28);
    p.custom.kanaboChargeGlow = step >= 3 ? 0.32 : 0.16;

    if (step === 0) {
      // 1. Wide horizontal kanabo swing
      p.attackCooldown = 0.36;
      p.attackCooldownMax = 0.36;
      audio.playSlash(0.95);
      audio.playKick();
      state.hitstopTimer = 0.04;
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range: 165,
        halfAngle: (78 * Math.PI) / 180,
        reverse: false,
        color: '#B71C1C',
        life: 0.24,
        maxLife: 0.24,
        type: 'kaido_kanabo_arc'
      });
      for (let k = 0; k < 8; k++) {
        const a = aimAngle + (Math.random() - 0.5) * 1.8;
        ctx.spawnParticle(p.x + Math.cos(a) * 85, p.y + Math.sin(a) * 85, k % 2 === 0 ? '#FF1744' : '#212121', 4.5, 0.26, { shape: 'spark' });
      }
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 165, (78 * Math.PI) / 180, 1.2, 55);
    } else if (step === 1) {
      // 2. Reverse sweeping kanabo strike with armor/guard pressure
      p.attackCooldown = 0.36;
      p.attackCooldownMax = 0.36;
      audio.playSlash(1.05);
      audio.playMetalClank();
      state.hitstopTimer = 0.045;
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range: 170,
        halfAngle: (82 * Math.PI) / 180,
        reverse: true,
        color: '#8E0000',
        life: 0.25,
        maxLife: 0.25,
        type: 'kaido_kanabo_arc'
      });
      for (let k = 0; k < 10; k++) {
        const a = aimAngle + (Math.random() - 0.5) * 1.8;
        ctx.spawnParticle(p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, k % 2 === 0 ? '#111111' : '#FF1744', 4.8, 0.28, { shape: 'spark' });
      }
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 170, (82 * Math.PI) / 180, 1.35, 65, false, 0, 0, {
        ignoreArmorPct: 0.40,
        armorDebuffTimer: 2.8
      });
    } else if (step === 2) {
      // 3. Overhead kanabo slam: compact shockwave + brief stagger
      p.attackCooldown = 0.44;
      p.attackCooldownMax = 0.44;
      const slamX = p.x + Math.cos(aimAngle) * 78;
      const slamY = p.y + Math.sin(aimAngle) * 78;
      audio.playExplosion(1.25);
      ctx.triggerScreenShake(5, 0.14);
      state.hitstopTimer = 0.06;
      state.slashEffects.push({
        x: slamX,
        y: slamY,
        angle: 0,
        range: 118,
        isCircular: true,
        color: '#FF1744',
        life: 0.28,
        maxLife: 0.28,
        type: 'kaido_slam'
      });
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        ctx.spawnParticle(slamX + Math.cos(a) * 45, slamY + Math.sin(a) * 45, k % 2 === 0 ? '#BCAAA4' : '#FF1744', 5.2, 0.32);
      }
      ctx.damageEnemiesInCircle(slamX, slamY, 118, 1.65, 40, false, 0.45);
    } else if (step === 3) {
      // 4. Forward-stepping thrust/spin that repositions enemies in front of Kaido
      p.attackCooldown = 0.40;
      p.attackCooldownMax = 0.40;
      p.momentumTimer = 0.12;
      p.momentumDirX = Math.cos(aimAngle);
      p.momentumDirY = Math.sin(aimAngle);
      audio.playFwoosh();
      audio.playSlash(1.15);
      state.hitstopTimer = 0.05;

      const focalX = Math.max(
        CONFIG.ARENA_MARGIN_X + 25,
        Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - 25, p.x + Math.cos(aimAngle) * 105)
      );
      const focalY = Math.max(
        CONFIG.ARENA_MARGIN_Y + 25,
        Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - 25, p.y + Math.sin(aimAngle) * 105)
      );

      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range: 195,
        halfAngle: (55 * Math.PI) / 180,
        reverse: false,
        color: '#D50000',
        life: 0.24,
        maxLife: 0.24,
        type: 'kaido_kanabo_arc'
      });

      const halfAng = (58 * Math.PI) / 180;
      state.enemies.forEach((en) => {
        if (en.hp <= 0) return;
        const dx = en.x - p.x;
        const dy = en.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d - en.radius <= 195 && Math.abs(ctx.normalizeAngle(Math.atan2(dy, dx) - aimAngle)) <= halfAng) {
          const { amount, isCrit } = ctx.calculatePlayerDamage(1.5, false);
          ctx.damageEnemy(en, amount, { isCrit, isNormalAttack: true, knockback: 10, sourceX: p.x, sourceY: p.y });
          if (!en.isBoss && en.hp > 0) {
            en.x = Math.max(
              CONFIG.ARENA_MARGIN_X + en.radius,
              Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - en.radius, en.x + (focalX - en.x) * 0.55)
            );
            en.y = Math.max(
              CONFIG.ARENA_MARGIN_Y + en.radius,
              Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - en.radius, en.y + (focalY - en.y) * 0.55)
            );
            ctx.spawnParticle(en.x, en.y, '#FF1744', 4.5, 0.25);
          }
        }
      });
    } else {
      // 5. Finisher: THUNDER BAGUA
      p.attackCooldown = 0.56;
      p.attackCooldownMax = 0.56;
      p.momentumTimer = 0.14;
      p.momentumDirX = Math.cos(aimAngle);
      p.momentumDirY = Math.sin(aimAngle);
      p.superArmorTimer = 0.34;
      p.x = Math.max(
        CONFIG.ARENA_MARGIN_X + p.radius,
        Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - p.radius, p.x + Math.cos(aimAngle) * 52)
      );
      p.y = Math.max(
        CONFIG.ARENA_MARGIN_Y + p.radius,
        Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - p.radius, p.y + Math.sin(aimAngle) * 52)
      );

      audio.playThunder();
      audio.playExplosion(1.45);
      audio.playShing();
      ctx.triggerScreenShake(10, 0.24);
      state.hitstopTimer = 0.11;

      const baguaLen = 285;
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range: baguaLen,
        width: 56,
        color: '#111116',
        subColor: '#FF1744',
        life: 0.32,
        maxLife: 0.32,
        type: 'kaido_thunder_bagua'
      });
      for (let k = 0; k < 22; k++) {
        const dist = 35 + (k / 22) * baguaLen;
        const spread = (Math.random() - 0.5) * 65;
        const perp = aimAngle + Math.PI / 2;
        ctx.spawnParticle(
          p.x + Math.cos(aimAngle) * dist + Math.cos(perp) * spread,
          p.y + Math.sin(aimAngle) * dist + Math.sin(perp) * spread,
          k % 2 === 0 ? '#FF1744' : '#111116',
          6,
          0.34,
          { shape: 'spark' }
        );
      }

      ctx.damageEnemiesInLine(p.x, p.y, aimAngle, baguaLen, 54, 2.75, 195, false, 0.75, {
        pierceShield: true,
        ignoreArmorPct: 0.50
      });
      ctx.spawnFloatingText(p.x, p.y - 50, '⚡ ¡THUNDER BAGUA!', '#FF1744', 1.45);
    }
  },

  onSkillReactivate(ctx, idx) {
    if (idx === 2 && ctx.player.custom.dragonActive) {
      endDragonTransformation(ctx, true);
      return true;
    }
    return false;
  },

  onSkill(ctx, idx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const isDragon = Boolean(p.custom.dragonActive);

    if (idx === 0) {
      if (isDragon) {
        // Dragon H1: Dragon Twister / Demolition Gust
        const cx = Math.max(
          CONFIG.ARENA_MARGIN_X + 50,
          Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - 50, p.x + Math.cos(aimAngle) * 75)
        );
        const cy = Math.max(
          CONFIG.ARENA_MARGIN_Y + 50,
          Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - 50, p.y + Math.sin(aimAngle) * 75)
        );
        p.custom.dragonTwister = {
          timer: 2.2,
          duration: 2.2,
          tickTimer: 0.05,
          x: cx,
          y: cy,
          radius: 265,
          angle: aimAngle
        };
        audio.playRoar();
        audio.playFwoosh();
        ctx.spawnFloatingText(p.x, p.y - 54, '🌪️ ¡DEMOLITION GUST!', '#80D8FF', 1.45);
        p.skillCds[0] = 6.5 * state.mods.h1CdMult;
        return true;
      }

      // Base H1: Bolo Breath (brief inhale at jaws -> wide roaring flame blast)
      p.custom.boloState = {
        phase: 'charge',
        timer: 0.26,
        maxTimer: 0.26,
        tickTimer: 0,
        angle: aimAngle,
        beamLen: 440,
        beamHalfW: 68
      };
      p.superArmorTimer = Math.max(p.superArmorTimer, 0.80);
      audio.playLaserCharge();
      ctx.spawnFloatingText(p.x, p.y - 48, '🔥 ¡BOLO BREATH!', '#FF9100', 1.35);
      return false;
    } else if (idx === 1) {
      if (isDragon) {
        // Dragon H2: Flame Dragon / Blazing Twister Barrage
        const target = state.targetedEnemy || ctx.findNearestEnemy(440);
        const rawTx = target ? target.x : p.x + Math.cos(aimAngle) * 300;
        const rawTy = target ? target.y : p.y + Math.sin(aimAngle) * 300;
        const targetX = Math.max(
          CONFIG.ARENA_MARGIN_X + p.radius,
          Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - p.radius, rawTx)
        );
        const targetY = Math.max(
          CONFIG.ARENA_MARGIN_Y + p.radius,
          Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - p.radius, rawTy)
        );
        p.custom.flameBarrage = {
          phase: 'charge',
          timer: 0.28,
          maxTimer: 0.28,
          startX: p.x,
          startY: p.y,
          targetX,
          targetY,
          angle: Math.atan2(targetY - p.y, targetX - p.x),
          hitSet: new Set()
        };
        p.invulnTimer = Math.max(p.invulnTimer, 0.56);
        p.superArmorTimer = Math.max(p.superArmorTimer, 0.65);
        audio.playRoar();
        audio.playLaserCharge();
        ctx.spawnFloatingText(p.x, p.y - 54, '🔥⚡ ¡FLAME DRAGON BARRAGE!', '#FFD54F', 1.45);
        p.skillCds[1] = 7.5;
        return true;
      }

      // Base H2: Ragnaraku (leap & Haki kanabo slam in circular area)
      const target = state.targetedEnemy || ctx.findNearestEnemy(380);
      const rawTx = target ? target.x : p.x + Math.cos(aimAngle) * 180;
      const rawTy = target ? target.y : p.y + Math.sin(aimAngle) * 180;
      const targetX = Math.max(
        CONFIG.ARENA_MARGIN_X + p.radius,
        Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - p.radius, rawTx)
      );
      const targetY = Math.max(
        CONFIG.ARENA_MARGIN_Y + p.radius,
        Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - p.radius, rawTy)
      );
      p.custom.ragnarakuJump = {
        phase: 'windup',
        timer: 0.14,
        startX: p.x,
        startY: p.y,
        targetX,
        targetY,
        scale: 1.0
      };
      p.invulnTimer = Math.max(p.invulnTimer, 0.48);
      p.superArmorTimer = Math.max(p.superArmorTimer, 0.52);
      audio.playFwoosh();
      ctx.spawnFloatingText(p.x, p.y - 50, '⚡ ¡RAGNARAKU!', '#FF1744', 1.4);
      return false;
    } else if (idx === 2) {
      // Base H3: Dragon Transformation (consumes FURY over time)
      if (p.custom.dragonActive) {
        endDragonTransformation(ctx, true);
        return true;
      }
      const currentFury = p.custom.fury || 0;
      if (currentFury <= 0) {
        ctx.spawnFloatingText(p.x, p.y - 48, '🔒 Sin FURY suficiente', '#FFD54F', 1.15);
        return true;
      }

      p.custom.dragonActive = true;
      p.custom.dragonBuildTimer = 0.28;
      p.custom.dragonArmorBonus = Math.round(p.armor * 0.75) + 14;
      p.armor += p.custom.dragonArmorBonus;
      initDragonSegments(p);

      p.skillCds[0] = 0;
      p.skillCds[1] = 0;
      p.skillCds[2] = 0;

      audio.playRoar();
      audio.playThunder();
      ctx.triggerScreenShake(9, 0.28);
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: 0,
        range: 165,
        isCircular: true,
        color: '#00B0FF',
        life: 0.36,
        maxLife: 0.36,
        type: 'ring'
      });
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * Math.PI * 2;
        ctx.spawnParticle(
          p.x + Math.cos(a) * 68,
          p.y + Math.sin(a) * 68,
          k % 3 === 0 ? '#00B0FF' : k % 3 === 1 ? '#FF6D00' : '#FF1744',
          6.5,
          0.45
        );
      }
      ctx.spawnFloatingText(p.x, p.y - 56, `🐉 ¡FORMA DRAGÓN! (${(currentFury / 10).toFixed(1)}s)`, '#80D8FF', 1.5);
      ctx.updateHUD();
      ctx.updateCooldownUI();
      return true;
    }
  },

  onUpdate(ctx, dt) {
    const { state, player: p, audio } = ctx;
    const t = performance.now() * 0.005;

    if (p.custom.kanaboChargeGlow > 0) {
      p.custom.kanaboChargeGlow = Math.max(0, p.custom.kanaboChargeGlow - dt);
    }

    // Resist minor stagger/slow faster due to Oni Scales
    if (p.slowTimer > 0) {
      p.slowTimer = Math.max(0, p.slowTimer - dt * 0.8);
    }

    // Combo hit streak decay
    if (p.custom.furyStreakTimer > 0) {
      p.custom.furyStreakTimer -= dt;
      if (p.custom.furyStreakTimer <= 0) {
        p.custom.furyHitStreak = 0;
      }
    }

    // Base H1: Bolo Breath update
    if (p.custom.boloState) {
      const bs = p.custom.boloState;
      bs.timer -= dt;
      if (bs.phase === 'charge') {
        if (Math.random() < 0.85) {
          const ang = bs.angle + (Math.random() - 0.5) * 1.2;
          const d = 32 + Math.random() * 24;
          ctx.spawnParticle(
            p.x + Math.cos(ang) * d,
            p.y + Math.sin(ang) * d,
            Math.random() < 0.5 ? '#FF9100' : '#FFEB3B',
            4.5,
            0.22,
            { vx: -Math.cos(ang) * 120, vy: -Math.sin(ang) * 120 }
          );
        }
        if (bs.timer <= 0) {
          bs.phase = 'fire';
          bs.timer = 0.48;
          bs.maxTimer = 0.48;
          bs.tickTimer = 0;
          audio.playRoar();
          audio.playExplosion(1.3);
          ctx.triggerScreenShake(7, 0.24);
          // Spawn scorch burn patches along blast line
          for (let s = 1; s <= 4; s++) {
            const dist = s * 95;
            const sx = p.x + Math.cos(bs.angle) * dist;
            const sy = p.y + Math.sin(bs.angle) * dist;
            p.custom.kaidoScorchZones.push({
              x: sx,
              y: sy,
              radius: 64,
              life: 3.0,
              maxLife: 3.0,
              tickTimer: 0.5
            });
          }
        }
      } else {
        bs.tickTimer -= dt;
        if (bs.tickTimer <= 0) {
          bs.tickTimer = 0.12;
          audio.playFireCrackle();
          ctx.damageEnemiesInLine(p.x, p.y, bs.angle, bs.beamLen, bs.beamHalfW, 1.05, 135, true, 0, {
            applyBurn: true,
            burnDps: 8
          });
          for (let k = 0; k < 4; k++) {
            const d = 40 + Math.random() * bs.beamLen;
            const lat = (Math.random() - 0.5) * bs.beamHalfW * 1.4;
            const perp = bs.angle + Math.PI / 2;
            ctx.spawnParticle(
              p.x + Math.cos(bs.angle) * d + Math.cos(perp) * lat,
              p.y + Math.sin(bs.angle) * d + Math.sin(perp) * lat,
              k % 2 === 0 ? '#FF6D00' : '#FFEB3B',
              6,
              0.26
            );
          }
        }
        if (bs.timer <= 0) {
          p.custom.boloState = null;
        }
      }
    }

    // Base H2: Ragnaraku leap & slam
    if (p.custom.ragnarakuJump) {
      const rj = p.custom.ragnarakuJump;
      rj.timer -= dt;
      if (rj.phase === 'windup') {
        rj.scale = 1.15;
        if (Math.random() < 0.7) {
          ctx.spawnParticle(p.x + (Math.random() - 0.5) * 28, p.y + (Math.random() - 0.5) * 28, '#FF1744', 4.5, 0.22, { shape: 'spark' });
        }
        if (rj.timer <= 0) {
          rj.phase = 'leap';
          rj.timer = 0.24;
          audio.playDash();
        }
      } else {
        const prog = 1 - Math.max(0, rj.timer / 0.24);
        p.x = rj.startX + (rj.targetX - rj.startX) * prog;
        p.y = rj.startY + (rj.targetY - rj.startY) * prog;
        rj.scale = 1.0 + Math.sin(prog * Math.PI) * 0.45;
        if (Math.random() < 0.6) {
          ctx.spawnParticle(p.x, p.y, Math.random() < 0.5 ? '#FF1744' : '#111111', 5, 0.22);
        }
        if (rj.timer <= 0) {
          p.x = rj.targetX;
          p.y = rj.targetY;
          p.custom.ragnarakuJump = null;
          p.landSquashTimer = 0.12;
          p.visualScaleX = 1.2;
          p.visualScaleY = 0.82;

          const slamRadius = 215 * state.mods.h3AreaMult;
          audio.playExplosion(1.65);
          audio.playThunder();
          ctx.triggerScreenShake(12, 0.28);
          state.hitstopTimer = 0.11;

          p.custom.kaidoCraters.push({
            x: p.x,
            y: p.y,
            radius: slamRadius * 0.88,
            life: 3.5,
            maxLife: 3.5
          });
          state.slashEffects.push({
            x: p.x,
            y: p.y,
            angle: 0,
            range: slamRadius,
            isCircular: true,
            color: '#FF1744',
            life: 0.42,
            maxLife: 0.42,
            type: 'kaido_ragnaraku_impact'
          });
          for (let k = 0; k < 28; k++) {
            const a = (k / 28) * Math.PI * 2;
            ctx.spawnParticle(
              p.x + Math.cos(a) * 85,
              p.y + Math.sin(a) * 85,
              k % 2 === 0 ? '#FF1744' : '#111116',
              6.5,
              0.42,
              { shape: 'spark' }
            );
          }
          ctx.damageEnemiesInCircle(p.x, p.y, slamRadius, 4.6, 155, true, 1.35, {
            pierceShield: true
          });
          ctx.spawnFloatingText(p.x, p.y - 54, '💥 ¡CONQUEROR RAGNARAKU!', '#FF1744', 1.5);
        }
      }
    }

    // Dragon H1: Dragon Twister / Demolition Gust
    if (p.custom.dragonTwister) {
      const tw = p.custom.dragonTwister;
      tw.timer -= dt;
      // Follow slightly ahead of Kaido so it remains responsive
      const targetCx = Math.max(
        CONFIG.ARENA_MARGIN_X + 40,
        Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - 40, p.x + Math.cos(p.facingAngle) * 55)
      );
      const targetCy = Math.max(
        CONFIG.ARENA_MARGIN_Y + 40,
        Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - 40, p.y + Math.sin(p.facingAngle) * 55)
      );
      tw.x += (targetCx - tw.x) * Math.min(1, dt * 6);
      tw.y += (targetCy - tw.y) * Math.min(1, dt * 6);

      // Pull and swirl nearby foes inward
      state.enemies.forEach((en) => {
        if (en.hp <= 0 || en.isBoss) return;
        const d = Math.hypot(en.x - tw.x, en.y - tw.y);
        if (d <= tw.radius + 75 && d > 18) {
          const pullAng = Math.atan2(tw.y - en.y, tw.x - en.x);
          const swirlAng = pullAng + 0.55;
          en.x += Math.cos(swirlAng) * 185 * dt;
          en.y += Math.sin(swirlAng) * 185 * dt;
        }
      });

      tw.tickTimer -= dt;
      if (tw.tickTimer <= 0) {
        tw.tickTimer = 0.18;
        audio.playSlash(1.15);
        if (Math.random() < 0.45) audio.playThunder();
        ctx.damageEnemiesInCircle(tw.x, tw.y, tw.radius, 0.72, 12, true, 0, {
          pierceShield: true
        });
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2;
          const r = 40 + Math.random() * (tw.radius - 40);
          ctx.spawnParticle(
            tw.x + Math.cos(a) * r,
            tw.y + Math.sin(a) * r,
            k % 3 === 0 ? '#FFFFFF' : k % 3 === 1 ? '#80D8FF' : '#FF6D00',
            5.2,
            0.28,
            { shape: 'spark', vx: -Math.sin(a) * 160, vy: Math.cos(a) * 160 }
          );
        }
      }

      if (tw.timer <= 0) {
        const bx = tw.x;
        const by = tw.y;
        p.custom.dragonTwister = null;
        audio.playExplosion(1.6);
        audio.playThunder();
        ctx.triggerScreenShake(11, 0.28);
        state.slashEffects.push({
          x: bx,
          y: by,
          angle: 0,
          range: 300,
          isCircular: true,
          color: '#80D8FF',
          life: 0.36,
          maxLife: 0.36,
          type: 'kaido_ragnaraku_impact'
        });
        for (let k = 0; k < 26; k++) {
          const a = (k / 26) * Math.PI * 2;
          ctx.spawnParticle(bx + Math.cos(a) * 100, by + Math.sin(a) * 100, k % 2 === 0 ? '#80D8FF' : '#FF6D00', 6.5, 0.42);
        }
        ctx.damageEnemiesInCircle(bx, by, 300, 2.6, 260, true, 1.0, {
          pierceShield: true
        });
        ctx.spawnFloatingText(bx, by - 52, '🌪️ ¡DEMOLITION GUST!', '#FFFFFF', 1.45);
      }
    }

    // Dragon H2: Flame Dragon / Blazing Twister Barrage
    if (p.custom.flameBarrage) {
      const fb = p.custom.flameBarrage;
      fb.timer -= dt;
      if (fb.phase === 'charge') {
        if (Math.random() < 0.9) {
          const a = Math.random() * Math.PI * 2;
          ctx.spawnParticle(
            p.x + Math.cos(a) * 42,
            p.y + Math.sin(a) * 42,
            Math.random() < 0.5 ? '#FF6D00' : '#40C4FF',
            5.5,
            0.24,
            { shape: 'spark' }
          );
        }
        if (fb.timer <= 0) {
          fb.phase = 'rush';
          fb.timer = 0.24;
          fb.maxTimer = 0.24;
          audio.playDash();
          audio.playExplosion(1.3);
        }
      } else {
        const prog = 1 - Math.max(0, fb.timer / 0.24);
        p.x = fb.startX + (fb.targetX - fb.startX) * prog;
        p.y = fb.startY + (fb.targetY - fb.startY) * prog;
        p.facingAngle = fb.angle;

        // Blazing azure-crimson-gold flame-lightning trail
        for (let k = 0; k < 3; k++) {
          ctx.spawnParticle(
            p.x + (Math.random() - 0.5) * 34,
            p.y + (Math.random() - 0.5) * 34,
            k === 0 ? '#FF6D00' : k === 1 ? '#FFD54F' : '#00B0FF',
            6.5,
            0.34
          );
        }
        ctx.damageEnemiesInCircle(p.x, p.y, 115, 1.8, 90, true, 0.3, {
          hitSet: fb.hitSet,
          applyBurn: true,
          burnDps: 8,
          pierceShield: true
        });

        if (fb.timer <= 0) {
          p.x = fb.targetX;
          p.y = fb.targetY;
          p.custom.flameBarrage = null;

          const burstR = 270;
          audio.playExplosion(1.8);
          audio.playThunder();
          ctx.triggerScreenShake(14, 0.35);
          state.hitstopTimer = 0.13;

          p.custom.kaidoCraters.push({
            x: p.x,
            y: p.y,
            radius: burstR * 0.9,
            life: 4.0,
            maxLife: 4.0,
            isFlame: true
          });
          p.custom.kaidoScorchZones.push({
            x: p.x,
            y: p.y,
            radius: 170,
            life: 3.5,
            maxLife: 3.5,
            tickTimer: 0.45
          });
          state.slashEffects.push({
            x: p.x,
            y: p.y,
            angle: 0,
            range: burstR,
            isCircular: true,
            color: '#FF6D00',
            life: 0.45,
            maxLife: 0.45,
            type: 'kaido_flame_burst'
          });
          for (let k = 0; k < 34; k++) {
            const a = (k / 34) * Math.PI * 2;
            ctx.spawnParticle(
              p.x + Math.cos(a) * 100,
              p.y + Math.sin(a) * 100,
              k % 3 === 0 ? '#FF6D00' : k % 3 === 1 ? '#FFD54F' : '#40C4FF',
              7.2,
              0.48,
              { shape: 'spark' }
            );
          }
          ctx.damageEnemiesInCircle(p.x, p.y, burstR, 4.2, 230, true, 1.5, {
            pierceShield: true,
            applyBurn: true,
            burnDps: 10
          });
          ctx.spawnFloatingText(p.x, p.y - 58, '🔥 ¡BLAZING TWISTER!', '#FFD54F', 1.55);
        }
      }
    }

    // Update ground craters & burning scorch zones
    for (let i = p.custom.kaidoCraters.length - 1; i >= 0; i--) {
      p.custom.kaidoCraters[i].life -= dt;
      if (p.custom.kaidoCraters[i].life <= 0) p.custom.kaidoCraters.splice(i, 1);
    }

    for (let i = p.custom.kaidoScorchZones.length - 1; i >= 0; i--) {
      const sz = p.custom.kaidoScorchZones[i];
      sz.life -= dt;
      sz.tickTimer -= dt;
      if (sz.tickTimer <= 0) {
        sz.tickTimer = 0.55;
        state.enemies.forEach((en) => {
          if (en.hp <= 0) return;
          if (Math.hypot(en.x - sz.x, en.y - sz.y) <= sz.radius + en.radius) {
            const { amount, isCrit } = ctx.calculatePlayerDamage(0.32, true);
            ctx.damageEnemy(en, amount, { isCrit, applyBurn: true, burnDps: 7 });
          }
        });
      }
      if (sz.life <= 0) p.custom.kaidoScorchZones.splice(i, 1);
    }

    // Dragon Transformation drain + zoom + trailing segments
    if (p.custom.dragonBuildTimer > 0) p.custom.dragonBuildTimer -= dt;
    if (p.custom.dragonActive) {
      updateDragonSegments(p, t);
      const drained = drainKaidoFury(p.custom.fury || 0, dt, 10);
      p.custom.fury = drained.energy;
      p.custom.kaidoCameraZoom =
        (p.custom.kaidoCameraZoom ?? 1.0) + (0.68 - (p.custom.kaidoCameraZoom ?? 1.0)) * Math.min(1, dt * 6.0);
      ctx.updateHUD();
      if (drained.ended) {
        endDragonTransformation(ctx, false);
      }
    } else {
      if (Math.abs((p.custom.kaidoCameraZoom ?? 1.0) - 1.0) > 0.0005) {
        p.custom.kaidoCameraZoom =
          (p.custom.kaidoCameraZoom ?? 1.0) + (1.0 - (p.custom.kaidoCameraZoom ?? 1.0)) * Math.min(1, dt * 6.5);
      } else {
        p.custom.kaidoCameraZoom = 1.0;
      }
    }
  },

  onCalculateDamage(p) {
    return calculateKaidoEmpowerment(
      p.custom.fury || 0,
      p.custom.furyHitStreak || 0,
      Boolean(p.custom.dragonActive)
    );
  },

  onAfterDamageEnemy(ctx) {
    const p = ctx.player;
    p.custom.furyHitStreak = Math.min(10, (p.custom.furyHitStreak || 0) + 1);
    p.custom.furyStreakTimer = 3.5;
    if (!p.custom.dragonActive) {
      const gain = p.custom.furyHitStreak >= 5 ? 5 : 3.5;
      p.custom.fury = Math.max(0, Math.min(100, (p.custom.fury || 0) + gain));
      ctx.updateHUD();
    }
  },

  onEnemyKilled(ctx, _en, resGain) {
    const p = ctx.player;
    if (p.custom.dragonActive) return;
    p.custom.fury = Math.max(0, Math.min(100, (p.custom.fury || 0) + resGain));
    ctx.updateHUD();
  },

  onBeforePlayerDamage(ctx) {
    // Oni Scales resilience (passive damage reduction; amplified by Dragon scales)
    return {
      dmgMult: ctx.player.custom.dragonActive ? 0.68 : 0.85
    };
  },

  onCleanupEffects(p) {
    if (p.custom.dragonActive && p.custom.dragonArmorBonus) {
      p.armor = Math.max(0, p.armor - p.custom.dragonArmorBonus);
    }
    p.custom.dragonActive = false;
    p.custom.dragonArmorBonus = 0;
    p.custom.kaidoCameraZoom = 1.0;
    p.custom.boloState = null;
    p.custom.ragnarakuJump = null;
    p.custom.dragonTwister = null;
    p.custom.flameBarrage = null;
    p.custom.dragonSegments = [];
    p.custom.kaidoCraters = [];
    p.custom.kaidoScorchZones = [];
  },

  mountHUD(slotEl) {
    slotEl.innerHTML = `
      <div id="kaido-fury-hud" class="char-resource-hud" style="display:flex;">
        <span style="font-size:11px;">🐉</span>
        <div class="res-bar-outer" style="border-color:#FF5252; background:#240A12;">
          <div id="hud-fury-fill" class="res-bar-fill" style="background: linear-gradient(90deg, #B71C1C, #FF5252, #FFD54F);"></div>
        </div>
        <span id="hud-fury-text" class="res-text text-outline-sm" style="color:#FFD54F;">FURY 0/100</span>
      </div>
    `;
  },

  updateHUD(p) {
    const container = document.getElementById('kaido-fury-hud');
    if (!container) return;
    container.style.display = 'flex';
    const isDragon = Boolean(p.custom.dragonActive);
    container.classList.toggle('fury-dragon', isDragon);
    const rawVal = p.custom.fury || 0;
    const val = Math.round(rawVal);
    const fill = document.getElementById('hud-fury-fill');
    const txt = document.getElementById('hud-fury-text');
    if (fill) {
      fill.style.width = `${Math.max(0, Math.min(100, rawVal))}%`;
      fill.style.background = isDragon
        ? 'linear-gradient(90deg, #0288D1, #00E5FF, #FFD54F)'
        : 'linear-gradient(90deg, #B71C1C, #FF5252, #FFD54F)';
    }
    if (txt) txt.textContent = `FURY ${val}/100`;
  },

  updateButtonsUI(p, helpers) {
    const isDragon = Boolean(p.custom.dragonActive);

    const iconH1 = helpers.getIcon(0);
    const lblH1 = helpers.getLabel(0);
    if (iconH1 && lblH1) {
      if (isDragon) {
        iconH1.textContent = '🌪️';
        lblH1.textContent = p.custom.dragonTwister
          ? `Gust (${p.custom.dragonTwister.timer.toFixed(1)}s)`
          : 'Demolition Gust';
      } else {
        iconH1.textContent = '🔥';
        lblH1.textContent = 'Bolo Breath';
      }
    }

    const iconH2 = helpers.getIcon(1);
    const lblH2 = helpers.getLabel(1);
    if (iconH2 && lblH2) {
      if (isDragon) {
        iconH2.textContent = '☄️';
        lblH2.textContent = 'Flame Barrage';
      } else {
        iconH2.textContent = '⚡';
        lblH2.textContent = 'Ragnaraku';
      }
    }

    const btnH3 = helpers.getBtn(2);
    const lblH3 = helpers.getLabel(2);
    const cdH3 = helpers.getCdEl(2);
    if (btnH3 && lblH3) {
      if (isDragon) {
        helpers.setSkillCooldownOverride(2, 0, undefined, true);
        btnH3.classList.remove('skill-locked');
        btnH3.classList.add('chain-active');
        lblH3.textContent = `CANCEL (${((p.custom.fury || 0) / 10).toFixed(1)}s)`;
        if (cdH3) cdH3.textContent = '';
      } else if ((p.custom.fury || 0) <= 0 && p.skillCds[2] <= 0) {
        btnH3.classList.add('skill-locked');
        btnH3.classList.remove('chain-active');
        lblH3.textContent = 'Dragon Form';
      } else {
        btnH3.classList.remove('skill-locked');
        btnH3.classList.remove('chain-active');
        lblH3.textContent = 'Dragon Form';
      }
    }
  },

  drawWorldBeforePlayer({ ctx, player: p, t }) {
    // 1. Ground craters from Ragnaraku / Flame Dragon Barrage
    if (Array.isArray(p.custom.kaidoCraters)) {
      p.custom.kaidoCraters.forEach((cr: any) => {
        const alpha = Math.min(1, cr.life / 1.0);
        ctx.save();
        ctx.globalAlpha = alpha;
        const grad = ctx.createRadialGradient(cr.x, cr.y, cr.radius * 0.12, cr.x, cr.y, cr.radius);
        grad.addColorStop(0, cr.isFlame ? 'rgba(62, 20, 8, 0.85)' : 'rgba(18, 12, 16, 0.82)');
        grad.addColorStop(0.65, cr.isFlame ? 'rgba(191, 54, 12, 0.5)' : 'rgba(74, 20, 40, 0.45)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cr.x, cr.y, cr.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = cr.isFlame ? '#FF9100' : '#FF1744';
        ctx.lineWidth = 3;
        for (let r = 0; r < 8; r++) {
          const a = (r / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cr.x + Math.cos(a) * 16, cr.y + Math.sin(a) * 16);
          ctx.lineTo(cr.x + Math.cos(a + 0.14) * cr.radius * 0.54, cr.y + Math.sin(a + 0.14) * cr.radius * 0.54);
          ctx.lineTo(cr.x + Math.cos(a - 0.08) * cr.radius * 0.90, cr.y + Math.sin(a - 0.08) * cr.radius * 0.90);
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    // 2. Scorch & burning ember zones
    if (Array.isArray(p.custom.kaidoScorchZones)) {
      p.custom.kaidoScorchZones.forEach((sz: any) => {
        const alpha = Math.min(1, sz.life / 0.8);
        ctx.save();
        ctx.globalAlpha = alpha * 0.8;
        const grad = ctx.createRadialGradient(sz.x, sz.y, 4, sz.x, sz.y, sz.radius);
        grad.addColorStop(0, 'rgba(255, 109, 0, 0.48)');
        grad.addColorStop(0.6, 'rgba(183, 28, 28, 0.28)');
        grad.addColorStop(1, 'rgba(183, 28, 28, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sz.x, sz.y, sz.radius, 0, Math.PI * 2);
        ctx.fill();

        // Glowing embers
        ctx.fillStyle = '#FFEB3B';
        for (let e = 0; e < 5; e++) {
          const ea = t * 1.5 + e * 1.25;
          const er = sz.radius * (0.25 + (e % 3) * 0.22);
          ctx.beginPath();
          ctx.arc(sz.x + Math.cos(ea) * er, sz.y + Math.sin(ea) * er, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    }

    // 3. Dragon H1: Dragon Twister / Demolition Gust swirling cyclone (under & around dragon)
    if (p.custom.dragonTwister) {
      const tw = p.custom.dragonTwister;
      const prog = 1 - Math.max(0, tw.timer / tw.duration);
      const easeIn = Math.min(1, prog / 0.12);
      const curR = tw.radius * (0.55 + 0.45 * easeIn);

      ctx.save();
      const grad = ctx.createRadialGradient(tw.x, tw.y, curR * 0.1, tw.x, tw.y, curR);
      grad.addColorStop(0, 'rgba(225, 245, 254, 0.36)');
      grad.addColorStop(0.5, 'rgba(0, 176, 255, 0.24)');
      grad.addColorStop(0.85, 'rgba(255, 109, 0, 0.20)');
      grad.addColorStop(1, 'rgba(0, 176, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(tw.x, tw.y, curR, 0, Math.PI * 2);
      ctx.fill();

      // Spinning wind-blade rings
      for (let ring = 0; ring < 4; ring++) {
        const ringR = curR * (0.30 + ring * 0.22);
        const startA = t * (4.5 + ring * 1.4) + ring * 1.4;
        ctx.strokeStyle = ring % 2 === 0 ? '#80D8FF' : '#FFFFFF';
        ctx.lineWidth = 4.5 - ring * 0.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(tw.x, tw.y, ringR, startA, startA + Math.PI * 1.25);
        ctx.stroke();
      }

      // Crackling cyclone lightning & Homengumo flame clouds around rim
      for (let c = 0; c < 6; c++) {
        const ca = (c / 6) * Math.PI * 2 + t * 2.4;
        const cx = tw.x + Math.cos(ca) * (curR * 0.78);
        const cy = tw.y + Math.sin(ca) * (curR * 0.78);
        ctx.fillStyle = 'rgba(255, 111, 0, 0.72)';
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        ctx.arc(cx + 8, cy - 5, 9, 0, Math.PI * 2);
        ctx.fill();

        if (c % 2 === 0) {
          ctx.strokeStyle = '#FF1744';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(tw.x + Math.cos(ca) * (curR * 0.28), tw.y + Math.sin(ca) * (curR * 0.28));
          ctx.lineTo(tw.x + Math.cos(ca + 0.16) * (curR * 0.56), tw.y + Math.sin(ca + 0.16) * (curR * 0.56));
          ctx.lineTo(cx, cy);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 4. Colossal Azure Eastern Dragon Serpentine Body + Homengumo Flame Clouds
    if (p.custom.dragonActive && Array.isArray(p.custom.dragonSegments) && p.custom.dragonSegments.length > 1) {
      const segs: Array<{ x: number; y: number }> = p.custom.dragonSegments;
      const buildRatio = p.custom.dragonBuildTimer > 0 ? 1 - p.custom.dragonBuildTimer / 0.28 : 1.0;
      const isFlaming = Boolean(p.custom.flameBarrage);

      ctx.save();
      ctx.globalAlpha = buildRatio;

      // Swirling flame clouds (Homengumo) trailing along dragon body
      for (let i = 2; i < segs.length; i += 2) {
        const sg = segs[i];
        const prev = segs[i - 1];
        const segAng = Math.atan2(prev.y - sg.y, prev.x - sg.x);
        const side = i % 4 === 0 ? 1 : -1;
        const cx = sg.x + Math.cos(segAng + Math.PI / 2) * (side * 24);
        const cy = sg.y + Math.sin(segAng + Math.PI / 2) * (side * 24);
        const pulse = 10 + Math.sin(t * 3 + i) * 2.5;
        ctx.fillStyle = isFlaming ? 'rgba(255, 109, 0, 0.85)' : 'rgba(255, 112, 67, 0.72)';
        ctx.strokeStyle = isFlaming ? '#FFEB3B' : '#FFAB91';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
        ctx.arc(cx + side * 7, cy - 4, pulse * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Draw segments tail-to-neck so head/front overlaps tail
      for (let i = segs.length - 1; i >= 1; i--) {
        const sg = segs[i];
        const prev = segs[i - 1];
        const frac = 1 - i / segs.length;
        const segR = (10 + frac * 16) * buildRatio;
        const segAng = Math.atan2(prev.y - sg.y, prev.x - sg.x);

        // Ground shadow under serpentine body
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(sg.x, sg.y + 18, segR * 0.9, segR * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(sg.x, sg.y);
        ctx.rotate(segAng);

        // Azure-scaled body segment
        ctx.fillStyle = isFlaming ? '#D84315' : '#0288D1';
        ctx.strokeStyle = '#002F6C';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, segR * 1.18, segR, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pale cream-gold belly ridge & dorsal scale pattern
        ctx.fillStyle = isFlaming ? '#FFE082' : '#B2EBF2';
        ctx.beginPath();
        ctx.ellipse(0, segR * 0.35, segR * 0.75, segR * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dark purple/gold dorsal fin spine
        ctx.fillStyle = isFlaming ? '#FFEB3B' : '#4A148C';
        ctx.beginPath();
        ctx.moveTo(-4, -segR * 0.72);
        ctx.lineTo(0, -segR * 1.38);
        ctx.lineTo(5, -segR * 0.72);
        ctx.closePath();
        ctx.fill();

        // Rear claws on segment 8
        if (i === 8) {
          ctx.fillStyle = '#01579B';
          ctx.strokeStyle = '#FFD54F';
          ctx.lineWidth = 1.8;
          for (let side = -1; side <= 1; side += 2) {
            ctx.beginPath();
            ctx.moveTo(0, side * segR * 0.7);
            ctx.lineTo(8, side * (segR + 12));
            ctx.lineTo(-4, side * (segR + 8));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      ctx.restore();
    }
  },

  drawWorldAfterPlayer({ ctx, player: p, t }) {
    // Base H1: Bolo Breath visual (inhale glow -> wide roaring flame blast)
    if (p.custom.boloState) {
      const bs = p.custom.boloState;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(bs.angle);

      if (bs.phase === 'charge') {
        const prog = 1 - Math.max(0, bs.timer / bs.maxTimer);
        const r = 12 + prog * 18;
        const grad = ctx.createRadialGradient(20, 0, 2, 20, 0, r);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.45, '#FFEB3B');
        grad.addColorStop(0.85, '#FF6D00');
        grad.addColorStop(1, 'rgba(255, 87, 34, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(20, 0, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const alpha = Math.min(1, (bs.timer / bs.maxTimer) * 1.4);
        const len = bs.beamLen;
        const hw = bs.beamHalfW;

        ctx.globalAlpha = alpha;
        const beamGrad = ctx.createLinearGradient(18, 0, len, 0);
        beamGrad.addColorStop(0, '#FFFFFF');
        beamGrad.addColorStop(0.18, '#FFEB3B');
        beamGrad.addColorStop(0.55, '#FF6D00');
        beamGrad.addColorStop(0.88, '#D50000');
        beamGrad.addColorStop(1, 'rgba(213, 0, 0, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(18, -hw * 0.25);
        ctx.lineTo(len, -hw * (0.95 + Math.sin(t * 20) * 0.08));
        ctx.lineTo(len + 32, 0);
        ctx.lineTo(len, hw * (0.95 + Math.cos(t * 20) * 0.08));
        ctx.lineTo(18, hw * 0.25);
        ctx.closePath();
        ctx.fill();

        // Roaring inner white-gold heat core
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.moveTo(18, -hw * 0.12);
        ctx.lineTo(len * 0.78, -hw * 0.34);
        ctx.lineTo(len * 0.86, 0);
        ctx.lineTo(len * 0.78, hw * 0.34);
        ctx.lineTo(18, hw * 0.12);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  },

  drawAura({ ctx, player: p, t }) {
    const isDragon = Boolean(p.custom.dragonActive);
    const baseR = p.radius + (isDragon ? 14 : 6);
    const pulse = Math.sin(t * 4) * 3;
    const isChargingFlame = Boolean(p.custom.flameBarrage);

    if (isDragon || isChargingFlame || (p.custom.fury || 0) >= 60 || p.custom.kanaboChargeGlow > 0) {
      const grad = ctx.createRadialGradient(0, 0, baseR * 0.4, 0, 0, baseR + 18 + pulse);
      if (isChargingFlame) {
        grad.addColorStop(0, 'rgba(255, 235, 59, 0.42)');
        grad.addColorStop(0.6, 'rgba(255, 87, 34, 0.34)');
        grad.addColorStop(1, 'rgba(213, 0, 0, 0)');
      } else if (isDragon) {
        grad.addColorStop(0, 'rgba(0, 176, 255, 0.36)');
        grad.addColorStop(0.6, 'rgba(255, 23, 68, 0.22)');
        grad.addColorStop(1, 'rgba(0, 176, 255, 0)');
      } else {
        grad.addColorStop(0, 'rgba(255, 23, 68, 0.30)');
        grad.addColorStop(0.65, 'rgba(17, 17, 22, 0.24)');
        grad.addColorStop(1, 'rgba(183, 28, 28, 0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, baseR + 18 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Subtle Conqueror's Haki black-and-crimson sparks
      for (let s = 0; s < 4; s++) {
        const sa = t * 1.8 + (s / 4) * Math.PI * 2;
        ctx.strokeStyle = s % 2 === 0 ? '#FF1744' : '#111116';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * baseR, Math.sin(sa) * baseR);
        ctx.lineTo(Math.cos(sa + 0.14) * (baseR + 13), Math.sin(sa + 0.14) * (baseR + 13));
        ctx.stroke();
      }
    }
  },

  drawBody({ ctx, player: p, t }) {
    const isDragon = Boolean(p.custom.dragonActive);

    if (isDragon) {
      // Colossal Horned Azure Eastern Dragon Head, Whiskers, Mane & Front Claws
      const isFlaming = Boolean(p.custom.flameBarrage);
      const buildRatio = p.custom.dragonBuildTimer > 0 ? 1 - p.custom.dragonBuildTimer / 0.28 : 1.0;
      ctx.save();
      ctx.scale(buildRatio * 1.25, buildRatio * 1.25);

      // Front dragon claws flanking head
      ctx.fillStyle = isFlaming ? '#BF360C' : '#0277BD';
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 2;
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(-2, side * 14);
        ctx.lineTo(14, side * 26);
        ctx.lineTo(22, side * 20);
        ctx.lineTo(6, side * 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Thick dark flowing dragon mane behind horns
      ctx.fillStyle = '#1A1423';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.2;
      for (let m = -2; m <= 2; m++) {
        ctx.beginPath();
        ctx.ellipse(-14, m * 5.5, 11, 4.5, m * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Horned dragon head & elongated snout
      ctx.fillStyle = isFlaming ? '#D84315' : '#0288D1';
      ctx.strokeStyle = '#002F6C';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-12, -14);
      ctx.quadraticCurveTo(10, -15, 25, -7);
      ctx.lineTo(28, 0);
      ctx.lineTo(25, 7);
      ctx.quadraticCurveTo(10, 15, -12, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Golden / Crimson antlers sweeping back
      ctx.strokeStyle = isFlaming ? '#FFEB3B' : '#37474F';
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath();
        ctx.moveTo(-4, side * 10);
        ctx.quadraticCurveTo(-14, side * 22, -24, side * 18);
        ctx.stroke();
      }

      // Long flowing golden dragon whiskers
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 2.4;
      for (let side = -1; side <= 1; side += 2) {
        const wave = Math.sin(t * 4 + side) * 4;
        ctx.beginPath();
        ctx.moveTo(22, side * 6);
        ctx.quadraticCurveTo(14, side * (18 + wave), -2, side * (25 + wave));
        ctx.stroke();
      }

      // Fierce glowing eyes
      ctx.fillStyle = '#FFEB3B';
      ctx.beginPath();
      ctx.arc(10, -5.5, 2.8, 0, Math.PI * 2);
      ctx.arc(10, 5.5, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#D50000';
      ctx.beginPath();
      ctx.arc(10.8, -5.5, 1.3, 0, Math.PI * 2);
      ctx.arc(10.8, 5.5, 1.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    // HUMAN / ONI EMPEROR FORM
    ctx.save();

    // Thick dark hair with flowing Oni mane + dark-plum feathered shoulder mantle
    ctx.fillStyle = '#18141E';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.6;
    for (let m = -2; m <= 2; m++) {
      ctx.beginPath();
      ctx.ellipse(-11, m * 6.5, 13, 6.2, m * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Feathered purple-black mantle across shoulders
    ctx.fillStyle = '#311B92';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(-5, 0, 14, p.radius + 7, 0, Math.PI * 0.45, Math.PI * 1.55);
    ctx.fill();
    ctx.stroke();

    // Massive muscular Oni torso + crimson/gold sash & dark-burgundy hakama trousers
    ctx.fillStyle = '#D79E6E';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.radius + 3, p.radius + 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Wide dark-and-crimson/gold sash & hakama lower wrap
    ctx.fillStyle = '#2A0E18';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 3, Math.PI * 0.55, Math.PI * 1.45);
    ctx.fill();
    ctx.strokeStyle = '#FFD54F';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-1, 0, p.radius + 1, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();
    ctx.strokeStyle = '#B71C1C';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(1, 0, p.radius - 1, Math.PI * 0.68, Math.PI * 1.32);
    ctx.stroke();

    // Iconic X-shaped scar on right torso
    ctx.strokeStyle = '#8E0000';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, 5);
    ctx.lineTo(12, 13);
    ctx.moveTo(12, 5);
    ctx.lineTo(4, 13);
    ctx.stroke();

    // Iconic spiked iron kanabo club (Hassaikai) — animates during swings
    const swingProgress = p.attackAnimTimer > 0 ? Math.sin((p.attackAnimTimer / 0.25) * Math.PI) : 0;
    const swingDir = p.kanaboSwingDir || 1;
    ctx.save();
    ctx.rotate(-0.45 + swingProgress * 1.35 * swingDir);
    // Club handle
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(4, 15);
    ctx.lineTo(20, 22);
    ctx.stroke();
    // Heavy spiked iron barrel
    ctx.fillStyle = '#263238';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(18, 18);
    ctx.lineTo(44, 24);
    ctx.lineTo(43, 33);
    ctx.lineTo(17, 25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Iron spikes along kanabo
    ctx.fillStyle = '#CFD8DC';
    for (let sp = 0; sp < 4; sp++) {
      const sx = 23 + sp * 6;
      const sy = 21 + sp * 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy - 2, 2.0, 0, Math.PI * 2);
      ctx.arc(sx, sy + 7, 2.0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Conqueror's Haki dark-crimson lightning sparks crackling around kanabo
    if (p.custom.kanaboChargeGlow > 0 || p.attackAnimTimer > 0) {
      ctx.strokeStyle = '#FF1744';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(28, 16);
      ctx.lineTo(35, 11);
      ctx.lineTo(41, 18);
      ctx.stroke();
    }
    ctx.restore();

    // Oni head + dark horned crown/antlers + fierce eyes
    ctx.fillStyle = '#D79E6E';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(2, 0, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Curved dark bull/oni horns sweeping outward & forward
    ctx.strokeStyle = '#141418';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(0, side * 9);
      ctx.quadraticCurveTo(2, side * 21, 12, side * 22);
      ctx.stroke();
      ctx.strokeStyle = '#546E7A';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.strokeStyle = '#141418';
      ctx.lineWidth = 4.5;
    }

    // Thick dark mustache & scowl eyes
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(8, -3.2, 1.7, 0, Math.PI * 2);
    ctx.arc(8, 3.2, 1.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  drawPreview(pctx, t) {
    // Subtle dark-crimson Haki pulse behind Kaido
    const auraR = 20 + Math.sin(t * 2.4) * 2;
    const grad = pctx.createRadialGradient(0, 0, 4, 0, 0, auraR);
    grad.addColorStop(0, 'rgba(255, 23, 68, 0.45)');
    grad.addColorStop(0.65, 'rgba(74, 20, 140, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    pctx.fillStyle = grad;
    pctx.beginPath();
    pctx.arc(0, 0, auraR, 0, Math.PI * 2);
    pctx.fill();

    // Flowing dark mane + purple shoulder mantle
    pctx.fillStyle = '#311B92';
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.ellipse(0, 5, 16, 12, 0, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    // Muscular chest + X-scar on right torso + gold/crimson sash
    pctx.fillStyle = '#D79E6E';
    pctx.beginPath();
    pctx.ellipse(0, 5, 12, 10, 0, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    pctx.strokeStyle = '#8E0000';
    pctx.lineWidth = 1.8;
    pctx.beginPath();
    pctx.moveTo(3, 4);
    pctx.lineTo(8, 9);
    pctx.moveTo(8, 4);
    pctx.lineTo(3, 9);
    pctx.stroke();

    pctx.fillStyle = '#FFD54F';
    pctx.fillRect(-10, 11, 20, 4);

    // Spiked kanabo behind right shoulder
    pctx.strokeStyle = '#263238';
    pctx.lineWidth = 4;
    pctx.beginPath();
    pctx.moveTo(11, 13);
    pctx.lineTo(17, -14);
    pctx.stroke();

    // Oni head & dark hair
    pctx.fillStyle = '#18141E';
    pctx.beginPath();
    pctx.arc(0, -6, 10, 0, Math.PI * 2);
    pctx.fill();
    pctx.fillStyle = '#D79E6E';
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 1.8;
    pctx.beginPath();
    pctx.arc(0, -4, 7.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    // Curved Oni horns
    pctx.strokeStyle = '#212126';
    pctx.lineWidth = 3.2;
    pctx.lineCap = 'round';
    pctx.beginPath();
    pctx.moveTo(-6, -8);
    pctx.quadraticCurveTo(-15, -13, -12, -20);
    pctx.moveTo(6, -8);
    pctx.quadraticCurveTo(15, -13, 12, -20);
    pctx.stroke();

    // Fierce eyes
    pctx.fillStyle = '#FF1744';
    pctx.beginPath();
    pctx.arc(-2.5, -5, 1.5, 0, Math.PI * 2);
    pctx.arc(2.5, -5, 1.5, 0, Math.PI * 2);
    pctx.fill();
  }
};
