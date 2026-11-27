import { CONFIG } from '../config';
import { calculateZoroWanoKohEmpowerment } from '../rules';
import type { ButtonUIHelpers, CharacterContext, CharacterModule } from './types';

// ============================================================================
// ZORO (WANO) — Shichibukai · Rey del Infierno · Santoryu + Enma + Haoshoku
// ============================================================================

interface ZoroCrescentSlash {
  x: number;
  y: number;
  angle: number;
  range: number;
  halfAngle: number;
  swingDir: 1 | -1;
  color: string;
  edgeColor: string;
  life: number;
  maxLife: number;
  thickness: number;
  isDouble?: boolean;
}

interface ZoroFlyingWave {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  width: number;
  dmgMult: number;
  pierceShield: boolean;
  isSkill: boolean;
  isDragonFire?: boolean;
  traveled: number;
  maxRange: number;
  life: number;
  maxLife: number;
  hitIds: any[];
}

interface ZoroWorldCut {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
  life: number;
  maxLife: number;
  dps: number;
  tick: number;
}

interface ZoroXCut {
  x: number;
  y: number;
  angle: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface ZoroCyclone {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  isDragon: boolean;
}

interface ZoroLightningBolt {
  pts: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  life: number;
  maxLife: number;
}

function clampArenaX(x: number, pad = 34): number {
  return Math.max(CONFIG.ARENA_MARGIN_X + pad, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - pad, x));
}

function clampArenaY(y: number, pad = 34): number {
  return Math.max(CONFIG.ARENA_MARGIN_Y + pad, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - pad, y));
}

function addEnmaEnergy(ctx: CharacterContext, amount: number): void {
  const p = ctx.player;
  const prev = p.custom.enma || 0;
  p.custom.enma = Math.min(100, prev + amount);
  if (prev < 100 && p.custom.enma >= 100) {
    ctx.audio.playShing();
    ctx.spawnFloatingText(p.x, p.y - 46, '⚡ ¡ENMA DESPERTADA!', '#00E676', 1.15);
  }
}

function pushLightningBolt(
  p: CharacterContext['player'],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 3.2,
  life = 0.22
): void {
  const bolts: ZoroLightningBolt[] = p.custom.bolts;
  if (bolts.length >= 16) bolts.shift();
  const segs = 5;
  const pts: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const jitter = (Math.random() - 0.5) * Math.min(28, len * 0.22);
    pts.push({
      x: x1 + dx * t + nx * jitter,
      y: y1 + dy * t + ny * jitter
    });
  }
  pts.push({ x: x2, y: y2 });
  bolts.push({ pts, color, width, life, maxLife: life });
}

function pushCrescentSlash(
  p: CharacterContext['player'],
  x: number,
  y: number,
  angle: number,
  range: number,
  halfAngle: number,
  swingDir: 1 | -1,
  color: string,
  edgeColor: string,
  thickness = 22,
  life = 0.22,
  isDouble = false
): void {
  const arr: ZoroCrescentSlash[] = p.custom.crescents;
  if (arr.length >= 16) arr.shift();
  arr.push({
    x,
    y,
    angle,
    range,
    halfAngle,
    swingDir,
    color,
    edgeColor,
    life,
    maxLife: life,
    thickness,
    isDouble
  });
}

function pushWorldCut(
  p: CharacterContext['player'],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: string,
  life: number,
  dps = 0
): void {
  const arr: ZoroWorldCut[] = p.custom.worldCuts;
  if (arr.length >= 10) arr.shift();
  arr.push({ x1, y1, x2, y2, width, color, life, maxLife: life, dps, tick: 0.25 });
}

function spawnFlyingWave(
  p: CharacterContext['player'],
  x: number,
  y: number,
  angle: number,
  speed: number,
  width: number,
  maxRange: number,
  dmgMult: number,
  isSkill: boolean,
  pierceShield = false,
  isDragonFire = false
): void {
  const arr: ZoroFlyingWave[] = p.custom.flyingWaves;
  if (arr.length >= 10) arr.shift();
  const life = maxRange / speed + 0.08;
  arr.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    width,
    dmgMult,
    pierceShield,
    isSkill,
    isDragonFire,
    traveled: 0,
    maxRange,
    life,
    maxLife: life,
    hitIds: []
  });
}

