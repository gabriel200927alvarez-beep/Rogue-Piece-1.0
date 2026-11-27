// ============================================================================
// 5. ENTIDADES, ENEMIGOS, JEFE ALVIDA, OLEADAS, PROYECTILES E IA ENEMIGA
// ============================================================================

import { CONFIG } from './config';
import { STATE } from './state';
import { AUDIO, triggerHaptic } from './audio';
import { triggerScreenShake } from './camera';
import {
  normalizeAngle,
  calculatePlayerDamage,
  spawnParticle,
  spawnFloatingText
} from './physics';
import { getCharacterModule } from './characters/index';
import { buildCharacterContext } from './abilities';
import { calculateBuggyPhase, calculateWaveEnemyMultipliers, resolveBuggyBlooperOutcome } from './rules';

export interface EntitiesCallbacks {
  onUpdateBossHUD: (boss: any) => void;
  onUpdateWaveHUD: () => void;
  onUpdatePlayerHUD: () => void;
  onTriggerGameOver: () => void;
  onEnterStage2: () => void;
  onEnterStage3: () => void;
  onStartBossCinematic: (bossType: string) => void;
  onDamageEnemiesInCircle: (
    cx: number,
    cy: number,
    radius: number,
    dmgMult: number,
    knockback: number,
    isSkill?: boolean,
    stunDur?: number
  ) => boolean;
}

let entitiesCallbacks: EntitiesCallbacks = {
  onUpdateBossHUD: () => {},
  onUpdateWaveHUD: () => {},
  onUpdatePlayerHUD: () => {},
  onTriggerGameOver: () => {},
  onEnterStage2: () => {},
  onEnterStage3: () => {},
  onStartBossCinematic: () => {},
  onDamageEnemiesInCircle: () => false
};

export function initEntities(callbacks: EntitiesCallbacks): void {
  entitiesCallbacks = callbacks;
}

export function createEnemy(type: string, wave: number, x: number, y: number): any {
  const wScale = wave - 1;
  const { hpMult, dmgMult } = calculateWaveEnemyMultipliers(wave);
  const hpScale = wave <= 5 ? 1 + 0.2 * wScale : hpMult;
  const dmgScale = wave <= 5 ? 1 + 0.1 * wScale : dmgMult;
  const baseStatuses = {
    vx: 0,
    vy: 0,
    facing: Math.PI,
    flashTimer: 0,
    stunTimer: 0,
    rootTimer: 0,
    bleedTimer: 0,
    bleedTick: 0,
    burnTimer: 0,
    burnTick: 0,
    burnDps: 5,
    clutchTimer: 0,
    clutchTick: 0,
    inSmoke: false,
    inLawRoom: false,
    armorDebuffTimer: 0,
    lawShamblesDebuffTimer: 0,
    magnetPullTimer: 0,
    magnetPullSpeed: 0,
    killerBleedStacks: 0,
    killerBleedTimer: 0,
    killerBleedTick: 0,
    frozen: false,
    frozenTimer: 0,
    akainuMarkTimer: 0,
    aokijiMarkTimer: 0,
    fearTimer: 0,
    slipperyTimer: 0,
    slideVx: 0,
    slideVy: 0,
    birdcageLocked: false,
    parasiteTimer: 0,
    parasiteAttackCd: 0,
    zeusShockChunks: 0,
    zeusShockTick: 0,
    blindTimer: 0,
    hitSquashTimer: 0,
    hitSquashMax: 0.12,
    hitAngle: 0,
    isFemale: false,
    isBoss: false
  };

  if (type === 'basic') {
    return {
      ...baseStatuses,
      type,
      name: 'Recluta',
      x,
      y,
      radius: 18,
      hp: Math.round(35 * hpScale),
      maxHp: Math.round(35 * hpScale),
      damage: 8 * dmgScale * 0.85,
      armor: wave > 5 ? 4 : 0,
      speed: 125,
      attackRange: 44,
      attackCd: 1.6,
      attackTimer: 0.7,
      telegraphTimer: 0,
      telegraphDuration: 0.4,
      telegraphAngle: Math.PI,
      isBlunt: false,
      berries: 1
    };
  } else if (type === 'shooter') {
    return {
      ...baseStatuses,
      type,
      name: 'Tirador',
      x,
      y,
      radius: 17,
      hp: Math.round(25 * hpScale),
      maxHp: Math.round(25 * hpScale),
      damage: 6 * dmgScale * 0.85,
      armor: 0,
      speed: 95,
      attackRange: 270,
      attackCd: 2.0,
      attackTimer: 1.2,
      telegraphTimer: 0,
      telegraphDuration: 0.4,
      telegraphAngle: Math.PI,
      isBlunt: false,
      berries: 2
    };
  } else if (type === 'shield') {
    const shieldHpScale = wave <= 5 ? 1 + 0.25 * wScale : hpMult * 1.15;
    return {
      ...baseStatuses,
      type,
      name: 'Escudero',
      x,
      y,
      radius: 20,
      hp: Math.round(80 * shieldHpScale),
      maxHp: Math.round(80 * shieldHpScale),
      damage: 10 * dmgScale * 0.85,
      armor: 12,
      speed: 75,
      attackRange: 40,
      attackCd: 2.2,
      attackTimer: 1.0,
      telegraphTimer: 0,
      telegraphDuration: 0.4,
      telegraphAngle: Math.PI,
      hasShield: true,
      shieldHp: wave > 5 ? 110 : 80,
      shieldMaxHp: wave > 5 ? 110 : 80,
      shieldBroken: false,
      shieldExposedTimer: 0,
      exposedBonusDmgTimer: 0,
      isBlunt: true,
      berries: 2
    };
  } else if (type === 'officer') {
    const offHpScale = wave <= 5 ? 1 + 0.3 * wScale : hpMult * 1.25;
    const offDmgScale = wave <= 5 ? 1 + 0.15 * wScale : dmgMult * 1.12;
    return {
      ...baseStatuses,
      type,
      name: 'Oficial',
      x,
      y,
      radius: 23,
      hp: Math.round(120 * offHpScale),
      maxHp: Math.round(120 * offHpScale),
      damage: 15 * offDmgScale * 0.85,
      armor: 25,
      speed: 90,
      attackRange: 55,
      attackCd: 3.0,
      attackTimer: 1.4,
      telegraphTimer: 0,
      telegraphDuration: 0.4,
      telegraphAngle: Math.PI,
      isBlunt: true,
      berries: 3
    };
  } else if (type === 'rifleman') {
    return {
      ...baseStatuses,
      type,
      name: 'Fusilero Marino',
      x,
      y,
      radius: 17,
      hp: Math.round(48 * hpMult),
      maxHp: Math.round(48 * hpMult),
      damage: 10.5 * dmgMult,
      armor: 5,
      speed: 108,
      attackRange: 350,
      attackCd: 2.1,
      attackTimer: 0.95,
      telegraphTimer: 0,
      telegraphDuration: 0.55,
      telegraphAngle: Math.PI,
      isBlunt: false,
      berries: 3
    };
  } else if (type === 'vanguard') {
    return {
      ...baseStatuses,
      type,
      name: 'Marine Pesado',
      x,
      y,
      radius: 25,
      hp: Math.round(128 * hpMult),
      maxHp: Math.round(128 * hpMult),
      damage: 14.5 * dmgMult,
      armor: 22,
      knockbackResist: 0.65,
      speed: 88,
      attackRange: 64,
      attackCd: 2.35,
      attackTimer: 1.05,
      telegraphTimer: 0,
      telegraphDuration: 0.58,
      telegraphAngle: Math.PI,
      isBlunt: true,
      berries: 4
    };
  } else if (type === 'swordsman') {
    return {
      ...baseStatuses,
      type,
      name: 'Oficial de Espada',
      x,
      y,
      radius: 20,
      hp: Math.round(78 * hpMult),
      maxHp: Math.round(78 * hpMult),
      damage: 12.5 * dmgMult,
      armor: 12,
      speed: 146,
      attackRange: 76,
      attackCd: 1.85,
      attackTimer: 0.85,
      telegraphTimer: 0,
      telegraphDuration: 0.42,
      telegraphAngle: Math.PI,
      isBlunt: false,
      berries: 3
    };
  } else if (type === 'alvida') {
    return {
      ...baseStatuses,
      type: 'alvida',
      name: 'ALVIDA',
      isBoss: true,
      isFemale: true,
      x,
      y,
      radius: 36,
      hp: 600,
      maxHp: 600,
      damage: 22,
      boomerangDamage: 18,
      slideDamage: 13,
      armor: 30,
      speed: 105,
      phase: 1,
      phase2Reinforced: false,
      aiState: 'idle',
      stateTimer: 1.0,
      telegraphType: 'melee',
      telegraphAngle: Math.PI,
      telegraphMaxTimer: 0.60,
      isBlunt: true,
      berries: 25
    };
  } else if (type === 'morgan') {
    return {
      ...baseStatuses,
      type: 'morgan',
      name: 'CAPITÁN MORGAN',
      isBoss: true,
      isFemale: false,
      x,
      y,
      radius: 40,
      hp: 1350,
      maxHp: 1350,
      damage: 30,
      rushDamage: 24,
      shockwaveDamage: 25,
      armor: 38,
      speed: 112,
      phase: 1,
      phase2Reinforced: false,
      aiState: 'idle',
      stateTimer: 0.95,
      telegraphType: 'axe_cleave',
      telegraphAngle: Math.PI,
      telegraphMaxTimer: 0.62,
      comboFollowupPending: false,
      rushHitPlayer: false,
      rushDirX: 1,
      rushDirY: 0,
      isBlunt: false,
      berries: 50
    };
  } else if (type === 'knife_juggler') {
    return {
      ...baseStatuses,
      type,
      name: 'Lanzacuchillos',
      x,
      y,
      radius: 18,
      hp: Math.round(42 * hpMult),
      maxHp: Math.round(42 * hpMult),
      damage: 9.5 * dmgMult,
      armor: 8,
      speed: 132,
      attackRange: 320,
      attackCd: 1.95,
      attackTimer: 0.9,
      telegraphTimer: 0,
      telegraphDuration: 0.46,
      telegraphAngle: Math.PI,
      isBlunt: false,
      berries: 3
    };
  } else if (type === 'acrobat') {
    return {
      ...baseStatuses,
      type,
      name: 'Acróbata del Circo',
      x,
      y,
      radius: 19,
      hp: Math.round(64 * hpMult),
      maxHp: Math.round(64 * hpMult),
      damage: 12 * dmgMult,
      armor: 10,
      speed: 162,
      attackRange: 138,
      attackCd: 1.9,
      attackTimer: 0.85,
      telegraphTimer: 0,
      telegraphDuration: 0.44,
      telegraphAngle: Math.PI,
      lungeTimer: 0,
      lungeDirX: 1,
      lungeDirY: 0,
      lungeHitPlayer: false,
      isBlunt: false,
      berries: 3
    };
  } else if (type === 'cannon_brute') {
    return {
      ...baseStatuses,
      type,
      name: 'Artillero Circense',
      x,
      y,
      radius: 25,
      hp: Math.round(115 * hpMult),
      maxHp: Math.round(115 * hpMult),
      damage: 14 * dmgMult,
      armor: 22,
      knockbackResist: 0.6,
      speed: 86,
      attackRange: 270,
      attackCd: 2.55,
      attackTimer: 1.1,
      telegraphTimer: 0,
      telegraphDuration: 0.60,
      telegraphAngle: Math.PI,
      isBlunt: true,
      berries: 4
    };
  } else if (type === 'buggy') {
    return {
      ...baseStatuses,
      type: 'buggy',
      name: 'BUGGY EL PAYASO',
      isBoss: true,
      isWanted: true,
      wantedBounty: '15,000,000',
      isFemale: false,
      x,
      y,
      radius: 44,
      hp: 2350,
      maxHp: 2350,
      damage: 36,
      knifeDamage: 24,
      bombDamage: 42,
      spinDamage: 26,
      armor: 44,
      speed: 120,
      phase: 1,
      phase2Reinforced: false,
      phase3Reinforced: false,
      aiState: 'idle',
      stateTimer: 0.9,
      telegraphType: 'knife_barrage',
      telegraphAngle: Math.PI,
      telegraphMaxTimer: 0.58,
      baraSplitActive: false,
      baraSplitTimer: 0,
      baraHandAngle: 0,
      baraOrbitTimer: 0,
      blooperTimer: 0,
      blooperType: null as 'backfire' | 'trip' | null,
      blooperCooldown: 0,
      quoteCooldown: 0,
      spinHitCooldown: 0,
      isBlunt: false,
      berries: 85
    };
  }
  return null;
}

