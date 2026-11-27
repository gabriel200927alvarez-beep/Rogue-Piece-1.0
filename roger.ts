import { CONFIG } from '../config';
import { calculateRogerHaoshokuBonus } from '../rules';
import type { ButtonUIHelpers, CharacterContext, CharacterModule } from './types';

// ============================================================================
// GOL D. ROGER — Yonko · Rey de los Piratas · Sable Supremo "Ace"
// ============================================================================

interface RogerArcVFX {
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

interface KamusariWave {
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
  isSkill: boolean;
  hitIds: any[];
}

interface RogerBoltVFX {
  pts: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  life: number;
  maxLife: number;
}

interface RogerDomeVFX {
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

function addHaoshoku(ctx: CharacterContext, amount: number): void {
  const p = ctx.player;
  const prev = p.custom.haoshoku || 0;
  p.custom.haoshoku = Math.min(100, prev + amount);
  if (prev < 60 && p.custom.haoshoku >= 60) {
    ctx.audio.playThunder();
    ctx.spawnFloatingText(p.x, p.y - 48, '⚡ ¡ACE: HAOSHOKU!', '#FFD54F', 1.15);
  }
}

function pushRogerArc(
  p: CharacterContext['player'],
  x: number,
  y: number,
  angle: number,
  range: number,
  halfAngle: number,
  swingDir: 1 | -1,
  thickness = 26,
  life = 0.22
): void {
  const arr: RogerArcVFX[] = p.custom.arcs;
  if (arr.length >= 14) arr.shift();
  arr.push({ x, y, angle, range, halfAngle, swingDir, thickness, life, maxLife: life });
}

function pushRogerBolt(
  p: CharacterContext['player'],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = '#FF1744',
  width = 3.8,
  life = 0.24
): void {
  const arr: RogerBoltVFX[] = p.custom.bolts;
  if (arr.length >= 16) arr.shift();
  const pts: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const jit = (Math.random() - 0.5) * Math.min(30, len * 0.22);
    pts.push({ x: x1 + dx * t + nx * jit, y: y1 + dy * t + ny * jit });
  }
  pts.push({ x: x2, y: y2 });
  arr.push({ pts, color, width, life, maxLife: life });
}

function pushRogerDome(p: CharacterContext['player'], x: number, y: number, radius: number, color = '#FF1744', life = 0.36): void {
  const arr: RogerDomeVFX[] = p.custom.domes;
  if (arr.length >= 10) arr.shift();
  arr.push({ x, y, radius, color, life, maxLife: life });
}

function fireOroJacksonFinale(ctx: CharacterContext, aimAngle: number): void {
  const { state, player: p, audio } = ctx;
  p.custom.pirateKingTimer = 0;
  p.facingAngle = aimAngle;

  audio.playExplosion(1.6);
  audio.playThunder();
  audio.playRoar();
  ctx.triggerScreenShake(12, 0.32);
  ctx.triggerHaptic(32);
  state.hitstopTimer = 0.09;

  pushRogerDome(p, p.x, p.y, 340, '#FFD54F', 0.45);
  pushRogerArc(p, p.x, p.y, aimAngle, 260, Math.PI, 1, 36, 0.32);

  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    pushRogerBolt(p, p.x, p.y, p.x + Math.cos(a) * 300, p.y + Math.sin(a) * 300, k % 2 === 0 ? '#FF1744' : '#FFD54F', 4.5, 0.3);
  }

  // Dispara 3 ondas Kamusari doradas-carmesí gigantes en abanico
  [-0.25, 0, 0.25].forEach((off) => {
    const a = aimAngle + off;
    p.custom.waves.push({
      x: p.x + Math.cos(a) * 28,
      y: p.y + Math.sin(a) * 28,
      vx: Math.cos(a) * 760,
      vy: Math.sin(a) * 760,
      angle: a,
      width: 110,
      dmgMult: 3.1,
      traveled: 0,
      maxRange: 430,
      life: 0.62,
      maxLife: 0.62,
      isSkill: true,
      hitIds: []
    });
  });

