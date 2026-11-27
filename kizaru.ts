import { CONFIG } from '../config';
import {
  drainKizaruPika,
  resolveKizaruYasakaniDamage
} from '../rules';
import type { CharacterModule, CharacterContext } from './types';

function endLightMode(ctx: CharacterContext, manualCancel: boolean): void {
  const { player: p, audio } = ctx;
  if (!p.custom.lightModeActive) return;
  p.custom.lightModeActive = false;
  if (p.custom.lightArmorBonus) {
    p.armor = Math.max(0, p.armor - p.custom.lightArmorBonus);
    p.custom.lightArmorBonus = 0;
  }
  p.custom.lightComboStep = 0;
  p.custom.lightComboResetTimer = 0;
  p.custom.lightFlurry = null;
  if (p.custom.lightBeamWindup) {
    p.custom.lightBeamWindup = null;
    p.attackCooldown = Math.min(p.attackCooldown, 0.2);
  }
  if (manualCancel && p.custom.pika > 0) {
    p.skillCds[1] = 2.0;
    ctx.spawnFloatingText(p.x, p.y - 48, '🌟 Modo Luz Plegado (Luz guardada)', '#FFF59D', 1.0);
  } else {
    p.custom.pika = 0;
    p.skillCds[1] = p.skillMaxCds[1];
    ctx.spawnFloatingText(p.x, p.y - 48, 'Fin de Modo Luz', '#FFE082', 1.0);
  }
  audio.playExhale();
  ctx.updateHUD();
  ctx.updateCooldownUI();
}

function endYasakaniFlight(ctx: CharacterContext, manualCancel: boolean): void {
  const { player: p, audio } = ctx;
  if (!p.custom.yasakaniActive) return;
  p.custom.yasakaniActive = false;
  p.landSquashTimer = 0.12;
  if (manualCancel && p.custom.pika > 0) {
    p.skillCds[2] = 2.0;
    ctx.spawnFloatingText(p.x, p.y - 48, '✨ Vuelo Cancelado (Luz guardada)', '#FFF59D', 1.0);
  } else {
    p.custom.pika = 0;
    p.skillCds[2] = p.skillMaxCds[2];
    ctx.spawnFloatingText(p.x, p.y - 48, 'Fin de Yasakani', '#FFE082', 1.0);
  }
  audio.playExhale();
  ctx.updateHUD();
  ctx.updateCooldownUI();
}

function resolveAimForCombo(ctx: CharacterContext, fallbackAngle: number): number {
  const target = ctx.findNearestEnemy(330);
  if (target) {
    const ang = Math.atan2(target.y - ctx.player.y, target.x - ctx.player.x);
    ctx.player.facingAngle = ang;
    return ang;
  }
  return fallbackAngle;
}

function executeMurakumoStep(ctx: CharacterContext, step: number): void {
  const { state, player: p, audio } = ctx;
  const isLight = Boolean(p.custom.lightModeActive);
  const reachMult = isLight ? 1.3 : 1.0;
  const dmgScale = isLight ? 1.3 : 1.0;
  const aimAngle = resolveAimForCombo(ctx, p.facingAngle);

  if (step === 1) {
    // Paso 1: Tajo largo hacia la izquierda con Ama no Murakumo
    const range = Math.round(175 * reachMult);
    audio.playSlash(1.15);
    audio.playShing();
    state.slashEffects.push({
      x: p.x,
      y: p.y,
      angle: aimAngle,
      range,
      halfAngle: (72 * Math.PI) / 180,
      swingDir: -1,
      followPlayer: true,
      isLightBoosted: isLight,
      color: '#FFD54F',
      life: 0.19,
      maxLife: 0.19,
      type: 'kizaru_sword_swipe'
    });
    ctx.damageEnemiesInCone(
      p.x,
      p.y,
      aimAngle,
      range,
      (72 * Math.PI) / 180,
      1.25 * dmgScale,
      45,
      false,
      0,
      0,
      { isNormalAttack: false }
    );
  } else if (step === 2) {
    // Paso 2: Tajo largo hacia la derecha con destellos de luz
    const range = Math.round(185 * reachMult);
    audio.playSlash(1.25);
    audio.playShing();
    state.slashEffects.push({
      x: p.x,
      y: p.y,
      angle: aimAngle,
      range,
      halfAngle: (74 * Math.PI) / 180,
      swingDir: 1,
      followPlayer: true,
      isLightBoosted: isLight,
      color: '#FFF59D',
      life: 0.2,
      maxLife: 0.2,
      type: 'kizaru_sword_swipe'
    });
    // Destellos de luz en el barrido derecho
    [-0.45, 0.35].forEach((offset) => {
      const bx = p.x + Math.cos(aimAngle + offset) * (range * 0.65);
      const by = p.y + Math.sin(aimAngle + offset) * (range * 0.65);
      state.slashEffects.push({
        x: bx,
        y: by,
        angle: 0,
        range: Math.round(58 * reachMult),
        isCircular: true,
        color: '#FFF59D',
        life: 0.18,
        maxLife: 0.18,
        type: 'kizaru_light_burst'
      });
      ctx.damageEnemiesInCircle(bx, by, Math.round(58 * reachMult), 0.45 * dmgScale, 20, true);
    });
    ctx.damageEnemiesInCone(
      p.x,
      p.y,
      aimAngle,
      range,
      (74 * Math.PI) / 180,
      1.35 * dmgScale,
      50,
      false,
      0,
      0,
      { isNormalAttack: false }
    );
  } else if (step === 3) {
    // Paso 3: Corte recto largo que deja un cráter luminoso en el suelo
    const lineLen = Math.round(270 * reachMult);
    audio.playLaserCharge();
    audio.playSlash(1.35);
    state.slashEffects.push({
      x: p.x,
      y: p.y,
      angle: aimAngle,
      range: lineLen,
      width: isLight ? 42 : 34,
      isLightBoosted: isLight,
      color: '#FFF59D',
      life: 0.25,
      maxLife: 0.25,
      type: 'kizaru_sword_line'
    });
    const craterX = Math.max(
      CONFIG.ARENA_MARGIN_X + 40,
      Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - 40, p.x + Math.cos(aimAngle) * (lineLen * 0.62))
    );
    const craterY = Math.max(
      CONFIG.ARENA_MARGIN_Y + 40,
      Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - 40, p.y + Math.sin(aimAngle) * (lineLen * 0.62))
    );
    p.custom.lightCraters.push({
      x: craterX,
      y: craterY,
      angle: aimAngle,
      radius: Math.round(78 * reachMult),
      life: 3.2,
      maxLife: 3.2
    });
    if (p.custom.lightCraters.length > 5) p.custom.lightCraters.shift();
    for (let k = 0; k < 5; k++) {
      ctx.spawnParticle(craterX, craterY, k % 2 === 0 ? '#FFF59D' : '#FFD54F', 4.5, 0.28, { shape: 'spark' });
    }
    ctx.damageEnemiesInLine(p.x, p.y, aimAngle, lineLen, isLight ? 38 : 30, 1.55 * dmgScale, 60, true);
  } else if (step === 4) {
    // Paso 4: Remate pesado frontal envuelto en luz (~2x daño respecto a los tajos previos)
    p.momentumTimer = 0.1;
    p.momentumDirX = Math.cos(aimAngle);
    p.momentumDirY = Math.sin(aimAngle);
    const range = Math.round(215 * reachMult);
    audio.playExplosion(1.1);
    audio.playShing();
    ctx.triggerScreenShake(7, 0.16);
    ctx.triggerHaptic(18);
    state.slashEffects.push({
      x: p.x,
      y: p.y,
      angle: aimAngle,
      range,
      halfAngle: (78 * Math.PI) / 180,
      followPlayer: true,
      isLightBoosted: isLight,
      color: '#FFFFFF',
      life: 0.28,
      maxLife: 0.28,
      type: 'kizaru_sword_finisher'
    });
    for (let k = 0; k < 6; k++) {
      const a = aimAngle + (Math.random() - 0.5) * 1.1;
      ctx.spawnParticle(
        p.x + Math.cos(a) * (range * 0.5),
        p.y + Math.sin(a) * (range * 0.5),
        k % 2 === 0 ? '#FFF59D' : '#FFFFFF',
        5.2,
        0.3,
        { shape: 'spark' }
      );
    }
    const hit = ctx.damageEnemiesInCone(
      p.x,
      p.y,
      aimAngle,
      range,
      (78 * Math.PI) / 180,
      3.1 * dmgScale,
      130,
      false,
      0,
      0,
      { isNormalAttack: false, pierceShield: true }
    );
    if (hit) {
      state.hitstopTimer = 0.065;
    }
  }
}