export function breakEscuderoShield(en: any): void {
  en.hasShield = false;
  en.shieldBroken = true;
  en.stunTimer = 1.0;
  en.exposedBonusDmgTimer = 2.0;
  AUDIO.playExplosion(1.3);
  spawnFloatingText(en.x, en.y - 44, '💥 ¡ESCUDO ROTO!', '#4FC3F7', 1.15);
  for (let k = 0; k < 14; k++) {
    spawnParticle(en.x, en.y, '#29B6F6', 6, 0.45);
  }
}

export function onBossPhaseChange(boss: any, label: string): void {
  triggerScreenShake(8, 0.35);
  triggerHaptic([60, 40, 60]);
  spawnFloatingText(boss.x, boss.y - 55, label, '#FF5252', 1.35);
  const bossHud = document.getElementById('boss-hud');
  if (bossHud) {
    bossHud.classList.remove('boss-pulse');
    void bossHud.offsetWidth;
    bossHud.classList.add('boss-pulse');
  }

  for (let i = 0; i < 20; i++) {
    spawnParticle(boss.x, boss.y, '#C8102E', 7, 0.55);
  }
}

export function onEnemyKilled(en: any): void {
  STATE.killsRun++;
  STATE.waveEnemiesRemaining = Math.max(0, STATE.waveEnemiesRemaining - 1);
  entitiesCallbacks.onUpdateWaveHUD();

  let resGain = 8;
  if (en.type === 'buggy') resGain = 55;
  else if (en.type === 'morgan') resGain = 40;
  else if (en.isBoss || en.type === 'alvida') resGain = 30;
  else if (en.type === 'cannon_brute') resGain = 15;
  else if (en.type === 'officer') resGain = 15;
  else if (en.type === 'vanguard') resGain = 14;
  else if (en.type === 'acrobat') resGain = 12;
  else if (en.type === 'swordsman') resGain = 12;
  else if (en.type === 'shield') resGain = 12;
  else if (en.type === 'knife_juggler') resGain = 11;
  else if (en.type === 'rifleman') resGain = 10;
  else if (en.type === 'shooter') resGain = 6;
  else resGain = 8;

  getCharacterModule(STATE.charId).onEnemyKilled?.(buildCharacterContext(), en, resGain);

  for (let i = 0; i < 12; i++) {
    spawnParticle(en.x, en.y, en.isBoss ? '#F5C518' : '#E0E0E0', 5, 0.4);
  }

  const totalBerries = en.berries + STATE.mods.bonusBerries;
  for (let b = 0; b < totalBerries; b++) {
    STATE.berriesDrops.push({
      x: en.x + (Math.random() - 0.5) * 24,
      y: en.y + (Math.random() - 0.5) * 24,
      vx: (Math.random() - 0.5) * 90,
      vy: (Math.random() - 0.5) * 90,
      value: 1
    });
  }
}

