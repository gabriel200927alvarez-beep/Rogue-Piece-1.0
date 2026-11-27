import { CONFIG } from '../config';
import type { CharacterContext, CharacterModule } from './types';

// ============================================================================
// AKAINU (SAKAZUKI) — Almirante de la Marina · Magu Magu no Mi (Rework Completo)
// ============================================================================

interface MagmaPool {
  x: number;
  y: number;
  radius: number;
  dps: number;
  slowPct: number;
  life: number;
  maxLife: number;
  tick: number;
}

interface MagmaProjectile {
  kind: 'fist' | 'hound' | 'daifunka';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  dmgMult: number;
  traveled: number;
  maxRange: number;
  life: number;
  maxLife: number;
  trailTick: number;
  hitIds: any[];
  explodeRadius: number;
}

interface VolcanicMeteor {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  delay: number;
  fallTime: number;
  maxFallTime: number;
  radius: number;
  dmgMult: number;
}

interface LavaFissure {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  life: number;
  maxLife: number;
  tick: number;
}

interface MagmaBurstRing {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  isVolcano?: boolean;
}

function clampX(x: number, pad = 28): number {
  return Math.max(CONFIG.ARENA_MARGIN_X + pad, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - pad, x));
}

function clampY(y: number, pad = 28): number {
  return Math.max(CONFIG.ARENA_MARGIN_Y + pad, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - pad, y));
}

function addMagma(ctx: CharacterContext, amount: number): void {
  const p = ctx.player;
  const prev = p.custom.magma || 0;
  p.custom.magma = Math.min(100, prev + amount);
  if (prev < 100 && p.custom.magma >= 100) {
    ctx.audio.playRoar();
    ctx.spawnFloatingText(p.x, p.y - 46, '🌋 ¡MAGMA AL MÁXIMO!', '#FF6D00', 1.15);
  }
}

function spawnMagmaPool(
  p: CharacterContext['player'],
  x: number,
  y: number,
  radius: number,
  dps: number,
  life: number,
  slowPct = 0
): void {
  const pools: MagmaPool[] = p.custom.magmaPools;
  if (pools.length >= 18) pools.shift();
  pools.push({
    x: clampX(x, 20),
    y: clampY(y, 20),
    radius,
    dps,
    slowPct,
    life,
    maxLife: life,
    tick: 0.25
  });
}

function pushBurst(
  p: CharacterContext['player'],
  x: number,
  y: number,
  radius: number,
  life = 0.3,
  isVolcano = false
): void {
  const arr: MagmaBurstRing[] = p.custom.bursts;
  if (arr.length >= 12) arr.shift();
  arr.push({ x, y, radius, life, maxLife: life, isVolcano });
}

