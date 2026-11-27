import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBuggyPhase,
  calculateConquerorStunDuration,
  calculateDawnWhipRadius,
  calculateFrankyCoupDeVentScaling,
  calculateKaidoEmpowerment,
  calculateKillerBloodlustHeal,
  calculateKingKongGunMultiplier,
  calculateLuffyPtsComboCooldown,
  calculateMihawkHawkCrit,
  calculateRogerHaoshokuBonus,
  calculateWaveEnemyMultipliers,
  calculateZoroWanoKohEmpowerment,
  drainGear2ndResource,
  drainGigantResource,
  drainKaidoFury,
  drainKizaruPika,
  drainWhitebeardQuake,
  getKizaruLightOrbStep,
  getStageForWave,
  isWantedBossWave,
  resolveAokijiFreezeDamage,
  resolveBuggyBlooperOutcome,
  resolveKatakuriFutureSight,
  resolveKizaruYasakaniDamage,
  resolveSanjiEggheadExoskeleton,
  scaleCharacterStats,
  shouldTriggerAkainuHeatWave,
  shouldTriggerToonForce,
} from './rules';

test('scaleCharacterStats applies rarity multipliers accurately', () => {
  const luffyPts = scaleCharacterStats({ hp: 130, damage: 17, armor: 8 }, 'shichibukai');
  assert.equal(luffyPts.hp, 195);
  assert.equal(luffyPts.damage, 25.5);
  assert.equal(luffyPts.armor, 12);

  const yonko = scaleCharacterStats({ hp: 100, damage: 20, armor: 10 }, 'yonko');
  assert.deepEqual(yonko, { hp: 200, damage: 40, armor: 20 });

  const almirante = scaleCharacterStats({ hp: 125, damage: 15.5, armor: 12 }, 'almirante');
  assert.deepEqual(almirante, { hp: 250, damage: 31, armor: 24 });
});

test('calculateKingKongGunMultiplier scales from 1.0x to 8.0x and applies Gear 2nd 1.4x', () => {
  assert.equal(calculateKingKongGunMultiplier(0, false), 1.0);
  assert.equal(calculateKingKongGunMultiplier(2.5, false), 8.0);
  assert.equal(calculateKingKongGunMultiplier(2.5, true), 11.2);
  assert.equal(calculateKingKongGunMultiplier(5.0, false), 8.0);
});

test('calculateWaveEnemyMultipliers ramps wave HP, damage, and boss spawn rate across Stages 1 and 2', () => {
  assert.deepEqual(calculateWaveEnemyMultipliers(1), {
    hpMult: 1.0,
    dmgMult: 1.0,
    spawnIntervalSec: 0.48,
  });
  assert.deepEqual(calculateWaveEnemyMultipliers(5), {
    hpMult: 1.8,
    dmgMult: 1.4,
    spawnIntervalSec: 0.28,
  });
  assert.deepEqual(calculateWaveEnemyMultipliers(6), {
    hpMult: 2.15,
    dmgMult: 1.56,
    spawnIntervalSec: 0.38,
  });
  assert.deepEqual(calculateWaveEnemyMultipliers(10), {
    hpMult: 3.55,
    dmgMult: 2.2,
    spawnIntervalSec: 0.26,
  });
});

test('calculateConquerorStunDuration scales from 1.0s to 4.2s with Haki', () => {
  assert.equal(calculateConquerorStunDuration(0), 1.0);
  assert.equal(calculateConquerorStunDuration(50), 2.6);
  assert.equal(calculateConquerorStunDuration(100), 4.2);
});

test('drainGear2ndResource drains G2 over 12s at full bar and signals end at zero', () => {
  const mid = drainGear2ndResource(100, 6.0);
  assert.equal(mid.energy, 50);
  assert.equal(mid.active, true);
  assert.equal(mid.ended, false);

  assert.deepEqual(drainGear2ndResource(100, 12.0), {
    energy: 0,
    active: false,
    ended: true,
  });
});

