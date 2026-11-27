import { CONFIG } from './config';
import { CHARACTERS, getCharacterModule } from './characters/index';
import { STATE } from './state';
import { AUDIO } from './audio';
import { CAMERA, triggerScreenShake } from './camera';
import { INPUT_TOUCH, getMoveInput, initInput } from './input';
import { findNearestEnemy, calculatePlayerDamage, spawnParticle, spawnFloatingText } from './physics';
import { calculateWaveEnemyMultipliers } from './rules';
import {
  initEntities, createEnemy, damageEnemy, damagePlayer, onEnemyKilled, startWave,
  spawnNextEnemyFromQueue, updateMarineAI, updateAlvidaAI, updateMorganAI, updateBuggyAI, updateProjectiles
} from './entities';
import {
  initAbilities, buildCharacterContext, tryNormalAttack,
  damageEnemiesInCircle, damageEnemiesInLine, tryDash, releaseHoldDash, trySkill, releaseHoldSkill
} from './abilities';
import { initRendering, prerenderBackground, renderCharacterPreviews, render } from './rendering';
import {
  SAFE_UPGRADE_MODAL, advanceTutorialStep, showUpgradeSelection,
  updatePlayerHUD, updateCharacterHUD, updateWaveHUD,
  updateBossHUD, updateCooldownUI, showStageBanner, switchScreen, startNewRun,
  triggerGameOver, triggerVictory, handleStartGame,
  startBossCinematic, updateBossCinematicUI, skipBossCinematic, initUI
} from './ui';

export function updateEffects(dt: number): void {
  for (let i = STATE.afterimages.length - 1; i >= 0; i--) {
    STATE.afterimages[i].life -= dt;
    if (STATE.afterimages[i].life <= 0) STATE.afterimages.splice(i, 1);
  }
  for (let i = STATE.slashEffects.length - 1; i >= 0; i--) {
    STATE.slashEffects[i].life -= dt;
    if (STATE.slashEffects[i].life <= 0) STATE.slashEffects.splice(i, 1);
  }
  for (let i = 0; i < STATE.particles.length; i++) {
    const pt: any = STATE.particles[i];
    if (!pt.active) continue;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
    if (pt.life <= 0) pt.active = false;
  }
  for (let i = 0; i < STATE.floatingTexts.length; i++) {
    const ft: any = STATE.floatingTexts[i];
    if (!ft.active) continue;
    ft.y += ft.vy * dt;
    ft.vy *= 0.94;
    ft.life -= dt;
    if (ft.life <= 0) ft.active = false;
  }
}