function triggerAsuraBurst(ctx: CharacterContext, burstIdx: number): void {
  const { state, player: p, audio } = ctx;
  const ang = p.custom.asuraAngle || p.facingAngle;
  audio.playSlash(1.3 + burstIdx * 0.12);
  audio.playShing();

  // 3 tajos cruzados superpuestos simulando los 9 filos del Asura
  const angles = [ang - 0.42, ang, ang + 0.42];
  angles.forEach((a, i) => {
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
    pushCrescentSlash(
      p,
      p.x,
      p.y,
      a,
      148 + i * 10,
      Math.PI * 0.48,
      dir,
      i === 1 ? '#00E676' : '#AB47BC',
      '#FFFFFF',
      20,
      0.24,
      true
    );
  });

  if (p.custom.xCuts.length >= 12) p.custom.xCuts.shift();
  p.custom.xCuts.push({
    x: p.x + Math.cos(ang) * 48,
    y: p.y + Math.sin(ang) * 48,
    angle: ang + (burstIdx - 1) * 0.35,
    size: 86,
    color: burstIdx === 2 ? '#00E676' : '#CE93D8',
    life: 0.34,
    maxLife: 0.34
  });

  for (let k = 0; k < 4; k++) {
    const ba = ang + (Math.random() - 0.5) * 2.4;
    pushLightningBolt(
      p,
      p.x,
      p.y,
      p.x + Math.cos(ba) * (95 + Math.random() * 55),
      p.y + Math.sin(ba) * (95 + Math.random() * 55),
      k % 2 === 0 ? '#00E676' : '#FF1744',
      2.8,
      0.22
    );
  }

  let hitAny = false;
  state.enemies.forEach((en) => {
    if (en.hp <= 0) return;
    if (Math.hypot(en.x - p.x, en.y - p.y) - en.radius <= 155) {
      const { amount, isCrit } = ctx.calculatePlayerDamage(burstIdx === 2 ? 1.55 : 1.2, true);
      ctx.damageEnemy(en, amount, {
        isCrit,
        knockback: burstIdx === 2 ? 90 : 28,
        sourceX: p.x,
        sourceY: p.y,
        stun: burstIdx === 2 ? 0.55 : 0.15,
        pierceShield: burstIdx === 2,
        killerBleedStacks: 1
      });
      hitAny = true;
    }
  });
  if (hitAny) {
    addEnmaEnergy(ctx, 5);
    state.hitstopTimer = burstIdx === 2 ? 0.06 : 0.025;
  }
  if (burstIdx === 2) {
    ctx.triggerScreenShake(7, 0.16);
    ctx.triggerHaptic(18);
  }
}

function endKingOfHell(ctx: CharacterContext, unleashFinisher: boolean): void {
  const { state, player: p, audio } = ctx;
  if (!p.custom.kohActive) return;
  p.custom.kohActive = false;
  p.custom.kohTimer = 0;

  if (unleashFinisher) {
    const aim = ctx.getAimAngle();
    p.facingAngle = aim;
    audio.playRoar();
    audio.playExplosion(1.3);
    ctx.triggerScreenShake(10, 0.24);
    ctx.triggerHaptic(24);
    state.hitstopTimer = 0.08;
    ctx.spawnFloatingText(p.x, p.y - 52, '🐉 ¡103 MERCIES: DRAGON DAMNATION!', '#00E676', 1.3);

    spawnFlyingWave(p, p.x + Math.cos(aim) * 24, p.y + Math.sin(aim) * 24, aim, 760, 96, 360, 4.1, true, true, true);
    pushWorldCut(
      p,
      p.x,
      p.y,
      clampArenaX(p.x + Math.cos(aim) * 320),
      clampArenaY(p.y + Math.sin(aim) * 320),
      18,
      '#00E676',
      3.5,
      14
    );
    p.skillCds[2] = Math.max(4.0, p.skillMaxCds[2] * 0.72);
  } else {
    ctx.spawnFloatingText(p.x, p.y - 46, 'Fin de Rey del Infierno', '#A5D6A7', 1.0);
    p.skillCds[2] = p.skillMaxCds[2];
  }
  ctx.updateHUD();
  ctx.updateCooldownUI();
}