export function damageEnemy(en: any, rawDamage: number, opts: Record<string, any> = {}): void {
  if (en.hp <= 0) return;

  const hitAng = Math.atan2(
    en.y - (opts.sourceY ?? STATE.player.y),
    en.x - (opts.sourceX ?? STATE.player.x)
  );
  let finalDmg = rawDamage;

  const charMod = getCharacterModule(STATE.charId);
  const modRes = charMod.onModifyDamageEnemy?.(STATE.player, en, opts) ?? {};

  // Mitigación de armadura enemiga con soporte para penetración de personaje
  let effectiveArmor = en.armor || 0;
  if (en.armorDebuffTimer > 0) effectiveArmor *= 0.80;
  let ignorePct = opts.ignoreArmorPct || 0;
  if (modRes.ignoreArmorPct && ignorePct < 1.0) {
    ignorePct = Math.max(ignorePct, modRes.ignoreArmorPct);
  }
  effectiveArmor *= 1 - Math.min(1, ignorePct);
  if (effectiveArmor > 0) {
    finalDmg = Math.max(1, Math.round(finalDmg * (100 / (100 + effectiveArmor))));
  }

  const bypassShield = Boolean(opts.pierceShield || modRes.pierceShield);

  if (en.type === 'shield' && en.hasShield && !en.shieldBroken && !bypassShield) {
    const isExposed = en.shieldExposedTimer > 0;
    const angleFromEnemyToPlayer = Math.atan2(STATE.player.y - en.y, STATE.player.x - en.x);
    const isFront = Math.abs(normalizeAngle(angleFromEnemyToPlayer - en.facing)) < Math.PI * 0.45;

    if (!isExposed && isFront) {
      if (opts.isNormalAttack) {
        en.shieldHp -= finalDmg;
        en.flashTimer = 0.08;
        en.hitSquashTimer = 0.09;
        en.hitSquashMax = 0.09;
        en.hitAngle = hitAng;
        for (let s = 0; s < 3; s++) {
          const sAng = hitAng + Math.PI + (Math.random() - 0.5) * 1.4;
          const sSpd = 140 + Math.random() * 140;
          spawnParticle(
            en.x + Math.cos(en.facing) * en.radius,
            en.y + Math.sin(en.facing) * en.radius,
            '#90CAF9',
            3.5,
            0.2,
            {
              shape: 'spark',
              vx: Math.cos(sAng) * sSpd,
              vy: Math.sin(sAng) * sSpd
            }
          );
        }
        spawnFloatingText(
          en.x,
          en.y - 36,
          `🛡️ Escudo (${Math.max(0, Math.ceil(en.shieldHp))})`,
          '#90CAF9',
          0.8
        );
        if (en.shieldHp <= 0) {
          breakEscuderoShield(en);
        }
        return;
      }
      finalDmg = Math.max(1, Math.round(finalDmg * 0.5));
      spawnFloatingText(en.x, en.y - 36, '🛡️ -50%', '#90CAF9', 0.8);
    }
  }

  if (modRes.dmgMult && modRes.dmgMult !== 1.0) {
    finalDmg = Math.round(finalDmg * modRes.dmgMult);
  }

  if (en.exposedBonusDmgTimer > 0) {
    finalDmg = Math.round(finalDmg * 1.5);
  }

  if (en.aokijiMarkTimer > 0) {
    finalDmg = Math.round(finalDmg * 1.15);
  }

  if (en.frozen) {
    if (opts.shatterFreeze) {
      en.frozen = false;
      en.frozenTimer = 0;
      if (!en.isBoss) {
        en.stunTimer = Math.max(en.stunTimer, 2.0);
      }
      AUDIO.playExplosion(1.45);
      triggerScreenShake(6, 0.16);
      for (let k = 0; k < 10; k++) {
        spawnParticle(en.x, en.y, k % 2 === 0 ? '#E1F5FE' : '#29B6F6', 5, 0.35, { shape: 'spark' });
      }
      spawnFloatingText(en.x, en.y - 46, '❄️ ¡FRACTURA 3×!', '#80DEEA', 1.25);
    } else if (!opts.ignoreFreezeMitigation) {
      finalDmg = Math.max(1, Math.round(finalDmg * 0.5));
    }
  }

  if (en.type === 'buggy') {
    if (en.blooperTimer > 0) {
      finalDmg = Math.round(finalDmg * 1.25);
    } else if (en.baraSplitActive) {
      if (opts.isCrit) {
        if ((en.quoteCooldown || 0) <= 0) {
          en.quoteCooldown = 3.5;
          spawnFloatingText(en.x, en.y - 72, '«¡¿A QUIÉN LLAMAS NARIZ DE TOMATE?!»', '#FF5252', 1.05);
        }
      } else {
        finalDmg = Math.max(1, Math.round(finalDmg * 0.72));
      }
    }
  }

  en.hp -= finalDmg;
  en.flashTimer = 0.08;
  en.hitSquashTimer = 0.12;
  en.hitSquashMax = 0.12;
  en.hitAngle = hitAng;

  const afterOpts = { ...opts, finalDmg };
  charMod.onAfterDamageEnemy?.(buildCharacterContext(), en, afterOpts);
  AUDIO.playHit();

  const dmgTextColor =
    modRes.damageTextColor || opts.damageTextColor || (opts.isCrit ? '#F5C518' : '#FFFFFF');
  spawnFloatingText(
    en.x + (Math.random() - 0.5) * 16,
    en.y - en.radius - 8,
    opts.isCrit ? `${finalDmg}!` : `${finalDmg}`,
    dmgTextColor,
    opts.isCrit ? 1.25 : 1.0,
    { isCrit: Boolean(opts.isCrit) }
  );

  const pCount = STATE.enemies.length > 8 ? 4 : 6;
  const sparkColor = opts.isCrit ? '#F5C518' : '#FFE082';
  for (let i = 0; i < pCount; i++) {
    const sAng = hitAng + (Math.random() - 0.5) * 1.65;
    const sSpd = 150 + Math.random() * 190;
    spawnParticle(en.x, en.y, i === 0 ? '#FFFFFF' : sparkColor, opts.isCrit ? 4.5 : 3.5, 0.22, {
      shape: 'spark',
      vx: Math.cos(sAng) * sSpd,
      vy: Math.sin(sAng) * sSpd
    });
  }
  if (STATE.slashEffects.length < 75) {
    STATE.slashEffects.push({
      x: en.x - Math.cos(hitAng) * (en.radius * 0.45),
      y: en.y - Math.sin(hitAng) * (en.radius * 0.45),
      angle: hitAng,
      range: opts.isCrit ? 26 : 19,
      color: opts.isCrit ? '#F5C518' : '#FFFFFF',
      life: 0.11,
      maxLife: 0.11,
      type: 'impact_flare'
    });
  }

  if (opts.knockback && !en.isBoss) {
    const kbScale = en.knockbackResist ? Math.max(0.15, 1 - en.knockbackResist) : 1.0;
    const ang = Math.atan2(
      en.y - (opts.sourceY ?? STATE.player.y),
      en.x - (opts.sourceX ?? STATE.player.x)
    );
    en.vx += Math.cos(ang) * opts.knockback * 3.5 * kbScale;
    en.vy += Math.sin(ang) * opts.knockback * 3.5 * kbScale;
  }

  if (opts.armorDebuffTimer) {
    en.armorDebuffTimer = Math.max(en.armorDebuffTimer || 0, opts.armorDebuffTimer);
  }

  if (opts.stun && !en.isBoss) {
    en.stunTimer = Math.max(en.stunTimer, opts.stun);
    spawnFloatingText(en.x, en.y - 42, '💫 ATURDIDO', '#FFEB3B', 0.85);
  }
  if (opts.blind && !en.isBoss) {
    en.stunTimer = Math.max(en.stunTimer, opts.blind);
    en.blindTimer = Math.max(en.blindTimer || 0, opts.blind);
    spawnFloatingText(en.x, en.y - 42, '✨ Cegado', '#FFF59D', 0.92);
  }
  if (opts.root) {
    en.rootTimer = Math.max(en.rootTimer, opts.root);
    spawnFloatingText(en.x, en.y - 42, '🌸 INMOVILIZADO', '#CE93D8', 0.85);
  }
  if (opts.clutchDot) {
    en.clutchTimer = opts.clutchDot;
    en.clutchTick = 0.5;
  }
  if (opts.applyBleed) {
    en.bleedTimer = 3.0;
    en.bleedTick = 0.5;
  }
  if (opts.applyBurn) {
    en.burnTimer = opts.burnDuration ?? 3.0;
    en.burnTick = 0.5;
    en.burnDps = opts.burnDps || 5;
  }
  if (opts.akainuMarkTimer) {
    en.akainuMarkTimer = Math.max(en.akainuMarkTimer || 0, opts.akainuMarkTimer);
  }
  if (opts.aokijiMarkTimer) {
    en.aokijiMarkTimer = Math.max(en.aokijiMarkTimer || 0, opts.aokijiMarkTimer);
  }
  if (opts.fearTimer && !en.isBoss) {
    en.fearTimer = Math.max(en.fearTimer || 0, opts.fearTimer);
    en.telegraphTimer = 0;
    spawnFloatingText(en.x, en.y - 42, '😱 TERROR', '#CE93D8', 0.9);
  }
  if (opts.zeusShockChunks) {
    en.zeusShockChunks = (en.zeusShockChunks || 0) + opts.zeusShockChunks;
    en.zeusShockTick = Math.min(en.zeusShockTick || 0.5, 0.5);
  }

  if (en.isBoss) {
    entitiesCallbacks.onUpdateBossHUD(en);
    const hpRatio = en.hp / en.maxHp;
    if (en.type === 'buggy') {
      const nextPhase = calculateBuggyPhase(en.hp, en.maxHp);
      if (en.phase === 1 && nextPhase >= 2) {
        en.phase = 2;
        AUDIO.playBuggyLaugh();
        onBossPhaseChange(en, '¡FASE 2: BARA BARA FESTIVAL!');
        if (!en.phase2Reinforced) {
          en.phase2Reinforced = true;
          spawnFloatingText(en.x, en.y - 88, '«¡Gyahaha! ¡A escena, payasos de Orange Town!»', '#FFD54F', 1.05);
          STATE.enemies.push(createEnemy('knife_juggler', STATE.wave, en.x - 95, en.y + 40));
          STATE.enemies.push(createEnemy('acrobat', STATE.wave, en.x + 95, en.y + 40));
          STATE.waveEnemiesRemaining += 2;
          entitiesCallbacks.onUpdateWaveHUD();
        }
      }
      if (en.phase < 3 && nextPhase === 3) {
        en.phase = 3;
        AUDIO.playBuggyLaugh();
        onBossPhaseChange(en, '¡FASE 3: ¡SUPER BALA BUGGY DE PÁNICO!!');
        if (!en.phase3Reinforced) {
          en.phase3Reinforced = true;
          spawnFloatingText(en.x, en.y - 92, '«¡Nadie se ríe del Gran Buggy! ¡FUEGO TOTAL!»', '#FF5252', 1.08);
          STATE.enemies.push(createEnemy('cannon_brute', STATE.wave, en.x - 105, en.y - 55));
          STATE.enemies.push(createEnemy('knife_juggler', STATE.wave, en.x + 105, en.y - 55));
          STATE.waveEnemiesRemaining += 2;
          entitiesCallbacks.onUpdateWaveHUD();
        }
      }
    } else if (en.type === 'morgan') {
      if (en.phase === 1 && hpRatio <= 0.60) {
        en.phase = 2;
        onBossPhaseChange(en, '¡FASE 2: FURIA DEL CAPITÁN MORGAN!');

        if (!en.phase2Reinforced) {
          en.phase2Reinforced = true;
          spawnFloatingText(en.x, en.y - 84, '«¡Marines, ejecutad a los intrusos!»', '#90CAF9', 1.05);
          STATE.enemies.push(createEnemy('rifleman', STATE.wave, en.x - 85, en.y + 45));
          STATE.enemies.push(createEnemy('vanguard', STATE.wave, en.x + 85, en.y + 45));
          STATE.enemies.push(createEnemy('swordsman', STATE.wave, en.x, en.y - 80));
          STATE.waveEnemiesRemaining += 3;
          entitiesCallbacks.onUpdateWaveHUD();
        }
      } else if (en.phase === 2 && hpRatio <= 0.30) {
        en.phase = 3;
        onBossPhaseChange(en, '¡FASE 3: ¡SOY EL CAPITÁN MORGAN!!');
      }
    } else {
      if (en.phase === 1 && hpRatio <= 0.60) {
        en.phase = 2;
        onBossPhaseChange(en, '¡FASE 2: MAZA BOOMERANG!');

        if (!en.phase2Reinforced) {
          en.phase2Reinforced = true;
          spawnFloatingText(en.x, en.y - 82, '«¡No me dejéis sola, inútiles!»', '#FFD54F', 1.05);
          STATE.enemies.push(createEnemy('basic', STATE.wave, en.x - 55, en.y + 40));
          STATE.enemies.push(createEnemy('basic', STATE.wave, en.x + 55, en.y + 40));
          STATE.waveEnemiesRemaining += 2;
          entitiesCallbacks.onUpdateWaveHUD();
        }
      } else if (en.phase === 2 && hpRatio <= 0.30) {
        en.phase = 3;
        onBossPhaseChange(en, '¡FASE 3: FURIA DESLIZANTE!');
      }
    }
  }

  if (en.hp <= 0) {
    onEnemyKilled(en);
  }
}

export function damagePlayer(incomingDmg: number, isBlunt = false, attacker: any = null, isProjectile = false): void {
  const p = STATE.player;
  if (p.invulnTimer > 0 || STATE.screen !== 'playing') return;

  const charMod = getCharacterModule(STATE.charId);
  const beforeRes = charMod.onBeforePlayerDamage?.(
    buildCharacterContext(),
    incomingDmg,
    isBlunt,
    attacker,
    isProjectile
  ) ?? {};
  if (beforeRes.cancelled) return;

  if (attacker && attacker.inSmoke && Math.random() < 0.50) {
    spawnFloatingText(p.x, p.y - 34, '💨 ¡FALLO!', '#CFD8DC', 0.9);
    return;
  }

  STATE.timeSinceLastCombat = 0;
  let dmg = incomingDmg * (beforeRes.dmgMult ?? 1.0);

  dmg = Math.max(1, Math.round(dmg * (100 / (100 + p.armor))));

  p.hp = Math.max(0, p.hp - dmg);
  if (p.superArmorTimer <= 0) {
    p.invulnTimer = 0.45;
  } else {
    p.invulnTimer = 0.20;
  }
  AUDIO.playBossHit();

  spawnFloatingText(p.x, p.y - 32, `-${dmg}`, '#FF5252', 1.15);
  triggerScreenShake(5, 0.14);
  triggerHaptic(40);
  entitiesCallbacks.onUpdatePlayerHUD();

  if (p.hp <= 0) {
    entitiesCallbacks.onTriggerGameOver();
  }
}

