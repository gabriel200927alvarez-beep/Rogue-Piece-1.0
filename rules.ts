export type RarityKey = 'novato' | 'pirata' | 'supernova' | 'shichibukai' | 'yonko' | 'almirante';

export const RARITY_MULTIPLIERS: Record<RarityKey, number> = {
  novato: 1.0,
  pirata: 1.1,
  supernova: 1.25,
  shichibukai: 1.5,
  yonko: 2.0,
  almirante: 2.0,
};

export interface ScaledStats {
  hp: number;
  damage: number;
  armor: number;
}

export function scaleCharacterStats(
  base: { hp: number; damage: number; armor: number },
  rarity: RarityKey,
): ScaledStats {
  const mult = RARITY_MULTIPLIERS[rarity] ?? 1.0;
  return {
    hp: Math.round(base.hp * mult),
    damage: Number((base.damage * mult).toFixed(2)),
    armor: Number((base.armor * mult).toFixed(2)),
  };
}

export function calculateKingKongGunMultiplier(
  chargeSeconds: number,
  gear2ndActive: boolean,
): number {
  const clampedCharge = Math.max(0, Math.min(2.5, chargeSeconds));
  const t = clampedCharge / 2.5;
  const baseMult = 1.0 + t * 7.0; // 1.0x at 0s -> 8.0x at 2.5s
  return Number((gear2ndActive ? baseMult * 1.4 : baseMult).toFixed(2));
}

export function calculateWaveEnemyMultipliers(wave: number): {
  hpMult: number;
  dmgMult: number;
  spawnIntervalSec: number;
} {
  const w = Math.max(1, Math.min(15, Math.floor(wave)));
  if (w <= 5) {
    return {
      hpMult: Number((1 + 0.2 * (w - 1)).toFixed(2)),
      dmgMult: Number((1 + 0.1 * (w - 1)).toFixed(2)),
      spawnIntervalSec: w === 5 ? 0.28 : 0.48,
    };
  }
  if (w <= 10) {
    const s2 = w - 5;
    return {
      hpMult: Number((1.8 + 0.35 * s2).toFixed(2)),
      dmgMult: Number((1.4 + 0.16 * s2).toFixed(2)),
      spawnIntervalSec: w === 10 ? 0.26 : 0.38,
    };
  }
  const s3 = w - 10;
  return {
    hpMult: Number((3.55 + 0.32 * s3).toFixed(2)),
    dmgMult: Number((2.2 + 0.13 * s3).toFixed(2)),
    spawnIntervalSec: w === 15 ? 0.25 : 0.34,
  };
}

export function calculateConquerorStunDuration(shanksHaki: number): number {
  const clamped = Math.max(0, Math.min(100, shanksHaki));
  return Number((1.0 + (clamped / 100) * 3.2).toFixed(2)); // 1.0s @ 0 -> 4.2s @ 100
}

export function drainGear2ndResource(
  energy: number,
  dt: number,
  drainPerSec = 100 / 12
): { energy: number; active: boolean; ended: boolean } {
  const next = Math.max(0, energy - drainPerSec * dt);
  const ended = next <= 0;
  return {
    energy: Number(next.toFixed(4)),
    active: !ended,
    ended
  };
}

export function drainWhitebeardQuake(
  energy: number,
  dt: number,
  drainPerSec = 10
): { energy: number; active: boolean; ended: boolean } {
  const next = Math.max(0, energy - drainPerSec * dt);
  const ended = next <= 0;
  return {
    energy: Number(next.toFixed(4)),
    active: !ended,
    ended
  };
}

export function calculateLuffyPtsComboCooldown(
  step: number,
  gear2ndActive: boolean
): { attackCooldown: number; comboResetTimer: number } {
  const g2Mult = gear2ndActive ? 0.5 : 1.0;
  if (step === 2) {
    return {
      attackCooldown: Number((0.4 * g2Mult).toFixed(4)),
      comboResetTimer: 0.7
    };
  }
  if (step === 3) {
    return {
      attackCooldown: Number((0.35 * g2Mult).toFixed(4)),
      comboResetTimer: 0.7
    };
  }
  return {
    attackCooldown: Number((0.35 * g2Mult).toFixed(4)),
    comboResetTimer: 0.65
  };
}