export const zoroWanoCharacter: CharacterModule = {
  id: 'zoro_wano',
  name: 'Zoro (Wano)',
  faction: 'pirates',
  rarity: 'shichibukai',
  portrait: '👹',
  portraitBg: 'linear-gradient(135deg, #1B5E20 0%, #4A148C 55%, #0D1117 100%)',
  attackIcon: '⚔️',
  themeClass: 'theme-zoro_wano',
  color: '#00E676',
  vestColor: '#1B5E20',
  hp: 135,
  damage: 21,
  speed: 5.2,
  armor: 11,
  dashCd: 1.8,
  autoAimRange: 300,
  skills: [
    { name: 'Asura', icon: '👹', cd: 7.5 },
    { name: 'Dragon Dam.', icon: '🐉', cd: 9.0 },
    { name: 'King of Hell', icon: '💚', cd: 13.0 }
  ],
  cardMeta: {
    displayName: 'ZORO (WANO)',
    zarparName: 'ZORO (WANO)',
    epithet: 'Rey del Infierno · Onigashima',
    nameColor: '#00E676',
    role: 'Shichibukai Espadachín / Crítico',
    passiveText: 'Pasiva: Dominio de Enma (+12% crit / +12% daño ≥50 Enma; Haoshoku rompe armadura)',
    passiveColor: '#69F0AE',
    stats: { hp: 82, dmg: 94, vel: 76, arm: 68 },
    comboDesc:
      '<b>Combo 4 golpes:</b> Yakkodori → Tornado Kokujo → Cruz Rengoku → <b>Onda Haoshoku</b> (corte volador 260px + fisura).',
    skillsDesc:
      '<b>H1:</b> Asura (ilusión 9 espadas) • <b>H2:</b> Salto Dragon Damnation • <b>H3:</b> Modo Rey del Infierno (re-tocar: remate 103 Mercies).'
  },

  // ==========================================================================
  // ESTADO PROPIO Y LIMPIEZA
  // ==========================================================================
  createCustomState: () => ({
    enma: 0,
    kohActive: false,
    kohTimer: 0,
    asuraTimer: 0,
    asuraAngle: 0,
    asuraBurstsLeft: 0,
    asuraBurstTick: 0,
    dragonJump: null as {
      startX: number;
      startY: number;
      targetX: number;
      targetY: number;
      elapsed: number;
      duration: number;
      hitDone: boolean;
    } | null,
    spinTimer: 0,
    crescents: [] as ZoroCrescentSlash[],
    flyingWaves: [] as ZoroFlyingWave[],
    worldCuts: [] as ZoroWorldCut[],
    xCuts: [] as ZoroXCut[],
    cyclones: [] as ZoroCyclone[],
    bolts: [] as ZoroLightningBolt[]
  }),

  onCleanupEffects(p) {
    p.custom.kohActive = false;
    p.custom.kohTimer = 0;
    p.custom.asuraTimer = 0;
    p.custom.asuraBurstsLeft = 0;
    p.custom.dragonJump = null;
    p.custom.spinTimer = 0;
    p.custom.crescents = [];
    p.custom.flyingWaves = [];
    p.custom.worldCuts = [];
    p.custom.xCuts = [];
    p.custom.cyclones = [];
    p.custom.bolts = [];
  },

  canAttack: (p) => !p.custom.dragonJump,
  isMovementLocked: (p) => Boolean(p.custom.dragonJump),

  getFlyOffsetY(p) {
    if (p.custom.dragonJump) {
      const prog = Math.min(1, p.custom.dragonJump.elapsed / p.custom.dragonJump.duration);
      return -Math.sin(prog * Math.PI) * 68;
    }
    return 0;
  },

  getBodySpin(p) {
    if ((p.custom.spinTimer || 0) > 0) {
      return (0.26 - p.custom.spinTimer) * 32;
    }
    return 0;
  },

  getMoveSpeedMult(p) {
    let mult = 1.0;
    if (p.custom.kohActive) mult *= 1.25;
    if ((p.custom.asuraTimer || 0) > 0) mult *= 1.35;
    return mult;
  },

  // ==========================================================================
  // PASIVA Y ESCALADO DE DAÑO (ENMA / REY DEL INFIERNO)
  // ==========================================================================
  onCalculateDamage(p) {
    const emp = calculateZoroWanoKohEmpowerment(p.custom.enma || 0, Boolean(p.custom.kohActive));
    return {
      dmgMult: emp.dmgMult,
      extraCritChance: emp.extraCritChance,
      critMult: emp.critMult
    };
  },

  onModifyDamageEnemy(p, _en, opts) {
    const emp = calculateZoroWanoKohEmpowerment(p.custom.enma || 0, Boolean(p.custom.kohActive));
    if (emp.ignoreArmorPct > 0) {
      return {
        ignoreArmorPct: Math.max(opts.ignoreArmorPct || 0, emp.ignoreArmorPct),
        damageTextColor: p.custom.kohActive ? '#00E676' : opts.damageTextColor
      };
    }
    return {};
  },

  onAfterDamageEnemy(ctx) {
    addEnmaEnergy(ctx, 4);
  },

  onEnemyKilled(ctx) {
    addEnmaEnergy(ctx, 10);
  },

  // ==========================================================================
  // COMBO BÁSICO SANTORYU WANO (4 GOLPES EVOLUCIONADOS)
  // ==========================================================================
  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const isKoh = Boolean(p.custom.kohActive);
    const step = p.comboStep % 4;
    p.comboStep = (step + 1) % 4;
    p.comboResetTimer = 1.0;
    p.attackCooldown = step === 3 ? 0.34 : 0.21;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = 0.23;

    const mainCol = isKoh ? '#00E676' : '#69F0AE';
    const edgeCol = isKoh ? '#B9F6CA' : '#FFFFFF';

    if (step === 0) {
      // Golpe 1: Yakkodori — media luna esmeralda-púrpura afilada
      audio.playSlash(1.1);
      audio.playShing();
      pushCrescentSlash(p, p.x, p.y, aimAngle, 128, Math.PI * 0.42, 1, mainCol, edgeCol, 22, 0.2, isKoh);
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 128, Math.PI * 0.42, 1.05, 36, true);
    } else if (step === 1) {
      // Golpe 2: Kokujo O Tatsumaki — torbellino giratorio 360° que atrae levemente
      p.custom.spinTimer = 0.26;
      audio.playSlash(1.25);
      audio.playFwoosh();
      if (p.custom.cyclones.length >= 6) p.custom.cyclones.shift();
      p.custom.cyclones.push({ x: p.x, y: p.y, radius: 132, life: 0.34, maxLife: 0.34, isDragon: isKoh });
      pushCrescentSlash(p, p.x, p.y, aimAngle, 132, Math.PI * 0.92, -1, '#AB47BC', mainCol, 18, 0.24, true);

      state.enemies.forEach((en) => {
        if (en.hp <= 0) return;
        const dx = en.x - p.x;
        const dy = en.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d - en.radius <= 132) {
          const { amount, isCrit } = ctx.calculatePlayerDamage(1.15, false);
          ctx.damageEnemy(en, amount, { isCrit, knockback: -28, sourceX: p.x, sourceY: p.y, applyBleed: true });
        }
      });
    } else if (step === 2) {
      // Golpe 3: Rengoku Oni Giri — estocada corta con cruz X esmeralda-púrpura
      p.momentumTimer = 0.12;
      p.momentumDirX = Math.cos(aimAngle);
      p.momentumDirY = Math.sin(aimAngle);
      audio.playSlash(1.35);
      audio.playShing();
      pushCrescentSlash(p, p.x, p.y, aimAngle - 0.18, 148, Math.PI * 0.38, 1, mainCol, '#FFFFFF', 24, 0.22, true);
      pushCrescentSlash(p, p.x, p.y, aimAngle + 0.18, 148, Math.PI * 0.38, -1, '#9C27B0', '#69F0AE', 20, 0.22, false);
      if (p.custom.xCuts.length >= 12) p.custom.xCuts.shift();
      p.custom.xCuts.push({
        x: p.x + Math.cos(aimAngle) * 76,
        y: p.y + Math.sin(aimAngle) * 76,
        angle: aimAngle,
        size: 64,
        color: isKoh ? '#00E676' : '#BA68C8',
        life: 0.28,
        maxLife: 0.28
      });
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 148, Math.PI * 0.42, 1.38, 48, true, 0, 0, {
        killerBleedStacks: isKoh ? 1 : 0
      });
    } else {
      // Golpe 4 (Finisher): 103 Mercies Haoshoku Wave — corte volador + fisura luminosa
      p.momentumTimer = 0.11;
      p.momentumDirX = Math.cos(aimAngle);
      p.momentumDirY = Math.sin(aimAngle);
      audio.playSlash(1.5);
      audio.playThunder();
      ctx.triggerScreenShake(5, 0.13);
      ctx.triggerHaptic(14);
      state.hitstopTimer = 0.05;

      pushCrescentSlash(p, p.x, p.y, aimAngle, 165, Math.PI * 0.5, 1, mainCol, '#FFFFFF', 28, 0.26, true);
      spawnFlyingWave(p, p.x + Math.cos(aimAngle) * 20, p.y + Math.sin(aimAngle) * 20, aimAngle, 640, 66, 260, 1.95, false, isKoh, isKoh);
      pushWorldCut(
        p,
        p.x + Math.cos(aimAngle) * 18,
        p.y + Math.sin(aimAngle) * 18,
        clampArenaX(p.x + Math.cos(aimAngle) * 220),
        clampArenaY(p.y + Math.sin(aimAngle) * 220),
        10,
        mainCol,
        1.8,
        isKoh ? 10 : 0
      );
      for (let k = 0; k < 3; k++) {
        const a = aimAngle + (Math.random() - 0.5) * 0.9;
        pushLightningBolt(p, p.x, p.y, p.x + Math.cos(a) * 140, p.y + Math.sin(a) * 140, mainCol, 2.5, 0.2);
      }
    }

    // Si Rey del Infierno está activo, cada golpe normal dispara una pequeña onda cortante adicional
    if (isKoh && step !== 3) {
      spawnFlyingWave(p, p.x + Math.cos(aimAngle) * 16, p.y + Math.sin(aimAngle) * 16, aimAngle, 600, 40, 185, 0.65, false, true, false);
    }
  },

  onDash(ctx) {
    const { player: p, audio } = ctx;
    p.customDashDist = CONFIG.DASH_DISTANCE * 1.1;
    p.invulnTimer = CONFIG.DASH_IFRAMES;
    audio.playSlash(1.1);
    const endX = clampArenaX(p.x + p.dashDirX * p.customDashDist);
    const endY = clampArenaY(p.y + p.dashDirY * p.customDashDist);
    pushWorldCut(p, p.x, p.y, endX, endY, 6, p.custom.kohActive ? '#00E676' : '#AB47BC', 0.45, 0);
  },

  // ==========================================================================
  // HABILIDADES H1 / H2 / H3
  // ==========================================================================
  onSkillReactivate(ctx, idx) {
    if (idx === 2 && ctx.player.custom.kohActive) {
      endKingOfHell(ctx, true);
      return true;
    }
    return false;
  },

  onSkill(ctx, idx, aimAngle) {
    const { state, player: p, audio } = ctx;

    if (idx === 0) {
      // H1: ASURA: BAKKEI (Ilusión 9 espadas + embestida invulnerable de 3 ráfagas)
      p.custom.asuraTimer = 0.56;
      p.custom.asuraAngle = aimAngle;
      p.custom.asuraBurstsLeft = 2;
      p.custom.asuraBurstTick = 0.16;
      p.invulnTimer = Math.max(p.invulnTimer, 0.48);
      p.superArmorTimer = Math.max(p.superArmorTimer, 0.55);
      p.momentumTimer = 0.38;
      p.momentumDirX = Math.cos(aimAngle);
      p.momentumDirY = Math.sin(aimAngle);
      ctx.spawnFloatingText(p.x, p.y - 46, '👹 ¡KYUTORYU: ASURA!', '#CE93D8', 1.25);
      triggerAsuraBurst(ctx, 0);
      return false;
    }

    if (idx === 1) {
      // H2: DRAGON DAMNATION — Salto aéreo con dragón esmeralda + impacto devastador
      const target = ctx.findNearestEnemy(310);
      const jumpDist = target ? Math.min(220, Math.hypot(target.x - p.x, target.y - p.y)) : 165;
      const ang = target ? Math.atan2(target.y - p.y, target.x - p.x) : aimAngle;
      p.facingAngle = ang;
      p.invulnTimer = Math.max(p.invulnTimer, 0.45);
      p.custom.dragonJump = {
        startX: p.x,
        startY: p.y,
        targetX: clampArenaX(p.x + Math.cos(ang) * jumpDist, 40),
        targetY: clampArenaY(p.y + Math.sin(ang) * jumpDist, 40),
        elapsed: 0,
        duration: 0.34,
        hitDone: false
      };
      audio.playRoar();
      audio.playSlash(1.4);
      ctx.spawnFloatingText(p.x, p.y - 48, '🐉 ¡DRAGON DAMNATION!', '#00E676', 1.25);
      return false;
    }

    if (idx === 2) {
      // H3: KING OF HELL — Despertar Haoshoku + llamas infernales en las 3 espadas
      p.custom.kohActive = true;
      p.custom.kohTimer = 9.0;
      p.custom.enma = Math.max(p.custom.enma || 0, 75);
      p.superArmorTimer = Math.max(p.superArmorTimer, 0.7);
      audio.playThunder();
      audio.playRoar();
      ctx.triggerScreenShake(9, 0.24);
      ctx.triggerHaptic(26);
      state.hitstopTimer = 0.08;
      ctx.spawnFloatingText(p.x, p.y - 52, '💚 ¡REY DEL INFIERNO!', '#00E676', 1.35);

      if (p.custom.cyclones.length >= 6) p.custom.cyclones.shift();
      p.custom.cyclones.push({ x: p.x, y: p.y, radius: 225, life: 0.42, maxLife: 0.42, isDragon: true });

      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        pushLightningBolt(
          p,
          p.x,
          p.y,
          p.x + Math.cos(a) * 195,
          p.y + Math.sin(a) * 195,
          k % 2 === 0 ? '#00E676' : '#FF1744',
          3.4,
          0.32
        );
      }

      ctx.damageEnemiesInCircle(p.x, p.y, 225, 2.25, 130, true, 1.35, {
        pierceShield: true,
        killerBleedStacks: 2
      });
      ctx.updateHUD();
      return true;
    }
  },

  // ==========================================================================
  // ACTUALIZACIÓN POR FRAME
  // ==========================================================================
  onUpdate(ctx, dt) {
    const { state, player: p, audio } = ctx;

    // 1. King of Hell timer & ambient Haoshoku sparks
    if (p.custom.kohActive) {
      p.custom.kohTimer = Math.max(0, p.custom.kohTimer - dt);
      if (Math.random() < 0.32) {
        const a = Math.random() * Math.PI * 2;
        pushLightningBolt(
          p,
          p.x + Math.cos(a) * 14,
          p.y + Math.sin(a) * 14,
          p.x + Math.cos(a) * 44,
          p.y + Math.sin(a) * 44,
          Math.random() < 0.7 ? '#00E676' : '#AB47BC',
          2.0,
          0.14
        );
      }
      if (p.custom.kohTimer <= 0) {
        endKingOfHell(ctx, false);
      }
    }

    // 2. Asura bursts
    if ((p.custom.asuraTimer || 0) > 0) {
      p.custom.asuraTimer = Math.max(0, p.custom.asuraTimer - dt);
    }
    if ((p.custom.asuraBurstsLeft || 0) > 0) {
      p.custom.asuraBurstTick -= dt;
      if (p.custom.asuraBurstTick <= 0) {
        p.custom.asuraBurstTick = 0.16;
        const idx = 3 - p.custom.asuraBurstsLeft;
        p.custom.asuraBurstsLeft--;
        triggerAsuraBurst(ctx, idx);
      }
    }

    // 3. Spin timer
    if ((p.custom.spinTimer || 0) > 0) {
      p.custom.spinTimer = Math.max(0, p.custom.spinTimer - dt);
    }

    // 4. Salto Dragon Damnation
    if (p.custom.dragonJump) {
      const dj = p.custom.dragonJump;
      dj.elapsed += dt;
      const prog = Math.min(1, dj.elapsed / dj.duration);
      p.x = dj.startX + (dj.targetX - dj.startX) * prog;
      p.y = dj.startY + (dj.targetY - dj.startY) * prog;

      if (Math.random() < 0.65) {
        ctx.spawnParticle(p.x, p.y - Math.sin(prog * Math.PI) * 58, Math.random() < 0.5 ? '#00E676' : '#FF1744', 5, 0.25);
      }

      if (prog >= 1 && !dj.hitDone) {
        dj.hitDone = true;
        p.landSquashTimer = 0.18;
        audio.playExplosion(1.35);
        audio.playThunder();
        ctx.triggerScreenShake(10, 0.22);
        ctx.triggerHaptic(24);
        state.hitstopTimer = 0.08;

        if (p.custom.cyclones.length >= 6) p.custom.cyclones.shift();
        p.custom.cyclones.push({ x: p.x, y: p.y, radius: 195, life: 0.45, maxLife: 0.45, isDragon: true });

        // Cruz de dragón + fisura ardiente esmeralda
        const ang = p.facingAngle;
        pushWorldCut(
          p,
          clampArenaX(p.x - Math.cos(ang) * 140),
          clampArenaY(p.y - Math.sin(ang) * 140),
          clampArenaX(p.x + Math.cos(ang) * 170),
          clampArenaY(p.y + Math.sin(ang) * 170),
          16,
          '#00E676',
          4.0,
          16
        );
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          pushLightningBolt(
            p,
            p.x,
            p.y,
            p.x + Math.cos(a) * 165,
            p.y + Math.sin(a) * 165,
            k % 2 === 0 ? '#00E676' : '#FF1744',
            3.2,
            0.28
          );
        }
        ctx.damageEnemiesInCircle(p.x, p.y, 190, 3.45, 145, true, 0.9, {
          pierceShield: true,
          ignoreArmorPct: 0.60,
          applyBurn: true,
          burnDps: 14,
          burnDuration: 3.0,
          killerBleedStacks: 2
        });
        p.custom.dragonJump = null;
      }
    }

    // 5. Ondas cortantes voladoras
    const waves: ZoroFlyingWave[] = p.custom.flyingWaves;
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      const stepX = w.vx * dt;
      const stepY = w.vy * dt;
      w.x += stepX;
      w.y += stepY;
      w.traveled += Math.hypot(stepX, stepY);
      w.life -= dt;

      if (Math.random() < 0.6) {
        ctx.spawnParticle(w.x, w.y, w.isDragonFire ? '#00E676' : '#69F0AE', 4, 0.22, { shape: 'spark' });
      }

      for (let j = 0; j < state.enemies.length; j++) {
        const en = state.enemies[j];
        if (en.hp <= 0 || w.hitIds.includes(en)) continue;
        if (Math.hypot(en.x - w.x, en.y - w.y) <= en.radius + w.width * 0.65) {
          w.hitIds.push(en);
          const { amount, isCrit } = ctx.calculatePlayerDamage(w.dmgMult, w.isSkill);
          ctx.damageEnemy(en, amount, {
            isCrit,
            knockback: 65,
            sourceX: w.x,
            sourceY: w.y,
            isNormalAttack: !w.isSkill,
            pierceShield: w.pierceShield,
            applyBleed: true,
            applyBurn: w.isDragonFire,
            burnDps: w.isDragonFire ? 12 : 0
          });
        }
      }

      if (w.life <= 0 || w.traveled >= w.maxRange) {
        waves.splice(i, 1);
      }
    }

    // 6. Cicatrices cortantes en el suelo (World Cuts)
    const cuts: ZoroWorldCut[] = p.custom.worldCuts;
    for (let i = cuts.length - 1; i >= 0; i--) {
      const c = cuts[i];
      c.life -= dt;
      if (c.dps > 0) {
        c.tick -= dt;
        if (c.tick <= 0) {
          c.tick = 0.35;
          state.enemies.forEach((en) => {
            if (en.hp > 0 && ctx.pointToSegmentDist(en.x, en.y, c.x1, c.y1, c.x2, c.y2) <= en.radius + c.width + 8) {
              ctx.damageEnemy(en, Math.round(c.dps * 0.35), {
                isCrit: false,
                knockback: 0,
                damageTextColor: '#69F0AE'
              });
            }
          });
        }
      }
      if (c.life <= 0) cuts.splice(i, 1);
    }

    // 7. Decay de VFX
    for (let i = p.custom.crescents.length - 1; i >= 0; i--) {
      p.custom.crescents[i].life -= dt;
      if (p.custom.crescents[i].life <= 0) p.custom.crescents.splice(i, 1);
    }
    for (let i = p.custom.xCuts.length - 1; i >= 0; i--) {
      p.custom.xCuts[i].life -= dt;
      if (p.custom.xCuts[i].life <= 0) p.custom.xCuts.splice(i, 1);
    }
    for (let i = p.custom.cyclones.length - 1; i >= 0; i--) {
      p.custom.cyclones[i].life -= dt;
      if (p.custom.cyclones[i].life <= 0) p.custom.cyclones.splice(i, 1);
    }
    for (let i = p.custom.bolts.length - 1; i >= 0; i--) {
      p.custom.bolts[i].life -= dt;
      if (p.custom.bolts[i].life <= 0) p.custom.bolts.splice(i, 1);
    }
  },

  // ==========================================================================
  // RENDERIZADO PERSONALIZADO (ENMA, ASURA, CORTES Y RAYOS HAOSHOKU)
  // ==========================================================================
  drawWorldBeforePlayer({ ctx, player: p, t }) {
    // Grietas luminosas de cortes en el suelo
    const cuts: ZoroWorldCut[] = p.custom.worldCuts || [];
    for (let i = 0; i < cuts.length; i++) {
      const c = cuts[i];
      const a = Math.max(0, Math.min(1, c.life / c.maxLife));
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#07140D';
      ctx.lineWidth = c.width + 6;
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();

      ctx.strokeStyle = c.color;
      ctx.lineWidth = Math.max(2, c.width * 0.55);
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();
      ctx.restore();
    }

    // Ilusiones de Asura flanqueando a Zoro
    if ((p.custom.asuraTimer || 0) > 0) {
      const a = Math.min(1, p.custom.asuraTimer / 0.25);
      const perp = p.facingAngle + Math.PI / 2;
      [-1, 1].forEach((side) => {
        ctx.save();
        ctx.translate(p.x + Math.cos(perp) * side * 28, p.y + Math.sin(perp) * side * 28);
        ctx.rotate(p.facingAngle + side * 0.22);
        ctx.globalAlpha = 0.45 * a;
        ctx.fillStyle = '#7B1FA2';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.92, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 2.6;
        for (let s = -1; s <= 1; s++) {
          ctx.beginPath();
          ctx.moveTo(-6, s * 11);
          ctx.lineTo(36, s * 16 + Math.sin(t * 25 + s) * 3);
          ctx.stroke();
        }
        ctx.restore();
      });
    }
  },

  drawWorldAfterPlayer({ ctx, player: p, t }) {
    // 1. Ciclos de tornado / dragón
    const cycs: ZoroCyclone[] = p.custom.cyclones || [];
    for (let i = 0; i < cycs.length; i++) {
      const cy = cycs[i];
      const prog = 1 - cy.life / cy.maxLife;
      const a = Math.max(0, cy.life / cy.maxLife);
      const curR = cy.radius * (0.35 + prog * 0.65);
      ctx.save();
      ctx.translate(cy.x, cy.y);
      ctx.rotate(t * 14 + prog * 5);
      ctx.globalAlpha = a * 0.85;
      for (let ring = 0; ring < 3; ring++) {
        const rr = curR * (0.52 + ring * 0.24);
        ctx.strokeStyle = ring === 1 ? (cy.isDragon ? '#FF1744' : '#AB47BC') : '#00E676';
        ctx.lineWidth = (6 - ring * 1.4) * a;
        ctx.beginPath();
        ctx.arc(0, 0, rr, ring * 1.4, ring * 1.4 + Math.PI * 1.35);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Medias lunas afiladas de Santoryu
    const cres: ZoroCrescentSlash[] = p.custom.crescents || [];
    for (let i = 0; i < cres.length; i++) {
      const c = cres[i];
      const prog = 1 - c.life / c.maxLife;
      const a = Math.max(0, c.life / c.maxLife);
      const head = Math.min(1, prog / 0.35);
      const tail = Math.max(0, (prog - 0.22) / 0.78) * 0.65;
      const sA = c.swingDir * (-c.halfAngle + 2 * c.halfAngle * tail);
      const eA = c.swingDir * (-c.halfAngle + 2 * c.halfAngle * head);
      const minA = Math.min(sA, eA);
      const maxA = Math.max(sA, eA);

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0D1310';
      ctx.lineWidth = (c.thickness + 6) * Math.max(0.45, a);
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.88, minA, maxA);
      ctx.stroke();

      ctx.strokeStyle = c.color;
      ctx.lineWidth = c.thickness * Math.max(0.45, a);
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.88, minA, maxA);
      ctx.stroke();

      ctx.strokeStyle = c.edgeColor;
      ctx.lineWidth = Math.max(2.5, c.thickness * 0.32 * a);
      ctx.beginPath();
      ctx.arc(0, 0, c.range * 0.94, minA, maxA);
      ctx.stroke();

      if (c.isDouble) {
        ctx.strokeStyle = '#AB47BC';
        ctx.lineWidth = Math.max(2.5, c.thickness * 0.25 * a);
        ctx.beginPath();
        ctx.arc(0, 0, c.range * 0.72, minA * 0.9, maxA * 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Cortes en X
    const xCuts: ZoroXCut[] = p.custom.xCuts || [];
    for (let i = 0; i < xCuts.length; i++) {
      const xc = xCuts[i];
      const a = Math.max(0, xc.life / xc.maxLife);
      ctx.save();
      ctx.translate(xc.x, xc.y);
      ctx.rotate(xc.angle);
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      [-0.65, 0.65].forEach((ang) => {
        ctx.save();
        ctx.rotate(ang);
        ctx.strokeStyle = xc.color;
        ctx.lineWidth = 10 * a;
        ctx.beginPath();
        ctx.moveTo(-xc.size, 0);
        ctx.lineTo(xc.size, 0);
        ctx.stroke();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3.5 * a;
        ctx.beginPath();
        ctx.moveTo(-xc.size * 0.9, 0);
        ctx.lineTo(xc.size * 0.9, 0);
        ctx.stroke();
        ctx.restore();
      });
      ctx.restore();
    }

    // 4. Ondas cortantes voladoras (Crescent Flying Slashes)
    const waves: ZoroFlyingWave[] = p.custom.flyingWaves || [];
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      const a = Math.max(0.2, Math.min(1, w.life / (w.maxLife * 0.35)));
      const hw = w.width * 0.5;
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.angle);
      ctx.globalAlpha = a;
      // Cuerpo de media luna afilada apuntando al frente
      ctx.fillStyle = w.isDragonFire ? '#00E676' : '#69F0AE';
      ctx.strokeStyle = '#071A0E';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.quadraticCurveTo(6, -hw * 0.72, -24, -hw);
      ctx.quadraticCurveTo(-4, 0, -24, hw);
      ctx.quadraticCurveTo(6, hw * 0.72, 18, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.quadraticCurveTo(4, -hw * 0.5, -14, -hw * 0.72);
      ctx.quadraticCurveTo(-2, 0, -14, hw * 0.72);
      ctx.quadraticCurveTo(4, hw * 0.5, 14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 5. Rayos negros y esmeralda de Haoshoku
    const bolts: ZoroLightningBolt[] = p.custom.bolts || [];
    for (let i = 0; i < bolts.length; i++) {
      const b = bolts[i];
      const a = Math.max(0, b.life / b.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#050507';
      ctx.lineWidth = b.width + 2.6;
      ctx.beginPath();
      b.pts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.stroke();

      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width;
      ctx.beginPath();
      b.pts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.stroke();
      ctx.restore();
    }
  },

  drawAura({ ctx, player: p, t }) {
    const isKoh = Boolean(p.custom.kohActive);
    const enmaHigh = (p.custom.enma || 0) >= 50;
    if (!isKoh && !enmaHigh) return;

    ctx.save();
    ctx.translate(p.x, p.y);
    const r = p.radius + (isKoh ? 18 : 11) + Math.sin(t * 9) * 3;
    ctx.strokeStyle = isKoh ? '#00E676' : '#AB47BC';
    ctx.lineWidth = isKoh ? 3.2 : 2.0;
    ctx.globalAlpha = isKoh ? 0.85 : 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    if (isKoh) {
      // Llamas esmeralda fantasmales de Rey del Infierno orbitando
      for (let i = 0; i < 4; i++) {
        const ang = t * 4.5 + (i * Math.PI) / 2;
        const fx = Math.cos(ang) * (p.radius + 13);
        const fy = Math.sin(ang) * (p.radius + 13);
        ctx.fillStyle = i % 2 === 0 ? '#00E676' : '#111116';
        ctx.beginPath();
        ctx.arc(fx, fy, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  drawBody({ ctx, player: p, cfg, t }) {
    const isKoh = Boolean(p.custom.kohActive);
    const atkSwing = p.attackAnimTimer > 0 ? Math.sin((p.attackAnimTimer / 0.23) * Math.PI) * 0.45 : 0;

    // 3 katanas (Wado Ichimonji blanca, Sandai Kitetsu roja, Enma púrpura-esmeralda)
    ctx.save();
    ctx.rotate(atkSwing);
    // Espada izquierda (Enma - llamas verdes/púrpura)
    ctx.strokeStyle = isKoh ? '#00E676' : '#CE93D8';
    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.moveTo(-12, -16);
    ctx.lineTo(30, -24);
    ctx.stroke();
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-12, -16);
    ctx.lineTo(30, -24);
    ctx.stroke();

    // Espada derecha (Sandai Kitetsu)
    ctx.strokeStyle = '#FF5252';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-12, 16);
    ctx.lineTo(28, 22);
    ctx.stroke();
    ctx.strokeStyle = '#EEEEEE';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 16);
    ctx.lineTo(28, 22);
    ctx.stroke();

    // Espada en boca (Wado Ichimonji - frontal)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(33, 2);
    ctx.stroke();
    ctx.restore();

    // Kimono Wano verde oscuro + faja dorada
    ctx.fillStyle = cfg.vestColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#C8A951';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius - 3.5, -0.9, 0.9);
    ctx.stroke();

    // Cabeza con pañuelo negro / pelo verde marimo
    ctx.fillStyle = isKoh ? '#1C1C22' : '#2E7D32';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(2, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Brillo Enma en la empuñadura
    if (isKoh || (p.custom.enma || 0) >= 50) {
      ctx.fillStyle = isKoh ? '#00E676' : '#AB47BC';
      ctx.globalAlpha = 0.75 + Math.sin(t * 14) * 0.2;
      ctx.beginPath();
      ctx.arc(28, -24, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  drawPreview(pctx, t, cfg) {
    const bob = Math.sin(t * 2) * 1.5;
    // Aura esmeralda sutil
    pctx.fillStyle = 'rgba(0, 230, 118, 0.18)';
    pctx.beginPath();
    pctx.arc(0, 0, 23, 0, Math.PI * 2);
    pctx.fill();

    // 3 katanas cruzadas
    pctx.lineCap = 'round';
    pctx.strokeStyle = '#00E676';
    pctx.lineWidth = 3.6;
    pctx.beginPath();
    pctx.moveTo(-20, -10 + bob);
    pctx.lineTo(20, 10 - bob);
    pctx.stroke();

    pctx.strokeStyle = '#E0E0E0';
    pctx.lineWidth = 2.4;
    pctx.beginPath();
    pctx.moveTo(-20, 10 + bob);
    pctx.lineTo(20, -10 - bob);
    pctx.moveTo(-22, 1);
    pctx.lineTo(22, 1);
    pctx.stroke();

    // Cuerpo kimono Wano
    pctx.fillStyle = cfg.vestColor;
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.arc(0, 2, 13, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    // Pañuelo negro + pelo verde
    pctx.fillStyle = '#1B1B20';
    pctx.beginPath();
    pctx.arc(0, -5, 9.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    pctx.fillStyle = '#00E676';
    pctx.beginPath();
    pctx.arc(-3, -6, 2.2, 0, Math.PI * 2);
    pctx.fill();
  },

  // ==========================================================================
  // HUD ESPECÍFICO Y BOTÓN REACTIVO DE REY DEL INFIERNO
  // ==========================================================================
  mountHUD(slotEl) {
    slotEl.innerHTML = `
      <div class="char-resource-hud" id="zoro-wano-hud" style="display:flex;">
        <div class="res-bar-outer" style="border-color:#00E676;">
          <div id="hud-zoro-wano-fill" class="res-bar-fill" style="background:linear-gradient(90deg,#7B1FA2,#00E676);"></div>
        </div>
        <span id="hud-zoro-wano-text" class="res-text text-outline-sm" style="color:#B9F6CA;">⚔️ ENMA 0/100</span>
      </div>
    `;
  },

  updateHUD(p) {
    const hud = document.getElementById('zoro-wano-hud');
    const fill = document.getElementById('hud-zoro-wano-fill');
    const txt = document.getElementById('hud-zoro-wano-text');
    const isKoh = Boolean(p.custom.kohActive);
    const val = Math.round(p.custom.enma || 0);
    if (hud) hud.classList.toggle('zoro-koh-active', isKoh);
    if (fill) {
      fill.style.width = isKoh ? `${Math.max(0, Math.min(100, (p.custom.kohTimer / 9.0) * 100))}%` : `${val}%`;
    }
    if (txt) {
      txt.textContent = isKoh ? `💚 KOH ${p.custom.kohTimer.toFixed(1)}s` : `⚔️ ENMA ${val}/100`;
    }
  },

  updateButtonsUI(p, helpers: ButtonUIHelpers) {
    const btn3 = helpers.getBtn(2);
    const lbl3 = helpers.getLabel(2);
    if (p.custom.kohActive) {
      btn3?.classList.add('chain-active');
      if (lbl3) lbl3.textContent = '103 Mercies';
      helpers.setSkillCooldownOverride(2, null, undefined, true);
    } else {
      btn3?.classList.remove('chain-active');
      if (lbl3) lbl3.textContent = 'King of Hell';
    }
  }
};