export function getWaveComposition(w: number): string[] {
  if (w === 5) {
    return ['basic', 'shooter', 'shield', 'officer', 'basic', 'shooter', 'alvida'];
  }
  if (w === 10) {
    return ['rifleman', 'vanguard', 'swordsman', 'officer', 'rifleman', 'vanguard', 'morgan'];
  }
  if (w === 15) {
    return ['knife_juggler', 'acrobat', 'cannon_brute', 'knife_juggler', 'acrobat', 'buggy'];
  }
  if (w >= 11) {
    const total = Math.round(18 + (w - 10) * 3);
    const list: string[] = [];
    for (let i = 0; i < total; i++) {
      if (w === 11) {
        if (i % 5 === 0) list.push('cannon_brute');
        else if (i % 3 === 1) list.push('knife_juggler');
        else if (i % 4 === 2) list.push('acrobat');
        else list.push(i % 2 === 0 ? 'swordsman' : 'knife_juggler');
      } else if (w === 12) {
        if (i % 5 === 0) list.push('cannon_brute');
        else if (i % 3 === 0) list.push('acrobat');
        else if (i % 3 === 1) list.push('knife_juggler');
        else list.push('swordsman');
      } else if (w === 13) {
        if (i % 4 === 0) list.push('cannon_brute');
        else if (i % 4 === 1) list.push('knife_juggler');
        else if (i % 4 === 2) list.push('acrobat');
        else list.push(i % 6 === 3 ? 'rifleman' : 'acrobat');
      } else {
        if (i % 4 === 0) list.push('cannon_brute');
        else if (i % 4 === 1) list.push('knife_juggler');
        else if (i % 4 === 2) list.push('acrobat');
        else list.push(i % 2 === 0 ? 'knife_juggler' : 'cannon_brute');
      }
    }
    return list;
  }
  if (w >= 6) {
    const total = Math.round(14 + (w - 5) * 3.5);
    const list: string[] = [];
    for (let i = 0; i < total; i++) {
      if (w === 6) {
        if (i % 5 === 0) list.push('vanguard');
        else if (i % 4 === 1) list.push('rifleman');
        else if (i % 6 === 3) list.push('shield');
        else if (i % 3 === 2) list.push('shooter');
        else list.push('basic');
      } else if (w === 7) {
        if (i % 5 === 0) list.push('vanguard');
        else if (i % 4 === 1) list.push('rifleman');
        else if (i % 4 === 2) list.push('swordsman');
        else if (i % 6 === 3) list.push('officer');
        else list.push('shield');
      } else if (w === 8) {
        if (i % 4 === 0) list.push('vanguard');
        else if (i % 4 === 1) list.push('rifleman');
        else if (i % 4 === 2) list.push('swordsman');
        else if (i % 6 === 3) list.push('officer');
        else list.push('shield');
      } else {
        if (i % 5 === 0) list.push('officer');
        else if (i % 4 === 1) list.push('vanguard');
        else if (i % 4 === 2) list.push('rifleman');
        else if (i % 4 === 3) list.push('swordsman');
        else list.push('shield');
      }
    }
    return list;
  }

  const total = Math.round((3 + 2 * w) * 1.5);
  const list: string[] = [];
  for (let i = 0; i < total; i++) {
    if (w === 1) {
      list.push(i % 4 === 3 ? 'shooter' : 'basic');
    } else if (w === 2) {
      if (i % 5 === 0) list.push('shield');
      else if (i % 3 === 0) list.push('shooter');
      else list.push('basic');
    } else if (w === 3) {
      if (i % 5 === 0) list.push('officer');
      else if (i % 3 === 0) list.push('shield');
      else if (i % 2 === 0) list.push('shooter');
      else list.push('basic');
    } else {
      if (i % 4 === 0) list.push('officer');
      else if (i % 4 === 1) list.push('shield');
      else if (i % 4 === 2) list.push('shooter');
      else list.push('basic');
    }
  }
  return list;
}

export function startWave(w: number): void {
  STATE.wave = w;
  const comp = getWaveComposition(w);
  STATE.waveSpawnQueue = [...comp];
  STATE.waveTotalEnemies = comp.length;
  STATE.waveEnemiesRemaining = comp.length;
  STATE.waveSpawnTimer = 0.25;
  STATE.waveClearPending = false;
  STATE.waveClearDelayTimer = 0;

  if (w >= 11) {
    entitiesCallbacks.onEnterStage3();
  } else if (w >= 6) {
    entitiesCallbacks.onEnterStage2();
  }

  const bossHud = document.getElementById('boss-hud');
  const bossTitle = document.getElementById('boss-title');
  const bossHpFill = document.getElementById('boss-hp-fill');
  if (w === 5 || w === 10 || w === 15) {
    if (bossHud) {
      bossHud.style.display = 'flex';
      bossHud.classList.toggle('boss-morgan', w === 10);
      bossHud.classList.toggle('boss-wanted', w === 15);
    }
    if (bossTitle) {
      bossTitle.textContent =
        w === 15
          ? '☠ WANTED · BUGGY EL PAYASO · 15,000,000 B ☠'
          : w === 10
            ? '🪓 CAPITÁN MORGAN, MANO DE HACHA 🪓'
            : '⚓ ALVIDA, LA MAZA DE HIERRO ⚓';
    }
    if (bossHpFill) bossHpFill.style.width = '100%';
  } else {
    if (bossHud) {
      bossHud.style.display = 'none';
      bossHud.classList.remove('boss-morgan', 'boss-wanted');
    }
  }

  entitiesCallbacks.onUpdateWaveHUD();

  if (w === 15) {
    // Generar a Buggy de inmediato para su cinemática fluida de entrada
    const buggyIdx = STATE.waveSpawnQueue.indexOf('buggy');
    if (buggyIdx !== -1) STATE.waveSpawnQueue.splice(buggyIdx, 1);
    const bx = CONFIG.WORLD_WIDTH / 2;
    const by = CONFIG.WORLD_HEIGHT / 2;
    const buggyBoss = createEnemy('buggy', w, bx, by - 220);
    if (buggyBoss) {
      buggyBoss.baraSplitActive = true;
      STATE.enemies.push(buggyBoss);
    }
    STATE.waveSpawnTimer = 0.85;
    entitiesCallbacks.onStartBossCinematic('buggy');
    return;
  }

  const announceText =
    w === 5
      ? '¡ALVIDA TE ESPERA EN EL CENTRO!'
      : w === 6
        ? '⚓ ¡PATIO DE LA BASE MARINA!'
        : w === 10
          ? '🪓 ¡EL CAPITÁN MORGAN TE DESAFÍA!'
          : w === 11
            ? '🎪 ¡PUERTO DEL CIRCO DE BUGGY!'
            : `OLEADA ${w}`;
  spawnFloatingText(
    STATE.player.x,
    STATE.player.y - 70,
    announceText,
    w >= 11 ? '#FF8A65' : w >= 6 ? '#90CAF9' : '#F5C518',
    1.45
  );
}

export function spawnNextEnemyFromQueue(): void {
  if (STATE.waveSpawnQueue.length === 0) return;
  const type = STATE.waveSpawnQueue.shift();

  if (type === 'alvida' || type === 'morgan' || type === 'buggy') {
    const bx = CONFIG.WORLD_WIDTH / 2;
    const by = CONFIG.WORLD_HEIGHT / 2;
    STATE.enemies.push(createEnemy(type, STATE.wave, bx, by));
    return;
  }

  const p = STATE.player;
  const angle = Math.random() * Math.PI * 2;
  const dist = 420 + Math.random() * 180;
  const x = Math.max(
    CONFIG.ARENA_MARGIN_X + 30,
    Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - 30, p.x + Math.cos(angle) * dist)
  );
  const y = Math.max(
    CONFIG.ARENA_MARGIN_Y + 30,
    Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - 30, p.y + Math.sin(angle) * dist)
  );

  STATE.enemies.push(createEnemy(type, STATE.wave, x, y));
}

export function executeMeleeMarineStrike(
  en: any,
  angle: number,
  range: number,
  halfAngle: number,
  isBlunt: boolean
): void {
  const p = STATE.player;
  en.flashTimer = 0.10;
  AUDIO.playSlash(0.8);

  STATE.slashEffects.push({
    x: en.x,
    y: en.y,
    angle: angle,
    range: range,
    halfAngle: halfAngle,
    color: '#FFFFFF',
    life: 0.15,
    maxLife: 0.15,
    type: 'marine_saber_arc'
  });

  if (
    Math.hypot(p.x - en.x, p.y - en.y) - p.radius <= range &&
    Math.abs(normalizeAngle(Math.atan2(p.y - en.y, p.x - en.x) - angle)) <= halfAngle
  ) {
    damagePlayer(en.damage, isBlunt, en);
  }
}

