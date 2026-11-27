import { CONFIG } from '../config';
import { resolveSanjiEggheadExoskeleton } from '../rules';
import type { ButtonUIHelpers, CharacterContext, CharacterModule } from './types';

// ============================================================================
// SANJI (EGGHEAD) — Shichibukai · Pierna Negra · Exoesqueleto + Ifrit Jambe
// ============================================================================

interface IfritKickArc {
  x: number;
  y: number;
  angle: number;
  range: number;
  halfAngle: number;
  swingDir: 1 | -1;
  life: number;
  maxLife: number;
}

interface VisibleKickAnim {
  mode: 'thrust' | 'sweep' | 'heel_drop' | 'boeuf';
  x: number;
  y: number;
  angle: number;
  range: number;
  halfAngle?: number;
  swingDir?: 1 | -1;
  legSide?: 1 | -1;
  followPlayer?: boolean;
  life: number;
  maxLife: number;
}

interface SanjiAfterimage {
  x: number;
  y: number;
  angle: number;
  life: number;
  maxLife: number;
}

interface PlasmaDome {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  isSonic?: boolean;
}

interface BlueBolt {
  pts: Array<{ x: number; y: number }>;
  width: number;
  life: number;
  maxLife: number;
}

interface BoeufBeam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angle: number;
  length: number;
  width: number;
  life: number;
  maxLife: number;
}

function clampX(x: number, pad = 32): number {
  return Math.max(CONFIG.ARENA_MARGIN_X + pad, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - pad, x));
}

function clampY(y: number, pad = 32): number {
  return Math.max(CONFIG.ARENA_MARGIN_Y + pad, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - pad, y));
}

function addIfrit(ctx: CharacterContext, amount: number): void {
  const p = ctx.player;
  p.custom.ifrit = Math.min(100, (p.custom.ifrit || 0) + amount);
}

function pushBlueBolt(
  p: CharacterContext['player'],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width = 2.8,
  life = 0.2
): void {
  const arr: BlueBolt[] = p.custom.bolts;
  if (arr.length >= 16) arr.shift();
  const pts: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    const jit = (Math.random() - 0.5) * Math.min(26, len * 0.24);
    pts.push({ x: x1 + dx * t + nx * jit, y: y1 + dy * t + ny * jit });
  }
  pts.push({ x: x2, y: y2 });
  arr.push({ pts, width, life, maxLife: life });
}

function pushKickArc(
  p: CharacterContext['player'],
  x: number,
  y: number,
  angle: number,
  range: number,
  halfAngle: number,
  swingDir: 1 | -1,
  life = 0.18
): void {
  const arr: IfritKickArc[] = p.custom.kickArcs;
  if (arr.length >= 14) arr.shift();
  arr.push({ x, y, angle, range, halfAngle, swingDir, life, maxLife: life });
}

function pushVisibleKick(
  p: CharacterContext['player'],
  kick: Omit<VisibleKickAnim, 'maxLife'>
): void {
  const arr: VisibleKickAnim[] = p.custom.visibleKicks;
  if (arr.length >= 12) arr.shift();
  arr.push({ ...kick, maxLife: kick.life });
}

function pushAfterimage(p: CharacterContext['player'], x: number, y: number, angle: number, life = 0.28): void {
  const arr: SanjiAfterimage[] = p.custom.afterimages;
  if (arr.length >= 8) arr.shift();
  arr.push({ x, y, angle, life, maxLife: life });
}

function pushDome(p: CharacterContext['player'], x: number, y: number, radius: number, life = 0.34, isSonic = false): void {
  const arr: PlasmaDome[] = p.custom.domes;
  if (arr.length >= 8) arr.shift();
  arr.push({ x, y, radius, life, maxLife: life, isSonic });
}

function fireBoeufBurst(ctx: CharacterContext, aimAngle: number): void {
  const { state, player: p, audio } = ctx;
  p.custom.ifritOverdriveTimer = 0;
  p.facingAngle = aimAngle;

  audio.playExplosion(1.5);
  audio.playThunder();
  audio.playKick();
  ctx.triggerScreenShake(10, 0.24);
  ctx.triggerHaptic(28);
  state.hitstopTimer = 0.085;
  ctx.spawnFloatingText(p.x, p.y - 52, '⚡ ¡IFRIT JAMBE: BOEUF BURST!', '#00E5FF', 1.3);

  const length = 350;
  const x2 = clampX(p.x + Math.cos(aimAngle) * length, 24);
  const y2 = clampY(p.y + Math.sin(aimAngle) * length, 24);

  if (p.custom.boeufBeams.length >= 4) p.custom.boeufBeams.shift();
  p.custom.boeufBeams.push({
    x1: p.x,
    y1: p.y,
    x2,
    y2,
    angle: aimAngle,
    length: Math.hypot(x2 - p.x, y2 - p.y),
    width: 78,
    life: 0.38,
    maxLife: 0.38
  });
  pushVisibleKick(p, {
    mode: 'boeuf',
    x: p.x,
    y: p.y,
    angle: aimAngle,
    range: 112,
    followPlayer: true,
    life: 0.34
  });

  for (let i = 0; i < 8; i++) {
    const d = 30 + (i / 8) * 300;
    const bx = p.x + Math.cos(aimAngle) * d;
    const by = p.y + Math.sin(aimAngle) * d;
    pushBlueBolt(p, bx, by, bx + (Math.random() - 0.5) * 90, by + (Math.random() - 0.5) * 90, 3.2, 0.25);
  }

  ctx.damageEnemiesInLine(p.x, p.y, aimAngle, length, 54, 4.4, 170, true, 0.85, {
    pierceShield: true,
    ignoreArmorPct: 1.0,
    applyBurn: true,
    burnDps: 20,
    burnDuration: 3.5,
    damageTextColor: '#00E5FF'
  });

  p.skillCds[2] = p.skillMaxCds[2];
  ctx.updateHUD();
  ctx.updateCooldownUI();
}