export const akainuCharacter: CharacterModule = {
  id: 'akainu',
  name: 'Akainu',
  faction: 'marines',
  rarity: 'almirante',
  portrait: '🌋',
  portraitBg: 'linear-gradient(135deg, #D32F2F 0%, #1A1A1A 100%)',
  attackIcon: '🌋',
  themeClass: 'theme-akainu',
  color: '#D32F2F',
  vestColor: '#1A1A1A',
  hp: 110,
  damage: 18,
  speed: 4.5,
  armor: 12,
  dashCd: 2.5,
  autoAimRange: 340,
  skills: [
    { name: 'Ryusei', icon: '☄️', cd: 8.5 },
    { name: 'Hellhound', icon: '🐕', cd: 7.5 },
    { name: 'Eruption', icon: '🌋', cd: 11.5 }
  ],
  cardMeta: {
    displayName: 'AKAINU',
    zarparName: 'AKAINU',
    epithet: 'Perro Rojo',
    nameColor: '#FF7043',
    role: 'Almirante Magma / Cataclismo',
    passiveText: 'Pasiva: Logia de Magma (-25% daño + charco; 100 Magma = onda calor 95px)',
    passiveColor: '#FFAB40',
    stats: { hp: 88, dmg: 100, vel: 68, arm: 92 },
    comboDesc:
      '<b>Combo 4 golpes Magma:</b> Puño Meigo (170px) → Sabueso Inugami (235px) → <b>Fisura Kazan</b> (145px) → <b>Dai Funka Volador</b> (310px + cráter).',
    skillsDesc:
      '<b>H1:</b> Ryusei Kazan (7 meteoros cayendo del cielo) • <b>H2:</b> Hellhound (390px + río de lava) • <b>H3:</b> Great Eruption (6 fisuras 310px + caldera 240px).'
  },

  // ==========================================================================
  // ESTADO PROPIO
  // ==========================================================================
  createCustomState: () => ({
    magma: 0,
    greatEruptionTimer: 0,
    magmaPools: [] as MagmaPool[],
    projectiles: [] as MagmaProjectile[],
    meteors: [] as VolcanicMeteor[],
    fissures: [] as LavaFissure[],
    bursts: [] as MagmaBurstRing[],
    magmaFistAnim: 0
  }),

  isMovementLocked: (p) => (p.custom.greatEruptionTimer || 0) > 0,

  canAttack: (p) => (p.custom.greatEruptionTimer || 0) <= 0,

  // ==========================================================================
  // COMBO BÁSICO VOLCÁNICO DESDE CERO (4 GOLPES ESPECTACULARES)
  // ==========================================================================
  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const step = p.comboStep % 4;
    p.comboStep = (step + 1) % 4;
    p.attackCooldown = step === 3 ? 0.34 : 0.21;
    p.comboResetTimer = 0.85;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = 0.24;
    p.custom.magmaFistAnim = 0.26;

    if (step === 0) {
      // Golpe 1: MEIGO — Proyectil cercano de puño de magma que atraviesa y deja charco
      audio.playPunch(0.95);
      audio.playFireCrackle();
      p.custom.projectiles.push({
        kind: 'fist',
        x: p.x + Math.cos(aimAngle) * 20,
        y: p.y + Math.sin(aimAngle) * 20,
        vx: Math.cos(aimAngle) * 760,
        vy: Math.sin(aimAngle) * 760,
        angle: aimAngle,
        radius: 34,
        dmgMult: 1.25,
        traveled: 0,
        maxRange: 170,
        life: 0.25,
        maxLife: 0.25,
        trailTick: 0,
        hitIds: [],
        explodeRadius: 86
      });
    } else if (step === 1) {
      // Golpe 2: INUGAMI GUREN — Cabeza gigante de sabueso de magma mordiendo hacia adelante (235px)
      audio.playRoar();
      audio.playFireCrackle();
      p.custom.projectiles.push({
        kind: 'hound',
        x: p.x + Math.cos(aimAngle) * 24,
        y: p.y + Math.sin(aimAngle) * 24,
        vx: Math.cos(aimAngle) * 720,
        vy: Math.sin(aimAngle) * 720,
        angle: aimAngle,
        radius: 44,
        dmgMult: 1.5,
        traveled: 0,
        maxRange: 235,
        life: 0.36,
        maxLife: 0.36,
        trailTick: 0,
        hitIds: [],
        explodeRadius: 108
      });
    } else if (step === 2) {
      // Golpe 3: KAZAN GEKIDO — Golpe al suelo que abre 3 fisuras volcánicas en abanico (165px)
      audio.playExplosion(1.1);
      ctx.triggerScreenShake(6, 0.16);
      const cx = clampX(p.x + Math.cos(aimAngle) * 72);
      const cy = clampY(p.y + Math.sin(aimAngle) * 72);
      pushBurst(p, cx, cy, 138, 0.32, true);
      for (let f = -1; f <= 1; f++) {
        const fa = aimAngle + f * 0.45;
        if (p.custom.fissures.length >= 16) p.custom.fissures.shift();
        p.custom.fissures.push({
          x1: p.x,
          y1: p.y,
          x2: clampX(p.x + Math.cos(fa) * 168),
          y2: clampY(p.y + Math.sin(fa) * 168),
          width: 22,
          life: 2.0,
          maxLife: 2.0,
          tick: 0.25
        });
      }
      spawnMagmaPool(p, cx, cy, 72, 10, 3.0, 0.2);
      ctx.damageEnemiesInCircle(cx, cy, 145, 1.65, 55, false, 0.25, {
        applyBurn: true,
        burnDps: 9,
        burnDuration: 3.0,
        akainuMarkTimer: 5.0
      });
    } else {
      // Golpe 4 (Finisher): DAI FUNKA — Puño volcánico colosal que vuela 310px y detona en cráter
      audio.playExplosion(1.4);
      audio.playRoar();
      ctx.triggerScreenShake(8, 0.2);
      ctx.triggerHaptic(22);
      state.hitstopTimer = 0.055;
      p.custom.projectiles.push({
        kind: 'daifunka',
        x: p.x + Math.cos(aimAngle) * 26,
        y: p.y + Math.sin(aimAngle) * 26,
        vx: Math.cos(aimAngle) * 620,
        vy: Math.sin(aimAngle) * 620,
        angle: aimAngle,
        radius: 56,
        dmgMult: 2.35,
        traveled: 0,
        maxRange: 310,
        life: 0.54,
        maxLife: 0.54,
        trailTick: 0,
        hitIds: [],
        explodeRadius: 145
      });
    }
  },

  // ==========================================================================
  // HABILIDADES H1 / H2 / H3 REHECHAS DESDE CERO
  // ==========================================================================
  onSkill(ctx, idx, aimAngle) {
    const { state, player: p, audio } = ctx;

    if (idx === 0) {
      // H1: RYUSEI KAZAN — 7 puños meteoro visibles cayendo en diagonal desde el cielo
      audio.playRoar();
      audio.playFireCrackle();
      ctx.triggerScreenShake(7, 0.22);
      const marked = state.enemies.filter((e: any) => e.hp > 0 && e.akainuMarkTimer > 0);
      const targets = marked.length > 0 ? marked : state.enemies.filter((e: any) => e.hp > 0);
      const meteors: VolcanicMeteor[] = p.custom.meteors;

      for (let m = 0; m < 7; m++) {
        let tx = p.x + Math.cos(aimAngle) * (120 + m * 36) + (Math.random() - 0.5) * 110;
        let ty = p.y + Math.sin(aimAngle) * (120 + m * 36) + (Math.random() - 0.5) * 110;
        if (targets.length > 0) {
          const t = targets[m % targets.length];
          tx = t.x + (Math.random() - 0.5) * 34;
          ty = t.y + (Math.random() - 0.5) * 34;
        }
        const ctxX = clampX(tx, 24);
        const ctxY = clampY(ty, 24);
        meteors.push({
          tx: ctxX,
          ty: ctxY,
          sx: ctxX - 140,
          sy: ctxY - 260,
          delay: m * 0.11,
          fallTime: 0.24,
          maxFallTime: 0.24,
          radius: 96,
          dmgMult: 1.25
        });
      }
      ctx.spawnFloatingText(p.x, p.y - 46, '☄️ ¡RYUSEI KAZAN!', '#FF6D00', 1.25);
    } else if (idx === 1) {
      // H2: HELLHOUND — Gigantesco sabueso de magma (390px) que deja un río ardiente continuo
      audio.playRoar();
      audio.playExplosion(1.2);
      ctx.triggerScreenShake(7, 0.18);
      p.custom.projectiles.push({
        kind: 'hound',
        x: p.x + Math.cos(aimAngle) * 26,
        y: p.y + Math.sin(aimAngle) * 26,
        vx: Math.cos(aimAngle) * 690,
        vy: Math.sin(aimAngle) * 690,
        angle: aimAngle,
        radius: 62,
        dmgMult: 2.6,
        traveled: 0,
        maxRange: 390,
        life: 0.62,
        maxLife: 0.62,
        trailTick: 0,
        hitIds: [],
        explodeRadius: 150
      });
      ctx.spawnFloatingText(p.x, p.y - 46, '🐕 ¡HELLHOUND!', '#FF7043', 1.25);
    } else if (idx === 2) {
      // H3: GREAT ERUPTION — Carga volcánica rápida (0.45s, 40% mitigación) -> 6 fisuras 310px + caldera 240px
      audio.playRoar();
      p.custom.greatEruptionTimer = 0.45;
      p.superArmorTimer = Math.max(p.superArmorTimer, 0.65);
      ctx.spawnFloatingText(p.x, p.y - 50, '🌋 ¡GREAT ERUPTION!', '#FF3D00', 1.35);
    }
  },

  // ==========================================================================
  // HOOKS DE COMBATE Y LOGIA
  // ==========================================================================
  onAfterDamageEnemy(ctx) {
    addMagma(ctx, 4);
    ctx.updateHUD();
  },

  onEnemyKilled(ctx) {
    addMagma(ctx, 10);
    ctx.updateHUD();
  },

  onBeforePlayerDamage(ctx, _incomingDmg, _isBlunt, attacker) {
    const p = ctx.player;
    const tx = attacker ? attacker.x : p.x;
    const ty = attacker ? attacker.y : p.y;
    spawnMagmaPool(p, tx, ty, 46, 9, 2.8, 0.15);

    if ((p.custom.magma || 0) >= 100) {
      ctx.audio.playFireCrackle();
      pushBurst(p, p.x, p.y, 95, 0.26, true);
      ctx.damageEnemiesInCircle(p.x, p.y, 95, 0.7, 32, true, 0, {
        applyBurn: true,
        burnDps: 12,
        burnDuration: 2.2
      });
    }

    const baseMult = 0.75;
    const channelMult = (p.custom.greatEruptionTimer || 0) > 0 ? 0.6 : 1.0;
    return { dmgMult: baseMult * channelMult };
  },

  onEnemyTick(p, en) {
    const pools: MagmaPool[] = p.custom.magmaPools || [];
    let slowMult = 1.0;
    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i];
      if (pool.slowPct > 0 && Math.hypot(en.x - pool.x, en.y - pool.y) <= pool.radius + en.radius) {
        slowMult = Math.min(slowMult, 1 - pool.slowPct);
      }
    }
    return slowMult < 1 ? { speedMult: slowMult } : {};
  },

  onUpdate(ctx, dt) {
    const { state, player: p, audio } = ctx;
    if (p.custom.magmaFistAnim > 0) {
      p.custom.magmaFistAnim = Math.max(0, p.custom.magmaFistAnim - dt);
    }

    // 1. Resolución de Great Eruption tras carga volcánica
    if (p.custom.greatEruptionTimer > 0) {
      p.custom.greatEruptionTimer -= dt;
      if (Math.random() < 0.75) {
        ctx.spawnParticle(p.x + (Math.random() - 0.5) * 52, p.y + (Math.random() - 0.5) * 52, '#FF6D00', 5.5, 0.32);
      }
      if (p.custom.greatEruptionTimer <= 0) {
        p.custom.greatEruptionTimer = 0;
        audio.playExplosion(1.6);
        audio.playRoar();
        ctx.triggerScreenShake(12, 0.32);
        ctx.triggerHaptic([40, 20, 40]);
        state.hitstopTimer = 0.08;

        pushBurst(p, p.x, p.y, 260, 0.48, true);
        spawnMagmaPool(p, p.x, p.y, 240, 14, 8.0, 0.35);

        // 6 fisuras volcánicas radiales de 310px
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * Math.PI * 2 + 0.2;
          const x2 = clampX(p.x + Math.cos(ang) * 310);
          const y2 = clampY(p.y + Math.sin(ang) * 310);
          if (p.custom.fissures.length >= 16) p.custom.fissures.shift();
          p.custom.fissures.push({ x1: p.x, y1: p.y, x2, y2, width: 32, life: 4.0, maxLife: 4.0, tick: 0.25 });
        }

        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          ctx.spawnParticle(p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, k % 2 === 0 ? '#FFAB40' : '#D32F2F', 6.5, 0.42, {
            shape: 'spark'
          });
        }
        ctx.damageEnemiesInCircle(p.x, p.y, 265, 3.3, 125, true, 0.85, {
          applyBurn: true,
          burnDps: 14,
          burnDuration: 3.5,
          akainuMarkTimer: 6.5,
          pierceShield: true
        });
      }
    }

    // 2. Proyectiles de magma (Meigo / Hound / Dai Funka)
    const projs: MagmaProjectile[] = p.custom.projectiles || [];
    for (let i = projs.length - 1; i >= 0; i--) {
      const pr = projs[i];
      const stepX = pr.vx * dt;
      const stepY = pr.vy * dt;
      pr.x += stepX;
      pr.y += stepY;
      pr.traveled += Math.hypot(stepX, stepY);
      pr.life -= dt;
      pr.trailTick -= dt;

      if (pr.trailTick <= 0) {
        pr.trailTick = 0.085;
        spawnMagmaPool(p, pr.x, pr.y, pr.kind === 'daifunka' ? 48 : 34, 8, 3.2, 0.18);
      }
      if (Math.random() < 0.65) {
        ctx.spawnParticle(pr.x, pr.y, Math.random() < 0.5 ? '#FF6D00' : '#FFAB40', 4.5, 0.25, { shape: 'spark' });
      }

      for (let j = 0; j < state.enemies.length; j++) {
        const en = state.enemies[j];
        if (en.hp <= 0 || pr.hitIds.includes(en)) continue;
        if (Math.hypot(en.x - pr.x, en.y - pr.y) <= en.radius + pr.radius) {
          pr.hitIds.push(en);
          const isSkillProj = pr.kind === 'hound' && pr.maxRange > 300;
          const { amount, isCrit } = ctx.calculatePlayerDamage(pr.dmgMult, isSkillProj);
          ctx.damageEnemy(en, amount, {
            isCrit,
            knockback: pr.kind === 'daifunka' ? 75 : 42,
            sourceX: pr.x,
            sourceY: pr.y,
            isNormalAttack: !isSkillProj,
            applyBurn: true,
            burnDps: 9,
            burnDuration: 3.0,
            akainuMarkTimer: 5.5
          });
        }
      }

      if (pr.life <= 0 || pr.traveled >= pr.maxRange) {
        if (pr.explodeRadius > 0) {
          audio.playExplosion(pr.kind === 'daifunka' ? 1.3 : 0.95);
          pushBurst(p, pr.x, pr.y, pr.explodeRadius, 0.34, true);
          spawnMagmaPool(p, pr.x, pr.y, pr.explodeRadius * 0.65, 10, 3.8, 0.25);
          const isSkillProj = pr.kind === 'hound' && pr.maxRange > 300;
          ctx.damageEnemiesInCircle(pr.x, pr.y, pr.explodeRadius, pr.kind === 'daifunka' ? 1.4 : 1.0, 58, isSkillProj, 0.35, {
            applyBurn: true,
            burnDps: 10,
            burnDuration: 3.0,
            akainuMarkTimer: 5.0
          });
        }
        projs.splice(i, 1);
      }
    }

    // 3. Meteoros visibles de Ryusei Kazan cayendo del cielo
    const meteors: VolcanicMeteor[] = p.custom.meteors || [];
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      if (m.delay > 0) {
        m.delay -= dt;
        continue;
      }
      m.fallTime -= dt;
      if (m.fallTime <= 0) {
        audio.playExplosion(1.15);
        ctx.triggerScreenShake(5, 0.14);
        pushBurst(p, m.tx, m.ty, m.radius, 0.30, true);
        for (let k = 0; k < 6; k++) {
          ctx.spawnParticle(m.tx, m.ty, k % 2 === 0 ? '#FFAB40' : '#D32F2F', 5, 0.32, { shape: 'spark' });
        }
        spawnMagmaPool(p, m.tx, m.ty, 58, 10, 3.8, 0.2);
        ctx.damageEnemiesInCircle(m.tx, m.ty, m.radius, m.dmgMult, 48, true, 0.3, {
          applyBurn: true,
          burnDps: 10,
          burnDuration: 3.0,
          akainuMarkTimer: 5.0
        });
        meteors.splice(i, 1);
      }
    }

    // 4. Fisuras de lava ardiente en el suelo
    const fissures: LavaFissure[] = p.custom.fissures || [];
    for (let i = fissures.length - 1; i >= 0; i--) {
      const f = fissures[i];
      f.life -= dt;
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = 0.35;
        for (let j = 0; j < state.enemies.length; j++) {
          const en = state.enemies[j];
          if (en.hp > 0 && ctx.pointToSegmentDist(en.x, en.y, f.x1, f.y1, f.x2, f.y2) <= en.radius + f.width) {
            ctx.damageEnemy(en, 8, { applyBurn: true, burnDps: 8, burnDuration: 2.0, damageTextColor: '#FF6D00' });
          }
        }
      }
      if (f.life <= 0) fissures.splice(i, 1);
    }

    // 5. Charcos y calderas de magma
    const pools: MagmaPool[] = p.custom.magmaPools || [];
    for (let i = pools.length - 1; i >= 0; i--) {
      const pool = pools[i];
      pool.life -= dt;
      pool.tick -= dt;
      if (pool.tick <= 0) {
        pool.tick = 0.45;
        const tickDmg = Math.max(2, Math.round(pool.dps * 0.45));
        for (let eIdx = 0; eIdx < state.enemies.length; eIdx++) {
          const en = state.enemies[eIdx];
          if (en.hp <= 0) continue;
          if (Math.hypot(en.x - pool.x, en.y - pool.y) <= pool.radius + en.radius) {
            ctx.damageEnemy(en, tickDmg, { ignoreFreezeMitigation: false });
          }
        }
      }
      if (pool.life <= 0) pools.splice(i, 1);
    }

    // 6. Ondas de erupción
    const bursts: MagmaBurstRing[] = p.custom.bursts || [];
    for (let i = bursts.length - 1; i >= 0; i--) {
      bursts[i].life -= dt;
      if (bursts[i].life <= 0) bursts.splice(i, 1);
    }

    ctx.updateHUD();
  },

  onCleanupEffects(p) {
    if (p.custom) {
      p.custom.magmaPools = [];
      p.custom.projectiles = [];
      p.custom.meteors = [];
      p.custom.fissures = [];
      p.custom.bursts = [];
      p.custom.greatEruptionTimer = 0;
    }
  },

  // ==========================================================================
  // HUD DINÁMICO (MAGMA 0-100)
  // ==========================================================================
  mountHUD(slotEl) {
    slotEl.innerHTML = `
      <div id="akainu-magma-hud" class="char-resource-hud" style="display:flex;">
        <span style="font-size:12px;">🌋</span>
        <div class="res-bar-outer" style="border-color:#FF6D00; width:108px;">
          <div id="hud-akainu-magma-fill" class="res-bar-fill" style="width:0%; background:linear-gradient(90deg, #B71C1C, #FF6D00);"></div>
        </div>
        <span id="hud-akainu-magma-text" class="res-text text-outline-sm" style="color:#FFAB40;">MAGMA 0/100</span>
      </div>
    `;
  },

  updateHUD(p) {
    const hud = document.getElementById('akainu-magma-hud');
    const fill = document.getElementById('hud-akainu-magma-fill');
    const txt = document.getElementById('hud-akainu-magma-text');
    const val = Math.round(p.custom.magma || 0);
    if (hud) hud.classList.toggle('akainu-overheat', val >= 100);
    if (fill) fill.style.width = `${Math.min(100, val)}%`;
    if (txt) txt.textContent = val >= 100 ? 'MAGMA 100/100 🔥' : `MAGMA ${val}/100`;
  },

  // ==========================================================================
  // RENDERIZADO VOLCÁNICO EN MUNDO Y SPRITE EXISTENTE (34x46 px)
  // ==========================================================================
  drawWorldBeforePlayer({ ctx, player: p, t }) {
    // 1. Charcos y calderas de lava con corteza de obsidiana
    const pools: MagmaPool[] = p.custom.magmaPools || [];
    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i];
      const alpha = Math.min(0.9, pool.life / Math.min(1.0, pool.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(pool.x, pool.y, pool.radius * 0.12, pool.x, pool.y, pool.radius);
      grad.addColorStop(0, 'rgba(255, 196, 0, 0.72)');
      grad.addColorStop(0.5, 'rgba(255, 87, 34, 0.52)');
      grad.addColorStop(0.85, 'rgba(183, 28, 28, 0.35)');
      grad.addColorStop(1, 'rgba(26, 26, 26, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FF6D00';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pool.x, pool.y, pool.radius * (0.94 + Math.sin(t * 3 + i) * 0.03), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Fisuras volcánicas agrietando la arena
    const fissures: LavaFissure[] = p.custom.fissures || [];
    for (let i = 0; i < fissures.length; i++) {
      const f = fissures[i];
      const a = Math.max(0, Math.min(1, f.life / Math.min(1, f.maxLife)));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#260E0A';
      ctx.lineWidth = f.width + 10;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1);
      ctx.lineTo(f.x2, f.y2);
      ctx.stroke();

      ctx.strokeStyle = '#FF3D00';
      ctx.lineWidth = f.width * 0.6;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1);
      ctx.lineTo(f.x2, f.y2);
      ctx.stroke();

      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = f.width * 0.24;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1);
      ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Zonas de aterrizaje de meteoros Ryusei Kazan
    const meteors: VolcanicMeteor[] = p.custom.meteors || [];
    for (let i = 0; i < meteors.length; i++) {
      const m = meteors[i];
      ctx.save();
      ctx.strokeStyle = '#FF6D00';
      ctx.fillStyle = 'rgba(211, 47, 47, 0.25)';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(m.tx, m.ty, m.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  },

  drawWorldAfterPlayer({ ctx, state, player: p, t }) {
    // 1. Marcas ardientes de Akainu sobre enemigos
    for (let i = 0; i < state.enemies.length; i++) {
      const en = state.enemies[i];
      if (en.hp > 0 && (en.akainuMarkTimer || 0) > 0) {
        ctx.save();
        ctx.strokeStyle = '#FF6D00';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.75 + Math.sin(t * 8) * 0.2;
        ctx.beginPath();
        ctx.arc(en.x, en.y, en.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Proyectiles esculpidos: Puño Meigo, Sabueso Inugami Guren, Colosal Dai Funka
    const projs: MagmaProjectile[] = p.custom.projectiles || [];
    for (let i = 0; i < projs.length; i++) {
      const pr = projs[i];
      ctx.save();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.angle);

      if (pr.kind === 'hound') {
        // Estela ígnea trasera
        const trailGrad = ctx.createLinearGradient(-85, 0, 20, 0);
        trailGrad.addColorStop(0, 'rgba(211, 47, 47, 0)');
        trailGrad.addColorStop(0.5, 'rgba(255, 61, 0, 0.65)');
        trailGrad.addColorStop(1, 'rgba(255, 196, 0, 0.92)');
        ctx.fillStyle = trailGrad;
        ctx.beginPath();
        ctx.moveTo(-88, -pr.radius * 0.4);
        ctx.lineTo(18, -pr.radius * 0.72);
        ctx.lineTo(18, pr.radius * 0.72);
        ctx.lineTo(-88, pr.radius * 0.4);
        ctx.closePath();
        ctx.fill();

        // Cabeza de sabueso de magma con mandíbulas y ojos ardientes
        ctx.fillStyle = '#B71C1C';
        ctx.strokeStyle = '#FF9100';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pr.radius * 1.15, -6);
        ctx.lineTo(pr.radius * 0.3, -pr.radius * 0.85);
        ctx.lineTo(-pr.radius * 0.7, -pr.radius * 0.6);
        ctx.lineTo(-pr.radius * 0.5, 0);
        ctx.lineTo(-pr.radius * 0.7, pr.radius * 0.6);
        ctx.lineTo(pr.radius * 0.3, pr.radius * 0.85);
        ctx.lineTo(pr.radius * 1.1, 10);
        ctx.lineTo(pr.radius * 0.25, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Ojo amarillo incandescente
        ctx.fillStyle = '#FFEA00';
        ctx.beginPath();
        ctx.arc(pr.radius * 0.25, -pr.radius * 0.32, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Puño de magma con corteza de obsidiana y grietas incandescentes
        const r = pr.radius;
        const grad = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
        grad.addColorStop(0, '#FFF59D');
        grad.addColorStop(0.45, '#FF6D00');
        grad.addColorStop(0.85, '#B71C1C');
        grad.addColorStop(1, '#210B09');
        ctx.fillStyle = grad;
        ctx.strokeStyle = '#FFAB40';
        ctx.lineWidth = pr.kind === 'daifunka' ? 4 : 2.5;
        ctx.beginPath();
        ctx.roundRect(-r * 0.9, -r * 0.78, r * 1.9, r * 1.56, r * 0.45);
        ctx.fill();
        ctx.stroke();

        // Nudillos de obsidiana
        ctx.fillStyle = '#1A1A1A';
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.arc(r * 0.55, k * r * 0.42, r * 0.18, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 3. Meteoros cayendo desde el cielo en diagonal
    const meteors: VolcanicMeteor[] = p.custom.meteors || [];
    for (let i = 0; i < meteors.length; i++) {
      const m = meteors[i];
      if (m.delay > 0) continue;
      const prog = 1 - Math.max(0, m.fallTime / m.maxFallTime);
      const mx = m.sx + (m.tx - m.sx) * prog;
      const my = m.sy + (m.ty - m.sy) * prog;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 109, 0, 0.85)';
      ctx.lineWidth = 20;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(mx - 42, my - 78);
      ctx.lineTo(mx, my);
      ctx.stroke();

      ctx.fillStyle = '#FF6D00';
      ctx.strokeStyle = '#FFF59D';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx, my, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 4. Ondas y erupciones volcánicas
    const bursts: MagmaBurstRing[] = p.custom.bursts || [];
    for (let i = 0; i < bursts.length; i++) {
      const b = bursts[i];
      const a = Math.max(0, b.life / b.maxLife);
      const curR = b.radius * (0.35 + (1 - a) * 0.65);
      ctx.save();
      ctx.globalAlpha = a;
      const grad = ctx.createRadialGradient(b.x, b.y, curR * 0.1, b.x, b.y, curR);
      grad.addColorStop(0, `rgba(255, 235, 59, ${0.8 * a})`);
      grad.addColorStop(0.55, `rgba(255, 87, 34, ${0.52 * a})`);
      grad.addColorStop(1, 'rgba(183, 28, 28, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, curR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FF6D00';
      ctx.lineWidth = 7 * a;
      ctx.beginPath();
      ctx.arc(b.x, b.y, curR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  },

  drawAura({ ctx, player: p, t }) {
    if ((p.custom.magma || 0) >= 100 || (p.custom.greatEruptionTimer || 0) > 0) {
      ctx.strokeStyle = 'rgba(255, 109, 0, 0.85)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 10 + Math.sin(t * 4) * 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  drawBody({ ctx, player: p, t }) {
    // Capa blanca de Almirante y cuerpo robusto 34x46
    ctx.fillStyle = '#ECEFF1';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-21, -22, 16, 44, 6);
    ctx.fill();
    ctx.stroke();

    // Traje rojo magma #D32F2F y solapa negra #1A1A1A
    ctx.fillStyle = '#D32F2F';
    ctx.beginPath();
    ctx.roundRect(-14, -20, 28, 40, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(-4, -18, 10, 36);

    // Grietas de lava brillante #FF6D00 en el torso
    ctx.strokeStyle = '#FF6D00';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(2, -5);
    ctx.lineTo(-4, 4);
    ctx.lineTo(6, 12);
    ctx.stroke();

    // Puño derecho encendido con magma al golpear
    if ((p.custom.magmaFistAnim || 0) > 0 || (p.custom.magma || 0) >= 100) {
      ctx.fillStyle = '#FF6D00';
      ctx.beginPath();
      ctx.arc(17, 11, 7 + Math.sin(t * 6) * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#D32F2F';
      ctx.stroke();
    }

    // Cabeza y gorra de Almirante blanca con visera y detalles dorados
    ctx.fillStyle = '#E0AC84';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(2, 0, 11.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gorra blanca de Almirante
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 11, Math.PI * 0.45, Math.PI * 1.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Visera dorada/azul
    ctx.fillStyle = '#1A1A1A';
    ctx.beginPath();
    ctx.arc(10, 0, 6.5, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
    ctx.fillStyle = '#FFD54F';
    ctx.fillRect(-3, -3, 4, 6);

    // Cigarro en la boca con punta naranja brillante
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(9, 4);
    ctx.lineTo(19, 7);
    ctx.stroke();
    ctx.fillStyle = '#FF6D00';
    ctx.beginPath();
    ctx.arc(19, 7, 2.2, 0, Math.PI * 2);
    ctx.fill();
  },

  drawPreview(pctx, t) {
    pctx.fillStyle = '#D32F2F';
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.roundRect(-13, -6, 26, 22, 7);
    pctx.fill();
    pctx.stroke();

    // Grieta de magma
    pctx.strokeStyle = '#FF6D00';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.moveTo(-6, -2);
    pctx.lineTo(2, 4);
    pctx.lineTo(-3, 11);
    pctx.stroke();

    // Cabeza
    pctx.fillStyle = '#E0AC84';
    pctx.strokeStyle = '#000';
    pctx.beginPath();
    pctx.arc(0, -10, 10, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    // Gorra de Almirante
    pctx.fillStyle = '#FFFFFF';
    pctx.beginPath();
    pctx.roundRect(-11, -21, 22, 9, 4);
    pctx.fill();
    pctx.stroke();
    pctx.fillStyle = '#FFD54F';
    pctx.fillRect(-5, -18, 10, 3);

    // Cigarro brillante
    pctx.strokeStyle = '#5D4037';
    pctx.lineWidth = 2.5;
    pctx.beginPath();
    pctx.moveTo(4, -7);
    pctx.lineTo(14, -5);
    pctx.stroke();
    pctx.fillStyle = Math.sin(t * 5) > 0 ? '#FF6D00' : '#FFAB40';
    pctx.beginPath();
    pctx.arc(14, -5, 2.2, 0, Math.PI * 2);
    pctx.fill();
  }
};
