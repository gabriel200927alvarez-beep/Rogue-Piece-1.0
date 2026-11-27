// ============================================================================
// 4. FÍSICA, GEOMETRÍA, AUTO-AIM, CÁLCULO DE DAÑO Y POOLS DE PARTÍCULAS/TEXTO
// ============================================================================

import { CONFIG } from './config';
import { STATE } from './state';
import { INPUT_TOUCH } from './input';
import { getCharacterModule } from './characters/index';
import { AUDIO, triggerHaptic } from './audio';
import { triggerScreenShake } from './camera';

export interface SpawnParticleOpts {
  vx?: number;
  vy?: number;
  alpha?: number;
  shape?: 'circle' | 'spark';
}

export interface SpawnFloatingTextOpts {
  isCrit?: boolean;
}

export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

export function findNearestEnemy(maxDist: number = CONFIG.AUTO_AIM_RANGE): any {
  let nearest: any = null;
  let minDist = maxDist;
  const p = STATE.player;
  for (let i = 0; i < STATE.enemies.length; i++) {
    const en = STATE.enemies[i];
    if (en.hp <= 0) continue;
    const d = Math.hypot(en.x - p.x, en.y - p.y);
    if (d <= minDist) {
      minDist = d;
      nearest = en;
    }
  }
  return nearest;
}

// Busca el enemigo vivo más cercano dentro de un radio y cono frontal (±halfAngle radianes respecto a baseAngle)
// Usado para auto-aim por golpe en Luffy PTS (radio 220px, cono ±120° = 2.094 rad)
export function findNearestEnemyInCone(maxDist: number, baseAngle: number, halfAngle: number): any {
  let nearest: any = null;
  let minDist = maxDist;
  const p = STATE.player;
  for (let i = 0; i < STATE.enemies.length; i++) {
    const en = STATE.enemies[i];
    if (en.hp <= 0) continue;
    const dx = en.x - p.x;
    const dy = en.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= minDist) {
      const angleToEnemy = Math.atan2(dy, dx);
      const diff = normalizeAngle(angleToEnemy - baseAngle);
      if (Math.abs(diff) <= halfAngle) {
        minDist = d;
        nearest = en;
      }
    }
  }
  return nearest;
}

export function getAimAngle(): number {
  const p = STATE.player;
  const aimMaxRange = getCharacterModule(STATE.charId).autoAimRange ?? CONFIG.AUTO_AIM_RANGE;
  const target = findNearestEnemy(aimMaxRange);
  STATE.targetedEnemy = target;
  if (target) {
    return Math.atan2(target.y - p.y, target.x - p.x);
  }
  if (INPUT_TOUCH.joystick.magnitude > 0.1) {
    return Math.atan2(INPUT_TOUCH.joystick.dirY, INPUT_TOUCH.joystick.dirX);
  }
  return p.facingAngle;
}

export function calculatePlayerDamage(
  baseMult: number,
  isSkill = false,
  forceCrit = false
): { amount: number; isCrit: boolean } {
  const p = STATE.player;
  const bonusPct = (isSkill ? STATE.mods.skillDmgPct : STATE.mods.normalDmgPct) + STATE.permBonusDmg;
  let dmg = p.baseDamage * baseMult * (1 + bonusPct);

  const charMod = getCharacterModule(STATE.charId);
  const modRes = charMod.onCalculateDamage?.(p, isSkill) ?? {};
  dmg *= modRes.dmgMult ?? 1.0;

  const effectiveCritChance = STATE.mods.critChance + (modRes.extraCritChance ?? 0);
  const isCrit = forceCrit || Math.random() < effectiveCritChance;
  if (isCrit) dmg *= modRes.critMult ?? 1.5;
  return { amount: Math.round(dmg), isCrit };
}

export function spawnParticle(
  x: number,
  y: number,
  color: string,
  size = 4,
  life = 0.35,
  opts: SpawnParticleOpts = {}
): void {
  for (let i = 0; i < STATE.particles.length; i++) {
    const pt = STATE.particles[i];
    if (!pt.active) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 180;
      pt.active = true;
      pt.x = x;
      pt.y = y;
      pt.vx = opts.vx != null ? opts.vx : Math.cos(ang) * spd;
      pt.vy = opts.vy != null ? opts.vy : Math.sin(ang) * spd;
      pt.color = color;
      pt.size = size;
      pt.life = life;
      pt.maxLife = life;
      pt.alpha = opts.alpha != null ? opts.alpha : 1.0;
      pt.shape = opts.shape || 'circle';
      return;
    }
  }
}

export function spawnFloatingText(
  x: number,
  y: number,
  text: string,
  color = '#FFF',
  scale = 1.0,
  opts: SpawnFloatingTextOpts = {}
): void {
  for (let i = 0; i < STATE.floatingTexts.length; i++) {
    const ft = STATE.floatingTexts[i];
    if (!ft.active) {
      ft.active = true;
      ft.x = x;
      ft.y = y;
      ft.vy = -55;
      ft.text = text;
      ft.color = color;
      ft.scale = scale;
      ft.life = 0.65;
      ft.maxLife = 0.65;
      ft.isCrit = Boolean(opts.isCrit);
      ft.tiltAngle = ft.isCrit ? (Math.random() - 0.5) * 0.24 : 0;
      return;
    }
  }
}

export function triggerComboFinisherImpact(
  impactX?: number,
  impactY?: number,
  aimAngle?: number,
  color?: string
): void {
  const p = STATE.player;
  const ang = aimAngle ?? p.facingAngle;
  const ix = impactX ?? (p.x + Math.cos(ang) * 52);
  const iy = impactY ?? (p.y + Math.sin(ang) * 52);
  const charMod = getCharacterModule(STATE.charId);
  const effectColor = color || charMod.color || '#F5C518';

  // 1. Breve pausa en el frame (hitstop auténtico de combate)
  STATE.hitstopTimer = 0.085;

  // 2. Destello de impacto en pantalla y sacudida
  STATE.impactFlashTimer = 0.09;
  STATE.impactFlashColor = '#FFFFFF';
  triggerScreenShake(8, 0.20);
  triggerHaptic(34);

  // 3. Destello de impacto visual en el mundo (estrella radial 8 puntas + shockwaves)
  if (STATE.slashEffects.length < 24) {
    STATE.slashEffects.push({
      type: 'finisher_flash',
      x: ix,
      y: iy,
      angle: ang,
      range: 115,
      color: effectColor,
      life: 0.24,
      maxLife: 0.24
    });
  }

  // 4. Chispas radiales de impacto
  for (let k = 0; k < 16; k++) {
    const spd = 200 + Math.random() * 240;
    const a = (k / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    spawnParticle(ix, iy, k % 2 === 0 ? '#FFFFFF' : effectColor, 4.2 + Math.random() * 2.2, 0.32, {
      shape: 'spark',
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      alpha: 1.0
    });
  }

  // 5. Sonido de golpe final
  AUDIO.playExplosion(1.18);
}