export function updateMarineAI(
  en: any,
  dt: number,
  dist: number,
  angleToPlayer: number,
  speedMult: number
): void {
  const p = STATE.player;
  const roomAtkSlow = en.inLawRoom ? 0.70 : 1.0;

  if (en.type === 'acrobat' && (en.lungeTimer || 0) > 0) {
    en.lungeTimer -= dt;
    en.x += (en.lungeDirX || 0) * 395 * speedMult * dt;
    en.y += (en.lungeDirY || 0) * 395 * speedMult * dt;
    en.facing += 18 * dt;
    if (Math.random() < 0.6) {
      spawnParticle(en.x, en.y, '#FFD54F', 3.5, 0.2);
    }
    if (!en.lungeHitPlayer && Math.hypot(p.x - en.x, p.y - en.y) <= en.radius + p.radius + 10) {
      en.lungeHitPlayer = true;
      damagePlayer(en.damage, false, en);
    }
    return;
  }

  if (en.telegraphTimer > 0) {
    en.telegraphTimer -= dt * roomAtkSlow;
    if (en.telegraphTimer <= 0) {
      if (en.type === 'shooter') {
        AUDIO.playPunch(1.3);
        STATE.projectiles.push({
          fromPlayer: false,
          owner: en,
          x: en.x + Math.cos(en.telegraphAngle) * 18,
          y: en.y + Math.sin(en.telegraphAngle) * 18,
          vx: Math.cos(en.telegraphAngle) * 320,
          vy: Math.sin(en.telegraphAngle) * 320,
          radius: 5,
          damage: en.damage,
          life: 2.2,
          color: '#FFD54F',
          type: 'bullet'
        });
      } else if (en.type === 'rifleman') {
        AUDIO.playExplosion(0.65);
        STATE.projectiles.push({
          fromPlayer: false,
          owner: en,
          x: en.x + Math.cos(en.telegraphAngle) * 24,
          y: en.y + Math.sin(en.telegraphAngle) * 24,
          vx: Math.cos(en.telegraphAngle) * 465,
          vy: Math.sin(en.telegraphAngle) * 465,
          radius: 5.5,
          damage: en.damage,
          life: 2.0,
          color: '#FF5252',
          type: 'rifle_shot'
        });
      } else if (en.type === 'knife_juggler') {
        AUDIO.playShing();
        const spread = [-0.22, 0, 0.22];
        spread.forEach((off) => {
          const ang = en.telegraphAngle + off;
          STATE.projectiles.push({
            fromPlayer: false,
            owner: en,
            x: en.x + Math.cos(ang) * 20,
            y: en.y + Math.sin(ang) * 20,
            vx: Math.cos(ang) * 355,
            vy: Math.sin(ang) * 355,
            radius: 7,
            damage: en.damage,
            life: 2.1,
            color: '#ECEFF1',
            rotation: ang,
            type: 'buggy_knife_proj'
          });
        });
      } else if (en.type === 'acrobat') {
        AUDIO.playDash();
        AUDIO.playSlash(0.95);
        en.lungeTimer = 0.28;
        en.lungeDirX = Math.cos(en.telegraphAngle);
        en.lungeDirY = Math.sin(en.telegraphAngle);
        en.lungeHitPlayer = false;
        STATE.slashEffects.push({
          x: en.x,
          y: en.y,
          angle: en.telegraphAngle,
          range: 118,
          halfAngle: Math.PI / 3.4,
          color: '#FFD54F',
          life: 0.2,
          maxLife: 0.2,
          type: 'swordsman_lunge'
        });
      } else if (en.type === 'cannon_brute') {
        AUDIO.playExplosion(0.85);
        const tx = Math.max(CONFIG.ARENA_MARGIN_X + 60, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - 60, p.x));
        const ty = Math.max(CONFIG.ARENA_MARGIN_Y + 60, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - 60, p.y));
        STATE.hazards.push({
          x: tx,
          y: ty,
          radius: 72,
          life: 1.0,
          maxLife: 1.0,
          damage: en.damage,
          owner: en,
          type: 'buggy_bomb'
        });
        for (let k = 0; k < 6; k++) {
          spawnParticle(en.x + Math.cos(en.telegraphAngle) * 22, en.y + Math.sin(en.telegraphAngle) * 22, '#FFAB40', 4, 0.24);
        }
      } else if (en.type === 'vanguard') {
        en.flashTimer = 0.12;
        AUDIO.playBossHit();
        triggerScreenShake(4, 0.12);
        const slamCx = en.x + Math.cos(en.telegraphAngle) * 24;
        const slamCy = en.y + Math.sin(en.telegraphAngle) * 24;
        STATE.slashEffects.push({
          x: slamCx,
          y: slamCy,
          angle: en.telegraphAngle,
          range: 70,
          isCircular: true,
          color: '#90CAF9',
          life: 0.24,
          maxLife: 0.24,
          type: 'vanguard_slam'
        });
        for (let k = 0; k < 8; k++) {
          spawnParticle(slamCx, slamCy, k % 2 === 0 ? '#B0BEC5' : '#FFAB40', 4.5, 0.26);
        }
        if (Math.hypot(p.x - slamCx, p.y - slamCy) <= 70 + p.radius) {
          damagePlayer(en.damage, true, en);
          if (p.superArmorTimer <= 0) {
            const kbMult = STATE.charId === 'kaido' ? 0.30 : 1.0;
            p.x += Math.cos(en.telegraphAngle) * 28 * kbMult;
            p.y += Math.sin(en.telegraphAngle) * 28 * kbMult;
          }
        }
      } else if (en.type === 'swordsman') {
        en.flashTimer = 0.10;
        en.x += Math.cos(en.telegraphAngle) * 44;
        en.y += Math.sin(en.telegraphAngle) * 44;
        AUDIO.playShing();
        STATE.slashEffects.push({
          x: en.x,
          y: en.y,
          angle: en.telegraphAngle,
          range: 80,
          halfAngle: Math.PI / 3.2,
          color: '#80D8FF',
          life: 0.18,
          maxLife: 0.18,
          type: 'swordsman_lunge'
        });
        if (
          Math.hypot(p.x - en.x, p.y - en.y) - p.radius <= 80 &&
          Math.abs(normalizeAngle(Math.atan2(p.y - en.y, p.x - en.x) - en.telegraphAngle)) <= Math.PI / 3.2
        ) {
          damagePlayer(en.damage, false, en);
        }
      } else {
        if (en.type === 'shield') {
          en.shieldExposedTimer = 1.2;
        }
        const halfAng = en.type === 'officer' ? Math.PI / 3 : Math.PI / 3.5;
        executeMeleeMarineStrike(en, en.telegraphAngle, en.attackRange, halfAng, en.isBlunt);
      }
    }
    return;
  }

  if (en.type === 'shooter' || en.type === 'rifleman' || en.type === 'knife_juggler' || en.type === 'cannon_brute') {
    const maxSpacing = en.type === 'rifleman' ? 335 : en.type === 'knife_juggler' ? 295 : en.type === 'cannon_brute' ? 255 : 280;
    const minSpacing = en.type === 'rifleman' ? 215 : en.type === 'knife_juggler' ? 195 : en.type === 'cannon_brute' ? 165 : 180;
    if (dist > maxSpacing) {
      en.x += Math.cos(angleToPlayer) * en.speed * speedMult * dt;
      en.y += Math.sin(angleToPlayer) * en.speed * speedMult * dt;
    } else if (dist < minSpacing) {
      en.x -= Math.cos(angleToPlayer) * en.speed * 0.8 * speedMult * dt;
      en.y -= Math.sin(angleToPlayer) * en.speed * 0.8 * speedMult * dt;
    } else if (en.type === 'rifleman' || en.type === 'knife_juggler') {
      const strafeAng = angleToPlayer + Math.PI / 2;
      en.x += Math.cos(strafeAng) * en.speed * 0.42 * speedMult * dt;
      en.y += Math.sin(strafeAng) * en.speed * 0.42 * speedMult * dt;
    }
    en.attackTimer -= dt * roomAtkSlow;
    const engageDist = en.type === 'rifleman' ? 390 : en.type === 'knife_juggler' ? 350 : 320;
    if (en.attackTimer <= 0 && dist <= engageDist) {
      en.attackTimer = en.attackCd;
      const dur = en.type === 'cannon_brute' ? 0.60 : en.type === 'rifleman' ? 0.55 : en.type === 'knife_juggler' ? 0.46 : 0.4;
      en.telegraphDuration = dur;
      en.telegraphTimer = dur;
      en.telegraphAngle = angleToPlayer;
    }
  } else {
    if (dist > en.attackRange - 6) {
      en.x += Math.cos(angleToPlayer) * en.speed * speedMult * dt;
      en.y += Math.sin(angleToPlayer) * en.speed * speedMult * dt;
    }
    en.attackTimer -= dt * roomAtkSlow;
    if (en.attackTimer <= 0 && dist <= en.attackRange + p.radius + 8) {
      en.attackTimer = en.attackCd;
      const dur = en.type === 'vanguard' ? 0.58 : en.type === 'acrobat' ? 0.44 : en.type === 'swordsman' ? 0.42 : 0.4;
      en.telegraphDuration = dur;
      en.telegraphTimer = dur;
      en.telegraphAngle = angleToPlayer;
    }
  }
}

export function updateAlvidaAI(
  boss: any,
  dt: number,
  dist: number,
  angleToPlayer: number,
  speedMult = 1.0
): void {
  const p = STATE.player;
  const roomSlow = boss.inLawRoom ? 0.70 : 1.0;
  const atkSpeedMult = (boss.phase === 3 ? 1.30 : 1.0) * roomSlow;
  boss.stateTimer -= dt * atkSpeedMult;

  if (boss.aiState === 'idle') {
    boss.facing = angleToPlayer;
    if (dist > 80) {
      boss.x += Math.cos(angleToPlayer) * boss.speed * speedMult * dt;
      boss.y += Math.sin(angleToPlayer) * boss.speed * speedMult * dt;
    }
    if (boss.stateTimer <= 0) {
      boss.aiState = 'telegraph';
      boss.stateTimer = 0.60;
      boss.telegraphMaxTimer = 0.60;
      boss.telegraphAngle = angleToPlayer;

      if (boss.phase === 1) {
        boss.telegraphType = 'melee';
      } else if (boss.phase === 2) {
        boss.telegraphType = Math.random() < 0.55 ? 'boomerang' : 'slide';
      } else {
        const r = Math.random();
        boss.telegraphType = r < 0.4 ? 'slide' : r < 0.75 ? 'boomerang' : 'melee';
      }
    }
  } else if (boss.aiState === 'telegraph') {
    if (boss.stateTimer <= 0) {
      boss.aiState = 'attack';
      boss.flashTimer = 0.10;

      if (boss.telegraphType === 'melee') {
        AUDIO.playBossHit();
        triggerScreenShake(6, 0.15);
        STATE.slashEffects.push({
          x: boss.x,
          y: boss.y,
          angle: boss.telegraphAngle,
          range: 70,
          halfAngle: Math.PI / 2.2,
          color: '#FFA726',
          life: 0.22,
          maxLife: 0.22,
          type: 'arc'
        });
        if (
          Math.hypot(p.x - boss.x, p.y - boss.y) - p.radius <= 70 &&
          Math.abs(normalizeAngle(Math.atan2(p.y - boss.y, p.x - boss.x) - boss.telegraphAngle)) <=
            Math.PI / 2.2
        ) {
          damagePlayer(boss.damage, true, boss);
        }
        boss.stateTimer = 0.45;
      } else if (boss.telegraphType === 'boomerang') {
        AUDIO.playSlash(1.2);
        STATE.projectiles.push({
          fromPlayer: false,
          x: boss.x + Math.cos(boss.telegraphAngle) * 40,
          y: boss.y + Math.sin(boss.telegraphAngle) * 40,
          vx: Math.cos(boss.telegraphAngle) * 430,
          vy: Math.sin(boss.telegraphAngle) * 430,
          radius: 24,
          damage: boss.boomerangDamage,
          life: 2.4,
          maxLife: 2.4,
          owner: boss,
          returning: false,
          type: 'mace_boomerang'
        });
        boss.stateTimer = 0.75;
      } else if (boss.telegraphType === 'slide') {
        AUDIO.playBossHit();
        boss.slideDirX = Math.cos(boss.telegraphAngle);
        boss.slideDirY = Math.sin(boss.telegraphAngle);
        boss.stateTimer = 0.35;
      }
    }
  } else if (boss.aiState === 'attack') {
    if (boss.telegraphType === 'slide') {
      boss.x += boss.slideDirX * 480 * speedMult * dt;
      boss.y += boss.slideDirY * 480 * speedMult * dt;

      if (boss.phase === 3 && Math.random() < 0.45) {
        STATE.hazards.push({
          x: boss.x,
          y: boss.y,
          radius: 42,
          life: 3.5,
          type: 'alvida_slow'
        });
      }

      if (Math.hypot(p.x - boss.x, p.y - boss.y) <= boss.radius + p.radius) {
        damagePlayer(boss.slideDamage, true, boss);
        if (p.superArmorTimer <= 0) {
          const kbMult = STATE.charId === 'kaido' ? 0.30 : 1.0;
          p.x += boss.slideDirX * 45 * kbMult;
          p.y += boss.slideDirY * 45 * kbMult;
        }
      }
    }
    if (boss.stateTimer <= 0) {
      boss.aiState = 'reposition';
      boss.stateTimer = boss.phase === 3 ? 0.5 : 0.7;
    }
  } else if (boss.aiState === 'reposition') {
    const perpAngle = angleToPlayer + Math.PI / 2;
    boss.x += Math.cos(perpAngle) * boss.speed * 0.9 * speedMult * dt;
    boss.y += Math.sin(perpAngle) * boss.speed * 0.9 * speedMult * dt;
    if (boss.stateTimer <= 0) {
      boss.aiState = 'idle';
      boss.stateTimer = boss.phase === 3 ? 1.85 : 2.25;
    }
  }
}

