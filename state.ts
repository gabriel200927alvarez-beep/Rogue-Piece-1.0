// ============================================================================
// 2. ESTADO GLOBAL DEL JUEGO Y POOLS PRE-ASIGNADOS
// ============================================================================

export interface ParticleSlot {
  active: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  color?: string;
  size?: number;
  life?: number;
  maxLife?: number;
  alpha?: number;
  shape?: 'circle' | 'spark';
}

export interface FloatingTextSlot {
  active: boolean;
  x?: number;
  y?: number;
  vy?: number;
  text?: string;
  color?: string;
  scale?: number;
  life?: number;
  maxLife?: number;
  isCrit?: boolean;
  tiltAngle?: number;
}

export interface LobbyLifetimeStats {
  runsPlayed: number;
  victories: number;
  bestWave: number;
  totalKills: number;
  totalBerries: number;
  charRuns: Record<string, number>;
}

const STATS_STORAGE_KEY = 'rogue_piece_v2_stats';

export function loadLifetimeStats(): LobbyLifetimeStats {
  const fallback: LobbyLifetimeStats = {
    runsPlayed: 0,
    victories: 0,
    bestWave: 0,
    totalKills: 0,
    totalBerries: 0,
    charRuns: {}
  };
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      runsPlayed: Number(parsed?.runsPlayed) || 0,
      victories: Number(parsed?.victories) || 0,
      bestWave: Number(parsed?.bestWave) || 0,
      totalKills: Number(parsed?.totalKills) || 0,
      totalBerries: Number(parsed?.totalBerries) || 0,
      charRuns: parsed?.charRuns && typeof parsed.charRuns === 'object' ? parsed.charRuns : {}
    };
  } catch {
    return fallback;
  }
}

export function saveLifetimeStats(stats: LobbyLifetimeStats): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota/privacy restrictions
  }
}

export interface GameState {
  screen: string;
  charId: string;
  wave: number;
  berries: number;
  berriesCollectedRun: number;
  killsRun: number;
  permBonusDmg: number;
  lifetimeStats: LobbyLifetimeStats;
  hitstopTimer: number;
  impactFlashTimer: number;
  impactFlashColor: string;
  shakeTimer: number;
  shakeIntensity: number;
  timeSinceLastCombat: number;
  targetedEnemy: any;
  bossCinematic: {
    active: boolean;
    bossType: string;
    timer: number;
    duration: number;
    lineIndex: number;
    skipped: boolean;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
  };

  settings: {
    sfxVolume: number;
    musicVolume: number;
    vibration: boolean;
  };

  tutorial: {
    shown: boolean;
    active: boolean;
    step: number;
    timer: number;
  };

  mods: {
    acquiredIds: string[];
    normalDmgPct: number;
    skillDmgPct: number;
    critChance: number;
    outOfCombatRegen: number;
    dashCdMult: number;
    dashSlowTrail: boolean;
    h1CdMult: number;
    h1Burn: boolean;
    h2PierceShield: boolean;
    h3AreaMult: number;
    bonusBerries: number;
    scoutNextWave: boolean;
  };

  player: Record<string, any> & {
    x: number;
    y: number;
    radius: number;
    vx: number;
    vy: number;
    facingAngle: number;
    hp: number;
    maxHp: number;
    baseDamage: number;
    speed: number;
    armor: number;
    invulnTimer: number;
    slowTimer: number;
    speedBuffTimer: number;
    comboStep: number;
    comboResetTimer: number;
    attackCooldown: number;
    attackCooldownMax: number;
    attackAnimTimer: number;
    skillAnimTimer: number;
    activeSkillIndex: number;
    momentumTimer: number;
    momentumDirX: number;
    momentumDirY: number;
    superArmorTimer: number;
    dashCdMax: number;
    dashCdTimer: number;
    dashCharges: number;
    maxDashCharges: number;
    isDashing: boolean;
    dashTimer: number;
    dashDurationMax: number;
    dashDirX: number;
    dashDirY: number;
    customDashDist: number;
    dashHitEnemyIds: any[];
    skillCds: number[];
    skillMaxCds: number[];
    custom: Record<string, any>;
    visualScaleX: number;
    visualScaleY: number;
    landSquashTimer: number;
    stepDustTimer: number;
  };