function executeKizaruFlurryKick(
  ctx: CharacterContext,
  variant: 1 | 2,
  hitIndex: number,
  baseAngle: number
): void {
  const { state, player: p, audio } = ctx;
  const target = ctx.findNearestEnemy(170);
  const trackedAngle = target ? Math.atan2(target.y - p.y, target.x - p.x) : baseAngle;
  p.facingAngle = trackedAngle;

  const isWave2 = variant === 2;
  const offsets1 = [-0.16, 0.14, -0.08, 0.18, 0];
  const offsets2 = [-0.36, 0.34, -0.22, 0.24, 0];
  const kickAngle = trackedAngle + (isWave2 ? offsets2[hitIndex % 5] : offsets1[hitIndex % 5]);
  const legSide = (hitIndex % 2 === 0 ? 1 : -1) * (isWave2 ? 9 : 7);
  const perp = kickAngle + Math.PI / 2;
  const range = isWave2 ? 122 : 114;
  const isFinalHit = hitIndex >= 4;

  audio.playKick();
  if (hitIndex % 2 === 0) audio.playShing();

  if (state.slashEffects.length < 70) {
    state.slashEffects.push({
      x: p.x + Math.cos(perp) * legSide,
      y: p.y + Math.sin(perp) * legSide,
      angle: kickAngle,
      range,
      armOffset: legSide,
      followPlayer: true,
      hasLightTrail: isWave2,
      color: isWave2 ? '#FFFFFF' : '#FFF59D',
      life: isWave2 ? 0.1 : 0.11,
      maxLife: isWave2 ? 0.1 : 0.11,
      type: 'kizaru_kick_thrust'
    });
  }

  // Ligera chispa fotónica por golpe (máx 5 en toda la ráfaga para rendimiento móvil)
  ctx.spawnParticle(
    p.x + Math.cos(kickAngle) * (range * 0.72),
    p.y + Math.sin(kickAngle) * (range * 0.72),
    isWave2 ? '#FFFFFF' : '#FFF59D',
    3.6,
    0.16,
    { shape: 'spark' }
  );

  ctx.damageEnemiesInCone(
    p.x,
    p.y,
    kickAngle,
    range,
    ((isWave2 ? 36 : 30) * Math.PI) / 180,
    isWave2 ? 0.38 : 0.34,
    isFinalHit ? (isWave2 ? 24 : 18) : 7
  );
}

function executeKizaruLightModeStrike(
  ctx: CharacterContext,
  variant: 1 | 2,
  hitIndex: number,
  baseAngle: number
): void {
  const { state, player: p, audio } = ctx;
  const target = ctx.findNearestEnemy(230);
  const trackedAngle = target ? Math.atan2(target.y - p.y, target.x - p.x) : baseAngle;
  p.facingAngle = trackedAngle;

  const isWave2 = variant === 2;
  const offsets1 = [-0.18, 0.15, -0.09, 0.18, 0];
  const offsets2 = [-0.32, 0.30, -0.20, 0.22, 0];
  const strikeAngle = trackedAngle + (isWave2 ? offsets2[hitIndex % 5] : offsets1[hitIndex % 5]);
  const armSide = (hitIndex % 2 === 0 ? 1 : -1) * (isWave2 ? 10 : 7);
  const perp = strikeAngle + Math.PI / 2;
  const range = isWave2 ? 140 : 128;
  const isFinalHit = hitIndex >= 4;

  if (hitIndex % 2 === 0) audio.playShing();
  else audio.playSlash(1.45);

  if (state.slashEffects.length < 70) {
    state.slashEffects.push({
      x: p.x + Math.cos(perp) * armSide,
      y: p.y + Math.sin(perp) * armSide,
      angle: strikeAngle,
      range,
      armOffset: armSide,
      followPlayer: true,
      hasLightTrail: isWave2,
      color: isWave2 ? '#FFFFFF' : '#FFF59D',
      life: isWave2 ? 0.09 : 0.1,
      maxLife: isWave2 ? 0.09 : 0.1,
      type: 'kizaru_light_strike'
    });
  }

  ctx.spawnParticle(
    p.x + Math.cos(strikeAngle) * (range * 0.78),
    p.y + Math.sin(strikeAngle) * (range * 0.78),
    isWave2 ? '#FFFFFF' : '#FFF59D',
    3.4,
    0.15,
    { shape: 'spark' }
  );

  ctx.damageEnemiesInCone(
    p.x,
    p.y,
    strikeAngle,
    range,
    ((isWave2 ? 36 : 30) * Math.PI) / 180,
    isWave2 ? 0.44 : 0.40,
    isFinalHit ? (isWave2 ? 24 : 16) : 7
  );
}