test('drainWhitebeardQuake drains Gura energy over time and signals end at zero', () => {
  assert.deepEqual(drainWhitebeardQuake(60, 2.0), {
    energy: 40,
    active: true,
    ended: false,
  });
  assert.deepEqual(drainWhitebeardQuake(5, 1.0), {
    energy: 0,
    active: false,
    ended: true,
  });
});

test('calculateLuffyPtsComboCooldown removes flat 1.0s post-combo cooldown and doubles speed in Gear 2nd', () => {
  assert.deepEqual(calculateLuffyPtsComboCooldown(3, false), {
    attackCooldown: 0.35,
    comboResetTimer: 0.7,
  });
  assert.deepEqual(calculateLuffyPtsComboCooldown(3, true), {
    attackCooldown: 0.175,
    comboResetTimer: 0.7,
  });
});

test('calculateFrankyCoupDeVentScaling scales damage and area proportionally with current Cola', () => {
  assert.deepEqual(calculateFrankyCoupDeVentScaling(0, 50), {
    colaSpent: 0,
    dmgMult: 1.0,
    rangeMult: 1.0,
    angleMult: 1.0,
  });
  assert.deepEqual(calculateFrankyCoupDeVentScaling(25, 50), {
    colaSpent: 25,
    dmgMult: 1.3,
    rangeMult: 1.2,
    angleMult: 1.125,
  });
  assert.deepEqual(calculateFrankyCoupDeVentScaling(50, 50), {
    colaSpent: 50,
    dmgMult: 1.6,
    rangeMult: 1.4,
    angleMult: 1.25,
  });
});

test('drainGigantResource drains 10/s so 100 energy lasts 10s and ends at zero', () => {
  assert.deepEqual(drainGigantResource(100, 2.5), {
    energy: 75,
    active: true,
    ended: false,
  });
  assert.deepEqual(drainGigantResource(10, 1.0), {
    energy: 0,
    active: false,
    ended: true,
  });
});

test('calculateDawnWhipRadius grows exponentially from minR to maxR', () => {
  const r0 = calculateDawnWhipRadius(0);
  const rMid = calculateDawnWhipRadius(0.5);
  const r1 = calculateDawnWhipRadius(1);
  assert.equal(r0, 55);
  assert.equal(r1, 250);
  assert.ok(rMid - r0 < r1 - rMid, 'exponential growth accelerates over time');
});

test('shouldTriggerToonForce triggers strictly at 10% probability', () => {
  assert.equal(shouldTriggerToonForce(0.0), true);
  assert.equal(shouldTriggerToonForce(0.0999), true);
  assert.equal(shouldTriggerToonForce(0.10), false);
  assert.equal(shouldTriggerToonForce(0.5), false);
});

test('drainKaidoFury drains FURY continuously over time and signals end at zero', () => {
  assert.deepEqual(drainKaidoFury(100, 3.0), {
    energy: 70,
    active: true,
    ended: false,
  });
  assert.deepEqual(drainKaidoFury(5, 1.0), {
    energy: 0,
    active: false,
    ended: true,
  });
});

test('calculateKaidoEmpowerment scales damage and crit chance with FURY, hit streak, and Dragon Form', () => {
  assert.deepEqual(calculateKaidoEmpowerment(0, 0, false), {
    dmgMult: 1.0,
    extraCritChance: 0,
    critMult: 1.65,
  });
  assert.deepEqual(calculateKaidoEmpowerment(100, 5, false), {
    dmgMult: 1.12,
    extraCritChance: 0.22,
    critMult: 1.65,
  });
  assert.deepEqual(calculateKaidoEmpowerment(100, 10, true), {
    dmgMult: 1.55,
    extraCritChance: 0.32,
    critMult: 1.85,
  });
});

test('drainKizaruPika drains Pika Pika gauge smoothly and ends at zero', () => {
  assert.deepEqual(drainKizaruPika(80, 2.5, 10), {
    energy: 55,
    active: true,
    ended: false,
  });
  assert.deepEqual(drainKizaruPika(6, 1.0, 12.5), {
    energy: 0,
    active: false,
    ended: true,
  });
});

