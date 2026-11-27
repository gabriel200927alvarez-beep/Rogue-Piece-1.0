import { CONFIG } from '../config';
import type { CharacterModule } from './types';

export const sanjiCharacter: CharacterModule = {
  id: 'sanji',
  name: 'SANJI',
  rarity: 'novato',
  portrait: '🔥',
  portraitBg: '#1C2833',
  attackIcon: '🦵',
  themeClass: 'theme-sanji',
  color: '#FFA726',
  vestColor: '#1C2833',
  hp: 115,
  damage: 21,
  speed: 6.4,
  armor: 5.5,
  dashCd: 1.7,
  skills: [
    { name: 'Diable', icon: '🔥', cd: 4.5 },
    { name: 'Concasse', icon: '☄️', cd: 6.0 },
    { name: 'Diable Jambe: Barrage', icon: '🔥', cd: 9.5 }
  ],
  cardMeta: {
    epithet: 'Pierna Negra',
    nameColor: '#FFA726',
    role: 'DPS Móvil / Evasivo',
    passiveText: 'Pasiva: +15% vel. tras dash',
    passiveColor: '#FFCC80',
    stats: { hp: 61, dmg: 76, vel: 91, arm: 23 },
    comboDesc: 'Recta (95px), Arco (110px), Descendente (onda 110px).',
    skillsDesc: '<b>H1:</b> 8 patadas + fuego • <b>H2:</b> Aturde • <b>H3:</b> Diable Jambe: Barrage (quema).'
  },

  createCustomState: () => ({
    diableHitsLeft: 0,
    diableTickTimer: 0,
    ifritShotsLeft: 0,
    ifritTickTimer: 0,
    ifritCycleIndex: 0
  }),

  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const step = p.comboStep;
    p.comboStep = (p.comboStep + 1) % 3;
    p.comboResetTimer = CONFIG.COMBO_RESET_TIME;
    p.attackCooldown = step === 2 ? 0.34 : 0.21;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = 0.22;

    if (step === 2) {
      p.momentumTimer = 0.10;
      p.momentumDirX = Math.cos(aimAngle);
      p.momentumDirY = Math.sin(aimAngle);
      p.superArmorTimer = 0.15;
    }

    if (step === 0) {
      audio.playKick();
      const rightOffset = aimAngle + Math.PI / 2;
      state.slashEffects.push({
        x: p.x + Math.cos(rightOffset) * 7,
        y: p.y + Math.sin(rightOffset) * 7,
        angle: aimAngle,
        range: 95,
        armOffset: 7,
        followPlayer: true,
        isFire: false,
        color: '#FFA726',
        life: 0.16,
        maxLife: 0.16,
        type: 'sanji_kick_thrust'
      });
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 95, (20 * Math.PI) / 180, 1.0, 30);
    } else if (step === 1) {
      audio.playKick();
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range: 110,
        isFire: false,
        color: '#FFA726',
        life: 0.19,
        maxLife: 0.19,
        type: 'sanji_kick_arc'
      });
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 110, Math.PI / 4, 1.1, 45);
    } else {
      audio.playExplosion(1.35);
      const impactX = p.x + Math.cos(aimAngle) * 60;
      const impactY = p.y + Math.sin(aimAngle) * 60;
      state.slashEffects.push({
        x: impactX,
        y: impactY,
        angle: aimAngle,
        range: 110,
        isCircular: true,
        isFire: false,
        color: '#FFA726',
        life: 0.28,
        maxLife: 0.28,
        type: 'sanji_heel_drop'
      });
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        ctx.spawnParticle(impactX + Math.cos(a) * 35, impactY + Math.sin(a) * 35, k % 2 === 0 ? '#FFD54F' : '#FFFFFF', 4.2, 0.26);
      }
      const hitConnected = ctx.damageEnemiesInCircle(impactX, impactY, 110, 1.6, 40);
      if (hitConnected) {
        state.hitstopTimer = CONFIG.HITSTOP_DURATION;
        ctx.triggerHaptic(10);
      }
    }
  },

  onDash(ctx) {
    const { player: p, audio } = ctx;
    p.customDashDist = CONFIG.DASH_DISTANCE;
    p.invulnTimer = CONFIG.DASH_IFRAMES;
    p.speedBuffTimer = 2.0;
    audio.playKick();
  },

  onSkill(ctx, idx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const pierceShield = idx === 1 && state.mods.h2PierceShield;

    if (idx === 0) {
      p.custom.diableHitsLeft = 8;
      p.custom.diableTickTimer = 0;
    } else if (idx === 1) {
      audio.playExplosion(1.25);
      audio.playFireCrackle();
      const targetX = p.x + Math.cos(aimAngle) * 65;
      const targetY = p.y + Math.sin(aimAngle) * 65;
      state.hitstopTimer = CONFIG.HITSTOP_DURATION;
      ctx.triggerScreenShake(6, 0.14);
      state.slashEffects.push({
        x: targetX,
        y: targetY,
        angle: aimAngle,
        range: 85,
        isCircular: true,
        isFire: true,
        color: '#FF5722',
        life: 0.30,
        maxLife: 0.30,
        type: 'sanji_heel_drop'
      });
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        ctx.spawnParticle(
          targetX + Math.cos(a) * 34,
          targetY + Math.sin(a) * 34,
          k % 2 === 0 ? '#FF5722' : '#FFEB3B',
          5.2,
          0.36
        );
      }
      state.enemies.forEach((en) => {
        if (Math.hypot(en.x - targetX, en.y - targetY) - en.radius <= 85) {
          const { amount, isCrit } = ctx.calculatePlayerDamage(2.5, true);
          ctx.damageEnemy(en, amount, { isCrit, stun: 1.0, pierceShield });
        }
      });
    } else if (idx === 2) {
      p.custom.ifritShotsLeft = 6;
      p.custom.ifritTickTimer = 0;
      p.custom.ifritCycleIndex = 0;
      ctx.spawnFloatingText(p.x, p.y - 38, '🔥 ¡DIABLE JAMBE: BARRAGE!', '#FF7043', 1.2);
    }
  },

  onUpdate(ctx, dt) {
    const { state, player: p, audio } = ctx;

    if (p.custom.diableHitsLeft > 0) {
      p.custom.diableTickTimer -= dt;
      if (p.custom.diableTickTimer <= 0) {
        p.custom.diableTickTimer = 0.055;
        p.custom.diableHitsLeft--;
        const isLast = p.custom.diableHitsLeft === 0;
        audio.playKick();
        if (p.custom.diableHitsLeft % 2 === 0) audio.playFireCrackle();

        const aimAngle = ctx.getAimAngle();
        p.facingAngle = aimAngle;
        const spreadAngle = aimAngle + (Math.random() - 0.5) * (Math.PI / 2);
        const legOffset = (p.custom.diableHitsLeft % 2 === 0 ? 1 : -1) * 8;
        const perp = spreadAngle + Math.PI / 2;

        state.slashEffects.push({
          x: p.x + Math.cos(perp) * legOffset,
          y: p.y + Math.sin(perp) * legOffset,
          angle: spreadAngle,
          range: 105,
          armOffset: legOffset,
          followPlayer: true,
          isFire: true,
          color: '#FF5722',
          life: 0.14,
          maxLife: 0.14,
          type: 'sanji_kick_thrust'
        });
        for (let k = 0; k < 2; k++) {
          ctx.spawnParticle(
            p.x + Math.cos(spreadAngle) * (45 + k * 25),
            p.y + Math.sin(spreadAngle) * (45 + k * 25),
            k === 0 ? '#FF5722' : '#FFEB3B',
            4.8,
            0.32
          );
        }

        state.enemies.forEach((en) => {
          const dx = en.x - p.x;
          const dy = en.y - p.y;
          if (
            Math.hypot(dx, dy) - en.radius <= 105 &&
            Math.abs(ctx.normalizeAngle(Math.atan2(dy, dx) - aimAngle)) <= Math.PI / 4
          ) {
            const { amount, isCrit } = ctx.calculatePlayerDamage(0.4, true);
            ctx.damageEnemy(en, amount, { isCrit, applyBurn: isLast });
          }
        });
      }
    }

    if (p.custom.ifritShotsLeft > 0) {
      p.custom.ifritTickTimer -= dt;
      if (p.custom.ifritTickTimer <= 0) {
        p.custom.ifritTickTimer = 0.18;
        p.custom.ifritShotsLeft--;
        audio.playKick();
        audio.playFwoosh();

        const inRange = state.enemies
          .filter((en) => en.hp > 0 && Math.hypot(en.x - p.x, en.y - p.y) <= 300)
          .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));

        let targetAng = p.facingAngle;
        if (inRange.length > 0) {
          const chosen = inRange[p.custom.ifritCycleIndex % inRange.length];
          p.custom.ifritCycleIndex++;
          targetAng = Math.atan2(chosen.y - p.y, chosen.x - p.x);
          p.facingAngle = targetAng;
        }

        const footX = p.x + Math.cos(targetAng) * 18;
        const footY = p.y + Math.sin(targetAng) * 18;
        state.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: targetAng,
          range: 82,
          isFire: true,
          color: '#FF5722',
          life: 0.16,
          maxLife: 0.16,
          type: 'sanji_kick_arc'
        });
        for (let k = 0; k < 4; k++) {
          ctx.spawnParticle(footX, footY, k % 2 === 0 ? '#FF5722' : '#FFEB3B', 5.5, 0.34);
        }

        state.projectiles.push({
          fromPlayer: true,
          x: footX,
          y: footY,
          vx: Math.cos(targetAng) * 600,
          vy: Math.sin(targetAng) * 600,
          curveSign: (p.custom.ifritShotsLeft % 2 === 0 ? 1 : -1) * 180,
          traveled: 0,
          maxRange: 300,
          radius: 11,
          dmgMult: 1.5,
          hitIds: [],
          life: 0.55,
          color: '#FF5722',
          type: 'diable_comet'
        });
      }
    }
  },

  onShouldIgnoreTarget(_p, en, isSkill) {
    if (!isSkill && en.isFemale) {
      return { ignore: true, text: '¡No pateo damas! ♥', color: '#FF80AB' };
    }
    return { ignore: false };
  },

  drawBody({ ctx, player: p, cfg, t }) {
    const isDiableActive = p.custom.diableHitsLeft > 0 || p.custom.ifritShotsLeft > 0;
    const isKicking = p.attackAnimTimer > 0 || isDiableActive;

    // Pierna pateando visible al atacar o usar Diable Jambe
    if (isKicking) {
      const swing = isDiableActive ? Math.sin(t * 20) * 6 : Math.sin((p.attackAnimTimer / 0.22) * Math.PI) * 5;
      ctx.save();
      ctx.fillStyle = '#1C2833';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(6, 5 + swing * 0.4, 18, 7, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.roundRect(20, 4 + swing * 0.4, 9, 8, 3);
      ctx.fill();
      ctx.stroke();
      if (isDiableActive) {
        ctx.fillStyle = 'rgba(255, 87, 34, 0.78)';
        ctx.beginPath();
        ctx.arc(24, 8 + swing * 0.4, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFEB3B';
        ctx.beginPath();
        ctx.arc(25, 8 + swing * 0.4, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.fillStyle = cfg.vestColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FDD835';
    ctx.beginPath();
    ctx.arc(2, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  },

  drawPreview(pctx, t, cfg) {
    const kickSwing = Math.sin(t * 1.6) * 3;
    pctx.fillStyle = cfg.vestColor;
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.arc(0, 1, 13, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
    pctx.fillStyle = '#FF7043';
    pctx.beginPath();
    pctx.arc(11, 9 + kickSwing, 5.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.fillStyle = '#FDD835';
    pctx.beginPath();
    pctx.arc(0, -5, 9.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
  }
};