function fireKizaruLightBeam(ctx: CharacterContext, aimAngle: number): void {
  const { state, player: p, audio } = ctx;
  const muzzleX = p.x + Math.cos(aimAngle) * (p.radius + 10);
  const muzzleY = p.y + Math.sin(aimAngle) * (p.radius + 10);

  audio.playShing();
  audio.playSlash(1.4);
  for (let k = 0; k < 2; k++) {
    ctx.spawnParticle(muzzleX, muzzleY, k === 0 ? '#FFFFFF' : '#FFF59D', 4.2, 0.18, { shape: 'spark' });
  }

  state.projectiles.push({
    fromPlayer: true,
    x: muzzleX,
    y: muzzleY,
    vx: Math.cos(aimAngle) * 1120,
    vy: Math.sin(aimAngle) * 1120,
    traveled: 0,
    maxRange: 540,
    radius: 7,
    blastRadius: 125,
    dmgMult: 2.35,
    hitIds: [],
    maxHits: 1,
    life: 0.55,
    color: '#FFF59D',
    type: 'kizaru_light_beam'
  });
}

export const kizaruCharacter: CharacterModule = {
  id: 'kizaru',
  name: 'Kizaru',
  faction: 'marines',
  rarity: 'almirante',
  portrait: '✨',
  portraitBg: 'linear-gradient(135deg, #FBC02D 0%, #FFF59D 52%, #0D47A1 100%)',
  attackIcon: '🦶',
  themeClass: 'theme-kizaru',
  color: '#FDD835',
  vestColor: '#FBC02D',
  hp: 125,
  damage: 15.5,
  speed: 5.8,
  armor: 12,
  dashCd: 1.55,
  initialDashCharges: 2,
  autoAimRange: 340,
  skills: [
    { name: 'Murakumo', icon: '🗡️', cd: 7.5 },
    { name: 'Modo Luz', icon: '🌟', cd: 9.0 },
    { name: 'Yasakani', icon: '✨', cd: 10.0 }
  ],
  cardMeta: {
    displayName: 'KIZARU',
    zarparName: 'KIZARU',
    epithet: 'Mono Amarillo',
    nameColor: '#FFF176',
    role: 'Almirante Pika Pika / Luz',
    passiveText: 'Pasiva: Paseo Relajado · "Oh, so scary" (6s) · Pika Pika',
    passiveColor: '#FFF59D',
    stats: { hp: 92, dmg: 97, vel: 98, arm: 90 },
    comboDesc:
      '<b>Base (5 pasos):</b> Patada recta fuerte → 2 ráfagas de 5 patadas rápidas de luz → Pisotón con cráter → Barrido amplio <b>Cegado</b> • <b>Modo Luz:</b> 5 golpes + 5 golpes + Rayo fino explosivo (1s CD).',
    skillsDesc:
      '<b>H1:</b> Ama no Murakumo (4 cortes en movimiento, +fuerte en Modo Luz) • <b>H2:</b> Modo de Luz (+ARM/+VEL) • <b>H3:</b> Yasakani no Magatama (vuelo).'
  },

  createCustomState: () => ({
    pika: 0,
    quipTimer: 6.0,
    lightModeActive: false,
    lightArmorBonus: 0,
    lightComboStep: 0,
    lightComboResetTimer: 0,
    lightFlurry: null as null | {
      variant: 1 | 2;
      hitsLeft: number;
      timer: number;
      angle: number;
      hitIndex: number;
    },
    lightBeamWindup: null as null | {
      timer: number;
      angle: number;
    },
    yasakaniActive: false,
    yasakaniFireTimer: 0,
    murakumoChain: null as null | {
      step: number;
      timer: number;
    },
    kickFlurry: null as null | {
      variant: 1 | 2;
      hitsLeft: number;
      timer: number;
      angle: number;
      hitIndex: number;
    },
    lightCraters: [] as Array<{
      x: number;
      y: number;
      angle: number;
      radius: number;
      life: number;
      maxLife: number;
    }>
  }),

  canAttack: (p) =>
    !p.custom.murakumoChain &&
    !p.custom.yasakaniActive &&
    !p.custom.kickFlurry &&
    !p.custom.lightFlurry &&
    !p.custom.lightBeamWindup,

  canDash: (p) => !p.custom.murakumoChain,

  canUseSkill(ctx, idx) {
    const p = ctx.player;
    if (p.custom.murakumoChain) return false;
    if (idx === 0) {
      return !p.custom.yasakaniActive;
    }
    if (idx === 1) {
      if (p.custom.lightModeActive) return true;
      return !p.custom.yasakaniActive && (p.custom.pika || 0) > 0;
    }
    if (idx === 2) {
      if (p.custom.yasakaniActive) return true;
      return !p.custom.lightModeActive && (p.custom.pika || 0) > 0;
    }
    return true;
  },

  isMovementLocked: () => false,

  isFacingLocked: () => false,

  getMoveSpeedMult(p) {
    if (p.custom.yasakaniActive) return 1.5;
    if (p.custom.lightModeActive) return 1.55;
    return 0.66;
  },

  getFlyOffsetY: (p) => (p.custom.yasakaniActive ? -26 : 0),

  onDash(ctx) {
    const { state, player: p, audio } = ctx;
    p.custom.kickFlurry = null;
    p.custom.lightFlurry = null;
    if (p.custom.lightBeamWindup) {
      p.custom.lightBeamWindup = null;
      p.attackCooldown = Math.min(p.attackCooldown, 0.2);
    }
    const mv = ctx.getMoveInput();
    let dirX = Math.cos(p.facingAngle);
    let dirY = Math.sin(p.facingAngle);
    if (mv.magnitude > 0.1) {
      dirX = mv.dirX;
      dirY = mv.dirY;
    } else {
      const target = ctx.findNearestEnemy(380);
      if (target) {
        const ang = Math.atan2(target.y - p.y, target.x - p.x);
        dirX = Math.cos(ang);
        dirY = Math.sin(ang);
      }
    }
    p.facingAngle = Math.atan2(dirY, dirX);

    const blinkDist = p.custom.lightModeActive ? 255 : 235;
    const startX = p.x;
    const startY = p.y;
    const destX = Math.max(
      CONFIG.ARENA_MARGIN_X + p.radius,
      Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - p.radius, p.x + dirX * blinkDist)
    );
    const destY = Math.max(
      CONFIG.ARENA_MARGIN_Y + p.radius,
      Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - p.radius, p.y + dirY * blinkDist)
    );

    const segDist = Math.hypot(destX - startX, destY - startY);
    const segAngle = Math.atan2(destY - startY, destX - startX);

    state.slashEffects.push({
      x: startX,
      y: startY,
      angle: segAngle,
      range: segDist,
      color: '#FFF59D',
      life: 0.22,
      maxLife: 0.22,
      type: 'kizaru_light_blink'
    });

    for (let i = 0; i < 3; i++) {
      const frac = i * 0.35;
      state.afterimages.push({
        x: startX + (destX - startX) * frac,
        y: startY + (destY - startY) * frac,
        angle: p.facingAngle,
        color: i === 2 ? '#FFF59D' : '#FBC02D',
        radius: p.radius * 0.92,
        life: 0.18 - i * 0.03,
        maxLife: 0.18
      });
    }
    if (state.afterimages.length > 24) {
      state.afterimages.splice(0, state.afterimages.length - 24);
    }

    for (let k = 0; k < 5; k++) {
      ctx.spawnParticle(
        destX + (Math.random() - 0.5) * 20,
        destY + (Math.random() - 0.5) * 20,
        k % 2 === 0 ? '#FFF59D' : '#FFFFFF',
        4,
        0.2,
        { shape: 'spark' }
      );
    }

    p.x = destX;
    p.y = destY;
    p.invulnTimer = Math.max(p.invulnTimer, 0.24);
    audio.playTeleport();
    audio.playShing();

    if (state.mods.dashSlowTrail) {
      state.hazards.push({ x: startX, y: startY, radius: 55, life: 3.0, type: 'player_slow' });
    }
    return true;
  },

  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;

    // En Modo Luz: combo de 3 partes en movimiento (5 golpes + 5 golpes + destello en dedo y rayo fino explosivo con 1s CD)
    if (p.custom.lightModeActive) {
      const lightStep = (p.custom.lightComboStep || 0) % 3;
      if (lightStep === 0) {
        p.custom.lightComboStep = 1;
        p.custom.lightComboResetTimer = 1.6;
        p.attackCooldown = 0.24;
        p.attackCooldownMax = 0.24;
        p.attackAnimTimer = 0.22;
        executeKizaruLightModeStrike(ctx, 1, 0, aimAngle);
        p.custom.lightFlurry = {
          variant: 1,
          hitsLeft: 4,
          timer: 0.036,
          angle: aimAngle,
          hitIndex: 1
        };
      } else if (lightStep === 1) {
        p.custom.lightComboStep = 2;
        p.custom.lightComboResetTimer = 1.6;
        p.attackCooldown = 0.24;
        p.attackCooldownMax = 0.24;
        p.attackAnimTimer = 0.22;
        executeKizaruLightModeStrike(ctx, 2, 0, aimAngle);
        p.custom.lightFlurry = {
          variant: 2,
          hitsLeft: 4,
          timer: 0.032,
          angle: aimAngle,
          hitIndex: 1
        };
      } else {
        p.custom.lightComboStep = 0;
        p.custom.lightComboResetTimer = 0;
        p.attackCooldown = 1.14;
        p.attackCooldownMax = 1.0;
        p.attackAnimTimer = 0.34;
        p.custom.lightBeamWindup = {
          timer: 0.14,
          angle: aimAngle
        };
        audio.playLaserCharge();
        state.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: aimAngle,
          range: 26,
          followPlayer: true,
          color: '#FFFFFF',
          life: 0.14,
          maxLife: 0.14,
          type: 'kizaru_finger_glint'
        });
      }
      return;
    }

    // Combo base de 5 pasos:
    // 1: Patada recta fuerte | 2: Ráfaga de 5 patadas | 3: 2ª Ráfaga 5 patadas (cadencia/estela)
    // 4: Patadón fuerte al suelo con cráter de luz | 5: Barrido largo de luz ("Cegado")
    const step = p.comboStep % 5;
    p.comboStep = (step + 1) % 5;
    p.comboResetTimer = 0.95;
    p.attackCooldown =
      step === 4 ? 0.40 :
      step === 3 ? 0.30 :
      step === 2 ? 0.27 :
      step === 1 ? 0.28 : 0.22;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = step === 4 ? 0.30 : step === 3 ? 0.25 : 0.21;

    if (step === 4) {
      p.momentumTimer = 0.11;
      p.momentumDirX = Math.cos(aimAngle);
      p.momentumDirY = Math.sin(aimAngle);
      p.superArmorTimer = 0.22;
    }

    if (step === 0) {
      // Hit 1: UNA sola patada recta fuerte con empuje sólido
      audio.playKick();
      audio.playShing();
      const range = 112;
      const legSide = 7;
      const perp = aimAngle + Math.PI / 2;

      state.slashEffects.push({
        x: p.x + Math.cos(perp) * legSide,
        y: p.y + Math.sin(perp) * legSide,
        angle: aimAngle,
        range,
        armOffset: legSide,
        followPlayer: true,
        color: '#FFF59D',
        life: 0.18,
        maxLife: 0.18,
        type: 'kizaru_kick_thrust'
      });
      for (let k = 0; k < 2; k++) {
        ctx.spawnParticle(
          p.x + Math.cos(aimAngle) * (range * 0.78),
          p.y + Math.sin(aimAngle) * (range * 0.78),
          k === 0 ? '#FFF59D' : '#FFFFFF',
          4.0,
          0.18,
          { shape: 'spark' }
        );
      }
      const hit = ctx.damageEnemiesInCone(p.x, p.y, aimAngle, range, (32 * Math.PI) / 180, 1.05, 48);
      if (hit) {
        ctx.triggerHaptic(8);
      }
    } else if (step === 1) {
      // Hit 2: Ráfaga rápida de 5 patadas seguidas
      executeKizaruFlurryKick(ctx, 1, 0, aimAngle);
      p.custom.kickFlurry = {
        variant: 1,
        hitsLeft: 4,
        timer: 0.045,
        angle: aimAngle,
        hitIndex: 1
      };
    } else if (step === 2) {
      // Hit 3: Segunda ráfaga rápida de 5 patadas con otro ángulo/cadencia y estela blanco-dorada
      executeKizaruFlurryKick(ctx, 2, 0, aimAngle);
      p.custom.kickFlurry = {
        variant: 2,
        hitsLeft: 4,
        timer: 0.038,
        angle: aimAngle,
        hitIndex: 1
      };
    } else if (step === 3) {
      // Hit 4: Patadón fuerte al suelo que deja un cráter luminoso dorado
      audio.playKick();
      audio.playExplosion(1.15);
      ctx.triggerScreenShake(5, 0.13);
      ctx.triggerHaptic(12);

      const stompDist = 56;
      const stompX = Math.max(
        CONFIG.ARENA_MARGIN_X + 36,
        Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - 36, p.x + Math.cos(aimAngle) * stompDist)
      );
      const stompY = Math.max(
        CONFIG.ARENA_MARGIN_Y + 36,
        Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - 36, p.y + Math.sin(aimAngle) * stompDist)
      );
      const impactRadius = 108;

      state.slashEffects.push({
        x: stompX,
        y: stompY,
        angle: aimAngle,
        range: impactRadius,
        isCircular: true,
        color: '#FFD54F',
        life: 0.28,
        maxLife: 0.28,
        type: 'kizaru_ground_stomp'
      });

      p.custom.lightCraters.push({
        x: stompX,
        y: stompY,
        angle: aimAngle,
        radius: 72,
        life: 2.8,
        maxLife: 2.8
      });
      if (p.custom.lightCraters.length > 5) p.custom.lightCraters.shift();

      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.35;
        ctx.spawnParticle(
          stompX + Math.cos(a) * 28,
          stompY + Math.sin(a) * 28,
          k % 2 === 0 ? '#FFD54F' : '#FFFFFF',
          4.4,
          0.24,
          { shape: 'spark' }
        );
      }

      const hit = ctx.damageEnemiesInCircle(stompX, stompY, impactRadius, 1.65, 76);
      if (hit) {
        state.hitstopTimer = 0.04;
      }
    } else {
      // Hit 5 (Remate): Barrido amplio de pierna de luz con mayor alcance, empuje y "Cegado"
      audio.playKick();
      audio.playExplosion(1.2);
      const range = 195;
      const halfAngle = (68 * Math.PI) / 180;
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range,
        halfAngle,
        swingDir: -1,
        isFinisher: true,
        color: '#FFF59D',
        life: 0.3,
        maxLife: 0.3,
        type: 'kizaru_kick_swipe'
      });
      for (let k = 0; k < 6; k++) {
        const a = aimAngle + (k - 2.5) * 0.36;
        ctx.spawnParticle(
          p.x + Math.cos(a) * 86,
          p.y + Math.sin(a) * 86,
          k % 2 === 0 ? '#FFF59D' : '#FFFFFF',
          4.6,
          0.26,
          { shape: 'spark' }
        );
      }
      const hit = ctx.damageEnemiesInCone(
        p.x,
        p.y,
        aimAngle,
        range,
        halfAngle,
        2.25,
        165,
        false,
        0,
        0,
        { blind: 2.0 }
      );
      if (hit) {
        state.hitstopTimer = CONFIG.HITSTOP_DURATION;
        ctx.triggerHaptic(18);
      }
    }
  },

  onSkillReactivate(ctx, idx) {
    const p = ctx.player;
    if (idx === 1 && p.custom.lightModeActive) {
      endLightMode(ctx, true);
      return true;
    }
    if (idx === 2 && p.custom.yasakaniActive) {
      endYasakaniFlight(ctx, true);
      return true;
    }
    return false;
  },

  onSkill(ctx, idx, aimAngle) {
    const { state, player: p, audio } = ctx;
    p.custom.kickFlurry = null;
    p.custom.lightFlurry = null;
    if (p.custom.lightBeamWindup) {
      p.custom.lightBeamWindup = null;
      p.attackCooldown = Math.min(p.attackCooldown, 0.2);
    }

    if (idx === 0) {
      // H1: Ama no Murakumo (invocación cortísima + 4 cortes automáticos en movimiento)
      audio.playShing();
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range: p.custom.lightModeActive ? 88 : 68,
        followPlayer: true,
        color: '#FFF59D',
        life: 0.12,
        maxLife: 0.12,
        type: 'kizaru_sword_summon'
      });
      ctx.spawnFloatingText(p.x, p.y - 46, '🗡️ ¡Ama no Murakumo!', '#FFF59D', 1.1);
      p.custom.murakumoChain = { step: 0, timer: 0.06 };
      return false;
    }

    if (idx === 1) {
      if ((p.custom.pika || 0) <= 0 || p.custom.yasakaniActive) return true;
      p.custom.lightModeActive = true;
      p.custom.lightComboStep = 0;
      p.custom.lightComboResetTimer = 0;
      p.custom.lightArmorBonus = 26;
      p.armor += p.custom.lightArmorBonus;
      audio.playLaserCharge();
      audio.playShing();
      ctx.triggerScreenShake(4, 0.14);
      ctx.spawnFloatingText(p.x, p.y - 50, '🌟 ¡MODO DE LUZ!', '#FFF59D', 1.25);
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: 0,
        range: 64,
        isCircular: true,
        color: '#FFF59D',
        life: 0.26,
        maxLife: 0.26,
        type: 'kizaru_light_explosion'
      });
      ctx.updateHUD();
      ctx.updateCooldownUI();
      return true; // El enfriamiento se aplica al cancelar o agotarse
    }

    if (idx === 2) {
      if ((p.custom.pika || 0) <= 0 || p.custom.lightModeActive) return true;
      p.custom.yasakaniActive = true;
      p.custom.yasakaniFireTimer = 0.04;
      audio.playTeleport();
      audio.playShing();
      ctx.spawnFloatingText(p.x, p.y - 62, '✨ ¡YASAKANI NO MAGATAMA!', '#FFF59D', 1.25);
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: 0,
        range: 68,
        isCircular: true,
        color: '#FFD54F',
        life: 0.26,
        maxLife: 0.26,
        type: 'ring'
      });
      ctx.updateHUD();
      ctx.updateCooldownUI();
      return true; // El enfriamiento se aplica al cancelar o agotarse
    }

    return false;
  },

  onUpdate(ctx, dt) {
    const { state, player: p, audio } = ctx;

    // 1. Frase recurrente cada 6 segundos durante combate activo
    p.custom.quipTimer = (p.custom.quipTimer ?? 6.0) - dt;
    if (p.custom.quipTimer <= 0) {
      p.custom.quipTimer = 6.0;
      ctx.spawnFloatingText(p.x, p.y - 54, '«Oh, so scary»', '#FFF59D', 1.05);
    }

    // 2. Decaimiento visual de cráteres luminosos de Ama no Murakumo
    if (Array.isArray(p.custom.lightCraters)) {
      for (let i = p.custom.lightCraters.length - 1; i >= 0; i--) {
        p.custom.lightCraters[i].life -= dt;
        if (p.custom.lightCraters[i].life <= 0) {
          p.custom.lightCraters.splice(i, 1);
        }
      }
    }

    // 2B. Ráfagas rápidas de patadas (Pasos 2 y 3 del combo base)
    if (p.custom.kickFlurry) {
      p.custom.kickFlurry.timer -= dt;
      if (p.custom.kickFlurry.timer <= 0) {
        const flurry = p.custom.kickFlurry;
        executeKizaruFlurryKick(ctx, flurry.variant, flurry.hitIndex, flurry.angle);
        flurry.hitIndex += 1;
        flurry.hitsLeft -= 1;
        if (flurry.hitsLeft <= 0) {
          p.custom.kickFlurry = null;
        } else {
          flurry.timer = flurry.variant === 2 ? 0.038 : 0.045;
        }
      }
    }

    // 2C. Combo de Modo Luz (5 golpes + 5 golpes + destello en dedo y rayo fino)
    if (p.custom.lightFlurry) {
      p.custom.lightFlurry.timer -= dt;
      if (p.custom.lightFlurry.timer <= 0) {
        const flurry = p.custom.lightFlurry;
        executeKizaruLightModeStrike(ctx, flurry.variant, flurry.hitIndex, flurry.angle);
        flurry.hitIndex += 1;
        flurry.hitsLeft -= 1;
        if (flurry.hitsLeft <= 0) {
          p.custom.lightFlurry = null;
        } else {
          flurry.timer = flurry.variant === 2 ? 0.032 : 0.036;
        }
      }
    }

    if (p.custom.lightBeamWindup) {
      p.custom.lightBeamWindup.timer -= dt;
      if (p.custom.lightBeamWindup.timer <= 0) {
        const liveAngle = resolveAimForCombo(ctx, p.custom.lightBeamWindup.angle ?? p.facingAngle);
        p.custom.lightBeamWindup = null;
        fireKizaruLightBeam(ctx, liveAngle);
        p.attackCooldown = 1.0;
        p.attackCooldownMax = 1.0;
      }
    }

    if (
      p.custom.lightModeActive &&
      !p.custom.lightFlurry &&
      !p.custom.lightBeamWindup &&
      (p.custom.lightComboResetTimer || 0) > 0
    ) {
      p.custom.lightComboResetTimer -= dt;
      if (p.custom.lightComboResetTimer <= 0) {
        p.custom.lightComboStep = 0;
      }
    }

    // 3. Cadena automática de H1 (Ama no Murakumo: 4 pasos)
    if (p.custom.murakumoChain) {
      p.custom.murakumoChain.timer -= dt;
      if (p.custom.murakumoChain.timer <= 0) {
        p.custom.murakumoChain.step += 1;
        const step = p.custom.murakumoChain.step;
        executeMurakumoStep(ctx, step);
        if (step >= 4) {
          p.custom.murakumoChain = null;
        } else if (step === 1) {
          p.custom.murakumoChain.timer = 0.14;
        } else if (step === 2) {
          p.custom.murakumoChain.timer = 0.16;
        } else {
          p.custom.murakumoChain.timer = 0.19;
        }
      }
    }

    // 4. Modo de Luz (drenaje Pika Pika 10/s)
    if (p.custom.lightModeActive) {
      const drained = drainKizaruPika(p.custom.pika || 0, dt, 10);
      p.custom.pika = drained.energy;
      if (drained.ended) {
        endLightMode(ctx, false);
      } else {
        ctx.updateHUD();
      }
    }

    // 5. Yasakani no Magatama (vuelo + ráfaga continua de orbes de luz)
    if (p.custom.yasakaniActive) {
      const drained = drainKizaruPika(p.custom.pika || 0, dt, 12.5);
      p.custom.pika = drained.energy;
      if (drained.ended) {
        endYasakaniFlight(ctx, false);
        return;
      }

      p.custom.yasakaniFireTimer -= dt;
      if (p.custom.yasakaniFireTimer <= 0) {
        p.custom.yasakaniFireTimer = 0.11;
        const nearby = state.enemies
          .filter((en) => en.hp > 0 && Math.hypot(en.x - p.x, en.y - p.y) <= 460)
          .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));

        const baseAng =
          nearby.length > 0
            ? Math.atan2(nearby[0].y - p.y, nearby[0].x - p.x)
            : p.facingAngle;
        p.facingAngle = baseAng;
        audio.playShing();

        for (let volley = 0; volley < 2; volley++) {
          const picked = nearby.length > 0 ? nearby[volley % nearby.length] : null;
          const aim = picked
            ? Math.atan2(picked.y - p.y, picked.x - p.x) + (Math.random() - 0.5) * 0.24
            : baseAng + (volley === 0 ? -0.14 : 0.14);
          const originX = p.x + Math.cos(aim) * 16;
          const originY = p.y - 24 + Math.sin(aim) * 16;

          state.projectiles.push({
            fromPlayer: true,
            x: originX,
            y: originY,
            vx: Math.cos(aim) * 780,
            vy: Math.sin(aim) * 780,
            traveled: 0,
            maxRange: 500,
            radius: 10,
            blastRadius: 46,
            dmgMult: 0.72,
            hitIds: [],
            maxHits: 1,
            life: 0.75,
            color: volley === 0 ? '#FFF59D' : '#FFD54F',
            type: 'kizaru_yasakani_orb'
          });
        }
      }
      ctx.updateHUD();
    }
  },

  onAfterDamageEnemy(ctx, _en, opts) {
    const p = ctx.player;
    if (p.custom.lightModeActive || p.custom.yasakaniActive) return;
    const gain = opts.isNormalAttack ? 5.5 : 7.0;
    p.custom.pika = Math.max(0, Math.min(100, (p.custom.pika || 0) + gain));
    ctx.updateHUD();
  },

  onEnemyKilled(ctx, _en, resGain) {
    const p = ctx.player;
    if (p.custom.lightModeActive || p.custom.yasakaniActive) return;
    p.custom.pika = Math.max(0, Math.min(100, (p.custom.pika || 0) + resGain));
    ctx.updateHUD();
  },

  onBeforePlayerDamage(ctx, _incomingDmg, _isBlunt, attacker, isProjectile) {
    const p = ctx.player;
    if (!p.custom.yasakaniActive) return {};
    const decision = resolveKizaruYasakaniDamage(Boolean(attacker && attacker.isBoss), Boolean(isProjectile));
    if (decision.cancelled) {
      ctx.spawnFloatingText(p.x, p.y - 52, '✨ ESQUIVADO (AIRE)', '#FFF59D', 0.85);
    }
    return decision;
  },

  onCleanupEffects(p) {
    if (p.custom.lightModeActive && p.custom.lightArmorBonus) {
      p.armor = Math.max(0, p.armor - p.custom.lightArmorBonus);
    }
    p.custom.lightModeActive = false;
    p.custom.lightArmorBonus = 0;
    p.custom.lightComboStep = 0;
    p.custom.lightComboResetTimer = 0;
    p.custom.lightFlurry = null;
    p.custom.lightBeamWindup = null;
    p.custom.yasakaniActive = false;
    p.custom.murakumoChain = null;
    p.custom.kickFlurry = null;
    p.custom.lightCraters = [];
  },

  mountHUD(slotEl) {
    slotEl.innerHTML = `
      <div id="kizaru-pika-hud" class="char-resource-hud" style="display:flex;">
        <span style="font-size:11px;">✨</span>
        <div class="res-bar-outer" style="border-color:#FFD54F; background:#1B2438;">
          <div id="hud-pika-fill" class="res-bar-fill" style="background: linear-gradient(90deg, #FBC02D, #FFF59D, #FFFFFF);"></div>
        </div>
        <span id="hud-pika-text" class="res-text text-outline-sm" style="color:#FFF59D;">PIKA 0/100</span>
      </div>
    `;
  },

  updateHUD(p) {
    const container = document.getElementById('kizaru-pika-hud');
    if (!container) return;
    container.style.display = 'flex';
    const isLight = Boolean(p.custom.lightModeActive);
    const isFly = Boolean(p.custom.yasakaniActive);
    container.classList.toggle('kizaru-light-active', isLight || isFly);

    const rawVal = p.custom.pika || 0;
    const val = Math.round(rawVal);
    const fill = document.getElementById('hud-pika-fill');
    const txt = document.getElementById('hud-pika-text');
    if (fill) {
      fill.style.width = `${Math.max(0, Math.min(100, rawVal))}%`;
    }
    if (txt) {
      txt.textContent = isFly ? `VUELO ${val}/100` : isLight ? `LUZ ${val}/100` : `PIKA ${val}/100`;
    }
  },

  updateButtonsUI(p, helpers) {
    const isLight = Boolean(p.custom.lightModeActive);
    const isFly = Boolean(p.custom.yasakaniActive);
    const hasPika = (p.custom.pika || 0) > 0;

    const iconAtk = document.getElementById('icon-attack');
    if (iconAtk) iconAtk.textContent = isLight ? '👆' : '🦶';

    const btnH1 = helpers.getBtn(0);
    const lblH1 = helpers.getLabel(0);
    if (btnH1 && lblH1) {
      btnH1.classList.toggle('skill-locked', isFly);
      lblH1.textContent = isLight ? 'Murakumo+' : 'Murakumo';
    }

    const btnH2 = helpers.getBtn(1);
    const lblH2 = helpers.getLabel(1);
    const cdH2 = helpers.getCdEl(1);
    if (btnH2 && lblH2) {
      if (isLight) {
        helpers.setSkillCooldownOverride(1, 0, undefined, true);
        btnH2.classList.remove('skill-locked');
        btnH2.classList.add('chain-active');
        lblH2.textContent = `SALIR (${((p.custom.pika || 0) / 10).toFixed(1)}s)`;
        if (cdH2) cdH2.textContent = '';
      } else if ((isFly || !hasPika) && p.skillCds[1] <= 0) {
        btnH2.classList.add('skill-locked');
        btnH2.classList.remove('chain-active');
        lblH2.textContent = 'Modo Luz';
      } else {
        btnH2.classList.remove('skill-locked');
        btnH2.classList.remove('chain-active');
        lblH2.textContent = 'Modo Luz';
      }
    }

    const btnH3 = helpers.getBtn(2);
    const lblH3 = helpers.getLabel(2);
    const cdH3 = helpers.getCdEl(2);
    if (btnH3 && lblH3) {
      if (isFly) {
        helpers.setSkillCooldownOverride(2, 0, undefined, true);
        btnH3.classList.remove('skill-locked');
        btnH3.classList.add('chain-active');
        lblH3.textContent = `BAJAR (${((p.custom.pika || 0) / 12.5).toFixed(1)}s)`;
        if (cdH3) cdH3.textContent = '';
      } else if ((isLight || !hasPika) && p.skillCds[2] <= 0) {
        btnH3.classList.add('skill-locked');
        btnH3.classList.remove('chain-active');
        lblH3.textContent = 'Yasakani';
      } else {
        btnH3.classList.remove('skill-locked');
        btnH3.classList.remove('chain-active');
        lblH3.textContent = 'Yasakani';
      }
    }
  },

  drawWorldBeforePlayer({ ctx, player: p }) {
    if (!Array.isArray(p.custom.lightCraters)) return;
    p.custom.lightCraters.forEach((cr: any) => {
      const alpha = Math.min(1, cr.life / 1.2);
      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(cr.x, cr.y, cr.radius * 0.1, cr.x, cr.y, cr.radius);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
      grad.addColorStop(0.45, 'rgba(255, 213, 79, 0.46)');
      grad.addColorStop(1, 'rgba(251, 192, 45, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cr.x, cr.y, cr.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFF59D';
      ctx.lineWidth = 2.6;
      for (let i = 0; i < 6; i++) {
        const a = cr.angle + (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cr.x + Math.cos(a) * 10, cr.y + Math.sin(a) * 10);
        ctx.lineTo(cr.x + Math.cos(a) * cr.radius * 0.85, cr.y + Math.sin(a) * cr.radius * 0.85);
        ctx.stroke();
      }
      ctx.restore();
    });
  },

  drawAura({ ctx, player: p, t }) {
    const isLight = Boolean(p.custom.lightModeActive);
    const isFly = Boolean(p.custom.yasakaniActive);
    if (!isLight && !isFly) return;

    const r = p.radius + (isFly ? 20 : 16) + Math.sin(t * 4) * 3;
    ctx.save();
    const grad = ctx.createRadialGradient(0, 0, p.radius * 0.35, 0, 0, r);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    grad.addColorStop(0.55, 'rgba(255, 241, 118, 0.35)');
    grad.addColorStop(1, 'rgba(251, 192, 45, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isFly ? '#FFFFFF' : '#FFF59D';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, t * 2, t * 2 + Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  drawBody({ ctx, player: p, cfg, t }) {
    const isLight = Boolean(p.custom.lightModeActive);
    const isFly = Boolean(p.custom.yasakaniActive);

    // Capa blanca de Almirante sobre los hombros con hombreras doradas
    ctx.save();
    ctx.fillStyle = isLight ? '#FFFDE7' : '#F4F6F9';
    ctx.strokeStyle = '#0D47A1';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-18, -20, 26, 40, 9);
    ctx.fill();
    ctx.stroke();

    // Hombreras doradas de Almirante
    ctx.fillStyle = '#FFD54F';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.8;
    ctx.fillRect(-13, -21, 9, 6);
    ctx.strokeRect(-13, -21, 9, 6);
    ctx.fillRect(-13, 15, 9, 6);
    ctx.strokeRect(-13, 15, 9, 6);

    // Traje amarillo con rayas sutiles
    ctx.fillStyle = isLight ? '#FFF59D' : cfg.vestColor;
    ctx.strokeStyle = isLight ? '#FFFFFF' : '#000';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rayas del traje + corbata oscura
    ctx.strokeStyle = 'rgba(140, 90, 0, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-6, -13);
    ctx.lineTo(-6, 13);
    ctx.moveTo(2, -14);
    ctx.lineTo(2, 14);
    ctx.stroke();

    ctx.fillStyle = '#2E4053';
    ctx.beginPath();
    ctx.moveTo(4, -5);
    ctx.lineTo(14, 0);
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fill();

    // Brazo derecho extendido en Modo Luz o Yasakani (punta luminosa + destello en dedo al cargar rayo)
    if (isLight || isFly) {
      const chargingBeam = Boolean(p.custom.lightBeamWindup);
      const pulse = (0.8 + Math.sin(t * 6) * 0.2) * (chargingBeam ? 1.35 : 1.0);
      ctx.fillStyle = '#FFF59D';
      ctx.beginPath();
      ctx.arc(p.radius + (chargingBeam ? 6 : 3), 7, 6.5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.radius + (chargingBeam ? 7 : 4), 7, 3.2 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cabeza, cabello oscuro ondulado y gafas ámbar icónicas
    ctx.fillStyle = '#1A1A1F';
    ctx.beginPath();
    ctx.arc(-1, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isLight ? '#FFF8E1' : '#E8BE94';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(2, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gafas tintadas ámbar
    ctx.fillStyle = '#FFB300';
    ctx.strokeStyle = '#4E342E';
    ctx.lineWidth = 1.5;
    ctx.fillRect(6, -6.5, 5, 4.5);
    ctx.strokeRect(6, -6.5, 5, 4.5);
    ctx.fillRect(6, 2, 5, 4.5);
    ctx.strokeRect(6, 2, 5, 4.5);
    ctx.beginPath();
    ctx.moveTo(8, -2);
    ctx.lineTo(8, 2);
    ctx.stroke();

    ctx.restore();
  },

  drawPreview(pctx, t, cfg) {
    // Halo de fotones Pika Pika
    const auraR = 20 + Math.sin(t * 2.5) * 2;
    const grad = pctx.createRadialGradient(0, 0, 3, 0, 0, auraR);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    grad.addColorStop(0.55, 'rgba(255, 213, 79, 0.45)');
    grad.addColorStop(1, 'rgba(21, 101, 192, 0)');
    pctx.fillStyle = grad;
    pctx.beginPath();
    pctx.arc(0, 0, auraR, 0, Math.PI * 2);
    pctx.fill();

    // Capa de Almirante blanca y hombreras doradas
    pctx.fillStyle = '#F8FAFC';
    pctx.strokeStyle = '#0D47A1';
    pctx.lineWidth = 1.8;
    pctx.beginPath();
    pctx.roundRect(-16, -2, 32, 18, 6);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#FFD54F';
    pctx.fillRect(-15, -3, 7, 4);
    pctx.fillRect(8, -3, 7, 4);

    // Traje amarillo rayado
    pctx.fillStyle = cfg.vestColor;
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 1.8;
    pctx.beginPath();
    pctx.arc(0, 6, 10.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    // Cabeza + pelo oscuro + gafas ámbar
    pctx.fillStyle = '#1A1A1F';
    pctx.beginPath();
    pctx.arc(0, -8, 9.5, 0, Math.PI * 2);
    pctx.fill();

    pctx.fillStyle = '#E8BE94';
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 1.6;
    pctx.beginPath();
    pctx.arc(0, -6, 7.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#FFB300';
    pctx.strokeStyle = '#4E342E';
    pctx.lineWidth = 1.2;
    pctx.fillRect(-5.5, -8, 4.5, 3);
    pctx.strokeRect(-5.5, -8, 4.5, 3);
    pctx.fillRect(1, -8, 4.5, 3);
    pctx.strokeRect(1, -8, 4.5, 3);
  }
};