export function update(dt: number): void {
  if (STATE.screen === 'upgrades') {
    SAFE_UPGRADE_MODAL.update(dt);
    return;
  }

  if (STATE.screen !== 'playing') return;

  if (STATE.tutorial.active) {
    STATE.tutorial.timer -= dt;
    if (STATE.tutorial.timer <= 0) {
      advanceTutorialStep();
    }
  }

  if (STATE.impactFlashTimer > 0) {
    STATE.impactFlashTimer = Math.max(0, STATE.impactFlashTimer - dt);
  }

  if (STATE.hitstopTimer > 0) {
    STATE.hitstopTimer -= dt;
    return;
  }

  if (STATE.shakeTimer > 0) STATE.shakeTimer -= dt;

  const p = STATE.player;

  if (STATE.bossCinematic.active) {
    const cin = STATE.bossCinematic;
    cin.timer += dt;
    const boss = STATE.enemies.find((e) => e.isBoss && e.type === cin.bossType);
    if (boss) {
      const glideT = Math.min(1, cin.timer / 2.1);
      const easeT = 1 - Math.pow(1 - glideT, 3);
      boss.x = cin.startX + (cin.targetX - cin.startX) * easeT;
      boss.y = cin.startY + (cin.targetY - cin.startY) * easeT;
      boss.baraHandAngle = (boss.baraHandAngle || 0) + dt * 7.2;
      boss.baraSplitActive = cin.timer < 2.55;
      boss.facing = Math.atan2(p.y - boss.y, p.x - boss.x);

      if (cin.timer >= 1.9 && cin.lineIndex === 0) {
        cin.lineIndex = 1;
        AUDIO.playBuggyLaugh();
        for (let k = 0; k < 12; k++) {
          spawnParticle(boss.x, boss.y, k % 2 === 0 ? '#FFD54F' : '#EF5350', 5, 0.35);
        }
      }

      const focusX = cin.timer < 2.65 ? boss.x : p.x;
      const focusY = cin.timer < 2.65 ? boss.y : p.y;
      const targetCamX = Math.max(0, Math.min(CONFIG.WORLD_WIDTH - CONFIG.WIDTH, focusX - CONFIG.WIDTH / 2));
      const targetCamY = Math.max(0, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.HEIGHT, focusY - CONFIG.HEIGHT / 2));
      CAMERA.x += (targetCamX - CAMERA.x) * Math.min(1, dt * 4.5);
      CAMERA.y += (targetCamY - CAMERA.y) * Math.min(1, dt * 4.5);
    }

    updateEffects(dt);
    updateBossCinematicUI();

    if (cin.timer >= cin.duration || cin.skipped) {
      skipBossCinematic();
    }
    return;
  }

  const charMod = getCharacterModule(STATE.charId);
  const ctx = buildCharacterContext();
  STATE.timeSinceLastCombat += dt;

  if (STATE.mods.outOfCombatRegen > 0 && STATE.timeSinceLastCombat > 3.0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + STATE.mods.outOfCombatRegen * dt);
    updatePlayerHUD();
  }

  if (p.invulnTimer > 0) p.invulnTimer -= dt;
  if (p.slowTimer > 0) p.slowTimer -= dt;
  if (p.speedBuffTimer > 0) p.speedBuffTimer -= dt;
  if (p.attackCooldown > 0) p.attackCooldown -= dt;
  if (p.attackAnimTimer > 0) p.attackAnimTimer -= dt;
  if (p.skillAnimTimer > 0) p.skillAnimTimer -= dt;
  if (p.superArmorTimer > 0) p.superArmorTimer -= dt;

  charMod.onUpdate?.(ctx, dt);

  if (p.comboResetTimer > 0) {
    p.comboResetTimer -= dt;
    if (p.comboResetTimer <= 0) p.comboStep = 0;
  }

  if (INPUT_TOUCH.attackHeld && p.attackCooldown <= 0 && !p.isDashing && (!charMod.canAttack || charMod.canAttack(p))) {
    tryNormalAttack();
  }

  for (let i = 0; i < 3; i++) {
    if (p.skillCds[i] > 0) p.skillCds[i] = Math.max(0, p.skillCds[i] - dt);
  }
  if (p.dashCharges < p.maxDashCharges) {
    p.dashCdTimer -= dt;
    if (p.dashCdTimer <= 0) {
      p.dashCharges++;
      if (p.dashCharges < p.maxDashCharges) {
        p.dashCdTimer = p.dashCdMax * STATE.mods.dashCdMult;
      }
    }
  }

  if (p.isDashing) {
    p.dashTimer -= dt;
    const dashDist = p.customDashDist || CONFIG.DASH_DISTANCE;
    const dashDur = p.dashDurationMax || CONFIG.DASH_DURATION;
    const dashSpeed = dashDist / dashDur;
    p.x += p.dashDirX * dashSpeed * dt;
    p.y += p.dashDirY * dashSpeed * dt;

    if (charMod.onDashHitEnemy) {
      STATE.enemies.forEach((en) => {
        if (en.hp <= 0 || p.dashHitEnemyIds.includes(en)) return;
        if (Math.hypot(en.x - p.x, en.y - p.y) <= en.radius + p.radius + 14) {
          p.dashHitEnemyIds.push(en);
          charMod.onDashHitEnemy!(ctx, en);
        }
      });
    }

    if (Math.random() < 0.78 && STATE.afterimages.length < 24) {
      STATE.afterimages.push({
        x: p.x, y: p.y, angle: p.facingAngle, radius: p.radius,
        color: charMod.color, life: 0.18, maxLife: 0.18
      });
    }

    if (p.dashTimer <= 0) {
      p.isDashing = false;
      charMod.onDashEnd?.(ctx);
    }
  } else {
    if (p.momentumTimer > 0) {
      p.momentumTimer -= dt;
      const momSpeed = 15 / 0.10;
      p.x += p.momentumDirX * momSpeed * dt;
      p.y += p.momentumDirY * momSpeed * dt;
    }

    let speedMult = charMod.getMoveSpeedMult?.(p) ?? 1.0;
    if (p.speedBuffTimer > 0) speedMult *= 1.15;
    if (p.slowTimer > 0) {
      if (STATE.charId === 'kaido' && p.superArmorTimer > 0) {
        speedMult *= 0.90;
      } else {
        speedMult *= STATE.charId === 'kaido' ? 0.78 : 0.55;
      }
    }

    if (charMod.isMovementLocked?.(p)) {
      p.vx = 0;
      p.vy = 0;
    } else {
      const mv = getMoveInput();
      p.vx = mv.dirX * mv.magnitude * p.speed * speedMult;
      p.vy = mv.dirY * mv.magnitude * p.speed * speedMult;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (getMoveInput().magnitude > 0.1 && !charMod.isFacingLocked?.(p)) {
      p.facingAngle = Math.atan2(p.vy, p.vx);
    }
  }

  p.visualScaleX += (1.0 - (p.visualScaleX || 1.0)) * Math.min(1, dt * 12);
  p.visualScaleY += (1.0 - (p.visualScaleY || 1.0)) * Math.min(1, dt * 12);
  if (p.landSquashTimer > 0) p.landSquashTimer = Math.max(0, p.landSquashTimer - dt);

  if (!p.isDashing && !charMod.isMovementLocked?.(p)) {
    const moveSpd = Math.hypot(p.vx, p.vy);
    if (moveSpd > 65) {
      p.stepDustTimer = (p.stepDustTimer || 0) - dt;
      if (p.stepDustTimer <= 0) {
        p.stepDustTimer = 0.11;
        spawnParticle(
          p.x - Math.cos(p.facingAngle) * 8 + (Math.random() - 0.5) * 8,
          p.y + p.radius * 0.72,
          '#B0BEC5',
          3.0 + Math.random() * 1.4,
          0.24,
          { alpha: 0.55, vx: -p.vx * 0.18 + (Math.random() - 0.5) * 18, vy: -12 - Math.random() * 16 }
        );
      }
    } else {
      p.stepDustTimer = 0.04;
    }
  }

  p.x = Math.max(CONFIG.ARENA_MARGIN_X + p.radius, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - p.radius, p.x));
  p.y = Math.max(CONFIG.ARENA_MARGIN_Y + p.radius, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - p.radius, p.y));

  CAMERA.update();

  const aimMaxRange = charMod.autoAimRange ?? CONFIG.AUTO_AIM_RANGE;
  STATE.targetedEnemy = findNearestEnemy(aimMaxRange);

  if (STATE.waveSpawnQueue.length > 0) {
    STATE.waveSpawnTimer -= dt;
    if (STATE.waveSpawnTimer <= 0) {
      spawnNextEnemyFromQueue();
      STATE.waveSpawnTimer = calculateWaveEnemyMultipliers(STATE.wave).spawnIntervalSec;
    }
  }

  for (let i = STATE.traps.length - 1; i >= 0; i--) {
    const tr = STATE.traps[i];
    tr.life -= dt;
    let triggered = false;
    for (let j = 0; j < STATE.enemies.length; j++) {
      const en = STATE.enemies[j];
      if (en.hp > 0 && Math.hypot(en.x - tr.x, en.y - tr.y) <= en.radius + tr.triggerRadius) {
        triggered = true;
        break;
      }
    }
    if (triggered) {
      AUDIO.playExplosion(1.2);
      triggerScreenShake(5, 0.14);
      STATE.slashEffects.push({
        x: tr.x, y: tr.y, angle: 0, range: tr.blastRadius, isCircular: true,
        color: '#FF5722', life: 0.25, maxLife: 0.25, type: 'ring'
      });
      for (let k = 0; k < 12; k++) spawnParticle(tr.x, tr.y, '#FF7043', 5, 0.38);
      damageEnemiesInCircle(tr.x, tr.y, tr.blastRadius, tr.dmgMult, 60, true, tr.stun);
      STATE.traps.splice(i, 1);
      continue;
    }
    if (tr.life <= 0) {
      STATE.traps.splice(i, 1);
    }
  }

  for (let i = STATE.pendingStrikes.length - 1; i >= 0; i--) {
    const st = STATE.pendingStrikes[i];
    st.timer -= dt;
    if (st.timer <= 0) {
      AUDIO.playExplosion(0.75);
      STATE.hitstopTimer = 0.10;
      triggerScreenShake(8, 0.20);
      STATE.slashEffects.push({
        x: st.ox, y: st.oy, angle: st.angle, range: st.length, width: st.width,
        color: '#9C27B0', life: 0.35, maxLife: 0.35, type: 'gigantesco_impact'
      });
      for (let k = 0; k < 24; k++) {
        const frac = 0.25 + (k / 24) * 0.75;
        const px = st.ox + Math.cos(st.angle) * (st.length * frac) + (Math.random() - 0.5) * st.width * 0.6;
        const py = st.oy + Math.sin(st.angle) * (st.length * frac) + (Math.random() - 0.5) * st.width * 0.6;
        spawnParticle(px, py, k % 2 === 0 ? '#CE93D8' : '#F48FB1', 6.5, 0.48);
      }
      damageEnemiesInLine(st.ox, st.oy, st.angle, st.length, st.width / 2, st.dmgMult, 50, true, st.stun);
      STATE.pendingStrikes.splice(i, 1);
    }
  }

  for (let i = STATE.enemies.length - 1; i >= 0; i--) {
    const en = STATE.enemies[i];
    if (en.hp <= 0) {
      STATE.enemies.splice(i, 1);
      continue;
    }

    if (en.flashTimer > 0) en.flashTimer -= dt;
    if (en.hitSquashTimer > 0) en.hitSquashTimer = Math.max(0, en.hitSquashTimer - dt);
    if (en.shieldExposedTimer > 0) en.shieldExposedTimer -= dt;
    if (en.exposedBonusDmgTimer > 0) en.exposedBonusDmgTimer -= dt;
    if (en.rootTimer > 0) en.rootTimer -= dt;
    if (en.armorDebuffTimer > 0) en.armorDebuffTimer -= dt;
    if (en.lawShamblesDebuffTimer > 0) en.lawShamblesDebuffTimer -= dt;

    if (en.magnetPullTimer > 0) {
      en.magnetPullTimer -= dt;
      const pullAng = Math.atan2(p.y - en.y, p.x - en.x);
      en.x += Math.cos(pullAng) * en.magnetPullSpeed * dt;
      en.y += Math.sin(pullAng) * en.magnetPullSpeed * dt;
    }

    if (en.killerBleedStacks > 0 && en.killerBleedTimer > 0) {
      en.killerBleedTimer -= dt;
      en.killerBleedTick -= dt;
      if (en.killerBleedTick <= 0) {
        en.killerBleedTick = 0.5;
        const dotDmg = Math.max(1, Math.round(en.killerBleedStacks * 3 * 0.5));
        en.hp -= dotDmg;
        spawnFloatingText(en.x - 10, en.y - 26, `-${dotDmg} 🩸`, '#FF5252', 0.85);
        if (en.hp <= 0) { onEnemyKilled(en); STATE.enemies.splice(i, 1); continue; }
      }
      if (en.killerBleedTimer <= 0) {
        en.killerBleedStacks = 0;
      }
    }

    if (en.bleedTimer > 0) {
      en.bleedTimer -= dt;
      en.bleedTick -= dt;
      if (en.bleedTick <= 0) {
        en.bleedTick = 0.5;
        const bleedDmg = Math.max(2, Math.round(p.baseDamage * 0.25));
        en.hp -= bleedDmg;
        spawnFloatingText(en.x - 10, en.y - 25, `-${bleedDmg}`, '#FF5252', 0.85);
        if (en.hp <= 0) { onEnemyKilled(en); STATE.enemies.splice(i, 1); continue; }
      }
    }
    if (en.burnTimer > 0) {
      en.burnTimer -= dt;
      en.burnTick -= dt;
      if (en.burnTick <= 0) {
        en.burnTick = 0.5;
        const tickDmg = (en.burnDps || 5) * 0.5;
        en.hp -= tickDmg;
        spawnFloatingText(en.x + 10, en.y - 25, `-${Math.round(tickDmg)} 🔥`, '#FF5252', 0.85);
        if (en.hp <= 0) { onEnemyKilled(en); STATE.enemies.splice(i, 1); continue; }
      }
    }
    if (en.clutchTimer > 0) {
      en.clutchTimer -= dt;
      en.clutchTick -= dt;
      if (en.clutchTick <= 0) {
        en.clutchTick = 0.5;
        en.hp -= 3;
        spawnFloatingText(en.x, en.y - 28, `-3 🌸`, '#FF5252', 0.85);
        if (en.hp <= 0) { onEnemyKilled(en); STATE.enemies.splice(i, 1); continue; }
      }
    }

    if (en.blindTimer > 0) {
      en.blindTimer = Math.max(0, en.blindTimer - dt);
    }
    if (en.akainuMarkTimer > 0) {
      en.akainuMarkTimer = Math.max(0, en.akainuMarkTimer - dt);
    }
    if (en.aokijiMarkTimer > 0) {
      en.aokijiMarkTimer = Math.max(0, en.aokijiMarkTimer - dt);
    }
    if (en.zeusShockChunks > 0) {
      en.zeusShockTick -= dt;
      if (en.zeusShockTick <= 0) {
        en.zeusShockTick = 0.5;
        en.zeusShockChunks--;
        en.hp -= 8;
        spawnFloatingText(en.x + 8, en.y - 26, '-8 ⚡', '#FFEB3B', 0.85);
        if (en.hp <= 0) {
          onEnemyKilled(en);
          STATE.enemies.splice(i, 1);
          continue;
        }
      }
    }

    if (en.frozenTimer > 0) {
      en.frozenTimer = Math.max(0, en.frozenTimer - dt);
      if (en.frozenTimer <= 0) {
        en.frozen = false;
      }
    }
    if (en.frozen) {
      en.telegraphTimer = 0;
      if (en.birdcageLocked && p.custom?.birdcageZone?.life > 0) {
        const z = p.custom.birdcageZone;
        const dxC = en.x - z.x;
        const dyC = en.y - z.y;
        const dC = Math.hypot(dxC, dyC);
        const maxR = Math.max(20, z.radius - en.radius);
        if (dC > maxR) {
          en.x = z.x + (dxC / dC) * maxR;
          en.y = z.y + (dyC / dC) * maxR;
        }
      }
      continue;
    }

    if (en.stunTimer > 0) {
      en.stunTimer -= dt;
      continue;
    }

    if (en.slipperyTimer > 0) {
      en.slipperyTimer = Math.max(0, en.slipperyTimer - dt);
      en.x += (en.slideVx || 0) * dt;
      en.y += (en.slideVy || 0) * dt;
      en.slideVx = (en.slideVx || 0) * 0.92;
      en.slideVy = (en.slideVy || 0) * 0.92;
      en.x = Math.max(CONFIG.ARENA_MARGIN_X + en.radius, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - en.radius, en.x));
      en.y = Math.max(CONFIG.ARENA_MARGIN_Y + en.radius, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - en.radius, en.y));
      continue;
    }

    if (en.parasiteTimer > 0) {
      en.parasiteTimer = Math.max(0, en.parasiteTimer - dt);
      en.telegraphTimer = 0;
      en.parasiteAttackCd = Math.max(0, (en.parasiteAttackCd || 0) - dt);
      let nearestAlly: any = null;
      let bestDist = Infinity;
      for (let j = 0; j < STATE.enemies.length; j++) {
        const cand = STATE.enemies[j];
        if (cand === en || cand.hp <= 0) continue;
        const dAlly = Math.hypot(cand.x - en.x, cand.y - en.y);
        if (dAlly < bestDist) {
          bestDist = dAlly;
          nearestAlly = cand;
        }
      }
      if (nearestAlly) {
        const angA = Math.atan2(nearestAlly.y - en.y, nearestAlly.x - en.x);
        en.facing = angA;
        if (bestDist > (en.attackRange || 45) + nearestAlly.radius - 6) {
          en.x += Math.cos(angA) * en.speed * 1.1 * dt;
          en.y += Math.sin(angA) * en.speed * 1.1 * dt;
        } else if (en.parasiteAttackCd <= 0) {
          en.parasiteAttackCd = 0.85;
          const pDmg = Math.max(4, Math.round(en.damage * 0.6));
          nearestAlly.hp -= pDmg;
          nearestAlly.flashTimer = 0.08;
          AUDIO.playHit();
          spawnFloatingText(nearestAlly.x, nearestAlly.y - nearestAlly.radius - 8, `-${pDmg} 🧵`, '#F48FB1', 0.95);
          if (nearestAlly.hp <= 0) {
            onEnemyKilled(nearestAlly);
          }
          // Si un jefe golpea o es atacado en área, los hilos pueden romperse
          if (nearestAlly.isBoss && Math.random() < 0.35) {
            en.parasiteTimer = 0;
          }
        }
      }
      if (en.birdcageLocked && p.custom?.birdcageZone?.life > 0) {
        const z = p.custom.birdcageZone;
        const dxC = en.x - z.x;
        const dyC = en.y - z.y;
        const dC = Math.hypot(dxC, dyC);
        const maxR = Math.max(20, z.radius - en.radius);
        if (dC > maxR) {
          en.x = z.x + (dxC / dC) * maxR;
          en.y = z.y + (dyC / dC) * maxR;
        }
      }
      en.x = Math.max(CONFIG.ARENA_MARGIN_X + en.radius, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - en.radius, en.x));
      en.y = Math.max(CONFIG.ARENA_MARGIN_Y + en.radius, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - en.radius, en.y));
      continue;
    }

    if (en.fearTimer > 0) {
      en.fearTimer = Math.max(0, en.fearTimer - dt);
      en.telegraphTimer = 0;
      const fleeAng = Math.atan2(en.y - p.y, en.x - p.x);
      en.facing = fleeAng;
      en.x += Math.cos(fleeAng) * en.speed * 0.65 * dt;
      en.y += Math.sin(fleeAng) * en.speed * 0.65 * dt;
      en.x = Math.max(CONFIG.ARENA_MARGIN_X + en.radius, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - en.radius, en.x));
      en.y = Math.max(CONFIG.ARENA_MARGIN_Y + en.radius, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - en.radius, en.y));
      continue;
    }

    if (en.rootTimer <= 0) {
      en.x += en.vx * dt;
      en.y += en.vy * dt;
    }
    en.vx *= 0.85;
    en.vy *= 0.85;

    let enemySpeedMult = en.rootTimer > 0 ? 0 : 1.0;
    en.inSmoke = false;
    en.inLawRoom = false;

    if (charMod.onEnemyTick) {
      const eTickRes = charMod.onEnemyTick(p, en, dt);
      if (eTickRes?.speedMult !== undefined) enemySpeedMult *= eTickRes.speedMult;
      if (eTickRes?.inLawRoom) en.inLawRoom = true;
    }

    for (let h = 0; h < STATE.hazards.length; h++) {
      const hz = STATE.hazards[h];
      if (Math.hypot(en.x - hz.x, en.y - hz.y) <= hz.radius + en.radius) {
        if (hz.type === 'player_slow') enemySpeedMult *= 0.55;
        if (hz.type === 'usopp_smoke') {
          enemySpeedMult *= 0.60;
          en.inSmoke = true;
        }
      }
    }

    const dx = p.x - en.x;
    const dy = p.y - en.y;
    const dist = Math.hypot(dx, dy);
    const angleToPlayer = Math.atan2(dy, dx);

    if (en.isBoss) {
      if (en.type === 'buggy') {
        updateBuggyAI(en, dt, dist, angleToPlayer, enemySpeedMult);
      } else if (en.type === 'morgan') {
        updateMorganAI(en, dt, dist, angleToPlayer, enemySpeedMult);
      } else {
        updateAlvidaAI(en, dt, dist, angleToPlayer, enemySpeedMult);
      }
    } else {
      if (en.telegraphTimer <= 0) en.facing = angleToPlayer;
      updateMarineAI(en, dt, dist, angleToPlayer, enemySpeedMult);
    }

    if (en.birdcageLocked && p.custom?.birdcageZone?.life > 0) {
      const z = p.custom.birdcageZone;
      const dxC = en.x - z.x;
      const dyC = en.y - z.y;
      const dC = Math.hypot(dxC, dyC);
      const maxR = Math.max(20, z.radius - en.radius);
      if (dC > maxR) {
        en.x = z.x + (dxC / dC) * maxR;
        en.y = z.y + (dyC / dC) * maxR;
      }
    }

    en.x = Math.max(CONFIG.ARENA_MARGIN_X + en.radius, Math.min(CONFIG.WORLD_WIDTH - CONFIG.ARENA_MARGIN_X - en.radius, en.x));
    en.y = Math.max(CONFIG.ARENA_MARGIN_Y + en.radius, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.ARENA_MARGIN_Y - en.radius, en.y));
  }

  updateProjectiles(dt);

  for (let i = STATE.hazards.length - 1; i >= 0; i--) {
    const hz = STATE.hazards[i];
    hz.life -= dt;
    if (hz.type === 'alvida_slow' && Math.hypot(p.x - hz.x, p.y - hz.y) <= hz.radius + p.radius) {
      p.slowTimer = 0.25;
    } else if (hz.type === 'zoro_crack' && !hz.damaged) {
      hz.damaged = true;
      const r = hz.crackRadius || 70;
      STATE.enemies.forEach((en) => {
        if (en.hp > 0 && Math.hypot(en.x - hz.x, en.y - hz.y) <= r + en.radius) {
          const { amount, isCrit } = calculatePlayerDamage(1.5, false);
          damageEnemy(en, amount, { isCrit });
        }
      });
    } else if (hz.type === 'buggy_bomb' && hz.life <= 0) {
      AUDIO.playExplosion(1.05);
      triggerScreenShake(6, 0.18);
      STATE.slashEffects.push({
        x: hz.x, y: hz.y, angle: 0, range: hz.radius, isCircular: true,
        color: '#FF5722', life: 0.28, maxLife: 0.28, type: 'ring'
      });
      for (let k = 0; k < 12; k++) {
        spawnParticle(hz.x, hz.y, k % 2 === 0 ? '#FF5722' : '#FFD54F', 5.2, 0.34);
      }
      if (Math.hypot(p.x - hz.x, p.y - hz.y) <= hz.radius + p.radius) {
        damagePlayer(hz.damage || 35, true, hz.owner || null, true);
      }
    }
    if (hz.life <= 0) STATE.hazards.splice(i, 1);
  }

  for (let i = STATE.berriesDrops.length - 1; i >= 0; i--) {
    const b = STATE.berriesDrops[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= 0.9;
    b.vy *= 0.9;

    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (d < 130) {
      const ang = Math.atan2(p.y - b.y, p.x - b.x);
      b.x += Math.cos(ang) * 340 * dt;
      b.y += Math.sin(ang) * 340 * dt;
    }
    if (d < p.radius + 14) {
      AUDIO.playBerry();
      STATE.berries += b.value;
      STATE.berriesCollectedRun += b.value;
      const berryEl = document.getElementById('hud-berries');
      if (berryEl) berryEl.textContent = String(STATE.berries);
      const box = document.getElementById('hud-berry-box');
      if (box) {
        box.classList.remove('pop');
        void box.offsetWidth;
        box.classList.add('pop');
      }
      STATE.berriesDrops.splice(i, 1);
    }
  }

  updateEffects(dt);
  updateCooldownUI();

  if (STATE.waveSpawnQueue.length === 0 && STATE.enemies.length === 0) {
    if (!STATE.waveClearPending) {
      STATE.waveClearPending = true;
      STATE.waveClearDelayTimer = 0.65;
    } else {
      STATE.waveClearDelayTimer -= dt;
      if (STATE.waveClearDelayTimer <= 0) {
        STATE.waveClearPending = false;
        STATE.waveClearDelayTimer = 0;
        if (STATE.wave >= CONFIG.MAX_WAVES) {
          triggerVictory();
        } else {
          showUpgradeSelection();
        }
      }
    }
  } else {
    STATE.waveClearPending = false;
    STATE.waveClearDelayTimer = 0;
  }
}