export function updateMorganAI(
  boss: any,
  dt: number,
  dist: number,
  angleToPlayer: number,
  speedMult = 1.0
): void {
  const p = STATE.player;
  const roomSlow = boss.inLawRoom ? 0.70 : 1.0;
  const phaseRate = boss.phase === 3 ? 1.42 : boss.phase === 2 ? 1.24 : 1.0;
  boss.stateTimer -= dt * phaseRate * roomSlow;

  if (boss.aiState === 'idle') {
    boss.facing = angleToPlayer;
    if (dist > 95) {
      boss.x += Math.cos(angleToPlayer) * boss.speed * speedMult * dt;
      boss.y += Math.sin(angleToPlayer) * boss.speed * speedMult * dt;
    }
    if (boss.stateTimer <= 0) {
      boss.aiState = 'telegraph';
      const baseWindup = boss.phase >= 2 ? 0.48 : 0.62;
      boss.stateTimer = baseWindup;
      boss.telegraphMaxTimer = baseWindup;
      boss.telegraphAngle = angleToPlayer;
      boss.comboFollowupPending = false;
      boss.rushHitPlayer = false;

      if (dist <= 135) {
        boss.telegraphType = Math.random() < 0.68 ? 'axe_cleave' : 'axe_rush';
      } else if (dist <= 300) {
        const r = Math.random();
        boss.telegraphType = r < 0.52 ? 'axe_rush' : r < 0.82 ? 'axe_shockwave' : 'axe_cleave';
      } else {
        boss.telegraphType = Math.random() < 0.55 ? 'axe_shockwave' : 'axe_rush';
      }
    }
  } else if (boss.aiState === 'telegraph') {
    if (boss.stateTimer <= 0) {
      boss.aiState = 'attack';
      boss.flashTimer = 0.12;

      if (boss.telegraphType === 'axe_cleave') {
        AUDIO.playBossHit();
        AUDIO.playSlash(0.75);
        triggerScreenShake(8, 0.18);
        const cleaveRange = 110;
        const halfAng = Math.PI / 2.0;
        STATE.slashEffects.push({
          x: boss.x,
          y: boss.y,
          angle: boss.telegraphAngle,
          range: cleaveRange,
          halfAngle: halfAng,
          color: '#ECEFF1',
          subColor: '#1565C0',
          life: 0.28,
          maxLife: 0.28,
          type: 'morgan_axe_cleave'
        });
        for (let k = 0; k < 12; k++) {
          const a = boss.telegraphAngle + (Math.random() - 0.5) * 1.4;
          spawnParticle(
            boss.x + Math.cos(a) * 60,
            boss.y + Math.sin(a) * 60,
            k % 2 === 0 ? '#CFD8DC' : '#90CAF9',
            5,
            0.3
          );
        }
        if (
          Math.hypot(p.x - boss.x, p.y - boss.y) - p.radius <= cleaveRange &&
          Math.abs(normalizeAngle(Math.atan2(p.y - boss.y, p.x - boss.x) - boss.telegraphAngle)) <= halfAng
        ) {
          damagePlayer(boss.damage, false, boss);
          if (p.superArmorTimer <= 0) {
            const kbMult = STATE.charId === 'kaido' ? 0.30 : 1.0;
            p.x += Math.cos(boss.telegraphAngle) * 42 * kbMult;
            p.y += Math.sin(boss.telegraphAngle) * 42 * kbMult;
          }
        }
        boss.stateTimer = boss.phase >= 2 ? 0.34 : 0.48;
      } else if (boss.telegraphType === 'axe_rush') {
        AUDIO.playDash();
        AUDIO.playBossHit();
        boss.rushDirX = Math.cos(boss.telegraphAngle);
        boss.rushDirY = Math.sin(boss.telegraphAngle);
        boss.facing = boss.telegraphAngle;
        boss.rushHitPlayer = false;
        boss.stateTimer = 0.42;
      } else if (boss.telegraphType === 'axe_shockwave') {
        AUDIO.playShing();
        AUDIO.playExplosion(0.9);
        triggerScreenShake(6, 0.14);
        STATE.projectiles.push({
          fromPlayer: false,
          owner: boss,
          x: boss.x + Math.cos(boss.telegraphAngle) * 34,
          y: boss.y + Math.sin(boss.telegraphAngle) * 34,
          vx: Math.cos(boss.telegraphAngle) * 445,
          vy: Math.sin(boss.telegraphAngle) * 445,
          radius: 26,
          damage: boss.shockwaveDamage,
          life: 2.0,
          maxLife: 2.0,
          color: '#90CAF9',
          type: 'morgan_wind_blade'
        });
        boss.stateTimer = boss.phase >= 2 ? 0.42 : 0.62;
      }
    }
  } else if (boss.aiState === 'attack') {
    if (boss.telegraphType === 'axe_rush') {
      boss.x += boss.rushDirX * 545 * speedMult * dt;
      boss.y += boss.rushDirY * 545 * speedMult * dt;
      boss.facing += 16 * dt;

      if (Math.random() < 0.75) {
        spawnParticle(
          boss.x,
          boss.y,
          Math.random() < 0.5 ? '#CFD8DC' : '#42A5F5',
          5.5,
          0.26,
          { shape: 'spark' }
        );
      }

      if (!boss.rushHitPlayer && Math.hypot(p.x - boss.x, p.y - boss.y) <= boss.radius + p.radius + 14) {
        boss.rushHitPlayer = true;
        damagePlayer(boss.rushDamage, false, boss);
        if (p.superArmorTimer <= 0) {
          const kbMult = STATE.charId === 'kaido' ? 0.30 : 1.0;
          p.x += boss.rushDirX * 52 * kbMult;
          p.y += boss.rushDirY * 52 * kbMult;
        }
        STATE.slashEffects.push({
          x: boss.x,
          y: boss.y,
          angle: Math.atan2(boss.rushDirY, boss.rushDirX),
          range: 95,
          halfAngle: Math.PI * 0.75,
          color: '#FFFFFF',
          subColor: '#1E88E5',
          life: 0.24,
          maxLife: 0.24,
          type: 'morgan_axe_cleave'
        });
      }
    }

    if (boss.stateTimer <= 0) {
      if (
        boss.phase >= 2 &&
        !boss.comboFollowupPending &&
        (boss.telegraphType === 'axe_rush' || (boss.telegraphType === 'axe_cleave' && dist <= 155))
      ) {
        boss.comboFollowupPending = true;
        boss.aiState = 'telegraph';
        boss.telegraphType = boss.phase === 3 && dist > 150 ? 'axe_shockwave' : 'axe_cleave';
        boss.telegraphAngle = angleToPlayer;
        boss.telegraphMaxTimer = 0.36;
        boss.stateTimer = 0.36;
        boss.facing = angleToPlayer;
        return;
      }
      boss.aiState = 'reposition';
      boss.stateTimer = boss.phase === 3 ? 0.42 : 0.62;
    }
  } else if (boss.aiState === 'reposition') {
    boss.facing = angleToPlayer;
    const perpAngle = angleToPlayer + Math.PI / 2;
    boss.x += Math.cos(perpAngle) * boss.speed * 0.85 * speedMult * dt;
    boss.y += Math.sin(perpAngle) * boss.speed * 0.85 * speedMult * dt;
    if (boss.stateTimer <= 0) {
      boss.aiState = 'idle';
      boss.stateTimer = boss.phase === 3 ? 1.15 : boss.phase === 2 ? 1.45 : 1.85;
    }
  }
}

const BUGGY_COMBAT_QUOTES = [
  '«¡Gyahaha! ¡Nadie supera al Gran Capitán Buggy!»',
  '«¡Contemplad el poder de la Bara Bara no Mi!»',
  '«¡Seré el Rey del Circo y del Grand Line!»',
  '«¡¿Están listos para volar en pedazos?!»'
];

