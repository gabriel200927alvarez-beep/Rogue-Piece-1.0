import { CONFIG } from '../config';
import type { CharacterModule, CharacterContext } from './types';

function hasLuffyGatlingSynergy(ctx: CharacterContext): boolean {
  return (
    ctx.state.mods.acquiredIds.includes('off_skill') &&
    ctx.state.mods.acquiredIds.includes('hab_h1cd')
  );
}

export const luffyCharacter: CharacterModule = {
  id: 'luffy',
  name: 'LUFFY',
  rarity: 'novato',
  portrait: '👒',
  portraitBg: '#C8102E',
  attackIcon: '👊',
  themeClass: 'theme-luffy',
  color: '#F5C518',
  vestColor: '#C8102E',
  hp: 150,
  damage: 18,
  speed: 4.6,
  armor: 18,
  dashCd: 2.2,
  skills: [
    { name: 'Gatling', icon: '👊', cd: 4.5 },
    { name: 'Bazooka', icon: '💥', cd: 6.0 },
    { name: 'Storm', icon: '🌪️', cd: 9.5 }
  ],
  cardMeta: {
    epithet: 'Sombrero de Paja',
    nameColor: '#F5C518',
    role: 'Tanque / Luchador',
    passiveText: 'Pasiva: -20% daño contundente',
    passiveColor: '#FFD54F',
    stats: { hp: 80, dmg: 65, vel: 66, arm: 74 },
    comboDesc: 'Pistol (110px), Pistol, Ono (onda 100px).',
    skillsDesc: '<b>H1:</b> Ráfaga 180px • <b>H2:</b> 3× empuje • <b>H3:</b> Storm 360° despeja área.'
  },

  createCustomState: () => ({
    gatlingHitsLeft: 0,
    gatlingTickTimer: 0,
    bazookaWindupTimer: 0,
    bazookaWindupMax: 0.22,
    bazookaAngle: 0,
    bazookaPierceShield: false,
    stormWindupTimer: 0,
    stormWindupMax: 0.26,
    stormLaunchAngle: 0,
    stormTimer: 0,
    stormHitsLeft: 0,
    stormTickTimer: 0,
    stormAimAngle: 0
  }),

  canAttack: (p) => !(p.custom.stormTimer > 0 || p.custom.stormWindupTimer > 0 || p.custom.bazookaWindupTimer > 0),
  canDash: (p) => !(p.custom.stormTimer > 0 || p.custom.stormWindupTimer > 0 || p.custom.bazookaWindupTimer > 0),
  canUseSkill: (ctx) => {
    const p = ctx.player;
    return !(p.custom.stormTimer > 0 || p.custom.stormWindupTimer > 0 || p.custom.bazookaWindupTimer > 0);
  },

  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const step = p.comboStep;
    p.comboStep = (p.comboStep + 1) % 3;
    p.comboResetTimer = CONFIG.COMBO_RESET_TIME;
    p.attackCooldown = step === 2 ? 0.34 : 0.21;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = 0.22;

    const isThirdHit = step === 2;
    if (isThirdHit) {
      p.momentumTimer = 0.12;
      p.momentumDirX = Math.cos(aimAngle);
      p.momentumDirY = Math.sin(aimAngle);
      p.superArmorTimer = 0.16;
    }

    if (!isThirdHit) {
      audio.playPunch();
      const armOffset = step === 0 ? -8 : 8;
      const perpAngle = aimAngle + Math.PI / 2;
      state.slashEffects.push({
        x: p.x + Math.cos(perpAngle) * armOffset,
        y: p.y + Math.sin(perpAngle) * armOffset,
        angle: aimAngle,
        range: 110,
        color: '#F5C518',
        armColor: '#FFCC80',
        armOffset,
        isRubberArm: true,
        followPlayer: true,
        life: 0.14,
        maxLife: 0.14,
        type: 'stretch'
      });
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 110, (20 * Math.PI) / 180, 1.0, 35);
    } else {
      audio.playKick();
      audio.playExplosion(1.2);
      const impactX = p.x + Math.cos(aimAngle) * 72;
      const impactY = p.y + Math.sin(aimAngle) * 72;
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        endX: impactX,
        endY: impactY,
        angle: aimAngle,
        range: 100,
        color: '#F5C518',
        armColor: '#FFCC80',
        life: 0.26,
        maxLife: 0.26,
        type: 'gomu_ono'
      });
      state.slashEffects.push({
        x: impactX,
        y: impactY,
        angle: 0,
        range: 100,
        isCircular: true,
        color: '#F5C518',
        life: 0.26,
        maxLife: 0.26,
        type: 'ring'
      });
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        ctx.spawnParticle(
          impactX + Math.cos(a) * 32,
          impactY + Math.sin(a) * 32,
          k % 2 === 0 ? '#F5C518' : '#ECEFF1',
          4.8,
          0.30
        );
      }
      const hitConnected = ctx.damageEnemiesInCircle(impactX, impactY, 100, 1.8, 120);
      if (hitConnected) {
        state.hitstopTimer = CONFIG.HITSTOP_DURATION;
        ctx.triggerScreenShake(5, 0.14);
        ctx.triggerHaptic(12);
      }
    }
  },

  onDash(ctx) {
    const { player: p, audio } = ctx;
    p.customDashDist = CONFIG.DASH_DISTANCE;
    p.invulnTimer = CONFIG.DASH_IFRAMES;
    audio.playPunch();
  },

  onSkill(ctx, idx, aimAngle) {
    const { player: p, audio, state } = ctx;
    const pierceShield = idx === 1 && state.mods.h2PierceShield;

    if (idx === 0) {
      p.custom.gatlingHitsLeft = hasLuffyGatlingSynergy(ctx) ? 15 : 10;
      p.custom.gatlingTickTimer = 0;
    } else if (idx === 1) {
      p.custom.bazookaWindupMax = 0.22;
      p.custom.bazookaWindupTimer = 0.22;
      p.custom.bazookaAngle = aimAngle;
      p.custom.bazookaPierceShield = pierceShield;
      p.facingAngle = aimAngle;
      audio.playFwoosh();
      for (let k = 0; k < 8; k++) {
        ctx.spawnParticle(
          p.x - Math.cos(aimAngle) * (18 + k * 7),
          p.y - Math.sin(aimAngle) * (18 + k * 7),
          k % 2 === 0 ? '#F5C518' : '#ECEFF1',
          4,
          0.22
        );
      }
      ctx.spawnFloatingText(p.x, p.y - 38, '💥 ¡BAZOOKA!', '#F5C518', 1.2);
    } else if (idx === 2) {
      p.custom.stormWindupMax = 0.26;
      p.custom.stormWindupTimer = 0.26;
      p.custom.stormLaunchAngle = aimAngle;
      p.facingAngle = aimAngle;
      audio.playFwoosh();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        ctx.spawnParticle(
          p.x + Math.cos(a) * 28,
          p.y + Math.sin(a) * 28,
          k % 2 === 0 ? '#FFF59D' : '#F5C518',
          4.5,
          0.26
        );
      }
      ctx.spawnFloatingText(p.x, p.y - 38, '🌪️ ¡GOMU GOMU NO STORM!', '#F5C518', 1.25);
    }
  },

  onUpdate(ctx, dt) {
    const { state, player: p, audio } = ctx;

    // Fase de tensión -> lanzamiento de Bazooka (H2)
    if (p.custom.bazookaWindupTimer > 0) {
      p.custom.bazookaWindupTimer -= dt;
      p.vx = 0;
      p.vy = 0;
      if (p.custom.bazookaWindupTimer <= 0) {
        p.custom.bazookaWindupTimer = 0;
        const ang = p.custom.bazookaAngle;
        const perp = ang + Math.PI / 2;
        p.facingAngle = ang;
        p.momentumTimer = 0.14;
        p.momentumDirX = Math.cos(ang);
        p.momentumDirY = Math.sin(ang);
        p.superArmorTimer = 0.22;

        audio.playExplosion(1.25);
        state.hitstopTimer = CONFIG.HITSTOP_DURATION;
        ctx.triggerScreenShake(7, 0.16);

        [-11, 11].forEach((armOffset) => {
          state.slashEffects.push({
            x: p.x + Math.cos(perp) * armOffset,
            y: p.y + Math.sin(perp) * armOffset,
            angle: ang,
            range: 125,
            color: '#F5C518',
            armColor: '#FFCC80',
            armOffset,
            isRubberArm: true,
            isBazookaPalm: true,
            followPlayer: true,
            life: 0.20,
            maxLife: 0.20,
            type: 'stretch'
          });
        });
        state.slashEffects.push({
          x: p.x + Math.cos(ang) * 20,
          y: p.y + Math.sin(ang) * 20,
          angle: ang,
          range: 130,
          halfAngle: Math.PI / 3.2,
          color: '#F5C518',
          life: 0.26,
          maxLife: 0.26,
          type: 'bazooka_blast'
        });
        const impactX = p.x + Math.cos(ang) * 85;
        const impactY = p.y + Math.sin(ang) * 85;
        state.slashEffects.push({
          x: impactX,
          y: impactY,
          angle: 0,
          range: 95,
          isCircular: true,
          color: '#FFF59D',
          life: 0.24,
          maxLife: 0.24,
          type: 'ring'
        });
        for (let k = 0; k < 16; k++) {
          const a = ang + (Math.random() - 0.5) * 1.1;
          const d = 35 + Math.random() * 85;
          ctx.spawnParticle(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, k % 2 === 0 ? '#F5C518' : '#FFFFFF', 5.2, 0.32);
        }

        state.enemies.forEach((en) => {
          if (en.hp <= 0) return;
          const dx = en.x - p.x;
          const dy = en.y - p.y;
          if (
            Math.hypot(dx, dy) - en.radius <= 125 &&
            Math.abs(ctx.normalizeAngle(Math.atan2(dy, dx) - ang)) <= Math.PI / 2.8
          ) {
            const { amount, isCrit } = ctx.calculatePlayerDamage(3.0, true);
            ctx.damageEnemy(en, amount, {
              isCrit,
              knockback: 320,
              sourceX: p.x,
              sourceY: p.y,
              pierceShield: Boolean(p.custom.bazookaPierceShield)
            });
          }
        });
      }
    }

    // Fase de tensión -> lanzamiento de Storm (H3)
    if (p.custom.stormWindupTimer > 0) {
      p.custom.stormWindupTimer -= dt;
      p.vx = 0;
      p.vy = 0;
      if (p.custom.stormWindupTimer <= 0) {
        p.custom.stormWindupTimer = 0;
        const ang = p.custom.stormLaunchAngle;
        p.custom.stormTimer = 1.2;
        p.custom.stormHitsLeft = 15;
        p.custom.stormTickTimer = 0;
        p.custom.stormAimAngle = ang;
        p.momentumTimer = 0.24;
        p.momentumDirX = Math.cos(ang);
        p.momentumDirY = Math.sin(ang);
        p.superArmorTimer = 1.2;
        state.hitstopTimer = CONFIG.HITSTOP_DURATION;
        audio.playExplosion(1.1);
        audio.playSlash(1.25);
        ctx.triggerScreenShake(6, 0.20);
        state.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: 0,
          range: 140,
          isCircular: true,
          color: '#F5C518',
          life: 0.28,
          maxLife: 0.28,
          type: 'ring'
        });
      }
    }

    if (p.custom.gatlingHitsLeft > 0) {
      p.custom.gatlingTickTimer -= dt;
      if (p.custom.gatlingTickTimer <= 0) {
        p.custom.gatlingTickTimer = 0.06;
        p.custom.gatlingHitsLeft--;
        audio.playPunch();

        const aimAngle = ctx.getAimAngle();
        p.facingAngle = aimAngle;
        const spreadAngle = aimAngle + (Math.random() - 0.5) * 0.6;

        state.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: spreadAngle,
          range: 180,
          color: '#F5C518',
          armColor: '#FFCC80',
          isRubberArm: true,
          followPlayer: true,
          life: 0.11,
          maxLife: 0.11,
          type: 'stretch'
        });

        state.enemies.forEach((en) => {
          const dx = en.x - p.x;
          const dy = en.y - p.y;
          if (
            Math.hypot(dx, dy) - en.radius <= 180 &&
            Math.abs(ctx.normalizeAngle(Math.atan2(dy, dx) - aimAngle)) <= Math.PI / 3.5
          ) {
            const { amount, isCrit } = ctx.calculatePlayerDamage(0.5, true);
            ctx.damageEnemy(en, amount, {
              isCrit,
              knockback: 18,
              sourceX: p.x,
              sourceY: p.y,
              applyBurn: state.mods.h1Burn
            });
          }
        });
      }
    }

    if (p.custom.stormTimer > 0) {
      p.custom.stormTimer -= dt;
      p.custom.stormTickTimer -= dt;
      // Impulso continuo hacia adelante durante Storm
      const launchAng = p.custom.stormLaunchAngle;
      const rushSpeed = p.speed * 0.95;
      p.x += Math.cos(launchAng) * rushSpeed * dt;
      p.y += Math.sin(launchAng) * rushSpeed * dt;
      if (Math.random() < 0.45 && state.afterimages.length < 24) {
        state.afterimages.push({
          x: p.x,
          y: p.y,
          angle: p.facingAngle,
          radius: p.radius,
          color: '#F5C518',
          life: 0.16,
          maxLife: 0.16
        });
      }

      if (p.custom.stormHitsLeft > 0 && p.custom.stormTickTimer <= 0) {
        p.custom.stormTickTimer = 0.075;
        p.custom.stormHitsLeft--;
        p.custom.stormAimAngle += 0.92;
        audio.playPunch(1.15);

        const radius = 155 * state.mods.h3AreaMult;
        const punchX = p.x + Math.cos(p.custom.stormAimAngle) * (radius * 0.80);
        const punchY = p.y + Math.sin(p.custom.stormAimAngle) * (radius * 0.80);

        [0, Math.PI].forEach((sideShift) => {
          state.slashEffects.push({
            x: p.x,
            y: p.y,
            angle: p.custom.stormAimAngle + sideShift,
            range: radius,
            color: '#F5C518',
            armColor: '#FFCC80',
            isRubberArm: true,
            followPlayer: true,
            life: 0.13,
            maxLife: 0.13,
            type: 'stretch'
          });
        });
        ctx.spawnParticle(punchX, punchY, '#FFF59D', 5, 0.28);

        state.enemies.forEach((en) => {
          if (en.hp <= 0) return;
          if (Math.hypot(en.x - p.x, en.y - p.y) - en.radius <= radius) {
            const { amount, isCrit } = ctx.calculatePlayerDamage(0.8, true);
            ctx.damageEnemy(en, amount, { isCrit, knockback: 42, sourceX: p.x, sourceY: p.y });
          }
        });
      }

      if (p.custom.stormTimer <= 0) {
        p.custom.stormTimer = 0;
        p.custom.stormHitsLeft = 0;
        const radius = 165 * state.mods.h3AreaMult;
        audio.playExplosion(1.15);
        ctx.triggerScreenShake(7, 0.18);
        state.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: 0,
          range: radius,
          isCircular: true,
          color: '#F5C518',
          life: 0.30,
          maxLife: 0.30,
          type: 'ring'
        });
        for (let k = 0; k < 18; k++) {
          const a = (k / 18) * Math.PI * 2;
          ctx.spawnParticle(p.x + Math.cos(a) * 55, p.y + Math.sin(a) * 55, k % 2 === 0 ? '#FFF59D' : '#F5C518', 5.5, 0.36);
        }
      }
    }
  },

  getMoveSpeedMult: (p) => (p.custom.stormTimer > 0 ? 0.45 : 1.0),
  isMovementLocked: (p) => Boolean(p.custom.bazookaWindupTimer > 0 || p.custom.stormWindupTimer > 0),
  isFacingLocked: (p) => Boolean(p.custom.stormTimer > 0 || p.custom.bazookaWindupTimer > 0 || p.custom.stormWindupTimer > 0),
  getBodyScale: (p) => {
    if (p.custom.stormWindupTimer > 0) {
      const prog = 1 - p.custom.stormWindupTimer / (p.custom.stormWindupMax || 0.26);
      return 1.0 + prog * 0.28; // Luffy toma aire (Gomu Gomu no Fusen) antes del Storm
    }
    return 1.0;
  },
  getBodySpin: (p) => (p.custom.stormTimer > 0 ? (performance.now() * 0.025) % (Math.PI * 2) : 0),

  onCleanupEffects(p) {
    p.custom.gatlingHitsLeft = 0;
    p.custom.bazookaWindupTimer = 0;
    p.custom.stormWindupTimer = 0;
    p.custom.stormTimer = 0;
    p.custom.stormHitsLeft = 0;
  },

  onBeforePlayerDamage(_ctx, _incomingDmg, isBlunt) {
    if (isBlunt) return { dmgMult: 0.80 };
    return {};
  },

  onUpgradeApplied(ctx) {
    if (hasLuffyGatlingSynergy(ctx)) {
      ctx.spawnFloatingText(ctx.player.x, ctx.player.y - 50, '⚡ SINERGIA: GATLING 15 GOLPES ⚡', '#F5C518', 1.2);
    }
  },

  drawWorldAfterPlayer({ ctx, player: p }) {
    const drawBackStretchedArms = (prog: number, angle: number, maxPull: number, ringColor: string) => {
      const pullLen = 20 + Math.pow(prog, 0.72) * maxPull;
      const perp = angle + Math.PI / 2;
      [-11, 11].forEach((offset) => {
        const sx = p.x + Math.cos(perp) * offset;
        const sy = p.y + Math.sin(perp) * offset;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle + Math.PI);

        ctx.fillStyle = '#FFCC80';
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(10, -7);
        ctx.quadraticCurveTo(pullLen * 0.5, -3.5, pullLen - 6, -6);
        ctx.lineTo(pullLen - 6, 6);
        ctx.quadraticCurveTo(pullLen * 0.5, 3.5, 10, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Puño / palma abierta tensada atrás
        ctx.fillStyle = '#FFCC80';
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(pullLen - 7, -9, 15, 18, 5);
        ctx.fill();
        ctx.stroke();

        // Líneas de tensión elástica
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(14, -9);
        ctx.lineTo(pullLen - 6, -9);
        ctx.moveTo(14, 9);
        ctx.lineTo(pullLen - 6, 9);
        ctx.stroke();
        ctx.restore();
      });
    };

    if (p.custom.bazookaWindupTimer > 0) {
      const prog = Math.max(0, Math.min(1, 1 - p.custom.bazookaWindupTimer / (p.custom.bazookaWindupMax || 0.22)));
      drawBackStretchedArms(prog, p.custom.bazookaAngle ?? p.facingAngle, 62, 'rgba(245, 197, 24, 0.85)');
    } else if (p.custom.stormWindupTimer > 0) {
      const prog = Math.max(0, Math.min(1, 1 - p.custom.stormWindupTimer / (p.custom.stormWindupMax || 0.26)));
      drawBackStretchedArms(prog, p.custom.stormLaunchAngle ?? p.facingAngle, 58, 'rgba(255, 245, 157, 0.9)');
    }
  },

  drawAura({ ctx, state, player: p, t }) {
    if (p.custom.stormWindupTimer > 0) {
      const prog = 1 - p.custom.stormWindupTimer / (p.custom.stormWindupMax || 0.26);
      ctx.strokeStyle = 'rgba(255, 245, 157, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 10 + (1 - prog) * 16, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.custom.stormTimer > 0) {
      const r = 155 * state.mods.h3AreaMult;
      const grad = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
      grad.addColorStop(0, 'rgba(255, 245, 157, 0.22)');
      grad.addColorStop(0.7, 'rgba(245, 197, 24, 0.16)');
      grad.addColorStop(1, 'rgba(245, 197, 24, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      for (let w = 0; w < 3; w++) {
        const wr = r * (0.42 + w * 0.26);
        const startA = t * (4.5 + w * 1.5) + w * 2.1;
        ctx.strokeStyle = w % 2 === 0 ? 'rgba(245, 197, 24, 0.78)' : 'rgba(255, 255, 255, 0.72)';
        ctx.lineWidth = 4 - w * 0.7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, wr, startA, startA + Math.PI * 1.3);
        ctx.stroke();
      }
    }
  },

  drawBody({ ctx, player: p, t }) {
    const isMoving = Math.hypot(p.vx, p.vy) > 15;
    const swingSpeed = isMoving ? t * 2.6 : t * 1.1;
    const armSwing = Math.sin(swingSpeed) * (isMoving ? 6.5 : 3.0);

    ctx.fillStyle = '#FFCC80';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-4 + armSwing, -26, 12, 8, 4);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-4 - armSwing, 18, 12, 8, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#C8102E';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F5C518';
    ctx.beginPath();
    ctx.arc(-1, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#C8102E';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(-1, 0, 11.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(-1, 0, 9.5, 0, Math.PI * 2);
    ctx.fill();
  },

  drawPreview(pctx, t) {
    const armSwing = Math.sin(t * 1.4) * 3.5;
    pctx.fillStyle = '#FFCC80';
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.arc(-14, 2 + armSwing, 4.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
    pctx.beginPath();
    pctx.arc(14, 2 - armSwing, 4.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#C8102E';
    pctx.beginPath();
    pctx.arc(0, 1, 13, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#F5C518';
    pctx.beginPath();
    pctx.ellipse(0, -6, 17, 7, 0, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#E6B400';
    pctx.beginPath();
    pctx.arc(0, -9, 9.5, Math.PI, 0);
    pctx.fill();
    pctx.stroke();

    pctx.strokeStyle = '#C8102E';
    pctx.lineWidth = 2.8;
    pctx.beginPath();
    pctx.moveTo(-9.5, -8.5);
    pctx.lineTo(9.5, -8.5);
    pctx.stroke();
  }
};
