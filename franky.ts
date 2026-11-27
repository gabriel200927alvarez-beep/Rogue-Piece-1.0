import { CONFIG } from '../config';
import { calculateFrankyCoupDeVentScaling } from '../rules';
import type { CharacterModule } from './types';

export const frankyCharacter: CharacterModule = {
  id: 'franky',
  name: 'FRANKY',
  rarity: 'pirata',
  portrait: '🤖',
  portraitBg: '#00838F',
  attackIcon: '🦾',
  themeClass: 'theme-franky',
  color: '#00E5FF',
  vestColor: '#00838F',
  hp: 160,
  damage: 21.5,
  speed: 4.1,
  armor: 22,
  dashCd: 2.5,
  skills: [
    { name: 'Radical', icon: '⚡', cd: 5.2 },
    { name: 'Hammer', icon: '🔨', cd: 6.2 },
    { name: 'CoupVent', icon: '🌪️', cd: 9.5 }
  ],
  cardMeta: {
    epithet: 'El Cyborg',
    nameColor: '#00E5FF',
    role: 'Tanque Ofensivo Cyborg',
    passiveText: 'Pasiva: Cola +5/golpe (50=+30% hab)',
    passiveColor: '#84FFFF',
    stats: { hp: 94, dmg: 86, vel: 59, arm: 100 },
    comboDesc: '2 golpes + Strong Right (cadena 120px 2×). Dash: 100px.',
    skillsDesc: '<b>H1:</b> Láser largo • <b>H2:</b> Martillo aturde • <b>H3:</b> Cono viento empuja.'
  },

  createCustomState: () => ({
    cola: 0,
    maxCola: 50,
    strongRightTimer: 0,
    strongRightAngle: 0,
    radicalChargeTimer: 0,
    radicalChargeMax: 0.42,
    radicalChargeAngle: 0,
    radicalColaMult: 1.0,
    radicalRecoilTimer: 0
  }),

  isFacingLocked: (p) => (p.custom.radicalChargeTimer || 0) > 0,

  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const step = p.comboStep;
    p.comboStep = (p.comboStep + 1) % 3;
    p.attackCooldown = 0.50;
    p.comboResetTimer = 0.90;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = 0.22;

    if (step === 2) {
      p.momentumTimer = 0.10;
      p.momentumDirX = Math.cos(aimAngle);
      p.momentumDirY = Math.sin(aimAngle);
      p.superArmorTimer = 0.15;
    }

    if (step === 0) {
      audio.playPunch(0.75);
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range: 85,
        color: '#00BCD4',
        life: 0.2,
        maxLife: 0.2,
        type: 'arc'
      });
      const hitConnected = ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 85, Math.PI / 3.0, 1.2, 95);
      if (hitConnected) {
        state.hitstopTimer = 0.07;
        ctx.triggerHaptic(12);
      }
    } else if (step === 1) {
      audio.playMetalClank();
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range: 85,
        color: '#90A4AE',
        life: 0.22,
        maxLife: 0.22,
        type: 'arc_left'
      });
      const hitConnected = ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 85, Math.PI / 2.8, 1.2, 115);
      if (hitConnected) {
        state.hitstopTimer = 0.07;
        ctx.triggerHaptic(14);
      }
    } else {
      audio.playMetalClank();
      audio.playExplosion(1.1);
      p.custom.strongRightTimer = 0.40;
      p.custom.strongRightAngle = aimAngle;
      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range: 120,
        color: '#00E5FF',
        life: 0.35,
        maxLife: 0.35,
        type: 'strong_right_chain'
      });
      const hitConnected = ctx.damageEnemiesInLine(p.x, p.y, aimAngle, 120, 28, 2.0, 165, false);
      if (hitConnected) {
        state.hitstopTimer = 0.07;
        ctx.triggerScreenShake(5, 0.14);
        ctx.triggerHaptic(16);
      }
    }
  },

  onDash(ctx) {
    const { player: p, audio } = ctx;
    p.customDashDist = 100;
    p.invulnTimer = 0.20;
    audio.playDash();
    audio.playMetalClank();
    for (let i = 0; i < 8; i++) ctx.spawnParticle(p.x, p.y, '#FFD54F', 4, 0.3);
  },

  onSkill(ctx, idx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const areaMult = idx === 2 ? state.mods.h3AreaMult : 1.0;

    if (idx === 0 || idx === 1) {
      let frankyColaMult = 1.0;
      if (p.custom.cola >= p.custom.maxCola) {
        frankyColaMult = 1.30;
        p.custom.cola = 0;
        ctx.updateHUD();
        ctx.spawnFloatingText(p.x, p.y - 44, '🥤 ¡SUPER COLA +30%!', '#00E5FF', 1.2);
      }

      if (idx === 0) {
        audio.playLaserCharge();
        p.custom.radicalChargeMax = 0.42;
        p.custom.radicalChargeTimer = 0.42;
        p.custom.radicalChargeAngle = aimAngle;
        p.custom.radicalColaMult = frankyColaMult;
        p.facingAngle = aimAngle;
        ctx.spawnFloatingText(p.x, p.y - 42, '⚡ ¡RADICAL BEAM!', '#00E5FF', 1.25);
      } else {
        audio.playExplosion(0.8);
        state.hitstopTimer = 0.07;
        ctx.triggerScreenShake(6, 0.16);
        const hx = p.x + Math.cos(aimAngle) * 60;
        const hy = p.y + Math.sin(aimAngle) * 60;
        state.slashEffects.push({
          x: hx,
          y: hy,
          angle: 0,
          range: 140,
          isCircular: true,
          color: '#E0E0E0',
          life: 0.28,
          maxLife: 0.28,
          type: 'ring'
        });
        for (let k = 0; k < 14; k++) ctx.spawnParticle(hx, hy, '#CFD8DC', 6, 0.4);
        ctx.damageEnemiesInCircle(hx, hy, 140, 2.0 * frankyColaMult, 125, true, 0.8);
      }
    } else if (idx === 2) {
      const scaling = calculateFrankyCoupDeVentScaling(p.custom.cola || 0, p.custom.maxCola || 50);
      if (scaling.colaSpent > 0) {
        p.custom.cola = 0;
        ctx.updateHUD();
      }

      audio.playExplosion(0.95);
      ctx.triggerScreenShake(7, 0.24);
      const range = 310 * areaMult * scaling.rangeMult;
      const halfAng = (Math.PI / 3.1) * scaling.angleMult;
      const dmgMult = 1.65 * scaling.dmgMult;

      state.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range,
        halfAngle: halfAng,
        color: '#E0F7FA',
        life: 0.34,
        maxLife: 0.34,
        type: 'coup_de_vent'
      });
      for (let k = 0; k < 18; k++) {
        const a = aimAngle + (Math.random() - 0.5) * halfAng * 1.8;
        const d = 40 + Math.random() * (range * 0.85);
        ctx.spawnParticle(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, '#84FFFF', 5, 0.38);
      }
      state.enemies.forEach((en) => {
        if (en.hp <= 0) return;
        const dx = en.x - p.x;
        const dy = en.y - p.y;
        if (
          Math.hypot(dx, dy) - en.radius <= range &&
          Math.abs(ctx.normalizeAngle(Math.atan2(dy, dx) - aimAngle)) <= halfAng
        ) {
          const { amount, isCrit } = ctx.calculatePlayerDamage(dmgMult, true);
          ctx.damageEnemy(en, amount, { isCrit, knockback: 240, sourceX: p.x, sourceY: p.y });
        }
      });
      const colaPct = Math.round((scaling.dmgMult - 1) * 100);
      const label = scaling.colaSpent > 0
        ? `🌪️ ¡COUP DE VENT (+${colaPct}% COLA)!`
        : '🌪️ ¡COUP DE VENT!';
      ctx.spawnFloatingText(p.x, p.y - 38, label, '#84FFFF', 1.25);
    }
  },

  onUpdate(ctx, dt) {
    const { state, player: p, audio } = ctx;
    if (p.custom.strongRightTimer > 0) p.custom.strongRightTimer -= dt;
    if (p.custom.radicalRecoilTimer > 0) p.custom.radicalRecoilTimer = Math.max(0, p.custom.radicalRecoilTimer - dt);
    if (p.custom.radicalChargeTimer > 0) {
      p.custom.radicalChargeTimer -= dt;
      const ang = p.custom.radicalChargeAngle;
      const muzzleX = p.x + Math.cos(ang) * 28;
      const muzzleY = p.y + Math.sin(ang) * 28;
      if (Math.random() < 0.85) {
        const sa = Math.random() * Math.PI * 2;
        const dist = 24 + Math.random() * 26;
        ctx.spawnParticle(
          muzzleX + Math.cos(sa) * dist,
          muzzleY + Math.sin(sa) * dist,
          Math.random() < 0.5 ? '#00E5FF' : '#FFFFFF',
          4,
          0.20,
          { vx: -Math.cos(sa) * 95, vy: -Math.sin(sa) * 95 }
        );
      }
      if (p.custom.radicalChargeTimer <= 0) {
        p.custom.radicalChargeTimer = 0;
        p.custom.radicalRecoilTimer = 0.24;
        audio.playExplosion(1.25);
        ctx.triggerScreenShake(9, 0.22);
        state.hitstopTimer = 0.06;
        const mult = 2.6 * (p.custom.radicalColaMult || 1.0);
        const beamLength = 580;
        state.slashEffects.push({
          x: muzzleX,
          y: muzzleY,
          angle: ang,
          range: beamLength,
          width: 42,
          color: '#00E5FF',
          life: 0.42,
          maxLife: 0.42,
          type: 'radical_beam'
        });
        state.slashEffects.push({
          x: muzzleX,
          y: muzzleY,
          angle: 0,
          range: 75,
          isCircular: true,
          color: '#84FFFF',
          life: 0.28,
          maxLife: 0.28,
          type: 'ring'
        });
        for (let k = 0; k < 20; k++) {
          const frac = (k + 0.5) / 20;
          const bx = muzzleX + Math.cos(ang) * beamLength * frac;
          const by = muzzleY + Math.sin(ang) * beamLength * frac;
          ctx.spawnParticle(
            bx + (Math.random() - 0.5) * 24,
            by + (Math.random() - 0.5) * 24,
            k % 2 === 0 ? '#00E5FF' : '#FFFFFF',
            5.5,
            0.34
          );
        }
        ctx.damageEnemiesInLine(p.x, p.y, ang, beamLength + 24, 22, mult, 95, true);
      }
    }
  },

  onAfterDamageEnemy(ctx, _en, opts) {
    if (opts.isNormalAttack) {
      const p = ctx.player;
      p.custom.cola = Math.min(p.custom.maxCola, p.custom.cola + 5);
      ctx.updateHUD();
    }
  },

  mountHUD(slotEl) {
    slotEl.innerHTML = `
      <div id="franky-cola-hud" class="char-resource-hud" style="display:flex;">
        <span style="font-size:11px;">🥤</span>
        <div class="res-bar-outer">
          <div id="hud-cola-fill" class="res-bar-fill"></div>
        </div>
        <span id="hud-cola-text" class="res-text text-outline-sm">0/50</span>
      </div>
    `;
  },

  updateHUD(p) {
    const container = document.getElementById('franky-cola-hud');
    if (!container) return;
    container.style.display = 'flex';
    const cola = p.custom.cola || 0;
    const maxCola = p.custom.maxCola || 50;
    const pct = Math.min(100, (cola / maxCola) * 100);
    const fill = document.getElementById('hud-cola-fill');
    const text = document.getElementById('hud-cola-text');
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.textContent = `${cola}/${maxCola}`;
    if (cola >= maxCola) container.classList.add('cola-full');
    else container.classList.remove('cola-full');
  },

  drawAura({ ctx, player: p, t }) {
    if (p.custom.cola >= p.custom.maxCola) {
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.75)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 7 + Math.sin(t * 2) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  drawWorldAfterPlayer({ ctx, player: p, t }) {
    if (p.custom.radicalChargeTimer > 0) {
      const maxT = p.custom.radicalChargeMax || 0.42;
      const prog = Math.max(0, Math.min(1, 1 - p.custom.radicalChargeTimer / maxT));
      const ang = p.custom.radicalChargeAngle;
      const mx = p.x + Math.cos(ang) * 28;
      const my = p.y + Math.sin(ang) * 28;

      ctx.save();
      // Línea guía de puntería antes del disparo
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.22 + prog * 0.45})`;
      ctx.lineWidth = 2 + prog * 3;
      ctx.setLineDash([12, 10]);
      ctx.lineDashOffset = -t * 28;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(580, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Anillos convergentes de carga + esfera de energía en las manos
      const orbR = 6 + prog * 15;
      const ringR = (1 - prog * 0.68) * 44;
      ctx.strokeStyle = 'rgba(132, 255, 255, 0.85)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(mx, my, ringR, t * 2, t * 2 + Math.PI * 1.45);
      ctx.stroke();

      const grad = ctx.createRadialGradient(mx, my, 2, mx, my, orbR * 1.8);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.45, '#00E5FF');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mx, my, orbR * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Destello estrella Franky
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.2;
      for (let s = 0; s < 4; s++) {
        const sa = t * 1.8 + (s * Math.PI) / 2;
        const sr = orbR * 1.5;
        ctx.beginPath();
        ctx.moveTo(mx + Math.cos(sa) * 4, my + Math.sin(sa) * 4);
        ctx.lineTo(mx + Math.cos(sa) * sr, my + Math.sin(sa) * sr);
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  drawBody({ ctx, player: p, t }) {
    const breath = Math.sin(t * 0.8) * 1.2;
    const isCharging = (p.custom.radicalChargeTimer || 0) > 0;
    const isRecoil = (p.custom.radicalRecoilTimer || 0) > 0;
    const recoilShift = isRecoil ? -5 * (p.custom.radicalRecoilTimer / 0.24) : 0;

    ctx.save();
    ctx.translate(recoilShift, 0);

    ctx.fillStyle = '#00BCD4';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-16, -21 - breath * 0.5, 32, 42 + breath, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#D32F2F';
    ctx.fillRect(-6, -15, 12, 30);

    if (isCharging || isRecoil) {
      // Pose clásica Radical Beam: ambos brazos robóticos unidos al frente
      const fwd = isCharging ? 18 : 22;
      [-10, 10].forEach((sideY) => {
        ctx.fillStyle = '#616161';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(fwd, sideY, 11.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#00E5FF';
        ctx.fillRect(fwd - 3, sideY - 3, 6, 6);
      });
    } else {
      const armExtend = p.custom.strongRightTimer > 0 ? 22 : Math.sin(t) * 2;
      ctx.fillStyle = '#616161';
      ctx.beginPath();
      ctx.arc(12 + armExtend, 16, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#D32F2F';
      ctx.fillRect(8 + armExtend, 12, 8, 8);
    }

    ctx.fillStyle = '#4DD0E1';
    ctx.beginPath();
    ctx.roundRect(-4, -11, 14, 22, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  drawPreview(pctx) {
    pctx.fillStyle = '#00BCD4';
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.fillRect(-13, -9, 26, 22);
    pctx.strokeRect(-13, -9, 26, 22);
    pctx.fillStyle = '#616161';
    pctx.beginPath();
    pctx.arc(14, 2, 9.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
    pctx.fillStyle = '#D32F2F';
    pctx.fillRect(10, -1, 7, 5);
    pctx.fillStyle = '#4DD0E1';
    pctx.fillRect(-9, -16, 18, 7);
  }
};