export function updateBuggyAI(
  boss: any,
  dt: number,
  dist: number,
  angleToPlayer: number,
  speedMult = 1.0
): void {
  const p = STATE.player;
  const roomSlow = boss.inLawRoom ? 0.70 : 1.0;
  const phaseRate = boss.phase === 3 ? 1.32 : boss.phase === 2 ? 1.16 : 1.0;

  boss.baraHandAngle = (boss.baraHandAngle || 0) + dt * (boss.baraSplitActive ? 6.5 : 2.2);
  if (boss.blooperCooldown > 0) boss.blooperCooldown = Math.max(0, boss.blooperCooldown - dt);
  if (boss.quoteCooldown > 0) boss.quoteCooldown = Math.max(0, boss.quoteCooldown - dt);
  if (boss.spinHitCooldown > 0) boss.spinHitCooldown = Math.max(0, boss.spinHitCooldown - dt);

  if (boss.blooperTimer > 0) {
    boss.blooperTimer = Math.max(0, boss.blooperTimer - dt);
    if (boss.blooperTimer <= 0) {
      boss.blooperType = null;
      boss.aiState = 'reposition';
      boss.stateTimer = 0.5;
    }
    return;
  }

  if (boss.baraSplitActive) {
    boss.baraSplitTimer = Math.max(0, (boss.baraSplitTimer || 0) - dt);
    if (boss.baraSplitTimer <= 0 && boss.aiState !== 'attack') {
      boss.baraSplitActive = false;
      const blooper = boss.blooperCooldown <= 0
        ? resolveBuggyBlooperOutcome(Math.random(), 'bara_split')
        : { triggered: false, blooperType: null, selfDamage: 0, stunSeconds: 0 };
      if (blooper.triggered) {
        boss.blooperCooldown = 6.5;
        boss.blooperType = blooper.blooperType;
        boss.blooperTimer = blooper.stunSeconds;
        boss.hp = Math.max(1, boss.hp - blooper.selfDamage);
        entitiesCallbacks.onUpdateBossHUD(boss);
        AUDIO.playBlooperBonk();
        spawnFloatingText(boss.x, boss.y - 68, '«¡¿Eh?! ¡Mi pie se fue solo!» 🤡', '#FFF59D', 1.15);
        spawnFloatingText(boss.x, boss.y - 34, `-${blooper.selfDamage} (BLOOPER!)`, '#FFAB40', 1.05);
        return;
      }
    }
  }

  boss.stateTimer -= dt * phaseRate * roomSlow;

  if (boss.aiState === 'idle') {
    boss.facing = angleToPlayer;
    if (dist > 140) {
      boss.x += Math.cos(angleToPlayer) * boss.speed * speedMult * dt;
      boss.y += Math.sin(angleToPlayer) * boss.speed * speedMult * dt;
    } else if (dist < 85) {
      boss.x -= Math.cos(angleToPlayer) * boss.speed * 0.65 * speedMult * dt;
      boss.y -= Math.sin(angleToPlayer) * boss.speed * 0.65 * speedMult * dt;
    }

    if (boss.stateTimer <= 0) {
      boss.aiState = 'telegraph';
      const windup = boss.phase === 3 ? 0.46 : boss.phase === 2 ? 0.52 : 0.58;
      boss.stateTimer = windup;
      boss.telegraphMaxTimer = windup;
      boss.telegraphAngle = angleToPlayer;

      const aliveMinions = STATE.enemies.filter((e) => !e.isBoss && e.hp > 0).length;
      const r = Math.random();
      if (aliveMinions < 2 && boss.phase >= 2 && r < 0.20) {
        boss.telegraphType = 'circus_call';
      } else if (r < 0.36) {
        boss.telegraphType = 'knife_barrage';
      } else if (r < 0.68) {
        boss.telegraphType = 'buggy_ball';
      } else {
        boss.telegraphType = 'bara_split';
      }

      if (boss.quoteCooldown <= 0 && Math.random() < 0.45) {
        boss.quoteCooldown = 4.5;
        const q = BUGGY_COMBAT_QUOTES[Math.floor(Math.random() * BUGGY_COMBAT_QUOTES.length)];
        spawnFloatingText(boss.x, boss.y - 78, q, '#FFD54F', 1.0);
      }
    }
  } else if (boss.aiState === 'telegraph') {
    if (boss.stateTimer <= 0) {
      boss.aiState = 'attack';
      boss.flashTimer = 0.10;

      if (boss.telegraphType === 'knife_barrage') {
        AUDIO.playShing();
        AUDIO.playSlash(1.1);
        const count = boss.phase === 3 ? 7 : 5;
        const spreadArc = boss.phase === 3 ? 1.15 : 0.85;
        for (let k = 0; k < count; k++) {
          const frac = k / (count - 1) - 0.5;
          const ang = boss.telegraphAngle + frac * spreadArc;
          STATE.projectiles.push({
            fromPlayer: false,
            owner: boss,
            x: boss.x + Math.cos(ang) * 34,
            y: boss.y + Math.sin(ang) * 34,
            vx: Math.cos(ang) * 410,
            vy: Math.sin(ang) * 410,
            radius: 9,
            damage: boss.knifeDamage,
            life: 2.2,
            color: '#ECEFF1',
            rotation: ang,
            type: 'buggy_knife_proj'
          });
        }
        boss.stateTimer = 0.48;
      } else if (boss.telegraphType === 'buggy_ball') {
        const blooper = boss.blooperCooldown <= 0
          ? resolveBuggyBlooperOutcome(Math.random(), 'buggy_ball')
          : { triggered: false, blooperType: null, selfDamage: 0, stunSeconds: 0 };

        if (blooper.triggered) {
          boss.blooperCooldown = 6.5;
          boss.blooperType = 'backfire';
          boss.blooperTimer = blooper.stunSeconds;
          boss.aiState = 'idle';
          boss.hp = Math.max(1, boss.hp - blooper.selfDamage);
          entitiesCallbacks.onUpdateBossHUD(boss);
          AUDIO.playExplosion(0.95);
          AUDIO.playBlooperBonk();
          triggerScreenShake(7, 0.22);
          STATE.slashEffects.push({
            x: boss.x, y: boss.y, angle: 0, range: 95, isCircular: true,
            color: '#FF7043', life: 0.3, maxLife: 0.3, type: 'ring'
          });
          for (let k = 0; k < 14; k++) {
            spawnParticle(boss.x, boss.y, k % 2 === 0 ? '#FF5722' : '#263238', 5.5, 0.36);
          }
          spawnFloatingText(boss.x, boss.y - 74, '«¡Maldición! ¡Prendí la mecha al revés!» 💥', '#FFAB40', 1.15);
          spawnFloatingText(boss.x, boss.y - 36, `-${blooper.selfDamage} (BLOOPER!)`, '#FF5252', 1.15);
          return;
        }

        AUDIO.playExplosion(0.8);
        spawnFloatingText(boss.x, boss.y - 72, '«¡Toma mi especial: BALA BUGGY!»', '#FF5252', 1.08);
        STATE.projectiles.push({
          fromPlayer: false,
          owner: boss,
          x: boss.x + Math.cos(boss.telegraphAngle) * 38,
          y: boss.y + Math.sin(boss.telegraphAngle) * 38,
          vx: Math.cos(boss.telegraphAngle) * 340,
          vy: Math.sin(boss.telegraphAngle) * 340,
          radius: 17,
          blastRadius: 112,
          maxRange: Math.max(180, Math.min(460, dist + 35)),
          damage: boss.bombDamage,
          life: 2.0,
          color: '#D32F2F',
          type: 'buggy_ball_proj'
        });
        if (boss.phase >= 2) {
          const bombCount = boss.phase === 3 ? 2 : 1;
          for (let b = 0; b < bombCount; b++) {
            const ox = (b === 0 ? -1 : 1) * (boss.phase === 3 ? 75 : 0);
            const tx = Math.max(CONFIG.ARENA_MARGIN_X + 80, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - 80, p.x + ox));
            const ty = Math.max(CONFIG.ARENA_MARGIN_Y + 80, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - 80, p.y + (b === 1 ? 55 : 0)));
            STATE.hazards.push({
              x: tx,
              y: ty,
              radius: 92,
              life: 1.15,
              maxLife: 1.15,
              damage: Math.round(boss.bombDamage * 0.85),
              owner: boss,
              type: 'buggy_bomb'
            });
          }
        }
        boss.stateTimer = 0.65;
      } else if (boss.telegraphType === 'bara_split') {
        AUDIO.playBuggyLaugh();
        boss.baraSplitActive = true;
        boss.baraSplitTimer = 2.25;
        boss.rushDirX = Math.cos(boss.telegraphAngle);
        boss.rushDirY = Math.sin(boss.telegraphAngle);
        spawnFloatingText(boss.x, boss.y - 74, '«¡Bara Bara Festival! ¡Partes al ataque!»', '#4FC3F7', 1.1);
        boss.stateTimer = 1.45;
      } else if (boss.telegraphType === 'circus_call') {
        AUDIO.playBuggyLaugh();
        spawnFloatingText(boss.x, boss.y - 74, '«¡Salid, tropa de Buggy!»', '#FFD54F', 1.1);
        const s1 = createEnemy('knife_juggler', STATE.wave, boss.x - 85, boss.y + 45);
        const s2 = createEnemy('acrobat', STATE.wave, boss.x + 85, boss.y + 45);
        if (s1) { STATE.enemies.push(s1); STATE.waveEnemiesRemaining++; }
        if (s2) { STATE.enemies.push(s2); STATE.waveEnemiesRemaining++; }
        entitiesCallbacks.onUpdateWaveHUD();
        boss.stateTimer = 0.55;
      }
    }
  } else if (boss.aiState === 'attack') {
    if (boss.telegraphType === 'bara_split') {
      const chaseAng = angleToPlayer;
      boss.x += Math.cos(chaseAng) * 235 * speedMult * dt;
      boss.y += Math.sin(chaseAng) * 235 * speedMult * dt;
      boss.facing = chaseAng;

      if (Math.random() < 0.5) {
        spawnParticle(boss.x + (Math.random() - 0.5) * 40, boss.y + (Math.random() - 0.5) * 40, '#4FC3F7', 3.5, 0.22);
      }

      if (boss.spinHitCooldown <= 0 && Math.hypot(p.x - boss.x, p.y - boss.y) <= boss.radius + p.radius + 24) {
        boss.spinHitCooldown = 0.45;
        AUDIO.playSlash(1.0);
        damagePlayer(boss.spinDamage, false, boss);
      }

      // Lanza un cuchillo desde las manos flotantes a mitad del giro
      if (!boss.splitShotFired && boss.stateTimer < 0.75) {
        boss.splitShotFired = true;
        AUDIO.playShing();
        [-0.3, 0.3].forEach((off) => {
          const ang = angleToPlayer + off;
          STATE.projectiles.push({
            fromPlayer: false,
            owner: boss,
            x: boss.x + Math.cos(ang) * 42,
            y: boss.y + Math.sin(ang) * 42,
            vx: Math.cos(ang) * 390,
            vy: Math.sin(ang) * 390,
            radius: 8,
            damage: boss.knifeDamage,
            life: 1.9,
            color: '#ECEFF1',
            rotation: ang,
            type: 'buggy_knife_proj'
          });
        });
      }
    }

    if (boss.stateTimer <= 0) {
      boss.splitShotFired = false;
      boss.aiState = 'reposition';
      boss.stateTimer = boss.phase === 3 ? 0.45 : 0.65;
    }
  } else if (boss.aiState === 'reposition') {
    boss.facing = angleToPlayer;
    const perpAngle = angleToPlayer + Math.PI / 2;
    boss.x += Math.cos(perpAngle) * boss.speed * 0.92 * speedMult * dt;
    boss.y += Math.sin(perpAngle) * boss.speed * 0.92 * speedMult * dt;
    if (boss.stateTimer <= 0) {
      boss.aiState = 'idle';
      boss.stateTimer = boss.phase === 3 ? 1.05 : boss.phase === 2 ? 1.35 : 1.65;
    }
  }
}

export function detonateUsoppBomb(x: number, y: number, dmgMult: number): void {
  AUDIO.playExplosion(1.3);
  STATE.slashEffects.push({
    x,
    y,
    angle: 0,
    range: 40,
    isCircular: true,
    color: '#FF7043',
    life: 0.22,
    maxLife: 0.22,
    type: 'ring'
  });
  for (let k = 0; k < 10; k++) spawnParticle(x, y, '#FF9800', 4.5, 0.32);
  entitiesCallbacks.onDamageEnemiesInCircle(x, y, 40, dmgMult, 50, false);
}

export function detonateKizaruOrb(
  x: number,
  y: number,
  radius: number,
  dmgMult: number,
  isSkill: boolean,
  heavyBurst: boolean
): void {
  if (heavyBurst) {
    AUDIO.playExplosion(1.18);
    triggerScreenShake(5, 0.12);
  } else {
    AUDIO.playShing();
  }
  STATE.slashEffects.push({
    x,
    y,
    angle: 0,
    range: radius,
    isCircular: true,
    color: heavyBurst ? '#FFD54F' : '#FFF59D',
    life: heavyBurst ? 0.24 : 0.16,
    maxLife: heavyBurst ? 0.24 : 0.16,
    type: 'kizaru_light_explosion'
  });
  const count = heavyBurst ? 8 : 3;
  for (let k = 0; k < count; k++) {
    spawnParticle(x, y, k % 2 === 0 ? '#FFF59D' : '#FFFFFF', heavyBurst ? 4.8 : 3.2, heavyBurst ? 0.28 : 0.18, {
      shape: 'spark'
    });
  }
  entitiesCallbacks.onDamageEnemiesInCircle(x, y, radius, dmgMult, heavyBurst ? 72 : 24, isSkill);
}