let lastTimestamp = 0;
let gameStarted = false;

function gameLoop(timestamp: number): void {
  const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;

  update(dt);
  if (STATE.screen === 'playing' || STATE.screen === 'upgrades' || STATE.screen === 'pause' || STATE.screen === 'settings') {
    render();
  } else if (STATE.screen === 'select') {
    renderCharacterPreviews(timestamp);
  }

  requestAnimationFrame(gameLoop);
}

export function initGame(): void {
  if (gameStarted) return;
  gameStarted = true;

  initEntities({
    onUpdateBossHUD: (boss) => updateBossHUD(boss),
    onUpdateWaveHUD: () => updateWaveHUD(),
    onUpdatePlayerHUD: () => updatePlayerHUD(),
    onTriggerGameOver: () => triggerGameOver(),
    onEnterStage2: () => {
      prerenderBackground('stage2');
      showStageBanner(
        'FASE 2 · OLEADAS 6–10',
        'PATIO DE LA BASE MARINA',
        'La guarnición del Capitán Morgan entra en alerta'
      );
      AUDIO.playShing();
      triggerScreenShake(5, 0.24);
    },
    onEnterStage3: () => {
      prerenderBackground('stage3');
      showStageBanner(
        'FASE 3 · OLEADAS 11–15',
        'PUERTO DE ORANGE TOWN · CIRCO BUGGY',
        'La banda pirata de Buggy el Payaso toma el muelle',
        'stage-circus'
      );
      AUDIO.playBuggyLaugh();
      triggerScreenShake(5, 0.24);
    },
    onStartBossCinematic: (bossType) => startBossCinematic(bossType),
    onDamageEnemiesInCircle: (cx, cy, radius, dmgMult, knockback, isSkill, stunDur) =>
      damageEnemiesInCircle(cx, cy, radius, dmgMult, knockback, isSkill, stunDur)
  });

  initInput({
    onUnlockModalTouchStart: (id) => SAFE_UPGRADE_MODAL.onTouchStart(id),
    onUnlockModalTouchEnd: (id) => SAFE_UPGRADE_MODAL.onTouchEnd(id),
    onAdvanceTutorial: () => advanceTutorialStep(),
    onStartGame: (e) => handleStartGame(e),
    onSwitchScreen: (screen) => switchScreen(screen),
    onAttack: () => tryNormalAttack(),
    onDash: () => tryDash(),
    onReleaseHoldDash: () => releaseHoldDash(),
    onSkill: (idx) => trySkill(idx),
    onReleaseHoldSkill: (idx) => releaseHoldSkill(idx),
    onSkipCinematic: () => skipBossCinematic()
  });

  initRendering();

  initAbilities({
    onUpdateHUD: () => updateCharacterHUD(),
    onUpdatePlayerHUD: () => updatePlayerHUD(),
    onUpdateCooldownUI: () => updateCooldownUI()
  });

  initUI();

  Object.assign(window, {
    STATE, CHARACTERS, AUDIO, CAMERA,
    startNewRun, switchScreen, startWave, skipBossCinematic, createEnemy, damageEnemy,
    tryNormalAttack, trySkill, tryDash, releaseHoldDash, releaseHoldSkill, update, render
  });

  if (new URLSearchParams(window.location.search).get('autostart') === '1') {
    startNewRun('luffy');
  }

  lastTimestamp = performance.now();
  requestAnimationFrame(gameLoop);
}