test('getKizaruLightOrbStep cycles 1-2-3 fingertip shots with explosive 3rd shot', () => {
  assert.deepEqual(getKizaruLightOrbStep(0), {
    nextStep: 1,
    isExplosiveThirdShot: false,
    dmgMult: 1.05,
    cooldown: 0.19,
  });
  assert.deepEqual(getKizaruLightOrbStep(1), {
    nextStep: 2,
    isExplosiveThirdShot: false,
    dmgMult: 1.05,
    cooldown: 0.19,
  });
  assert.deepEqual(getKizaruLightOrbStep(2), {
    nextStep: 0,
    isExplosiveThirdShot: true,
    dmgMult: 2.1,
    cooldown: 0.32,
  });
});

test('resolveKizaruYasakaniDamage lets bosses and projectiles hit while airborne and evades grounded melee', () => {
  assert.deepEqual(resolveKizaruYasakaniDamage(true, false), { cancelled: false, dmgMult: 1.0 });
  assert.deepEqual(resolveKizaruYasakaniDamage(true, true), { cancelled: false, dmgMult: 1.0 });
  assert.deepEqual(resolveKizaruYasakaniDamage(false, true), { cancelled: false, dmgMult: 1.0 });
  assert.deepEqual(resolveKizaruYasakaniDamage(false, false), { cancelled: true, dmgMult: 0 });
});

test('calculateKillerBloodlustHeal heals 15% only on normal attacks during Bloodlust', () => {
  assert.equal(calculateKillerBloodlustHeal(100, true, true), 15);
  assert.equal(calculateKillerBloodlustHeal(100, false, true), 0);
  assert.equal(calculateKillerBloodlustHeal(100, true, false), 0);
});

test('resolveAokijiFreezeDamage halves normal damage on frozen enemies and triples on Ice Saber shatter', () => {
  assert.deepEqual(resolveAokijiFreezeDamage(40, true, false), { finalDmg: 20, shattered: false });
  assert.deepEqual(resolveAokijiFreezeDamage(40, true, true), { finalDmg: 120, shattered: true });
  assert.deepEqual(resolveAokijiFreezeDamage(40, false, false), { finalDmg: 40, shattered: false });
});

test('shouldTriggerAkainuHeatWave activates strictly at 100 Magma', () => {
  assert.equal(shouldTriggerAkainuHeatWave(99), false);
  assert.equal(shouldTriggerAkainuHeatWave(100), true);
});

test('calculateZoroWanoKohEmpowerment scales Enma awakening and King of Hell mode', () => {
  assert.deepEqual(calculateZoroWanoKohEmpowerment(20, false), {
    dmgMult: 1.0,
    extraCritChance: 0,
    critMult: 1.6,
    ignoreArmorPct: 0,
  });
  assert.deepEqual(calculateZoroWanoKohEmpowerment(100, false), {
    dmgMult: 1.12,
    extraCritChance: 0.12,
    critMult: 1.6,
    ignoreArmorPct: 0.25,
  });
  assert.deepEqual(calculateZoroWanoKohEmpowerment(60, true), {
    dmgMult: 1.28,
    extraCritChance: 0.28,
    critMult: 1.85,
    ignoreArmorPct: 0.4,
  });
});

test('calculateMihawkHawkCrit grants armor cleave and crit bonus on Hawk-marked targets', () => {
  assert.deepEqual(calculateMihawkHawkCrit(0, false), {
    dmgMult: 1.0,
    extraCritChance: 0,
    ignoreArmorPct: 0,
  });
  assert.deepEqual(calculateMihawkHawkCrit(80, true), {
    dmgMult: 1.25,
    extraCritChance: 0.47,
    ignoreArmorPct: 0.5,
  });
});