export function updateProjectiles(dt: number): void {
  const p = STATE.player;
  const charMod = getCharacterModule(STATE.charId);
  const ctx = buildCharacterContext();
  for (let i = STATE.projectiles.length - 1; i >= 0; i--) {
    const pr = STATE.projectiles[i];
    pr.life -= dt;

    let projSpeedMult = 1.0;
    if (charMod.onProjectileTick) {
      const tickRes = charMod.onProjectileTick(ctx, pr, dt);
      if (tickRes?.speedMult !== undefined) projSpeedMult = tickRes.speedMult;
      if (tickRes?.remove) {
        STATE.projectiles.splice(i, 1);
        continue;
      }
    }

    if (pr.type === 'mace_boomerang' && pr.owner) {
      if (Math.random() < 0.7) spawnParticle(pr.x, pr.y, '#FF1744', 5, 0.25);
      if (!pr.returning && pr.life < pr.maxLife * 0.55) {
        pr.returning = true;
      }
      if (pr.returning && !pr.reflectedByLuffy) {
        const ang = Math.atan2(pr.owner.y - pr.y, pr.owner.x - pr.x);
        pr.vx = Math.cos(ang) * 460;
        pr.vy = Math.sin(ang) * 460;
        if (Math.hypot(pr.owner.x - pr.x, pr.owner.y - pr.y) < 35) {
          STATE.projectiles.splice(i, 1);
          continue;
        }
      }
    }

    if (pr.type === 'diable_comet' && pr.curveSign) {
      const perpX = -pr.vy / 600;
      const perpY = pr.vx / 600;
      pr.vx += perpX * pr.curveSign * dt;
      pr.vy += perpY * pr.curveSign * dt;
      if (Math.random() < 0.8) {
        spawnParticle(pr.x, pr.y, Math.random() < 0.5 ? '#FF5722' : '#FFA726', 4.5, 0.28);
      }
    }

    if (pr.type === 'firebird_star') {
      if (Math.random() < 0.85) spawnParticle(pr.x, pr.y, '#FF5722', 5, 0.30);
    }

    if (pr.type === 'usopp_bomb') {
      spawnParticle(pr.x, pr.y, '#FFF59D', 2.5, 0.14);
    }

    if (
      pr.type === 'zoro_air_cut' ||
      pr.type === 'pound_ho_x' ||
      pr.type === 'firebird_star' ||
      pr.type === 'diable_comet' ||
      pr.type === 'mace_boomerang' ||
      pr.type === 'morgan_wind_blade' ||
      pr.type === 'rifle_shot' ||
      pr.type === 'usopp_pellet' ||
      pr.type === 'bullet' ||
      pr.type === 'kizaru_light_orb' ||
      pr.type === 'kizaru_light_orb_heavy' ||
      pr.type === 'kizaru_light_beam' ||
      pr.type === 'kizaru_yasakani_orb' ||
      pr.type === 'buggy_knife_proj' ||
      pr.type === 'buggy_ball_proj'
    ) {
      if (!pr.trail) pr.trail = [];
      pr.trail.push({ x: pr.x, y: pr.y });
      if (pr.trail.length > 6) pr.trail.shift();
    }

    if (pr.type === 'buggy_knife_proj') {
      pr.rotation = (pr.rotation || 0) + 16 * dt;
    }

    const stepX = pr.vx * projSpeedMult * dt;
    const stepY = pr.vy * projSpeedMult * dt;
    pr.x += stepX;
    pr.y += stepY;

    if (pr.maxRange !== undefined) {
      pr.traveled = (pr.traveled || 0) + Math.hypot(stepX, stepY);
      if (pr.traveled >= pr.maxRange) {
        if (pr.type === 'usopp_bomb') {
          detonateUsoppBomb(pr.x, pr.y, pr.dmgMult);
        } else if (pr.type === 'kizaru_light_orb_heavy') {
          detonateKizaruOrb(pr.x, pr.y, pr.blastRadius || 115, pr.dmgMult, false, true);
        } else if (pr.type === 'buggy_ball_proj') {
          AUDIO.playExplosion(0.9);
          triggerScreenShake(7, 0.2);
          const blastR = pr.blastRadius || 112;
          STATE.slashEffects.push({
            x: pr.x, y: pr.y, angle: 0, range: blastR, isCircular: true,
            color: '#FF5722', life: 0.28, maxLife: 0.28, type: 'ring'
          });
          for (let k = 0; k < 14; k++) {
            spawnParticle(pr.x, pr.y, k % 2 === 0 ? '#FF5722' : '#FFD54F', 5.5, 0.36);
          }
          if (Math.hypot(p.x - pr.x, p.y - pr.y) <= blastR + p.radius) {
            damagePlayer(pr.damage, true, pr.owner, true);
          }
        }
        STATE.projectiles.splice(i, 1);
        continue;
      }
    }

    if (pr.type === 'pound_ho_x') {
      pr.rotation += 14 * dt;
      if (Math.random() < 0.6) spawnParticle(pr.x, pr.y, '#A5D6A7', 4, 0.35);
    }

    if (pr.type === 'zoro_air_cut') {
      pr.traveled += Math.hypot(stepX, stepY);
      if (pr.traveled >= pr.maxDist && !pr.spawnedCrack) {
        pr.spawnedCrack = true;
        STATE.hazards.push({
          x: pr.x,
          y: pr.y,
          radius: pr.crackRadius || 70,
          crackRadius: pr.crackRadius || 70,
          life: 0.4,
          type: 'zoro_crack',
          damaged: false
        });
        STATE.projectiles.splice(i, 1);
        continue;
      }
    }

    if (pr.fromPlayer) {
      for (let j = 0; j < STATE.enemies.length; j++) {
        const en = STATE.enemies[j];
        if (en.hp <= 0 || pr.hitIds.includes(en)) continue;
        if (Math.hypot(en.x - pr.x, en.y - pr.y) <= en.radius + pr.radius) {
          pr.hitIds.push(en);
          if (pr.reflectedFlatDamage) {
            damageEnemy(en, pr.reflectedFlatDamage, { isCrit: true });
          } else if (pr.type === 'diable_comet') {
            AUDIO.playFireCrackle();
            for (let k = 0; k < 8; k++) {
              spawnParticle(en.x, en.y, k % 2 === 0 ? '#FF5722' : '#FFA726', 5, 0.35);
            }
            const { amount, isCrit } = calculatePlayerDamage(pr.dmgMult, true);
            damageEnemy(en, amount, { isCrit, applyBurn: true, burnDps: 5 });
          } else if (pr.type === 'firebird_star') {
            AUDIO.playExplosion(1.3);
            const { amount, isCrit } = calculatePlayerDamage(pr.dmgMult, true);
            damageEnemy(en, amount, { isCrit, applyBurn: true, burnDps: 5 });
          } else if (pr.type === 'usopp_bomb') {
            detonateUsoppBomb(pr.x, pr.y, pr.dmgMult);
          } else if (pr.type === 'kizaru_light_orb_heavy') {
            detonateKizaruOrb(pr.x, pr.y, pr.blastRadius || 115, pr.dmgMult, false, true);
          } else if (pr.type === 'kizaru_light_beam') {
            detonateKizaruOrb(pr.x, pr.y, pr.blastRadius || 125, pr.dmgMult, false, true);
          } else if (pr.type === 'kizaru_yasakani_orb') {
            detonateKizaruOrb(pr.x, pr.y, pr.blastRadius || 44, pr.dmgMult, true, false);
          } else if (pr.type === 'kizaru_light_orb') {
            AUDIO.playShing();
            spawnParticle(pr.x, pr.y, '#FFF59D', 3.5, 0.16, { shape: 'spark' });
            const { amount, isCrit } = calculatePlayerDamage(pr.dmgMult, false);
            damageEnemy(en, amount, { isCrit, isNormalAttack: true });
          } else {
            const isNorm = pr.type === 'zoro_air_cut' || pr.type === 'usopp_pellet';
            const { amount, isCrit } = calculatePlayerDamage(pr.dmgMult, !isNorm);
            damageEnemy(en, amount, {
              isCrit,
              pierceShield: pr.pierceShield,
              isNormalAttack: isNorm
            });
          }

          if (pr.type === 'zoro_air_cut' && !pr.spawnedCrack) {
            pr.spawnedCrack = true;
            STATE.hazards.push({
              x: pr.x,
              y: pr.y,
              radius: pr.crackRadius || 70,
              crackRadius: pr.crackRadius || 70,
              life: 0.4,
              type: 'zoro_crack',
              damaged: false
            });
          }

          if (pr.maxHits && pr.hitIds.length >= pr.maxHits) {
            STATE.projectiles.splice(i, 1);
            break;
          }
        }
      }
    } else {
      if (Math.hypot(p.x - pr.x, p.y - pr.y) <= p.radius + pr.radius) {
        if (charMod.onCheckEnemyProjectileHit?.(ctx, pr)) {
          STATE.projectiles.splice(i, 1);
          continue;
        }
        if (pr.type === 'buggy_ball_proj') {
          AUDIO.playExplosion(0.9);
          triggerScreenShake(7, 0.2);
          const blastR = pr.blastRadius || 112;
          STATE.slashEffects.push({
            x: pr.x, y: pr.y, angle: 0, range: blastR, isCircular: true,
            color: '#FF5722', life: 0.28, maxLife: 0.28, type: 'ring'
          });
          for (let k = 0; k < 14; k++) {
            spawnParticle(pr.x, pr.y, k % 2 === 0 ? '#FF5722' : '#FFD54F', 5.5, 0.36);
          }
          if (Math.hypot(p.x - pr.x, p.y - pr.y) <= blastR + p.radius) {
            damagePlayer(pr.damage, true, pr.owner, true);
          }
          STATE.projectiles.splice(i, 1);
          continue;
        }
        damagePlayer(pr.damage, pr.type === 'mace_boomerang', pr.owner, true);
        if (pr.type !== 'mace_boomerang') {
          STATE.projectiles.splice(i, 1);
          continue;
        }
      }
    }

    if (pr.life <= 0) STATE.projectiles.splice(i, 1);
  }
}
