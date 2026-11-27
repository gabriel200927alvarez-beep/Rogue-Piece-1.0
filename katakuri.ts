import { CONFIG } from '../config';
import { resolveKatakuriFutureSight } from '../rules';
import type { CharacterContext, CharacterModule } from './types';

// ============================================================================
// CHARLOTTE KATAKURI — Shichibukai · Comandante Dulce · Mochi Mochi no Mi
// ============================================================================

interface MochiFistStrike {
  kind: 'thrust' | 'donut_punch' | 'square_slam' | 'buzz_mace';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angle: number;
  width: number;
  life: number;
  maxLife: number;
}

interface MochiDonutPortal {
  x: number;
  y: number;
  angle: number;
  fireDelay: number;
  fired: boolean;
  life: number;
  maxLife: number;
}

interface MochiZone {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  tick: number;
  isAwakening?: boolean;
}

interface MochiRingVFX {
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

function addMochi(ctx: CharacterContext, amount: number): void {
  const p = ctx.player;
  const prev = p.custom.mochi || 0;
  p.custom.mochi = Math.min(100, prev + amount);
  if (prev < 100 && p.custom.mochi >= 100) {
    ctx.audio.playShing();
    ctx.spawnFloatingText(p.x, p.y - 48, '🍩 ¡MOCHI AL MÁXIMO!', '#E040FB', 1.15);
  }
}

function pushStrike(
  p: CharacterContext['player'],
  strike: Omit<MochiFistStrike, 'maxLife'>
): void {
  const arr: MochiFistStrike[] = p.custom.strikes;
  if (arr.length >= 14) arr.shift();
  arr.push({ ...strike, maxLife: strike.life });
}

function pushRing(p: CharacterContext['player'], x: number, y: number, radius: number, color = '#E040FB', life = 0.3): void {
  const arr: MochiRingVFX[] = p.custom.rings;
  if (arr.length >= 12) arr.shift();
  arr.push({ x, y, radius, color, life, maxLife: life });
}

function pushMochiZone(
  p: CharacterContext['player'],
  x: number,
  y: number,
  radius: number,
  life: number,
  isAwakening = false
): void {
  const zones: MochiZone[] = p.custom.mochiZones;
  if (zones.length >= 10) zones.shift();
  zones.push({
    x: clampX(x, 24),
    y: clampY(y, 24),
    radius,
    life,
    maxLife: life,
    tick: 0.35,
    isAwakening
  });
}

export const katakuriCharacter: CharacterModule = {
  id: 'katakuri',
  name: 'Katakuri',
  faction: 'pirates',
  rarity: 'shichibukai',
  portrait: '🍩',
  portraitBg: 'linear-gradient(135deg, #6A1B9A 0%, #B71C1C 60%, #1C1C22 100%)',
  attackIcon: '🔱',
  themeClass: 'theme-katakuri',
  color: '#E040FB',
  vestColor: '#1E1B24',
  hp: 112,
  damage: 17.5,
  speed: 5.5,
  armor: 10,
  dashCd: 1.6,
  autoAimRange: 320,
  skills: [
    { name: 'Donuts', icon: '🍩', cd: 7.5 },
    { name: 'Mogura', icon: '🔱', cd: 6.5 },
    { name: 'Mochi Zone', icon: '🌀', cd: 11.5 }
  ],
  cardMeta: {
    displayName: 'KATAKURI',
    zarparName: 'KATAKURI',
    epithet: 'Comandante Dulce · Tridente Mogura',
    nameColor: '#EA80FC',
    role: 'Shichibukai Duelista / Visión Futura',
    passiveText: 'Pasiva: Visión Futura (esquiva 100% 1 golpe cada 7s; 3.5s en Despertar + contraataque)',
    passiveColor: '#FFE0B2',
    stats: { hp: 82, dmg: 92, vel: 85, arm: 78 },
    comboDesc:
      '<b>Combo 4 golpes Mochi:</b> Estocada Mogura (175px) → Yanagi Mochi (5 tentáculos) → <b>Kaku Mochi</b> (puño cuadrado) → <b>Zangiri Mochi</b> (rueda giratoria + maza).',
    skillsDesc:
      '<b>H1:</b> Peerless Donuts (4 portales disparan puños Haki 300px) • <b>H2:</b> Mogura Mole (embestida taladro 260px) • <b>H3:</b> Mochi World (Despertar 260px x 7s).'
  },

  // ==========================================================================
  // ESTADO PROPIO Y LIMPIEZA
  // ==========================================================================
  createCustomState: () => ({
    mochi: 0,
    futureSightCd: 0,
    awakeningTimer: 0,
    buzzRollTimer: 0,
    strikes: [] as MochiFistStrike[],
    donuts: [] as MochiDonutPortal[],
    mochiZones: [] as MochiZone[],
    rings: [] as MochiRingVFX[]
  }),

  onCleanupEffects(p) {
    p.custom.awakeningTimer = 0;
    p.custom.buzzRollTimer = 0;
    p.custom.strikes = [];
    p.custom.donuts = [];
    p.custom.mochiZones = [];
    p.custom.rings = [];
  },

  getBodySpin(p) {
    if ((p.custom.buzzRollTimer || 0) > 0) {
      return (1 - p.custom.buzzRollTimer / 0.24) * Math.PI * 4;
    }
    return 0;
  },

  getMoveSpeedMult(p) {
    return (p.custom.awakeningTimer || 0) > 0 ? 1.18 : 1.0;
  },

  // ==========================================================================
  // PASIVA: VISIÓN FUTURA (ESQUIVA PERFECTA CON CUERPO DE MOCHI + CONTRAATAQUE)
  // ==========================================================================
  onBeforePlayerDamage(ctx, _incomingDmg, _isBlunt, attacker) {
    const p = ctx.player;
    const awakeningActive = (p.custom.awakeningTimer || 0) > 0;
    const res = resolveKatakuriFutureSight(p.custom.futureSightCd || 0, awakeningActive);
    if (res.evaded) {
      p.custom.futureSightCd = res.nextCooldown;
      p.invulnTimer = Math.max(p.invulnTimer, 0.45);
      ctx.audio.playShing();
      pushRing(p, p.x, p.y, 110, '#EA80FC', 0.3);
      ctx.spawnFloatingText(p.x, p.y - 50, '👁️ ¡VISIÓN FUTURA!', '#EA80FC', 1.25);

      if (attacker && attacker.hp > 0) {
        const ang = Math.atan2(attacker.y - p.y, attacker.x - p.x);
        const x2 = clampX(p.x + Math.cos(ang) * 185);
        const y2 = clampY(p.y + Math.sin(ang) * 185);
        pushStrike(p, { kind: 'thrust', x1: p.x, y1: p.y, x2, y2, angle: ang, width: 22, life: 0.22 });
        const { amount } = ctx.calculatePlayerDamage(1.35, true, true);
        ctx.damageEnemy(attacker, amount, { isCrit: true, knockback: 50, sourceX: p.x, sourceY: p.y });
      }
      ctx.updateHUD();
      return { cancelled: true, dmgMult: 0 };
    }
    return {};
  },

  onAfterDamageEnemy(ctx) {
    addMochi(ctx, 6);
    ctx.updateHUD();
  },

  onEnemyKilled(ctx) {
    addMochi(ctx, 12);
    ctx.updateHUD();
  },

  // ==========================================================================
  // COMBO BÁSICO (4 GOLPES — MOGURA + MOCHI ELÁSTICO + ZANGIRI MOCHI)
  // ==========================================================================
  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const step = p.comboStep % 4;
    p.comboStep = (step + 1) % 4;
    p.comboResetTimer = 0.9;
    p.attackCooldown = step === 3 ? 0.34 : 0.20;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = 0.24;

    if (step === 0) {
      // Golpe 1: Estocada espiral con tridente Mogura (175px)
      audio.playSlash(1.25);
      audio.playShing();
      const x2 = clampX(p.x + Math.cos(aimAngle) * 175, 22);
      const y2 = clampY(p.y + Math.sin(aimAngle) * 175, 22);
      pushStrike(p, { kind: 'thrust', x1: p.x, y1: p.y, x2, y2, angle: aimAngle, width: 24, life: 0.2 });
      ctx.damageEnemiesInLine(p.x, p.y, aimAngle, 175, 30, 1.2, 36, false, 0, {
        isNormalAttack: true,
        ignoreArmorPct: 0.25
      });
    } else if (step === 1) {
      // Golpe 2: Yanagi Mochi — 5 brazos elásticos golpeando en abanico (165px)
      audio.playPunch(1.1);
      audio.playFwoosh();
      const fan = [-0.36, -0.18, 0, 0.18, 0.36];
      for (let i = 0; i < fan.length; i++) {
        const a = aimAngle + fan[i];
        const x2 = clampX(p.x + Math.cos(a) * 165, 20);
        const y2 = clampY(p.y + Math.sin(a) * 165, 20);
        pushStrike(p, { kind: 'donut_punch', x1: p.x, y1: p.y, x2, y2, angle: a, width: 18, life: 0.2 });
      }
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 165, Math.PI * 0.44, 1.32, 30);
    } else if (step === 2) {
      // Golpe 3: Kaku Mochi — Puño cúbico endurecido con Busoshoku (165px)
      audio.playPunch(0.8);
      audio.playExplosion(0.95);
      ctx.triggerScreenShake(5, 0.14);
      const cx = clampX(p.x + Math.cos(aimAngle) * 115, 24);
      const cy = clampY(p.y + Math.sin(aimAngle) * 115, 24);
      pushStrike(p, { kind: 'square_slam', x1: p.x, y1: p.y, x2: cx, y2: cy, angle: aimAngle, width: 48, life: 0.24 });
      pushRing(p, cx, cy, 102, '#1A1A22', 0.25);
      ctx.damageEnemiesInCircle(cx, cy, 105, 1.55, 68, false, 0.45);
    } else {
      // Golpe 4 (Finisher): ZANGIRI MOCHI (Buzz Cut Mochi) — Rueda giratoria + maza gigante con pinchos
      p.custom.buzzRollTimer = 0.24;
      p.momentumTimer = 0.14;
      p.momentumDirX = Math.cos(aimAngle);
      p.momentumDirY = Math.sin(aimAngle);
      audio.playExplosion(1.35);
      audio.playRoar();
      ctx.triggerScreenShake(8, 0.2);
      ctx.triggerHaptic(22);
      state.hitstopTimer = 0.06;

      const cx = clampX(p.x + Math.cos(aimAngle) * 90, 28);
      const cy = clampY(p.y + Math.sin(aimAngle) * 90, 28);
      pushStrike(p, { kind: 'buzz_mace', x1: p.x, y1: p.y, x2: cx, y2: cy, angle: aimAngle, width: 64, life: 0.30 });
      pushRing(p, cx, cy, 155, '#E040FB', 0.34);
      pushMochiZone(p, cx, cy, 92, 3.0, false);
      ctx.damageEnemiesInCircle(cx, cy, 155, 2.35, 110, false, 0.65, {
        ignoreArmorPct: 0.4
      });
    }
  },

  // ==========================================================================
  // HABILIDADES H1 / H2 / H3
  // ==========================================================================
  onSkill(ctx, idx, aimAngle) {
    const { state, player: p, audio } = ctx;

    if (idx === 0) {
      // H1: PEERLESS DONUTS — Invoca 4 donas flotantes que disparan enormes puños Mochi Haki (300px)
      audio.playShing();
      const perp = aimAngle + Math.PI / 2;
      const offsets = [-56, -20, 20, 56];
      for (let i = 0; i < offsets.length; i++) {
        const dx = clampX(p.x - Math.cos(aimAngle) * 28 + Math.cos(perp) * offsets[i]);
        const dy = clampY(p.y - Math.sin(aimAngle) * 28 + Math.sin(perp) * offsets[i]);
        p.custom.donuts.push({
          x: dx,
          y: dy,
          angle: aimAngle,
          fireDelay: 0.1 + i * 0.14,
          fired: false,
          life: 0.85,
          maxLife: 0.85
        });
      }
      ctx.spawnFloatingText(p.x, p.y - 48, '🍩 ¡PEERLESS DONUTS!', '#EA80FC', 1.25);
    } else if (idx === 1) {
      // H2: MOGURA: MOLE — Embestida perforante giratoria de 260px con el tridente Mogura
      const dist = 260;
      const sx = p.x;
      const sy = p.y;
      const ex = clampX(p.x + Math.cos(aimAngle) * dist, 38);
      const ey = clampY(p.y + Math.sin(aimAngle) * dist, 38);
      p.facingAngle = aimAngle;
      p.invulnTimer = Math.max(p.invulnTimer, 0.3);
      audio.playRoar();
      audio.playSlash(1.45);
      ctx.triggerScreenShake(7, 0.18);

      pushStrike(p, { kind: 'thrust', x1: sx, y1: sy, x2: ex, y2: ey, angle: aimAngle, width: 42, life: 0.30 });
      pushRing(p, ex, ey, 125, '#B71C1C', 0.32);
      pushMochiZone(p, (sx + ex) * 0.5, (sy + ey) * 0.5, 110, 3.6, false);

      state.enemies.forEach((en) => {
        if (en.hp <= 0) return;
        const nearSeg = ctx.pointToSegmentDist(en.x, en.y, sx, sy, ex, ey) <= en.radius + 54;
        const nearEnd = Math.hypot(en.x - ex, en.y - ey) <= en.radius + 115;
        if (nearSeg || nearEnd) {
          const { amount, isCrit } = ctx.calculatePlayerDamage(2.55, true);
          ctx.damageEnemy(en, amount, {
            isCrit,
            knockback: 90,
            sourceX: sx,
            sourceY: sy,
            stun: 0.6,
            ignoreArmorPct: 0.65,
            pierceShield: true
          });
        }
      });

      p.x = ex;
      p.y = ey;
      ctx.spawnFloatingText(p.x, p.y - 48, '🔱 ¡MOGURA MOLE!', '#FF5252', 1.25);
    } else if (idx === 2) {
      // H3: MOCHI WORLD (DESPERTAR) — Convierte el suelo en Mochi (260px x 7s), erupciona puños y baja CD de Visión Futura
      p.custom.awakeningTimer = 7.0;
      p.custom.mochi = 100;
      p.custom.futureSightCd = Math.min(p.custom.futureSightCd || 0, 1.5);
      audio.playExplosion(1.35);
      audio.playShing();
      ctx.triggerScreenShake(9, 0.24);
      pushRing(p, p.x, p.y, 260, '#FFE0B2', 0.45);
      pushMochiZone(p, p.x, p.y, 260, 7.0, true);

      ctx.damageEnemiesInCircle(p.x, p.y, 260, 2.1, 80, true, 0.75, {
        pierceShield: true
      });
      ctx.spawnFloatingText(p.x, p.y - 54, '🌀 ¡MOCHI AWAKENING!', '#FFE0B2', 1.35);
    }
    ctx.updateHUD();
  },

  onEnemyTick(p, en) {
    const zones: MochiZone[] = p.custom.mochiZones || [];
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      if (Math.hypot(en.x - z.x, en.y - z.y) <= z.radius + en.radius) {
        return { speedMult: z.isAwakening ? 0.55 : 0.7 };
      }
    }
    return {};
  },

  onUpdate(ctx, dt) {
    const { state, player: p, audio } = ctx;

    if ((p.custom.futureSightCd || 0) > 0) {
      p.custom.futureSightCd = Math.max(0, p.custom.futureSightCd - dt);
    }
    if ((p.custom.awakeningTimer || 0) > 0) {
      p.custom.awakeningTimer = Math.max(0, p.custom.awakeningTimer - dt);
    }
    if ((p.custom.buzzRollTimer || 0) > 0) {
      p.custom.buzzRollTimer = Math.max(0, p.custom.buzzRollTimer - dt);
    }

    // 1. Portales de Peerless Donuts disparando puños gigantes
    const donuts: MochiDonutPortal[] = p.custom.donuts || [];
    for (let i = donuts.length - 1; i >= 0; i--) {
      const d = donuts[i];
      d.life -= dt;
      d.fireDelay -= dt;
      if (!d.fired && d.fireDelay <= 0) {
        d.fired = true;
        audio.playPunch(0.95);
        const target = ctx.findNearestEnemy(320);
        const ang = target ? Math.atan2(target.y - d.y, target.x - d.x) : d.angle;
        const x2 = clampX(d.x + Math.cos(ang) * 290, 22);
        const y2 = clampY(d.y + Math.sin(ang) * 290, 22);
        pushStrike(p, { kind: 'donut_punch', x1: d.x, y1: d.y, x2, y2, angle: ang, width: 34, life: 0.25 });
        pushRing(p, x2, y2, 65, '#E040FB', 0.22);
        ctx.damageEnemiesInLine(d.x, d.y, ang, 290, 32, 1.35, 55, true, 0.25, {
          ignoreArmorPct: 0.35
        });
      }
      if (d.life <= 0) donuts.splice(i, 1);
    }

    // 2. Zonas de Mochi pegajoso y erupciones del Despertar
    const zones: MochiZone[] = p.custom.mochiZones || [];
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      z.life -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = z.isAwakening ? 0.65 : 0.6;
        if (z.isAwakening) {
          const target = state.enemies.find(
            (e: any) => e.hp > 0 && Math.hypot(e.x - z.x, e.y - z.y) <= z.radius + e.radius
          );
          if (target) {
            pushStrike(p, {
              kind: 'donut_punch',
              x1: target.x,
              y1: target.y + 42,
              x2: target.x,
              y2: target.y - 26,
              angle: -Math.PI / 2,
              width: 30,
              life: 0.22
            });
            pushRing(p, target.x, target.y, 70, '#E040FB', 0.24);
            const { amount, isCrit } = ctx.calculatePlayerDamage(0.95, true);
            ctx.damageEnemy(target, amount, { isCrit, knockback: 24 });
          }
        }
      }
      if (z.life <= 0) zones.splice(i, 1);
    }

    // 3. Decay VFX
    for (let i = p.custom.strikes.length - 1; i >= 0; i--) {
      p.custom.strikes[i].life -= dt;
      if (p.custom.strikes[i].life <= 0) p.custom.strikes.splice(i, 1);
    }
    for (let i = p.custom.rings.length - 1; i >= 0; i--) {
      p.custom.rings[i].life -= dt;
      if (p.custom.rings[i].life <= 0) p.custom.rings.splice(i, 1);
    }

    ctx.updateHUD();
  },

  // ==========================================================================
  // HUD DINÁMICO (MOCHI + VISIÓN FUTURA)
  // ==========================================================================
  mountHUD(slotEl) {
    slotEl.innerHTML = `
      <div id="katakuri-mochi-hud" class="char-resource-hud" style="display:flex;">
        <span style="font-size:12px;">🍩</span>
        <div class="res-bar-outer" style="border-color:#E040FB; width:92px;">
          <div id="hud-katakuri-fill" class="res-bar-fill" style="width:0%; background:linear-gradient(90deg, #8E24AA, #FFE0B2);"></div>
        </div>
        <span id="hud-katakuri-text" class="res-text text-outline-sm" style="color:#F3E5F5;">👁️ LISTO</span>
      </div>
    `;
  },

  updateHUD(p) {
    const hud = document.getElementById('katakuri-mochi-hud');
    const fill = document.getElementById('hud-katakuri-fill');
    const txt = document.getElementById('hud-katakuri-text');
    const cd = p.custom.futureSightCd || 0;
    const awk = (p.custom.awakeningTimer || 0) > 0;
    if (hud) hud.classList.toggle('katakuri-awk-active', awk);
    if (fill) fill.style.width = `${Math.min(100, Math.round(p.custom.mochi || 0))}%`;
    if (txt) {
      txt.textContent = cd <= 0 ? '👁️ VISIÓN OK' : `👁️ ${cd.toFixed(1)}s`;
    }
  },

  // ==========================================================================
  // RENDERIZADO EN MUNDO Y SPRITE (TRIDENTE MOGURA + BUFANDA + CABELLO CARMESÍ)
  // ==========================================================================
  drawWorldBeforePlayer({ ctx, player: p }) {
    const zones: MochiZone[] = p.custom.mochiZones || [];
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      const a = Math.min(0.85, z.life / Math.min(1, z.maxLife));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = z.isAwakening ? 'rgba(255, 236, 209, 0.34)' : 'rgba(224, 64, 251, 0.22)';
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = z.isAwakening ? '#FFE0B2' : '#E040FB';
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.restore();
    }
  },

  drawWorldAfterPlayer({ ctx, player: p }) {
    // 1. Portales de Donas Flotantes (Peerless Donuts)
    const donuts: MochiDonutPortal[] = p.custom.donuts || [];
    for (let i = 0; i < donuts.length; i++) {
      const d = donuts[i];
      const a = Math.max(0, Math.min(1, d.life / 0.25));
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#18141E';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#E040FB';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Puños Mochi Haki, Mogura y Maza Zangiri
    const strikes: MochiFistStrike[] = p.custom.strikes || [];
    for (let i = 0; i < strikes.length; i++) {
      const s = strikes[i];
      const a = Math.max(0, s.life / s.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      if (s.kind === 'thrust') {
        ctx.strokeStyle = '#B71C1C';
        ctx.lineWidth = s.width * a;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(3, s.width * 0.35 * a);
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      } else {
        // Brazo elástico de Mochi + cabeza de puño endurecida en Haki negro-magenta
        ctx.strokeStyle = '#FFE0B2';
        ctx.lineWidth = s.width * 0.45 * a;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();

        ctx.translate(s.x2, s.y2);
        ctx.rotate(s.angle);
        ctx.fillStyle = '#14121A';
        ctx.strokeStyle = '#E040FB';
        ctx.lineWidth = 3;
        if (s.kind === 'square_slam') {
          ctx.beginPath();
          ctx.roundRect(-s.width * 0.5, -s.width * 0.5, s.width, s.width, 6);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, s.width * (s.kind === 'buzz_mace' ? 0.58 : 0.45), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 3. Anillos de impacto Mochi
    const rings: MochiRingVFX[] = p.custom.rings || [];
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const a = Math.max(0, r.life / r.maxLife);
      const curR = r.radius * (0.35 + (1 - a) * 0.65);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 6 * a;
      ctx.beginPath();
      ctx.arc(r.x, r.y, curR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  },

  drawAura({ ctx, player: p, t }) {
    if ((p.custom.futureSightCd || 0) <= 0 || (p.custom.awakeningTimer || 0) > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = (p.custom.awakeningTimer || 0) > 0 ? '#FFE0B2' : 'rgba(224, 64, 251, 0.75)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 10 + Math.sin(t * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  },

  drawBody({ ctx, player: p, cfg }) {
    const swing = p.attackAnimTimer > 0 ? Math.sin((p.attackAnimTimer / 0.24) * Math.PI) * 0.6 : 0;

    // Tridente Mogura (carmesí y plata)
    ctx.save();
    ctx.rotate(-0.3 + swing);
    ctx.strokeStyle = '#8E0000';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-16, 14);
    ctx.lineTo(32, 14);
    ctx.stroke();
    // Puntas del tridente
    ctx.strokeStyle = '#ECEFF1';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(32, 14);
    ctx.lineTo(42, 14);
    ctx.moveTo(28, 9);
    ctx.lineTo(39, 8);
    ctx.moveTo(28, 19);
    ctx.lineTo(39, 20);
    ctx.stroke();
    ctx.restore();

    // Chaleco oscuro biker
    ctx.fillStyle = cfg.vestColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bufanda alta oscura característica
    ctx.fillStyle = '#373042';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-8, -11, 18, 22, 6);
    ctx.fill();
    ctx.stroke();

    // Cabello puntiagudo carmesí
    ctx.fillStyle = '#C2185B';
    ctx.beginPath();
    ctx.arc(-2, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ojos intensos con Visión Futura
    ctx.fillStyle = (p.custom.futureSightCd || 0) <= 0 ? '#EA80FC' : '#FFFFFF';
    ctx.beginPath();
    ctx.arc(6, -3.5, 2, 0, Math.PI * 2);
    ctx.arc(6, 3.5, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  drawPreview(pctx, _t, cfg) {
    // Tridente Mogura atrás
    pctx.save();
    pctx.strokeStyle = '#8E0000';
    pctx.lineWidth = 3.5;
    pctx.beginPath();
    pctx.moveTo(-16, 16);
    pctx.lineTo(20, -20);
    pctx.stroke();
    pctx.strokeStyle = '#ECEFF1';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.moveTo(16, -16);
    pctx.lineTo(23, -23);
    pctx.moveTo(13, -19);
    pctx.lineTo(19, -25);
    pctx.moveTo(19, -13);
    pctx.lineTo(25, -19);
    pctx.stroke();
    pctx.restore();

    // Torso chaleco oscuro
    pctx.fillStyle = cfg.vestColor;
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.arc(0, 3, 13, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    // Bufanda alta
    pctx.fillStyle = '#373042';
    pctx.beginPath();
    pctx.roundRect(-9, -4, 18, 9, 3);
    pctx.fill();
    pctx.stroke();

    // Cabello carmesí
    pctx.fillStyle = '#C2185B';
    pctx.beginPath();
    pctx.arc(0, -10, 10, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#EA80FC';
    pctx.beginPath();
    pctx.arc(-3.5, -9, 1.8, 0, Math.PI * 2);
    pctx.arc(3.5, -9, 1.8, 0, Math.PI * 2);
    pctx.fill();
  }
};