test('resolveSanjiEggheadExoskeleton mitigates incoming damage in base and Ifrit Overdrive', () => {
  assert.deepEqual(resolveSanjiEggheadExoskeleton(100, false), {
    dmgMult: 0.78,
    mitigatedAmount: 22,
  });
  assert.deepEqual(resolveSanjiEggheadExoskeleton(100, true), {
    dmgMult: 0.65,
    mitigatedAmount: 35,
  });
});

test('resolveKatakuriFutureSight dodges when ready and halves cooldown during Mochi Awakening', () => {
  assert.deepEqual(resolveKatakuriFutureSight(0, false), {
    evaded: true,
    nextCooldown: 7.0,
  });
  assert.deepEqual(resolveKatakuriFutureSight(0, true), {
    evaded: true,
    nextCooldown: 3.5,
  });
  assert.deepEqual(resolveKatakuriFutureSight(2.2, true), {
    evaded: false,
    nextCooldown: 2.2,
  });
});

test('calculateRogerHaoshokuBonus scales damage, crit, and armor pierce with Haoshoku and Pirate King mode', () => {
  assert.deepEqual(calculateRogerHaoshokuBonus(25, false), {
    dmgMult: 1.0,
    extraCritChance: 0.03,
    ignoreArmorPct: 0,
  });
  assert.deepEqual(calculateRogerHaoshokuBonus(65, false), {
    dmgMult: 1.18,
    extraCritChance: 0.18,
    ignoreArmorPct: 0.3,
  });
  assert.deepEqual(calculateRogerHaoshokuBonus(100, true), {
    dmgMult: 1.32,
    extraCritChance: 0.3,
    ignoreArmorPct: 0.45,
  });
});

test('calculateWaveEnemyMultipliers ramps smoothly across Stage 3 (Waves 11-15) without sudden jump', () => {
  const w10 = calculateWaveEnemyMultipliers(10);
  const w11 = calculateWaveEnemyMultipliers(11);
  const w15 = calculateWaveEnemyMultipliers(15);
  assert.deepEqual(w11, {
    hpMult: 3.87,
    dmgMult: 2.33,
    spawnIntervalSec: 0.34,
  });
  assert.deepEqual(w15, {
    hpMult: 5.15,
    dmgMult: 2.85,
    spawnIntervalSec: 0.25,
  });
  assert.ok(w11.hpMult - w10.hpMult <= 0.35);
  assert.ok(w11.dmgMult - w10.dmgMult <= 0.16);
});

test('getStageForWave and isWantedBossWave map Stage 3 and Wanted Boss milestones every 15 waves', () => {
  assert.equal(getStageForWave(1), 'stage1');
  assert.equal(getStageForWave(5), 'stage1');
  assert.equal(getStageForWave(6), 'stage2');
  assert.equal(getStageForWave(10), 'stage2');
  assert.equal(getStageForWave(11), 'stage3');
  assert.equal(getStageForWave(15), 'stage3');

  assert.equal(isWantedBossWave(5), false);
  assert.equal(isWantedBossWave(10), false);
  assert.equal(isWantedBossWave(15), true);
  assert.equal(isWantedBossWave(30), true);
});

test('calculateBuggyPhase and resolveBuggyBlooperOutcome handle Buggy phases and misfire/trip bloopers', () => {
  assert.equal(calculateBuggyPhase(2350, 2350), 1);
  assert.equal(calculateBuggyPhase(1500, 2350), 2);
  assert.equal(calculateBuggyPhase(700, 2350), 3);

  assert.deepEqual(resolveBuggyBlooperOutcome(0.10, 'buggy_ball'), {
    triggered: true,
    blooperType: 'backfire',
    selfDamage: 85,
    stunSeconds: 1.5,
  });
  assert.deepEqual(resolveBuggyBlooperOutcome(0.20, 'bara_split'), {
    triggered: true,
    blooperType: 'trip',
    selfDamage: 30,
    stunSeconds: 1.4,
  });
  assert.deepEqual(resolveBuggyBlooperOutcome(0.65, 'buggy_ball'), {
    triggered: false,
    blooperType: null,
    selfDamage: 0,
    stunSeconds: 0,
  });
});