export function calculateFrankyCoupDeVentScaling(
  cola: number,
  maxCola = 50
): { colaSpent: number; dmgMult: number; rangeMult: number; angleMult: number } {
  const spent = Math.max(0, Math.min(maxCola, cola));
  const ratio = maxCola > 0 ? spent / maxCola : 0;
  return {
    colaSpent: spent,
    dmgMult: Number((1.0 + ratio * 0.6).toFixed(3)),
    rangeMult: Number((1.0 + ratio * 0.4).toFixed(3)),
    angleMult: Number((1.0 + ratio * 0.25).toFixed(3))
  };
}

export function drainGigantResource(
  energy: number,
  dt: number,
  drainPerSec = 10
): { energy: number; active: boolean; ended: boolean } {
  const next = Math.max(0, energy - drainPerSec * dt);
  const ended = next <= 0;
  return {
    energy: Number(next.toFixed(4)),
    active: !ended,
    ended
  };
}

export function calculateDawnWhipRadius(
  progress: number,
  minR = 55,
  maxR = 250
): number {
  const u = Math.max(0, Math.min(1, progress));
  return Number((minR * Math.pow(maxR / minR, u)).toFixed(2));
}

export function shouldTriggerToonForce(roll: number): boolean {
  return roll >= 0 && roll < 0.10;
}

export function drainKaidoFury(
  energy: number,
  dt: number,
  drainPerSec = 10
): { energy: number; active: boolean; ended: boolean } {
  const next = Math.max(0, energy - drainPerSec * dt);
  const ended = next <= 0;
  return {
    energy: Number(next.toFixed(4)),
    active: !ended,
    ended
  };
}

export function calculateKaidoEmpowerment(
  fury: number,
  hitStreak: number,
  dragonActive: boolean
): { dmgMult: number; extraCritChance: number; critMult: number } {
  const clampedFury = Math.max(0, Math.min(100, fury));
  const clampedStreak = Math.max(0, Math.min(10, hitStreak));
  const streakBonus = clampedStreak * 0.02; // up to +20% crit from consecutive hits
  const furyBonus = (clampedFury / 100) * 0.12; // up to +12% crit from FURY
  return {
    dmgMult: dragonActive ? 1.55 : Number((1.0 + (clampedStreak >= 5 ? 0.12 : 0)).toFixed(2)),
    extraCritChance: Number((streakBonus + furyBonus).toFixed(3)),
    critMult: dragonActive ? 1.85 : 1.65
  };
}

export function drainKizaruPika(
  energy: number,
  dt: number,
  drainPerSec = 10
): { energy: number; active: boolean; ended: boolean } {
  const next = Math.max(0, energy - drainPerSec * dt);
  const ended = next <= 0;
  return {
    energy: Number(next.toFixed(4)),
    active: !ended,
    ended
  };
}

export function getKizaruLightOrbStep(step: number): {
  nextStep: number;
  isExplosiveThirdShot: boolean;
  dmgMult: number;
  cooldown: number;
} {
  const normalized = ((step % 3) + 3) % 3;
  const isThird = normalized === 2;
  return {
    nextStep: (normalized + 1) % 3,
    isExplosiveThirdShot: isThird,
    dmgMult: isThird ? 2.1 : 1.05,
    cooldown: isThird ? 0.32 : 0.19
  };
}

export function resolveKizaruYasakaniDamage(
  attackerIsBoss: boolean,
  isProjectile: boolean
): { cancelled: boolean; dmgMult: number } {
  if (attackerIsBoss || isProjectile) {
    return { cancelled: false, dmgMult: 1.0 };
  }
  return { cancelled: true, dmgMult: 0 };
}

export function calculateKillerBloodlustHeal(finalDmg: number, isNormalAttack: boolean, bloodlustActive: boolean): number {
  if (!isNormalAttack || !bloodlustActive || finalDmg <= 0) return 0;
  return Math.max(1, Math.round(finalDmg * 0.15));
}

export function resolveAokijiFreezeDamage(
  baseDmg: number,
  isFrozen: boolean,
  shatterFreeze: boolean,
  ignoreFreezeMitigation = false
): { finalDmg: number; shattered: boolean } {
  if (!isFrozen) return { finalDmg: baseDmg, shattered: false };
  if (shatterFreeze) return { finalDmg: Math.round(baseDmg * 3), shattered: true };
  if (ignoreFreezeMitigation) return { finalDmg: baseDmg, shattered: false };
  return { finalDmg: Math.max(1, Math.round(baseDmg * 0.5)), shattered: false };
}

export function shouldTriggerAkainuHeatWave(magma: number): boolean {
  return magma >= 100;
}