export const sanjiEggheadCharacter: CharacterModule = {
  id: 'sanji_egghead',
  name: 'Sanji (Egghead)',
  faction: 'pirates',
  rarity: 'shichibukai',
  portrait: '⚡',
  portraitBg: 'linear-gradient(135deg, #FF5722 0%, #00B0FF 65%, #0D1B2A 100%)',
  attackIcon: '🦵',
  themeClass: 'theme-sanji_egghead',
  color: '#00E5FF',
  vestColor: '#FF5722',
  hp: 118,
  damage: 19.5,
  speed: 6.1,
  armor: 12,
  dashCd: 1.5,
  autoAimRange: 270,
  skills: [
    { name: 'Sky Walk', icon: '🚀', cd: 6.0 },
    { name: 'Hell Blue', icon: '💙', cd: 8.5 },
    { name: 'Ifrit Mode', icon: '⚡', cd: 12.0 }
  ],
  cardMeta: {
    displayName: 'SANJI (EGGHEAD)',
    zarparName: 'SANJI (EGGHEAD)',
    epithet: 'Pierna Negra · Ifrit Jambe',
    nameColor: '#00E5FF',
    role: 'Shichibukai Asesino / Plasma Azul',
    passiveText: 'Pasiva: Exoesqueleto (-22% daño recibido) + Caballerosidad (no patea a Alvida)',
    passiveColor: '#80D8FF',
    stats: { hp: 78, dmg: 90, vel: 96, arm: 76 },
    comboDesc:
      '<b>Combo 4 golpes Ifrit:</b> Patada Flash → Doble Arco Plasma → <b>Ráfaga Spectre</b> (3 golpes) → <b>Concasse Azul</b>.',
    skillsDesc:
      '<b>H1:</b> DOM Sky Walk (vuelo + cura Exoesqueleto) • <b>H2:</b> Hell Memories (domo plasma) • <b>H3:</b> Ifrit Overdrive (re-tocar: Boeuf Burst).'
  },

  // ==========================================================================
  // ESTADO PROPIO Y LIMPIEZA
  // ==========================================================================
  createCustomState: () => ({
    ifrit: 0,
    ifritOverdriveTimer: 0,
    exoFlashTimer: 0,
    spectreHitsLeft: 0,
    spectreTick: 0,
    skyWalkTimer: 0,
    skyWalkTargetX: 0,
    skyWalkTargetY: 0,
    concasseHopTimer: 0,
    kickArcs: [] as IfritKickArc[],
    visibleKicks: [] as VisibleKickAnim[],
    afterimages: [] as SanjiAfterimage[],
    domes: [] as PlasmaDome[],
    bolts: [] as BlueBolt[],
    boeufBeams: [] as BoeufBeam[]
  }),

  onCleanupEffects(p) {
    p.custom.ifritOverdriveTimer = 0;
    p.custom.spectreHitsLeft = 0;
    p.custom.skyWalkTimer = 0;
    p.custom.concasseHopTimer = 0;
    p.custom.kickArcs = [];
    p.custom.visibleKicks = [];
    p.custom.afterimages = [];
    p.custom.domes = [];
    p.custom.bolts = [];
    p.custom.boeufBeams = [];
  },

  // Regla intocable: Sanji nunca golpea a damas (Alvida) con ataques normales
  onShouldIgnoreTarget(_p, en, isSkill) {
    if (!isSkill && en.isFemale) {
      return { ignore: true, text: '♥ ¡No pateo a una dama!', color: '#FF80AB' };
    }
    return { ignore: false };
  },

  getFlyOffsetY(p) {
    if ((p.custom.skyWalkTimer || 0) > 0) {
      const prog = 1 - p.custom.skyWalkTimer / 0.42;
      return -Math.sin(prog * Math.PI) * 52;
    }
    if ((p.custom.concasseHopTimer || 0) > 0) {
      const prog = 1 - p.custom.concasseHopTimer / 0.22;
      return -Math.sin(prog * Math.PI) * 26;
    }
    return 0;
  },

  getMoveSpeedMult(p) {
    let mult = 1.0;
    if ((p.custom.ifritOverdriveTimer || 0) > 0) mult *= 1.32;
    if ((p.custom.skyWalkTimer || 0) > 0) mult *= 1.45;
    return mult;
  },

  // ==========================================================================
  // PASIVA EXOESQUELETO VINSMOKE + IFRIT JAMBE
  // ==========================================================================
  onBeforePlayerDamage(ctx, incomingDmg) {
    const p = ctx.player;
    const isOverdrive = (p.custom.ifritOverdriveTimer || 0) > 0;
    const res = resolveSanjiEggheadExoskeleton(incomingDmg, isOverdrive);
    p.custom.exoFlashTimer = 0.24;
    if (res.mitigatedAmount > 0 && Math.random() < 0.45) {
      ctx.spawnFloatingText(p.x, p.y - 36, `🛡️ -${res.mitigatedAmount} Exo`, '#80D8FF', 0.85);
    }
    return { dmgMult: res.dmgMult };
  },

  onCalculateDamage(p) {
    const isOverdrive = (p.custom.ifritOverdriveTimer || 0) > 0;
    const heated = (p.custom.ifrit || 0) >= 50;
    return {
      dmgMult: isOverdrive ? 1.25 : heated ? 1.12 : 1.0,
      extraCritChance: isOverdrive ? 0.25 : heated ? 0.1 : 0,
      critMult: isOverdrive ? 1.75 : 1.55
    };
  },

  onAfterDamageEnemy(ctx) {
    addIfrit(ctx, 5);
  },

  onEnemyKilled(ctx) {
    addIfrit(ctx, 12);
  },

  // ==========================================================================
  // COMBO BÁSICO EN MOVIMIENTO CON IFRIT JAMBE (4 GOLPES)
  // ==========================================================================
  onAttack(ctx, aimAngle) {
    const { state, player: p, audio } = ctx;
    const isOverdrive = (p.custom.ifritOverdriveTimer || 0) > 0;
    const step = p.comboStep % 4;
    p.comboStep = (step + 1) % 4;
    p.comboResetTimer = 0.95;
    p.attackCooldown = step === 3 ? 0.30 : isOverdrive ? 0.15 : 0.19;
    p.attackCooldownMax = p.attackCooldown;
    p.attackAnimTimer = 0.22;

    const heated = isOverdrive || (p.custom.ifrit || 0) >= 50;

    if (step === 0) {
      // Golpe 1: Collier Flash — patada recta visible con bota DOM + plasma cian
      audio.playKick();
      audio.playFwoosh();
      pushAfterimage(p, p.x, p.y, aimAngle, 0.24);
      pushKickArc(p, p.x, p.y, aimAngle, 114, Math.PI * 0.38, 1, 0.16);
      pushVisibleKick(p, {
        mode: 'thrust',
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range: 102,
        legSide: 1,
        followPlayer: true,
        life: 0.20
      });
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 114, Math.PI * 0.38, 1.0, 26, false, 0, 0, {
        applyBurn: heated,
        burnDps: 12,
        burnDuration: 2.5
      });
    } else if (step === 1) {
      // Golpe 2: Flanc & Tendron — patada giratoria barriendo con pierna visible y chispas azules
      audio.playKick();
      audio.playShing();
      pushKickArc(p, p.x, p.y, aimAngle, 122, Math.PI * 0.45, -1, 0.18);
      pushKickArc(p, p.x, p.y, aimAngle + 0.15, 110, Math.PI * 0.42, 1, 0.18);
      pushVisibleKick(p, {
        mode: 'sweep',
        x: p.x,
        y: p.y,
        angle: aimAngle,
        range: 112,
        halfAngle: Math.PI * 0.45,
        swingDir: -1,
        followPlayer: true,
        life: 0.21
      });
      pushBlueBolt(
        p,
        p.x,
        p.y,
        p.x + Math.cos(aimAngle) * 112,
        p.y + Math.sin(aimAngle) * 112,
        2.5,
        0.18
      );
      ctx.damageEnemiesInCone(p.x, p.y, aimAngle, 122, Math.PI * 0.45, 1.18, 32, false, 0, 0, {
        applyBurn: true,
        burnDps: 12,
        burnDuration: 2.5
      });
    } else if (step === 2) {
      // Golpe 3: Spectre Plasma Flurry — 3 patadas visibles ultrarrápidas en movimiento
      p.custom.spectreHitsLeft = 3;
      p.custom.spectreTick = 0;
      pushAfterimage(p, p.x, p.y, aimAngle, 0.26);
    } else {
      // Golpe 4 (Finisher): Concasse Burst — taconazo descendente visible + domo sónico
      p.custom.concasseHopTimer = 0.22;
      const cx = clampX(p.x + Math.cos(aimAngle) * 58);
      const cy = clampY(p.y + Math.sin(aimAngle) * 58);
      audio.playExplosion(1.15);
      audio.playThunder();
      ctx.triggerScreenShake(6, 0.15);
      ctx.triggerHaptic(16);
      state.hitstopTimer = 0.05;

      pushDome(p, cx, cy, 118, 0.30, true);
      pushVisibleKick(p, {
        mode: 'heel_drop',
        x: cx,
        y: cy,
        angle: aimAngle,
        range: 92,
        life: 0.28
      });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        pushBlueBolt(p, cx, cy, cx + Math.cos(a) * 108, cy + Math.sin(a) * 108, 2.8, 0.22);
      }
      ctx.damageEnemiesInCircle(cx, cy, 118, 1.95, 85, false, 0.45, {
        applyBurn: true,
        burnDps: 16,
        burnDuration: 3.0,
        pierceShield: isOverdrive
      });
    }
  },

  onDash(ctx) {
    const { player: p, audio } = ctx;
    p.customDashDist = CONFIG.DASH_DISTANCE * 1.18;
    p.invulnTimer = CONFIG.DASH_IFRAMES * 1.15;
    audio.playFwoosh();
    pushAfterimage(p, p.x, p.y, p.facingAngle, 0.32);
    addIfrit(ctx, 6);
  },

  // ==========================================================================
  // HABILIDADES H1 / H2 / H3
  // ==========================================================================
  onSkillReactivate(ctx, idx) {
    const p = ctx.player;
    if (idx === 2 && (p.custom.ifritOverdriveTimer || 0) > 0) {
      fireBoeufBurst(ctx, ctx.getAimAngle());
      return true;
    }
    return false;
  },

  onSkill(ctx, idx, aimAngle) {
    const { state, player: p, audio } = ctx;

    if (idx === 0) {
      // H1: DOM SKY WALK — Propulsores Egghead: vuelo veloz con clones cian y pisotón plasma
      const dist = 225;
      p.custom.skyWalkTimer = 0.42;
      p.custom.skyWalkStartX = p.x;
      p.custom.skyWalkStartY = p.y;
      p.custom.skyWalkTargetX = clampX(p.x + Math.cos(aimAngle) * dist, 38);
      p.custom.skyWalkTargetY = clampY(p.y + Math.sin(aimAngle) * dist, 38);
      p.custom.skyWalkLanded = false;
      p.invulnTimer = Math.max(p.invulnTimer, 0.48);

      // Cura ligera de exoesqueleto
      const heal = Math.max(6, Math.round(p.maxHp * 0.06));
      p.hp = Math.min(p.maxHp, p.hp + heal);
      ctx.updatePlayerHUD();

      audio.playDawnRocket(false);
      audio.playFwoosh();
      pushAfterimage(p, p.x, p.y, aimAngle, 0.36);
      ctx.spawnFloatingText(p.x, p.y - 46, `🚀 ¡DOM SKY WALK! +${heal}`, '#00E5FF', 1.15);
      return false;
    }

    if (idx === 1) {
      // H2: HELL MEMORIES: BLUE — Pilar explosivo de plasma azul-blanco 210px
      audio.playExplosion(1.35);
      audio.playThunder();
      audio.playFireCrackle();
      ctx.triggerScreenShake(9, 0.22);
      ctx.triggerHaptic(22);
      state.hitstopTimer = 0.075;

      pushDome(p, p.x, p.y, 215, 0.44, false);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        pushBlueBolt(p, p.x, p.y, p.x + Math.cos(a) * 195, p.y + Math.sin(a) * 195, 3.4, 0.30);
        ctx.spawnParticle(p.x + Math.cos(a) * 80, p.y + Math.sin(a) * 80, k % 2 === 0 ? '#00E5FF' : '#FFFFFF', 5.5, 0.38);
      }

      ctx.spawnFloatingText(p.x, p.y - 52, '💙 ¡HELL MEMORIES: BLUE!', '#80D8FF', 1.28);
      ctx.damageEnemiesInCircle(p.x, p.y, 215, 3.3, 145, true, 0.9, {
        applyBurn: true,
        burnDps: 22,
        burnDuration: 3.5,
        pierceShield: true
      });
      addIfrit(ctx, 18);
      return false;
    }

    if (idx === 2) {
      // H3: IFRIT OVERDRIVE — Sobrecarga de Exoesqueleto + Plasma Azul (8s) + Re-activar = Boeuf Burst
      p.custom.ifritOverdriveTimer = 8.0;
      p.custom.ifrit = 100;
      p.superArmorTimer = Math.max(p.superArmorTimer, 0.7);
      audio.playThunder();
      audio.playFireCrackle();
      ctx.triggerScreenShake(7, 0.18);
      pushDome(p, p.x, p.y, 165, 0.34, true);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        pushBlueBolt(p, p.x, p.y, p.x + Math.cos(a) * 155, p.y + Math.sin(a) * 155, 3.0, 0.24);
      }
      ctx.damageEnemiesInCircle(p.x, p.y, 165, 1.85, 110, true, 0.55, {
        applyBurn: true,
        burnDps: 18,
        burnDuration: 3.0
      });
      ctx.spawnFloatingText(p.x, p.y - 52, '⚡ ¡IFRIT OVERDRIVE!', '#00E5FF', 1.3);
      ctx.updateHUD();
      return true;
    }
  },

  // ==========================================================================
  // ACTUALIZACIÓN POR FRAME
  // ==========================================================================
  onUpdate(ctx, dt) {
    const { player: p, audio } = ctx;

    if ((p.custom.exoFlashTimer || 0) > 0) {
      p.custom.exoFlashTimer = Math.max(0, p.custom.exoFlashTimer - dt);
    }
    if ((p.custom.concasseHopTimer || 0) > 0) {
      p.custom.concasseHopTimer = Math.max(0, p.custom.concasseHopTimer - dt);
    }

    // 1. Ifrit Overdrive
    if ((p.custom.ifritOverdriveTimer || 0) > 0) {
      p.custom.ifritOverdriveTimer = Math.max(0, p.custom.ifritOverdriveTimer - dt);
      if (Math.random() < 0.35) {
        const a = Math.random() * Math.PI * 2;
        pushBlueBolt(p, p.x + Math.cos(a) * 10, p.y + Math.sin(a) * 10, p.x + Math.cos(a) * 42, p.y + Math.sin(a) * 42, 2.0, 0.14);
      }
      if (p.custom.ifritOverdriveTimer <= 0) {
        p.skillCds[2] = p.skillMaxCds[2];
        ctx.spawnFloatingText(p.x, p.y - 44, 'Fin de Ifrit Overdrive', '#80D8FF', 1.0);
        ctx.updateHUD();
        ctx.updateCooldownUI();
      }
    }

    // 2. Spectre multi-kick (3 patadas visibles en movimiento)
    if ((p.custom.spectreHitsLeft || 0) > 0) {
      p.custom.spectreTick -= dt;
      if (p.custom.spectreTick <= 0) {
        p.custom.spectreTick = 0.06;
        p.custom.spectreHitsLeft--;
        const aim = ctx.getAimAngle();
        p.facingAngle = aim;
        const spread = aim + (Math.random() - 0.5) * 0.44;
        const side: 1 | -1 = p.custom.spectreHitsLeft % 2 === 0 ? 1 : -1;
        audio.playKick();
        pushKickArc(p, p.x, p.y, spread, 126, Math.PI * 0.34, side, 0.15);
        pushVisibleKick(p, {
          mode: 'thrust',
          x: p.x,
          y: p.y,
          angle: spread,
          range: 112,
          legSide: side,
          followPlayer: true,
          life: 0.17
        });
        ctx.damageEnemiesInCone(p.x, p.y, aim, 126, Math.PI * 0.4, 0.62, 16, false, 0, 0, {
          applyBurn: p.custom.spectreHitsLeft === 0,
          burnDps: 14,
          burnDuration: 2.5
        });
      }
    }

    // 3. DOM Sky Walk vuelo e impacto final
    if ((p.custom.skyWalkTimer || 0) > 0) {
      p.custom.skyWalkTimer = Math.max(0, p.custom.skyWalkTimer - dt);
      const prog = 1 - p.custom.skyWalkTimer / 0.42;
      p.x = p.custom.skyWalkStartX + (p.custom.skyWalkTargetX - p.custom.skyWalkStartX) * prog;
      p.y = p.custom.skyWalkStartY + (p.custom.skyWalkTargetY - p.custom.skyWalkStartY) * prog;

      if (Math.random() < 0.45) {
        pushAfterimage(p, p.x, p.y, p.facingAngle, 0.26);
      }
      if (p.custom.skyWalkTimer <= 0 && !p.custom.skyWalkLanded) {
        p.custom.skyWalkLanded = true;
        p.landSquashTimer = 0.16;
        audio.playExplosion(1.1);
        ctx.triggerScreenShake(7, 0.16);
        pushDome(p, p.x, p.y, 138, 0.34, true);
        pushVisibleKick(p, {
          mode: 'heel_drop',
          x: p.x,
          y: p.y,
          angle: p.facingAngle,
          range: 105,
          life: 0.30
        });
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          pushBlueBolt(p, p.x, p.y, p.x + Math.cos(a) * 125, p.y + Math.sin(a) * 125, 2.8, 0.22);
        }
        ctx.damageEnemiesInCircle(p.x, p.y, 138, 2.85, 115, true, 0.65, {
          applyBurn: true,
          burnDps: 16,
          burnDuration: 3.0,
          pierceShield: true
        });
      }
    }

    // 4. Decay VFX
    for (let i = p.custom.kickArcs.length - 1; i >= 0; i--) {
      p.custom.kickArcs[i].life -= dt;
      if (p.custom.kickArcs[i].life <= 0) p.custom.kickArcs.splice(i, 1);
    }
    for (let i = p.custom.visibleKicks.length - 1; i >= 0; i--) {
      p.custom.visibleKicks[i].life -= dt;
      if (p.custom.visibleKicks[i].life <= 0) p.custom.visibleKicks.splice(i, 1);
    }
    for (let i = p.custom.afterimages.length - 1; i >= 0; i--) {
      p.custom.afterimages[i].life -= dt;
      if (p.custom.afterimages[i].life <= 0) p.custom.afterimages.splice(i, 1);
    }
    for (let i = p.custom.domes.length - 1; i >= 0; i--) {
      p.custom.domes[i].life -= dt;
      if (p.custom.domes[i].life <= 0) p.custom.domes.splice(i, 1);
    }
    for (let i = p.custom.bolts.length - 1; i >= 0; i--) {
      p.custom.bolts[i].life -= dt;
      if (p.custom.bolts[i].life <= 0) p.custom.bolts.splice(i, 1);
    }
    for (let i = p.custom.boeufBeams.length - 1; i >= 0; i--) {
      p.custom.boeufBeams[i].life -= dt;
      if (p.custom.boeufBeams[i].life <= 0) p.custom.boeufBeams.splice(i, 1);
    }
  },

  // ==========================================================================
  // RENDERIZADO PERSONALIZADO (AFTERIMAGES, DOM BOOTS, IFRIT PLASMA AZUL)
  // ==========================================================================
  drawWorldBeforePlayer({ ctx, player: p }) {
    const imgs: SanjiAfterimage[] = p.custom.afterimages || [];
    for (let i = 0; i < imgs.length; i++) {
      const im = imgs[i];
      const a = Math.max(0, im.life / im.maxLife);
      ctx.save();
      ctx.translate(im.x, im.y);
      ctx.rotate(im.angle);
      ctx.globalAlpha = a * 0.45;
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  },

  drawWorldAfterPlayer({ ctx, player: p }) {
    // 1. Arcos de patada Ifrit azul-blanco
    const arcs: IfritKickArc[] = p.custom.kickArcs || [];
    for (let i = 0; i < arcs.length; i++) {
      const k = arcs[i];
      const prog = 1 - k.life / k.maxLife;
      const a = Math.max(0, k.life / k.maxLife);
      const head = Math.min(1, prog / 0.35);
      const tail = Math.max(0, (prog - 0.2) / 0.8) * 0.6;
      const sA = k.swingDir * (-k.halfAngle + 2 * k.halfAngle * tail);
      const eA = k.swingDir * (-k.halfAngle + 2 * k.halfAngle * head);
      const minA = Math.min(sA, eA);
      const maxA = Math.max(sA, eA);

      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.angle);
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#00B0FF';
      ctx.lineWidth = 20 * Math.max(0.45, a);
      ctx.beginPath();
      ctx.arc(0, 0, k.range * 0.85, minA, maxA);
      ctx.stroke();

      ctx.strokeStyle = '#E0F7FA';
      ctx.lineWidth = 7 * a;
      ctx.beginPath();
      ctx.arc(0, 0, k.range * 0.92, minA, maxA);
      ctx.stroke();
      ctx.restore();
    }

    // 1B. Animaciones de pierna + bota DOM + llamas Ifrit Jambe visibles en cada patada
    const kicks: VisibleKickAnim[] = p.custom.visibleKicks || [];
    for (let i = 0; i < kicks.length; i++) {
      const k = kicks[i];
      const a = Math.max(0, k.life / k.maxLife);
      const prog = 1 - a;

      if (k.mode === 'thrust' || k.mode === 'boeuf') {
        const ext = prog < 0.5 ? 1 - Math.pow(1 - prog / 0.5, 2.2) : prog < 0.75 ? 1 : 1 - ((prog - 0.75) / 0.25) * 0.65;
        const startDist = 12;
        const curLen = startDist + (k.range - startDist) * ext;
        const side = (k.legSide || 1) * 7;
        const perp = k.angle + Math.PI / 2;
        const ox = (k.followPlayer ? p.x : k.x) + Math.cos(perp) * side;
        const oy = (k.followPlayer ? p.y : k.y) + Math.sin(perp) * side;

        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(k.angle);
        ctx.globalAlpha = Math.min(1, a * 1.15);

        // Llama plasma Ifrit azul-blanco envolviendo la pierna
        const fGrad = ctx.createLinearGradient(startDist, 0, curLen + 18, 0);
        fGrad.addColorStop(0, 'rgba(0, 176, 255, 0.18)');
        fGrad.addColorStop(0.55, `rgba(0, 229, 255, ${0.85 * a})`);
        fGrad.addColorStop(1, `rgba(255, 255, 255, ${0.95 * a})`);
        ctx.fillStyle = fGrad;
        ctx.beginPath();
        ctx.ellipse((startDist + curLen) * 0.54, 0, curLen * 0.54, k.mode === 'boeuf' ? 22 : 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pierna de pantalón oscuro Egghead
        ctx.fillStyle = '#263238';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(startDist, -7);
        ctx.lineTo(curLen - 16, -5.5);
        ctx.lineTo(curLen - 16, 5.5);
        ctx.lineTo(startDist, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Bota tecnológica DOM Egghead (blanca + suela neón cian)
        ctx.fillStyle = '#ECEFF1';
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(curLen - 18, -8);
        ctx.lineTo(curLen + 9, -5);
        ctx.lineTo(curLen + 14, 0);
        ctx.lineTo(curLen + 7, 8);
        ctx.lineTo(curLen - 18, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Choque de impacto en la punta de la bota
        if (ext > 0.78) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 3 * a;
          ctx.beginPath();
          ctx.arc(curLen + 6, 0, 15, -Math.PI * 0.52, Math.PI * 0.52);
          ctx.stroke();
        }
        ctx.restore();
      } else if (k.mode === 'sweep') {
        const hAng = k.halfAngle || Math.PI * 0.45;
        const dir = k.swingDir || 1;
        const headT = 1 - Math.pow(1 - Math.min(1, prog / 0.42), 2.5);
        const curAng = dir * (-hAng + 2 * hAng * headT);
        const ox = k.followPlayer ? p.x : k.x;
        const oy = k.followPlayer ? p.y : k.y;

        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(k.angle + curAng);
        ctx.globalAlpha = Math.min(1, a * 1.15);

        // Aura azul plasma detrás de la pierna barriendo
        ctx.fillStyle = 'rgba(0, 229, 255, 0.42)';
        ctx.beginPath();
        ctx.ellipse(k.range * 0.54, 0, k.range * 0.46, 13, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pierna estirada
        ctx.fillStyle = '#263238';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(12, -5.5, Math.max(28, k.range - 34), 11, 4);
        ctx.fill();
        ctx.stroke();

        // Bota DOM glowing en la punta
        ctx.fillStyle = '#ECEFF1';
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.roundRect(k.range - 24, -7.5, 22, 15, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(k.range - 6, 0, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (k.mode === 'heel_drop') {
        const dropOffset = (1 - Math.min(1, prog / 0.32)) * -48;
        ctx.save();
        ctx.translate(k.x, k.y);
        ctx.globalAlpha = Math.min(1, a * 1.2);

        // Estela descendente de plasma azul-blanco
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 14 * a;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, dropOffset - 54);
        ctx.lineTo(0, dropOffset);
        ctx.stroke();

        // Pierna bajando verticalmente hacia el suelo
        ctx.fillStyle = '#263238';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(-6.5, dropOffset - 40, 13, 30, 4);
        ctx.fill();
        ctx.stroke();

        // Bota DOM aplastando con halo blanco
        ctx.fillStyle = '#ECEFF1';
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.roundRect(-12, dropOffset - 12, 24, 17, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, dropOffset - 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 2. Domos plasma y anillos sónicos
    const domes: PlasmaDome[] = p.custom.domes || [];
    for (let i = 0; i < domes.length; i++) {
      const d = domes[i];
      const prog = 1 - d.life / d.maxLife;
      const a = Math.max(0, d.life / d.maxLife);
      const curR = d.radius * (0.3 + prog * 0.7);
      ctx.save();
      ctx.globalAlpha = a;
      const grad = ctx.createRadialGradient(d.x, d.y, curR * 0.1, d.x, d.y, curR);
      grad.addColorStop(0, `rgba(224, 247, 250, ${0.75 * a})`);
      grad.addColorStop(0.55, `rgba(0, 229, 255, ${0.42 * a})`);
      grad.addColorStop(1, 'rgba(0, 176, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(d.x, d.y, curR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 6 * a;
      ctx.beginPath();
      ctx.arc(d.x, d.y, curR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5 * a;
      ctx.beginPath();
      ctx.arc(d.x, d.y, curR * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Boeuf Burst — Cañón supersónico de plasma con anillos Mach
    const beams: BoeufBeam[] = p.custom.boeufBeams || [];
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      const a = Math.max(0, b.life / b.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#00B0FF';
      ctx.lineWidth = b.width * a;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      ctx.strokeStyle = '#E0F7FA';
      ctx.lineWidth = b.width * 0.45 * a;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();

      // Anillos sónicos Mach perpendiculares
      for (let m = 1; m <= 3; m++) {
        const md = (b.length * m) / 3.5;
        const mx = b.x1 + Math.cos(b.angle) * md;
        const my = b.y1 + Math.sin(b.angle) * md;
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(b.angle);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3.2 * a;
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, b.width * (0.45 + m * 0.12), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // 4. Rayos eléctricos cian-blanco de Ifrit Jambe
    const bolts: BlueBolt[] = p.custom.bolts || [];
    for (let i = 0; i < bolts.length; i++) {
      const bt = bolts[i];
      const a = Math.max(0, bt.life / bt.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#00B0FF';
      ctx.lineWidth = bt.width + 2.2;
      ctx.beginPath();
      bt.pts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = bt.width * 0.65;
      ctx.beginPath();
      bt.pts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.stroke();
      ctx.restore();
    }
  },

  drawAura({ ctx, player: p, t }) {
    const isOverdrive = (p.custom.ifritOverdriveTimer || 0) > 0;
    const isExoFlash = (p.custom.exoFlashTimer || 0) > 0;
    if (!isOverdrive && !isExoFlash) return;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = isExoFlash ? '#FFFFFF' : '#00E5FF';
    ctx.lineWidth = isOverdrive ? 3.0 : 2.5;
    ctx.globalAlpha = isOverdrive ? 0.8 + Math.sin(t * 14) * 0.15 : 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  drawBody({ ctx, player: p, cfg, t }) {
    const isOverdrive = (p.custom.ifritOverdriveTimer || 0) > 0;
    const isSky = (p.custom.skyWalkTimer || 0) > 0;
    const isKicking = p.attackAnimTimer > 0 || (p.custom.spectreHitsLeft || 0) > 0 || isOverdrive;

    // Pierna con botas DOM Egghead + llamas azul eléctrico Ifrit Jambe
    if (isKicking || isSky) {
      const swing = Math.sin(t * 22) * 5;
      ctx.save();
      ctx.fillStyle = '#263238';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(6, 5 + swing * 0.35, 19, 7, 3);
      ctx.fill();
      ctx.stroke();

      // Bota DOM (blanca/cian con suela propulsora)
      ctx.fillStyle = '#ECEFF1';
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(21, 3.5 + swing * 0.35, 10, 9, 3.5);
      ctx.fill();
      ctx.stroke();

      // Llama Ifrit azul-blanco en el pie
      ctx.fillStyle = 'rgba(0, 229, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(27, 8 + swing * 0.35, isOverdrive ? 12 : 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(28, 8 + swing * 0.35, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Chaqueta Egghead naranja-coral con franja tecnológica blanca
    ctx.fillStyle = cfg.vestColor;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius - 4, -0.8, 0.8);
    ctx.stroke();

    // Cabello rubio característico
    ctx.fillStyle = '#FDD835';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(2, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  },

  drawPreview(pctx, t, cfg) {
    const kickSwing = Math.sin(t * 2.2) * 3;
    // Aura azul plasma Ifrit
    pctx.fillStyle = 'rgba(0, 229, 255, 0.2)';
    pctx.beginPath();
    pctx.arc(10, 8 + kickSwing, 10, 0, Math.PI * 2);
    pctx.fill();

    // Chaqueta Egghead naranja-coral
    pctx.fillStyle = cfg.vestColor;
    pctx.strokeStyle = '#000';
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.arc(0, 1, 13, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();

    // Bota DOM + plasma Ifrit
    pctx.fillStyle = '#00E5FF';
    pctx.beginPath();
    pctx.arc(12, 9 + kickSwing, 6.2, 0, Math.PI * 2);
    pctx.fill();
    pctx.fillStyle = '#FFFFFF';
    pctx.beginPath();
    pctx.arc(12, 9 + kickSwing, 3, 0, Math.PI * 2);
    pctx.fill();

    // Pelo rubio
    pctx.fillStyle = '#FDD835';
    pctx.beginPath();
    pctx.arc(0, -5, 9.5, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
  },

  // ==========================================================================
  // HUD ESPECÍFICO Y BOTÓN REACTIVO DE BOEUF BURST
  // ==========================================================================
  mountHUD(slotEl) {
    slotEl.innerHTML = `
      <div class="char-resource-hud" id="sanji-egghead-hud" style="display:flex;">
        <div class="res-bar-outer" style="border-color:#00E5FF;">
          <div id="hud-sanji-egg-fill" class="res-bar-fill" style="background:linear-gradient(90deg,#FF5722,#00E5FF,#FFFFFF);"></div>
        </div>
        <span id="hud-sanji-egg-text" class="res-text text-outline-sm" style="color:#E0F7FA;">⚡ IFRIT 0/100</span>
      </div>
    `;
  },

  updateHUD(p) {
    const hud = document.getElementById('sanji-egghead-hud');
    const fill = document.getElementById('hud-sanji-egg-fill');
    const txt = document.getElementById('hud-sanji-egg-text');
    const isOverdrive = (p.custom.ifritOverdriveTimer || 0) > 0;
    const val = Math.round(p.custom.ifrit || 0);
    if (hud) hud.classList.toggle('sanji-ifrit-active', isOverdrive);
    if (fill) {
      fill.style.width = isOverdrive
        ? `${Math.max(0, Math.min(100, (p.custom.ifritOverdriveTimer / 8.0) * 100))}%`
        : `${val}%`;
    }
    if (txt) {
      txt.textContent = isOverdrive ? `⚡ IFRIT ${p.custom.ifritOverdriveTimer.toFixed(1)}s` : `⚡ IFRIT ${val}/100`;
    }
  },

  updateButtonsUI(p, helpers: ButtonUIHelpers) {
    const btn3 = helpers.getBtn(2);
    const lbl3 = helpers.getLabel(2);
    if ((p.custom.ifritOverdriveTimer || 0) > 0) {
      btn3?.classList.add('chain-active');
      if (lbl3) lbl3.textContent = 'Boeuf Burst';
      helpers.setSkillCooldownOverride(2, null, undefined, true);
    } else {
      btn3?.classList.remove('chain-active');
      if (lbl3) lbl3.textContent = 'Ifrit Mode';
    }
  }
};