  waveSpawnQueue: any[];
  waveTotalEnemies: number;
  waveEnemiesRemaining: number;
  waveSpawnTimer: number;
  waveClearPending: boolean;
  waveClearDelayTimer: number;

  enemies: any[];
  projectiles: any[];
  berriesDrops: any[];
  hazards: any[];
  traps: any[];
  pendingStrikes: any[];
  afterimages: any[];
  slashEffects: any[];
  particles: ParticleSlot[];
  floatingTexts: FloatingTextSlot[];
}

export const STATE: GameState = {
  screen: 'menu',
  charId: 'luffy',
  wave: 1,
  berries: 0,
  berriesCollectedRun: 0,
  killsRun: 0,
  permBonusDmg: 0,
  lifetimeStats: loadLifetimeStats(),
  hitstopTimer: 0,
  impactFlashTimer: 0,
  impactFlashColor: '#FFFFFF',
  shakeTimer: 0,
  shakeIntensity: 0,
  timeSinceLastCombat: 0,
  targetedEnemy: null,
  bossCinematic: {
    active: false,
    bossType: '',
    timer: 0,
    duration: 3.8,
    lineIndex: 0,
    skipped: false,
    startX: 1280,
    startY: 520,
    targetX: 1280,
    targetY: 720
  },

  settings: {
    sfxVolume: 0.8,
    musicVolume: 0.55,
    vibration: true
  },

  tutorial: {
    shown: false,
    active: false,
    step: 0,
    timer: 0
  },

  mods: {
    acquiredIds: [],
    normalDmgPct: 0,
    skillDmgPct: 0,
    critChance: 0.05,
    outOfCombatRegen: 0,
    dashCdMult: 1.0,
    dashSlowTrail: false,
    h1CdMult: 1.0,
    h1Burn: false,
    h2PierceShield: false,
    h3AreaMult: 1.0,
    bonusBerries: 0,
    scoutNextWave: false
  },

  player: {
    x: 1280, y: 720, radius: 18,
    vx: 0, vy: 0, facingAngle: 0,
    hp: 150, maxHp: 150,
    baseDamage: 18, speed: 240, armor: 18,
    invulnTimer: 0, slowTimer: 0, speedBuffTimer: 0,
    comboStep: 0, comboResetTimer: 0,
    attackCooldown: 0, attackCooldownMax: 0.21, attackAnimTimer: 0,
    skillAnimTimer: 0, activeSkillIndex: 0,
    momentumTimer: 0, momentumDirX: 0, momentumDirY: 0,
    superArmorTimer: 0,
    dashCdMax: 2.2, dashCdTimer: 0,
    dashCharges: 1, maxDashCharges: 1,
    isDashing: false, dashTimer: 0, dashDurationMax: 0.16,
    dashDirX: 1, dashDirY: 0, customDashDist: 165,
    dashHitEnemyIds: [],
    skillCds: [0, 0, 0], skillMaxCds: [4.5, 6.0, 9.5],
    custom: {},
    // Locomoción e inercia visual (Canvas 2D)
    visualScaleX: 1.0,
    visualScaleY: 1.0,
    landSquashTimer: 0,
    stepDustTimer: 0
  },

  waveSpawnQueue: [],
  waveTotalEnemies: 0,
  waveEnemiesRemaining: 0,
  waveSpawnTimer: 0,
  waveClearPending: false,
  waveClearDelayTimer: 0,

  enemies: [],
  projectiles: [],
  berriesDrops: [],
  hazards: [],
  traps: [],
  pendingStrikes: [],
  afterimages: [],
  slashEffects: [],
  particles: Array.from({ length: 180 }, () => ({ active: false })),
  floatingTexts: Array.from({ length: 55 }, () => ({ active: false }))
};