export function calculateZoroWanoKohEmpowerment(
  enmaEnergy: number,
  kohActive: boolean
): { dmgMult: number; extraCritChance: number; critMult: number; ignoreArmorPct: number } {
  const clamped = Math.max(0, Math.min(100, enmaEnergy));
  const enmaAwakened = clamped >= 50;
  if (kohActive) {
    return {
      dmgMult: 1.28,
      extraCritChance: 0.28,
      critMult: 1.85,
      ignoreArmorPct: 0.40
    };
  }
  return {
    dmgMult: enmaAwakened ? 1.12 : 1.0,
    extraCritChance: enmaAwakened ? 0.12 : 0,
    critMult: 1.60,
    ignoreArmorPct: clamped >= 100 ? 0.25 : 0
  };
}

export function calculateMihawkHawkCrit(
  precision: number,
  isMarked: boolean
): { dmgMult: number; extraCritChance: number; ignoreArmorPct: number } {
  const clamped = Math.max(0, Math.min(100, precision));
  const edgeBonus = clamped >= 60 ? 0.15 : 0;
  return {
    dmgMult: isMarked ? 1.25 : Number((1.0 + edgeBonus * 0.6).toFixed(2)),
    extraCritChance: Number(((isMarked ? 0.35 : 0) + (clamped / 100) * 0.15).toFixed(3)),
    ignoreArmorPct: isMarked ? 0.50 : clamped >= 60 ? 0.25 : 0
  };
}

export function resolveSanjiEggheadExoskeleton(
  incomingDmg: number,
  isIfritOverdrive: boolean
): { dmgMult: number; mitigatedAmount: number } {
  const dmgMult = isIfritOverdrive ? 0.65 : 0.78;
  const mitigatedAmount = Math.max(0, Math.round(incomingDmg * (1 - dmgMult)));
  return { dmgMult, mitigatedAmount };
}

export function resolveKatakuriFutureSight(
  evadeCooldown: number,
  awakeningActive: boolean
): { evaded: boolean; nextCooldown: number } {
  if (evadeCooldown <= 0) {
    return {
      evaded: true,
      nextCooldown: awakeningActive ? 3.5 : 7.0
    };
  }
  return {
    evaded: false,
    nextCooldown: evadeCooldown
  };
}

export function calculateRogerHaoshokuBonus(
  haoshoku: number,
  pirateKingActive: boolean
): { dmgMult: number; extraCritChance: number; ignoreArmorPct: number } {
  const clamped = Math.max(0, Math.min(100, haoshoku));
  if (pirateKingActive) {
    return {
      dmgMult: 1.32,
      extraCritChance: 0.30,
      ignoreArmorPct: 0.45
    };
  }
  if (clamped >= 60) {
    return {
      dmgMult: 1.18,
      extraCritChance: 0.18,
      ignoreArmorPct: 0.30
    };
  }
  return {
    dmgMult: 1.0,
    extraCritChance: Number(((clamped / 100) * 0.12).toFixed(3)),
    ignoreArmorPct: 0
  };
}

export function getStageForWave(wave: number): 'stage1' | 'stage2' | 'stage3' {
  if (wave >= 11) return 'stage3';
  if (wave >= 6) return 'stage2';
  return 'stage1';
}

export function isWantedBossWave(wave: number): boolean {
  const w = Math.floor(wave);
  return w > 0 && w % 15 === 0;
}

export function calculateBuggyPhase(hp: number, maxHp: number): 1 | 2 | 3 {
  if (maxHp <= 0) return 1;
  const ratio = hp / maxHp;
  if (ratio <= 0.30) return 3;
  if (ratio <= 0.65) return 2;
  return 1;
}

export function resolveBuggyBlooperOutcome(
  roll: number,
  attackType: 'buggy_ball' | 'bara_split' | 'knife_barrage'
): {
  triggered: boolean;
  blooperType: 'backfire' | 'trip' | null;
  selfDamage: number;
  stunSeconds: number;
} {
  if (attackType === 'buggy_ball' && roll >= 0 && roll < 0.22) {
    return {
      triggered: true,
      blooperType: 'backfire',
      selfDamage: 85,
      stunSeconds: 1.5,
    };
  }
  if (attackType === 'bara_split' && roll >= 0 && roll < 0.25) {
    return {
      triggered: true,
      blooperType: 'trip',
      selfDamage: 30,
      stunSeconds: 1.4,
    };
  }
  return {
    triggered: false,
    blooperType: null,
    selfDamage: 0,
    stunSeconds: 0,
  };
}