  ctx.damageEnemiesInCircle(p.x, p.y, 260, 2.8, 160, true, 1.4, {
    pierceShield: true,
    ignoreArmorPct: 1.0,
    damageTextColor: '#FFD54F'
  });
  ctx.spawnFloatingText(p.x, p.y - 54, '🏴‍☠️ ¡ORO JACKSON FINALE!', '#FFD54F', 1.4);

  p.skillCds[2] = p.skillMaxCds[2];
  ctx.updateHUD();
  ctx.updateCooldownUI();
}

export const rogerCharacter: CharacterModule = {
  id: 'roger',
  name: 'Gol D. Roger',
  faction: 'pirates',
  rarity: 'yonko',
  portrait: '🏴‍☠️',
  portraitBg: 'linear-gradient(135deg, #B71C1C 0%, #FFD54F 65%, #111116 100%)',
  attackIcon: '⚔️',
  themeClass: 'theme-roger',
  color: '#FF1744',
  vestColor: '#B71C1C',
  hp: 118,
  damage: 20,
  speed: 5.4,
  armor: 11,
  dashCd: 1.9,
  autoAimRange: 350,
  skills: [
    { name: 'Kamusari', icon: '⚔️', cd: 7.0 },
    { name: 'Haoshoku', icon: '👑', cd: 8.5 },
    { name: 'Pirate King', icon: '🏴‍☠️', cd: 12.0 }
  ],
  cardMeta: {
    displayName: 'GOL D. ROGER',
    zarparName: 'ROGER',
    epithet: 'Rey de los Piratas · Sable Ace',
    nameColor: '#FFD54F',
    role: 'Yonko Conquistador / Haki Supremo',
    passiveText: 'Pasiva: Voluntad D. (≥60 Haoshoku = +18% daño y 30% perf.; pulso Haki <40% HP)',
    passiveColor: '#FFD54F',
    stats: { hp: 92, dmg: 100, vel: 82, arm: 86 },
    comboDesc:
      '<b>Combo 4 golpes Ace:</b> Tajo Carmesí (165px) → Reverso Negro → <b>Estocada Rompe-Cielos</b> (225px) → <b>Mini Kamusari</b> (onda Haki 340px).',
    skillsDesc:
      '<b>H1:</b> Kamusari / Divine Departure (420px, perf. 85%) • <b>H2:</b> Haoshoku (270px aturde hasta 3.6s) • <b>H3:</b> Pirate King (+vel, re-tocar: Oro Jackson).'
  },

  // ==========================================================================
  // ESTADO PROPIO Y LIMPIEZA
  // ==========================================================================
  createCustomState: () => ({
    haoshoku: 0,
    pirateKingTimer: 0,
    willPulseUsed: false,
    arcs: [] as RogerArcVFX[],
    waves: [] as KamusariWave[],
    bolts: [] as RogerBoltVFX[],
    domes: [] as RogerDomeVFX[]
  }),

  onCleanupEffects(p) {
    p.custom.pirateKingTimer = 0;
    p.custom.arcs = [];
    p.custom.waves = [];
    p.custom.bolts = [];
    p.custom.domes = [];
  },

  getMoveSpeedMult: (p) => ((p.custom.pirateKingTimer || 0) > 0 ? 1.25 : 1.0),

  // ==========================================================================
  // PASIVA VOLUNTAD D. Y HAOSHOKU
  // ==========================================================================
  onCalculateDamage(p) {
    const pk = (p.custom.pirateKingTimer || 0) > 0;
    const res = calculateRogerHaoshokuBonus(p.custom.haoshoku || 0, pk);
    return {
      dmgMult: res.dmgMult,
      extraCritChance: res.extraCritChance,
      critMult: pk ? 1.85 : 1.7
    };
  },

  onModifyDamageEnemy(p, _en, opts) {
    const pk = (p.custom.pirateKingTimer || 0) > 0;
    const res = calculateRogerHaoshokuBonus(p.custom.haoshoku || 0, pk);
    return {
      ignoreArmorPct: Math.max(opts.ignoreArmorPct || 0, res.ignoreArmorPct),
      damageTextColor: pk ? '#FFD54F' : opts.damageTextColor
    };
  },

  onBeforePlayerDamage(ctx, incomingDmg) {
    const p = ctx.player;
    const pk = (p.custom.pirateKingTimer || 0) > 0;
    if (!p.custom.willPulseUsed && p.hp <= p.maxHp * 0.4) {
      p.custom.willPulseUsed = true;
      ctx.audio.playRoar();
      ctx.audio.playThunder();
      pushRogerDome(p, p.x, p.y, 240, '#FFD54F', 0.4);
      ctx.damageEnemiesInCircle(p.x, p.y, 240, 1.8, 120, true, 1.8, { pierceShield: true });
      ctx.spawnFloatingText(p.x, p.y - 52, '👑 ¡VOLUNTAD D.!', '#FFD54F', 1.3);
    }
    return pk ? { dmgMult: 0.8 } : incomingDmg > 0 ? { dmgMult: 0.92 } : {};
  },

  onAfterDamageEnemy(ctx) {
    addHaoshoku(ctx, 6);
  },

  onEnemyKilled(ctx) {
    addHaoshoku(ctx, 15);
  },

  // ==========================================================================
  // COMBO BÁSICO CON ACE (4 GOLPES DE HAKI DEL REY)
  // ==========================================================================
  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const pk = (p.custom.pirateKingTimer || 0) > 0;
    const step = p.comboStep % 4;
    p.comboStep = (step + 1) % 4;
    p.comboResetTimer = 0.95;
    p.attackCooldown = step === 3 ? (pk ? 0.24 : 0.32) : pk ? 0.14 : 0.20;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = 0.24;

    const bonus = pk ? 45 : 0;

    if (step === 0) {
      // Golpe 1: Tajo carmesí-negro de Ace
      audio.playSlash(1.15);
      pushRogerArc(p, p.x, p.y, aimAngle, 165 + bonus, Math.PI * 0.45, 1, 26, 0.22);
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 165 + bonus, Math.PI * 0.45, 1.2, 46);
    } else if (step === 1) {
      // Golpe 2: Tajo inverso con chispas negras
      audio.playSlash(1.25);
      audio.playThunder();
      pushRogerArc(p, p.x, p.y, aimAngle, 175 + bonus, Math.PI * 0.48, -1, 28, 0.23);
      pushRogerBolt(p, p.x, p.y, p.x + Math.cos(aimAngle) * (150 + bonus), p.y + Math.sin(aimAngle) * (150 + bonus), '#FF1744', 3.4, 0.2);
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 175 + bonus, Math.PI * 0.48, 1.32, 50);
    } else if (step === 2) {
      // Golpe 3: Estocada Rompe-Cielos (225px) + estallido en la punta
      p.momentumTimer = 0.10;
      p.momentumDirX = Math.cos(aimAngle);
      p.momentumDirY = Math.sin(aimAngle);
      audio.playShing();
      audio.playExplosion(1.0);
      const len = 225 + bonus;
      const x2 = clampX(p.x + Math.cos(aimAngle) * len, 22);
      const y2 = clampY(p.y + Math.sin(aimAngle) * len, 22);
      pushRogerBolt(p, p.x, p.y, x2, y2, '#FFD54F', 5.0, 0.22);
      pushRogerDome(p, x2, y2, 95, '#FF1744', 0.24);
      ctx.damageEnemiesInLine(p.x, p.y, aimAngle, len, 32, 1.5, 48, false, 0);
      ctx.damageEnemiesInCircle(x2, y2, 95, 0.9, 55, false, 0);
    } else {
      // Golpe 4 (Finisher): Mini Kamusari — Onda Haki de 340px
      audio.playSlash(1.45);
      audio.playThunder();
      ctx.triggerScreenShake(6, 0.16);
      state.hitstopTimer = 0.05;
      pushRogerArc(p, p.x, p.y, aimAngle, 190 + bonus, Math.PI * 0.52, 1, 30, 0.25);

      p.custom.waves.push({
        x: p.x + Math.cos(aimAngle) * 26,
        y: p.y + Math.sin(aimAngle) * 26,
        vx: Math.cos(aimAngle) * 720,
        vy: Math.sin(aimAngle) * 720,
        angle: aimAngle,
        width: 96,
        dmgMult: 2.15,
        traveled: 0,
        maxRange: 340 + bonus,
        life: 0.52,
        maxLife: 0.52,
        isSkill: false,
        hitIds: []
      });
    }
  },

  // ==========================================================================
  // HABILIDADES H1 / H2 / H3
  // ==========================================================================
  onSkillReactivate(ctx, idx) {
    const p = ctx.player;
    if (idx === 2 && (p.custom.pirateKingTimer || 0) > 0) {
      fireOroJacksonFinale(ctx, ctx.getAimAngle());
      return true;
    }
    return false;
  },

  onSkill(ctx, idx, aimAngle) {
    const { state, player: p, audio } = ctx;

    if (idx === 0) {
      // H1: KAMUSARI (DIVINE DEPARTURE) — Onda titánica carmesí-negro-oro de 420px
      audio.playRoar();
      audio.playExplosion(1.4);
      audio.playThunder();
      ctx.triggerScreenShake(10, 0.24);
      ctx.triggerHaptic(26);
      state.hitstopTimer = 0.075;

      pushRogerArc(p, p.x, p.y, aimAngle, 200, Math.PI * 0.55, 1, 34, 0.28);
      p.custom.waves.push({
        x: p.x + Math.cos(aimAngle) * 26,
        y: p.y + Math.sin(aimAngle) * 26,
        vx: Math.cos(aimAngle) * 790,
        vy: Math.sin(aimAngle) * 790,
        angle: aimAngle,
        width: 124,
        dmgMult: 3.1,
        traveled: 0,
        maxRange: 420,
        life: 0.58,
        maxLife: 0.58,
        isSkill: true,
        hitIds: []
      });
      ctx.spawnFloatingText(p.x, p.y - 50, '⚔️ ¡KAMUSARI!', '#FF1744', 1.35);
      return false;
    }

    if (idx === 1) {
      // H2: HAOSHOKU BURST — Explosión de Haki del Conquistador (270px), aturde hasta 3.6s
      const haki = p.custom.haoshoku || 0;
      const stunDur = 2.2 + (haki / 100) * 1.4;
      audio.playExplosion(1.45);
      audio.playThunder();
      ctx.triggerScreenShake(9, 0.24);
      state.hitstopTimer = 0.07;

      pushRogerDome(p, p.x, p.y, 270, '#FF1744', 0.42);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        pushRogerBolt(p, p.x, p.y, p.x + Math.cos(a) * 255, p.y + Math.sin(a) * 255, k % 2 === 0 ? '#FF1744' : '#FFD54F', 4.2, 0.28);
      }

      ctx.damageEnemiesInCircle(p.x, p.y, 270, 2.55, 125, true, stunDur, {
        pierceShield: true,
        ignoreArmorPct: 0.6
      });
      addHaoshoku(ctx, 18);
      ctx.spawnFloatingText(p.x, p.y - 52, `👑 ¡HAOSHOKU (${stunDur.toFixed(1)}s)!`, '#FFD54F', 1.3);
      return false;
    }

    if (idx === 2) {
      // H3: PIRATE KING — Modo Rey de los Piratas (8.5s, re-activar = Oro Jackson Finale)
      p.custom.pirateKingTimer = 8.5;
      p.custom.haoshoku = 100;
      p.superArmorTimer = Math.max(p.superArmorTimer, 0.8);
      audio.playRoar();
      audio.playThunder();
      ctx.triggerScreenShake(8, 0.22);
      pushRogerDome(p, p.x, p.y, 195, '#FFD54F', 0.36);
      ctx.damageEnemiesInCircle(p.x, p.y, 195, 2.0, 120, true, 0.85, { pierceShield: true });
      ctx.spawnFloatingText(p.x, p.y - 54, '🏴‍☠️ ¡REY DE LOS PIRATAS!', '#FFD54F', 1.35);
      ctx.updateHUD();
      return true;
    }
  },

  // ==========================================================================
  // ACTUALIZACIÓN POR FRAME
  // ==========================================================================
  onUpdate(ctx, dt) {
    const { state, player: p } = ctx;

    // 1. Overdrive Pirate King
    if ((p.custom.pirateKingTimer || 0) > 0) {
      p.custom.pirateKingTimer = Math.max(0, p.custom.pirateKingTimer - dt);
      if (Math.random() < 0.35) {
        const a = Math.random() * Math.PI * 2;
        pushRogerBolt(p, p.x, p.y, p.x + Math.cos(a) * 48, p.y + Math.sin(a) * 48, Math.random() < 0.5 ? '#FF1744' : '#FFD54F', 2.4, 0.16);
      }
      if (p.custom.pirateKingTimer <= 0) {
        p.skillCds[2] = p.skillMaxCds[2];
        ctx.spawnFloatingText(p.x, p.y - 44, 'Fin de Rey Pirata', '#FFD54F', 1.0);
        ctx.updateCooldownUI();
      }
    }

    // 2. Proyectiles Kamusari
    const waves: KamusariWave[] = p.custom.waves || [];
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      const sx = w.vx * dt;
      const sy = w.vy * dt;
      w.x += sx;
      w.y += sy;
      w.traveled += Math.hypot(sx, sy);
      w.life -= dt;

      if (Math.random() < 0.65) {
        ctx.spawnParticle(w.x, w.y, Math.random() < 0.5 ? '#FF1744' : '#FFD54F', 4.5, 0.24, { shape: 'spark' });
      }

      for (let j = 0; j < state.enemies.length; j++) {
        const en = state.enemies[j];
        if (en.hp <= 0 || w.hitIds.includes(en)) continue;
        if (Math.hypot(en.x - w.x, en.y - w.y) <= en.radius + w.width * 0.56) {
          w.hitIds.push(en);
          const { amount, isCrit } = ctx.calculatePlayerDamage(w.dmgMult, w.isSkill);
          ctx.damageEnemy(en, amount, {
            isCrit,
            knockback: w.isSkill ? 165 : 85,
            sourceX: w.x,
            sourceY: w.y,
            isNormalAttack: !w.isSkill,
            pierceShield: w.isSkill,
            ignoreArmorPct: w.isSkill ? 0.85 : 0.35,
            damageTextColor: w.isSkill ? '#FFD54F' : '#FF5252'
          });
        }
      }

      if (w.life <= 0 || w.traveled >= w.maxRange) {
        waves.splice(i, 1);
      }
    }

    // 3. Decay VFX
    for (let i = p.custom.arcs.length - 1; i >= 0; i--) {
      p.custom.arcs[i].life -= dt;
      if (p.custom.arcs[i].life <= 0) p.custom.arcs.splice(i, 1);
    }
    for (let i = p.custom.bolts.length - 1; i >= 0; i--) {
      p.custom.bolts[i].life -= dt;
      if (p.custom.bolts[i].life <= 0) p.custom.bolts.splice(i, 1);
    }
    for (let i = p.custom.domes.length - 1; i >= 0; i--) {
      p.custom.domes[i].life -= dt;
      if (p.custom.domes[i].life <= 0) p.custom.domes.splice(i, 1);
    }

    ctx.updateHUD();
  },

  // ==========================================================================
  // HUD DINÁMICO (HAOSHOKU) Y BOTÓN ORO JACKSON
  // ==========================================================================
  mountHUD(slotEl) {
    slotEl.innerHTML = `
      <div id="roger-haki-hud" class="char-resource-hud" style="display:flex;">
        <span style="font-size:12px;">🏴‍☠️</span>
        <div class="res-bar-outer" style="border-color:#FFD54F; width:100px;">
          <div id="hud-roger-fill" class="res-bar-fill" style="width:0%; background:linear-gradient(90deg, #B71C1C, #FF1744, #FFD54F);"></div>
        </div>
        <span id="hud-roger-text" class="res-text text-outline-sm" style="color:#FFE082;">HAKI 0/100</span>
      </div>
    `;
  },

  updateHUD(p) {
    const hud = document.getElementById('roger-haki-hud');
    const fill = document.getElementById('hud-roger-fill');
    const txt = document.getElementById('hud-roger-text');
    const pk = (p.custom.pirateKingTimer || 0) > 0;
    const val = Math.round(p.custom.haoshoku || 0);
    if (hud) hud.classList.toggle('roger-pk-active', pk || val >= 60);
    if (fill) {
      fill.style.width = pk ? `${Math.min(100, (p.custom.pirateKingTimer / 8.5) * 100)}%` : `${val}%`;
    }
    if (txt) {
      txt.textContent = pk ? `👑 ${p.custom.pirateKingTimer.toFixed(1)}s` : `HAKI ${val}/100`;
    }
  },

  updateButtonsUI(p, helpers: ButtonUIHelpers) {
    const btn3 = helpers.getBtn(2);
    const lbl3 = helpers.getLabel(2);
    if ((p.custom.pirateKingTimer || 0) > 0) {
      btn3?.classList.add('chain-active');
      if (lbl3) lbl3.textContent = 'Oro Jackson';
      helpers.setSkillCooldownOverride(2, null, undefined, true);
    } else {
      btn3?.classList.remove('chain-active');
      if (lbl3) lbl3.textContent = 'Pirate King';
    }
  },

  // ==========================================================================
  // RENDERIZADO PERSONALIZADO (KAMUSARI, HAOSHOKU Y SABLE ACE)
  // ==========================================================================
  drawWorldAfterPlayer({ ctx, player: p }) {
    // 1. Arcos negros-carmesí-oro de Ace
    const arcs: RogerArcVFX[] = p.custom.arcs || [];
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
      ctx.strokeStyle = '#111116';
      ctx.lineWidth = (c.thickness + 8) * Math.max(0.45, a);
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.88, minA, maxA);
      ctx.stroke();

      ctx.strokeStyle = '#FF1744';
      ctx.lineWidth = c.thickness * 0.62 * Math.max(0.45, a);
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.93, minA, maxA);
      ctx.stroke();

      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 3.5 * a;
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.96, minA, maxA);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Ondas Kamusari voladoras
    const waves: KamusariWave[] = p.custom.waves || [];
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      const a = Math.max(0.25, Math.min(1, w.life / (w.maxLife * 0.35)));
      const hw = w.width * 0.5;
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.angle);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#0D0B10';
      ctx.strokeStyle = '#FF1744';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.quadraticCurveTo(8, -hw * 0.8, -32, -hw);
      ctx.quadraticCurveTo(-8, 0, -32, hw);
      ctx.quadraticCurveTo(8, hw * 0.8, 26, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFD54F';
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.quadraticCurveTo(6, -hw * 0.45, -14, -hw * 0.62);
      ctx.quadraticCurveTo(0, 0, -14, hw * 0.62);
      ctx.quadraticCurveTo(6, hw * 0.45, 20, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 3. Domos Haoshoku
    const domes: RogerDomeVFX[] = p.custom.domes || [];
    for (let i = 0; i < domes.length; i++) {
      const d = domes[i];
      const a = Math.max(0, d.life / d.maxLife);
      const curR = d.radius * (0.3 + (1 - a) * 0.7);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 8 * a;
      ctx.beginPath();
      ctx.arc(d.x, d.y, curR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#111116';
      ctx.lineWidth = 4 * a;
      ctx.beginPath();
      ctx.arc(d.x, d.y, curR * 0.84, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Relámpagos negros-carmesí-oro de Haki del Conquistador
    const bolts: RogerBoltVFX[] = p.custom.bolts || [];
    for (let i = 0; i < bolts.length; i++) {
      const bt = bolts[i];
      const a = Math.max(0, bt.life / bt.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111116';
      ctx.lineWidth = bt.width + 3;
      ctx.beginPath();
      bt.pts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.stroke();

      ctx.strokeStyle = bt.color;
      ctx.lineWidth = bt.width;
      ctx.beginPath();
      bt.pts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.stroke();
      ctx.restore();
    }
  },

  drawAura({ ctx, player: p, t }) {
    const pk = (p.custom.pirateKingTimer || 0) > 0;
    const hakiHigh = (p.custom.haoshoku || 0) >= 60;
    if (!pk && !hakiHigh) return;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = pk ? '#FFD54F' : '#FF1744';
    ctx.lineWidth = pk ? 3.2 : 2.2;
    ctx.globalAlpha = 0.7 + Math.sin(t * 10) * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  drawBody({ ctx, player: p, cfg }) {
    const swing = p.attackAnimTimer > 0 ? Math.sin((p.attackAnimTimer / 0.24) * Math.PI) * 0.7 : 0;

    // Sable Supremo "Ace" con hoja oscura e imbuida en Haoshoku
    ctx.save();
    ctx.rotate(-0.35 + swing);
    ctx.strokeStyle = '#CFD8DC';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, 13);
    ctx.lineTo(36, 11);
    ctx.stroke();
    if ((p.custom.haoshoku || 0) >= 60 || (p.custom.pirateKingTimer || 0) > 0) {
      ctx.strokeStyle = '#FF1744';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(2, 10.5);
      ctx.lineTo(36, 8.5);
      ctx.stroke();
    }
    ctx.strokeStyle = '#FFD54F';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(2, 13, 6, Math.PI * 0.4, Math.PI * 1.6);
    ctx.stroke();
    ctx.restore();

    // Abrigo escarlata de Capitán con hombreras doradas
    ctx.fillStyle = cfg.vestColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hombreras doradas
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(-6, -13, 5, 0, Math.PI * 2);
    ctx.arc(-6, 13, 5, 0, Math.PI * 2);
    ctx.fill();

    // Sombrero de Capitán Pirata oscuro con borde dorado
    ctx.fillStyle = '#18181E';
    ctx.strokeStyle = '#FFD54F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-1, 0, 11, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bigote icónico negro de Roger
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(7, -7);
    ctx.quadraticCurveTo(12, -2, 7, 0);
    ctx.quadraticCurveTo(12, 2, 7, 7);
    ctx.stroke();
  },

  drawPreview(pctx, t, cfg) {
    const gleam = 0.7 + Math.sin(t * 2.5) * 0.25;
    // Sable Ace en diagonal
    pctx.save();
    pctx.strokeStyle = '#CFD8DC';
    pctx.lineWidth = 4.2;
    pctx.lineCap = 'round';
    pctx.beginPath();
    pctx.moveTo(-16, 16);
    pctx.lineTo(20, -20);
    pctx.stroke();
    pctx.strokeStyle = `rgba(255, 23, 68, ${gleam})`;
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.moveTo(-2, 2);
    pctx.lineTo(20, -20);
    pctx.stroke();
    pctx.restore();

    // Abrigo escarlata
    pctx.fillStyle = cfg.vestColor;
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.arc(0, 3, 13, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    // Charreteras doradas
    pctx.fillStyle = '#FFD54F';
    pctx.beginPath();
    pctx.arc(-10, -2, 4, 0, Math.PI * 2);
    pctx.arc(10, -2, 4, 0, Math.PI * 2);
    pctx.fill();

    // Sombrero de Capitán + emblema oro
    pctx.fillStyle = '#18181E';
    pctx.strokeStyle = '#FFD54F';
    pctx.lineWidth = 1.8;
    pctx.beginPath();
    pctx.ellipse(0, -13, 15, 7, 0, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    // Bigote icónico
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2.4;
    pctx.beginPath();
    pctx.moveTo(-8, -5);
    pctx.quadraticCurveTo(0, -8, 8, -5);
    pctx.stroke();
  }
};
