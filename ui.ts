import { CONFIG, RAREZAS, UPGRADE_POOL, TUTORIAL_STEPS } from './config';
import { STATE, saveLifetimeStats } from './state';
import { AUDIO, triggerHaptic } from './audio';
import { CAMERA } from './camera';
import { INPUT_TOUCH, clearAllHeldInputs } from './input';
import { startWave } from './entities';
import { buildCharacterContext } from './abilities';
import { CHARACTERS, CHARACTER_LIST, getCharacterModule } from './characters/index';
import type { ButtonUIHelpers } from './characters/types';
import { prerenderBackground, renderRosterThumbnails, renderCharacterPreviews } from './rendering';

// Sistema de Protección de 3 Capas para el Modal de Mejoras
export const SAFE_UPGRADE_MODAL = {
  activeTouches: new Set<any>(),
  isOpen: false,
  unlocked: false,
  enterTimer: 0,
  fingerReleaseBuffer: 0,
  selectedIndex: -1,
  choices: [] as any[],

  onTouchStart(id: any) {
    this.activeTouches.add(id);
    if (this.isOpen && !this.unlocked) {
      this.fingerReleaseBuffer = 0.30;
    }
  },

  onTouchEnd(id: any) {
    this.activeTouches.delete(id);
    if (this.isOpen && !this.unlocked && this.activeTouches.size === 0) {
      this.fingerReleaseBuffer = 0.30;
    }
  },

  open(choices: any[]) {
    this.isOpen = true;
    this.unlocked = false;
    this.enterTimer = 0.40;
    this.fingerReleaseBuffer = this.activeTouches.size > 0 ? 0.30 : 0.0;
    this.selectedIndex = -1;
    this.choices = choices;

    INPUT_TOUCH.attackHeld = false;
    INPUT_TOUCH.attackTouchId = null;
    INPUT_TOUCH.joystick.active = false;
    INPUT_TOUCH.joystick.magnitude = 0;

    document.getElementById('hud-combat')?.classList.add('hud-modal-locked');
    const btnConfirm = document.getElementById('btn-confirm-upgrade');
    btnConfirm?.classList.remove('visible');
  },

  close() {
    this.isOpen = false;
    this.unlocked = false;
    this.selectedIndex = -1;
    document.getElementById('hud-combat')?.classList.remove('hud-modal-locked');
    document.getElementById('btn-confirm-upgrade')?.classList.remove('visible');
  },

  update(dt: number) {
    if (!this.isOpen || this.unlocked) return;

    if (this.enterTimer > 0) {
      this.enterTimer = Math.max(0, this.enterTimer - dt);
    }

    if (this.activeTouches.size > 0) {
      this.fingerReleaseBuffer = 0.30;
    } else if (this.fingerReleaseBuffer > 0) {
      this.fingerReleaseBuffer = Math.max(0, this.fingerReleaseBuffer - dt);
    }

    if (this.enterTimer <= 0 && this.activeTouches.size === 0 && this.fingerReleaseBuffer <= 0) {
      this.unlockCards();
    }
  },

  unlockCards() {
    this.unlocked = true;
    const cards = document.querySelectorAll('#upgrade-cards-container .upgrade-card');
    cards.forEach(c => {
      c.classList.add('unlocked', 'flash-ready');
    });
  },

  handleCardTap(index: number) {
    if (!this.isOpen || !this.unlocked) return;
    AUDIO.playUIClick();
    triggerHaptic(12);
    this.selectedIndex = index;

    const cards = document.querySelectorAll('#upgrade-cards-container .upgrade-card');
    cards.forEach((c, idx) => {
      c.classList.toggle('selected', idx === index);
      c.classList.toggle('dimmed', idx !== index);
    });

    const btnConfirm = document.getElementById('btn-confirm-upgrade');
    btnConfirm?.classList.add('visible');
  },

  confirmSelection() {
    if (!this.isOpen || !this.unlocked || this.selectedIndex < 0) return;
    const chosen = this.choices[this.selectedIndex];
    this.close();
    if (chosen) {
      applyConfirmedUpgrade(chosen);
    }
  }
};

export function startTutorialIfFirstTime(): void {
  if (STATE.tutorial.shown) return;
  STATE.tutorial.shown = true;
  STATE.tutorial.active = true;
  STATE.tutorial.step = 0;
  showTutorialStep(0);
}

export function showTutorialStep(idx: number): void {
  const el = document.getElementById('tutorial-tooltip');
  if (!el) return;
  if (idx >= TUTORIAL_STEPS.length) {
    STATE.tutorial.active = false;
    el.style.display = 'none';
    return;
  }
  const st = TUTORIAL_STEPS[idx];
  el.textContent = st.text;
  el.style.left = st.left;
  el.style.right = st.right;
  el.style.bottom = st.bottom;
  el.style.display = 'block';
  STATE.tutorial.timer = 3.5;
}

export function advanceTutorialStep(): void {
  if (!STATE.tutorial.active) return;
  STATE.tutorial.step++;
  showTutorialStep(STATE.tutorial.step);
}

// ==========================================================================
// 6. UPGRADES: Modal Seguro
// ==========================================================================

export function showUpgradeSelection(): void {
  STATE.screen = 'upgrades';
  document.body.dataset.state = 'upgrades';
  const container = document.getElementById('upgrade-cards-container');
  if (!container) return;
  container.innerHTML = '';

  const shuffled = [...UPGRADE_POOL].sort(() => Math.random() - 0.5);
  const choices = shuffled.slice(0, 3);

  SAFE_UPGRADE_MODAL.open(choices);

  choices.forEach((upg, index) => {
    const card = document.createElement('div');
    card.className = 'upgrade-card entering';
    card.style.borderColor = upg.catColor;
    card.innerHTML = `
      <div class="upgrade-lock-overlay"></div>
      <div class="upgrade-lock-icon">🔒</div>
      <div class="upgrade-unlock-flash"></div>
      <span class="upg-cat-badge" style="background:${upg.catColor}">${upg.cat}</span>
      <div class="upg-icon">${upg.icon}</div>
      <div>
        <div class="upg-name">${upg.name}</div>
        <div class="upg-desc">${upg.desc}</div>
      </div>
    `;

    const onTapCard = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      SAFE_UPGRADE_MODAL.handleCardTap(index);
    };
    card.addEventListener('touchstart', onTapCard, { passive: false });
    card.addEventListener('click', onTapCard);
    container.appendChild(card);
  });

  const previewEl = document.getElementById('next-wave-preview');
  if (previewEl) {
    if (STATE.mods.scoutNextWave) {
      const nextW = STATE.wave + 1;
      previewEl.style.display = 'block';
      if (nextW === 5) {
        previewEl.textContent = '🔭 Vigía: ¡La Capitana Alvida y su guardia élite te esperan!';
      } else if (nextW === 10) {
        previewEl.textContent = '🔭 Vigía: ¡El Capitán Morgan, Mano de Hacha, comanda la guarnición!';
      } else if (nextW === 15) {
        previewEl.textContent = '☠️ Vigía: ¡PRIMER WANTED! Buggy el Payaso y su gran circo te aguardan!';
      } else if (nextW >= 11) {
        previewEl.textContent = `🔭 Vigía: Oleada ${nextW} en el Puerto del Circo de Buggy (Orange Town).`;
      } else if (nextW >= 6) {
        previewEl.textContent = `🔭 Vigía: Oleada ${nextW} en el Patio de la Base Marina con refuerzos élite.`;
      } else {
        previewEl.textContent = `🔭 Vigía: Oleada ${nextW} tendrá ${Math.round((3 + 2 * nextW) * 1.5)} Marines variados.`;
      }
    } else {
      previewEl.style.display = 'none';
    }
  }

  document.getElementById('screen-upgrades')?.classList.add('active');
}

export function applyConfirmedUpgrade(upg: any): void {
  AUDIO.playUpgrade();
  upg.apply(STATE);
  STATE.mods.acquiredIds.push(upg.id);
  updatePlayerHUD();

  document.getElementById('screen-upgrades')?.classList.remove('active');
  STATE.screen = 'playing';
  document.body.dataset.state = 'playing';

  getCharacterModule(STATE.charId).onUpgradeApplied?.(buildCharacterContext());

  startWave(STATE.wave + 1);
}

export function animateStatBars(): void {
  document.querySelectorAll('#showcase-stats .stat-fill').forEach(bar => {
    const el = bar as HTMLElement;
    const targetW = el.getAttribute('data-stat-w') || '0%';
    el.style.width = targetW;
  });
}

export function updatePlayerHUD(): void {
  const p = STATE.player;
  const ratio = Math.max(0, p.hp / p.maxHp);
  const fill = document.getElementById('hud-hp-fill');
  if (fill) {
    fill.style.width = `${ratio * 100}%`;
    if (ratio > 0.5) fill.style.backgroundColor = '#4CAF50';
    else if (ratio > 0.25) fill.style.backgroundColor = '#FFC107';
    else fill.style.backgroundColor = '#F44336';
  }

  const hpText = document.getElementById('hud-hp-text');
  if (hpText) hpText.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
}

export function updateCharacterHUD(): void {
  const charMod = getCharacterModule(STATE.charId);
  charMod.updateHUD?.(STATE.player);
}

let stageBannerTimer: ReturnType<typeof setTimeout> | null = null;

export function hideStageBanner(): void {
  if (stageBannerTimer) {
    clearTimeout(stageBannerTimer);
    stageBannerTimer = null;
  }
  const el = document.getElementById('stage-banner');
  if (el) el.classList.remove('visible', 'stage-circus');
}

export function showStageBanner(kicker: string, title: string, sub: string, variantClass?: string): void {
  const el = document.getElementById('stage-banner');
  if (!el) return;
  const kEl = document.getElementById('stage-banner-kicker');
  const tEl = document.getElementById('stage-banner-title');
  const sEl = document.getElementById('stage-banner-sub');
  if (kEl) kEl.textContent = kicker;
  if (tEl) tEl.textContent = title;
  if (sEl) sEl.textContent = sub;
  el.classList.remove('stage-circus');
  if (variantClass) el.classList.add(variantClass);
  el.classList.add('visible');
  if (stageBannerTimer) clearTimeout(stageBannerTimer);
  stageBannerTimer = setTimeout(() => {
    el.classList.remove('visible', 'stage-circus');
    stageBannerTimer = null;
  }, 3400);
}

const BUGGY_INTRO_LINES = [
  '«¡Gyahaha! ¡Bienvenidos al Gran Circo de Orange Town!»',
  '«¡Yo soy Buggy el Payaso, el PRIMER WANTED de este mar! ¡Prepárense para la Bala Buggy!»'
];

export function startBossCinematic(bossType: string): void {
  const cx = CONFIG.WORLD_WIDTH / 2;
  const cy = CONFIG.WORLD_HEIGHT / 2;
  STATE.bossCinematic = {
    active: true,
    bossType,
    timer: 0,
    duration: 3.8,
    lineIndex: 0,
    skipped: false,
    startX: cx,
    startY: cy - 220,
    targetX: cx,
    targetY: cy
  };
  clearAllHeldInputs();

  const overlay = document.getElementById('boss-cinematic-overlay');
  if (overlay) {
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
  }
  updateBossCinematicUI();
  AUDIO.playBuggyLaugh();
}

export function updateBossCinematicUI(): void {
  const textEl = document.getElementById('cinematic-dialogue-text');
  if (!textEl) return;
  const idx = Math.min(BUGGY_INTRO_LINES.length - 1, Math.max(0, STATE.bossCinematic.lineIndex));
  const targetLine = BUGGY_INTRO_LINES[idx];
  if (textEl.textContent !== targetLine) {
    textEl.textContent = targetLine;
  }
}

export function skipBossCinematic(): void {
  if (!STATE.bossCinematic.active) return;
  const cin = STATE.bossCinematic;
  const boss = STATE.enemies.find((e) => e.isBoss && e.type === cin.bossType);
  if (boss) {
    boss.x = cin.targetX;
    boss.y = cin.targetY;
    boss.baraSplitActive = false;
  }
  cin.active = false;
  cin.skipped = true;

  const overlay = document.getElementById('boss-cinematic-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }
  CAMERA.resetToPlayer();
}

export function updateWaveHUD(): void {
  const waveEl = document.getElementById('hud-wave-text');
  const enemiesEl = document.getElementById('hud-enemies-text');
  if (waveEl) waveEl.textContent = `OLEADA ${STATE.wave} / ${CONFIG.MAX_WAVES}`;
  if (enemiesEl) {
    if (STATE.wave === 5 || STATE.wave === 10 || STATE.wave === 15) {
      enemiesEl.textContent = '';
      enemiesEl.style.display = 'none';
    } else {
      enemiesEl.style.display = 'block';
      enemiesEl.textContent = `Enemigos restantes: ${STATE.waveEnemiesRemaining}`;
    }
  }
}

export function updateBossHUD(boss: any): void {
  const ratio = Math.max(0, boss.hp / boss.maxHp);
  const fill = document.getElementById('boss-hp-fill');
  if (fill) fill.style.width = `${ratio * 100}%`;
}

export function updateCooldownUI(): void {
  const p = STATE.player;
  const charMod = getCharacterModule(STATE.charId);

  const btnAttack = document.getElementById('btn-attack');
  const cdAttack = document.getElementById('cd-attack');
  if (btnAttack && cdAttack) {
    if (charMod.isAttackCooldownVisible?.(p)) {
      btnAttack.classList.add('on-cooldown');
      const deg = Math.round((p.attackCooldown / (p.attackCooldownMax || 0.6)) * 360);
      cdAttack.style.background = `conic-gradient(rgba(0,0,0,0.65) 0deg, rgba(0,0,0,0.65) ${deg}deg, transparent ${deg}deg)`;
      cdAttack.textContent = p.attackCooldown.toFixed(1);
    } else {
      btnAttack.classList.remove('on-cooldown');
      cdAttack.textContent = '';
    }
  }

  const renderSkillCooldown = (
    idx: number,
    rem: number,
    maxCd: number,
    isSpecialReady: boolean
  ): void => {
    const btn = document.getElementById(`btn-h${idx + 1}`);
    const cdEl = document.getElementById(`cd-h${idx + 1}`);
    if (!btn || !cdEl) return;

    if (rem > 0 && !isSpecialReady) {
      btn.classList.add('on-cooldown');
      const deg = Math.round((rem / Math.max(0.01, maxCd)) * 360);
      cdEl.style.background = `conic-gradient(rgba(0,0,0,0.75) 0deg, rgba(0,0,0,0.75) ${deg}deg, transparent ${deg}deg)`;
      cdEl.textContent = rem.toFixed(1);
    } else {
      btn.classList.remove('on-cooldown');
      cdEl.textContent = '';
    }
  };

  for (let i = 0; i < 3; i++) {
    const defaultMaxCd = p.skillMaxCds[i] * (i === 0 ? STATE.mods.h1CdMult : 1);
    renderSkillCooldown(i, p.skillCds[i], defaultMaxCd, false);
  }

  const helpers: ButtonUIHelpers = {
    setSkillCooldownOverride: (idx, rem, maxCd, isSpecialReady) => {
      const defaultMaxCd = p.skillMaxCds[idx] * (idx === 0 ? STATE.mods.h1CdMult : 1);
      renderSkillCooldown(
        idx,
        rem ?? p.skillCds[idx],
        maxCd ?? defaultMaxCd,
        Boolean(isSpecialReady)
      );
    },
    getBtn: (idx) => document.getElementById(`btn-h${idx + 1}`),
    getIcon: (idx) => document.getElementById(`icon-h${idx + 1}`),
    getLabel: (idx) => document.getElementById(`lbl-h${idx + 1}`),
    getCdEl: (idx) => document.getElementById(`cd-h${idx + 1}`),
    dashBtn: document.getElementById('btn-dash')
  };
  charMod.updateButtonsUI?.(p, helpers);

  const btnDash = document.getElementById('btn-dash');
  const cdDash = document.getElementById('cd-dash');
  const badge = document.getElementById('dash-charges-badge');
  if (badge) {
    if (p.maxDashCharges > 1) {
      badge.style.display = 'flex';
      badge.textContent = String(p.dashCharges);
    } else {
      badge.style.display = 'none';
    }
  }

  if (btnDash && cdDash) {
    const holdDashActive = Boolean(charMod.isHoldDashActive?.(p));
    if (holdDashActive) {
      btnDash.classList.remove('on-cooldown');
      btnDash.classList.add('chain-active');
      cdDash.style.background = '';
      cdDash.textContent = '';
    } else if (p.dashCharges === 0 && p.dashCdTimer > 0) {
      btnDash.classList.remove('chain-active');
      btnDash.classList.add('on-cooldown');
      const maxD = p.dashCdMax * STATE.mods.dashCdMult;
      const deg = Math.round((p.dashCdTimer / maxD) * 360);
      cdDash.style.background = `conic-gradient(rgba(0,0,0,0.75) 0deg, rgba(0,0,0,0.75) ${deg}deg, transparent ${deg}deg)`;
      cdDash.textContent = p.dashCdTimer.toFixed(1);
    } else {
      btnDash.classList.remove('chain-active');
      btnDash.classList.remove('on-cooldown');
      cdDash.style.background = '';
      cdDash.textContent = '';
    }
  }
}

// ==========================================================================
// CONTROL DE FLUJO DE PANTALLAS, CARROUSEL DE 12 PERSONAJES Y MULTIPLICADOR
// ==========================================================================
export function switchScreen(screenName: string): void {
  STATE.screen = screenName;
  document.body.dataset.state = screenName;
  clearAllHeldInputs();
  closeStatsModal();
  if (screenName === 'playing' && document.activeElement && typeof (document.activeElement as HTMLElement).blur === 'function') {
    (document.activeElement as HTMLElement).blur();
  }
  document.querySelectorAll('.screen-modal').forEach(m => m.classList.remove('active'));
  const hudCombat = document.getElementById('hud-combat');
  if (hudCombat) hudCombat.style.display = (screenName === 'playing' || screenName === 'upgrades') ? 'block' : 'none';

  const target = document.getElementById('screen-' + screenName);
  if (target) target.classList.add('active');
  else if (screenName !== 'playing') console.warn('Screen not found:', 'screen-' + screenName);

  if (screenName === 'select') {
    updateShowcaseCard(STATE.charId, false);
    if (!rosterThumbsRendered) {
      renderRosterThumbnails();
      rosterThumbsRendered = true;
    }
    renderCharacterPreviews(performance.now(), true);
  }
}

export function startNewRun(charId: string): void {
  AUDIO.unlock();
  getCharacterModule(STATE.charId).onCleanupEffects?.(STATE.player);

  STATE.charId = getCharacterModule(charId).id;
  const cfg = getCharacterModule(STATE.charId);
  const rar = RAREZAS[cfg.rarity] || RAREZAS.novato;
  const mult = rar.multiplicadorStats;

  STATE.lifetimeStats.runsPlayed += 1;
  STATE.lifetimeStats.charRuns[STATE.charId] = (STATE.lifetimeStats.charRuns[STATE.charId] || 0) + 1;
  saveLifetimeStats(STATE.lifetimeStats);

  const effectiveHp = Math.round(cfg.hp * mult);
  const effectiveDamage = Number((cfg.damage * mult).toFixed(2));
  const effectiveArmor = Number((cfg.armor * mult).toFixed(2));

  STATE.wave = 1;
  STATE.berries = 0;
  STATE.berriesCollectedRun = 0;
  STATE.killsRun = 0;
  STATE.hitstopTimer = 0;
  STATE.shakeTimer = 0;
  STATE.timeSinceLastCombat = 0;
  STATE.waveClearPending = false;
  STATE.waveClearDelayTimer = 0;

  STATE.mods = {
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
  };

  const p = STATE.player;
  p.x = CONFIG.WORLD_WIDTH / 2;
  p.y = CONFIG.WORLD_HEIGHT / 2;
  p.vx = 0; p.vy = 0;
  p.facingAngle = 0;
  p.hp = effectiveHp;
  p.maxHp = effectiveHp;
  p.baseDamage = effectiveDamage;
  p.speed = cfg.speed * 52;
  p.armor = effectiveArmor;
  p.invulnTimer = 0; p.slowTimer = 0; p.speedBuffTimer = 0;
  p.comboStep = 0; p.comboResetTimer = 0;
  p.attackCooldown = 0; p.attackCooldownMax = 0.21; p.attackAnimTimer = 0;
  p.momentumTimer = 0; p.superArmorTimer = 0;

  const initialDashCharges = cfg.initialDashCharges ?? 1;
  p.dashCdMax = cfg.dashCd;
  p.dashCdTimer = 0;
  p.dashCharges = initialDashCharges;
  p.maxDashCharges = initialDashCharges;
  p.isDashing = false;
  p.dashDurationMax = CONFIG.DASH_DURATION;
  p.dashHitEnemyIds = [];

  p.skillCds = [0, 0, 0];
  p.skillMaxCds = cfg.skills.map((s) => s.cd);
  p.visualScaleX = 1.0;
  p.visualScaleY = 1.0;
  p.landSquashTimer = 0;
  p.stepDustTimer = 0;
  p.custom = cfg.createCustomState();

  const frenzyVig = document.getElementById('frenzy-vignette');
  if (frenzyVig) frenzyVig.style.display = 'none';

  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById(`btn-h${i}`);
    const cdEl = document.getElementById(`cd-h${i}`);
    if (btn) btn.classList.remove('on-cooldown', 'skill-locked', 'chain-active', 'kid-repel-phase');
    if (cdEl) { cdEl.textContent = ''; cdEl.style.background = ''; }
  }
  const btnAttack = document.getElementById('btn-attack');
  const cdAttack = document.getElementById('cd-attack');
  if (btnAttack) btnAttack.classList.remove('on-cooldown');
  if (cdAttack) { cdAttack.textContent = ''; cdAttack.style.background = ''; }
  const btnDash = document.getElementById('btn-dash');
  const cdDash = document.getElementById('cd-dash');
  if (btnDash) btnDash.classList.remove('on-cooldown', 'skill-locked');
  if (cdDash) { cdDash.textContent = ''; cdDash.style.background = ''; }

  CAMERA.resetToPlayer();

  STATE.enemies = [];
  STATE.projectiles = [];
  STATE.berriesDrops = [];
  STATE.hazards = [];
  STATE.traps = [];
  STATE.pendingStrikes = [];
  STATE.afterimages = [];
  STATE.slashEffects = [];
  for (const pt of STATE.particles) pt.active = false;
  for (const ft of STATE.floatingTexts) ft.active = false;

  STATE.bossCinematic.active = false;
  STATE.bossCinematic.skipped = false;
  const cinOverlay = document.getElementById('boss-cinematic-overlay');
  if (cinOverlay) {
    cinOverlay.classList.remove('visible');
    cinOverlay.setAttribute('aria-hidden', 'true');
  }

  const bossHud = document.getElementById('boss-hud');
  if (bossHud) {
    bossHud.style.display = 'none';
    bossHud.classList.remove('boss-morgan', 'boss-wanted');
  }
  hideStageBanner();
  prerenderBackground('stage1');

  const portraitEl = document.getElementById('hud-portrait');
  if (portraitEl) {
    portraitEl.textContent = cfg.portrait;
    portraitEl.style.background = cfg.portraitBg || '#2A2A30';
  }
  const charNameEl = document.getElementById('hud-char-name');
  if (charNameEl) charNameEl.textContent = cfg.name;
  const hudRarity = document.getElementById('hud-rarity-badge');
  if (hudRarity) {
    hudRarity.textContent = rar.nombre;
    hudRarity.className = `hud-rarity-pill ${cfg.rarity} text-outline-sm`;
    if (cfg.rarity === 'shichibukai' || cfg.rarity === 'yonko' || cfg.rarity === 'almirante') {
      hudRarity.style.backgroundColor = '';
      hudRarity.style.borderColor = '';
    } else {
      hudRarity.style.backgroundColor = rar.color;
      hudRarity.style.borderColor = rar.borde;
    }
  }

  const hudBerries = document.getElementById('hud-berries');
  if (hudBerries) hudBerries.textContent = '0';
  const iconAttack = document.getElementById('icon-attack');
  if (iconAttack) iconAttack.textContent = cfg.attackIcon;

  const cluster = document.getElementById('action-cluster');
  if (cluster) cluster.className = `action-cluster ${cfg.themeClass}`;
  cfg.skills.forEach((sk, idx) => {
    const iconEl = document.getElementById(`icon-h${idx + 1}`);
    const lblEl = document.getElementById(`lbl-h${idx + 1}`);
    if (iconEl) iconEl.textContent = sk.icon;
    if (lblEl) lblEl.textContent = sk.name;
  });

  const hudSlot = document.getElementById('char-hud-slot');
  const hudExtra = document.getElementById('char-hud-extra');
  if (hudSlot) hudSlot.innerHTML = '';
  if (hudExtra) hudExtra.innerHTML = '';
  if (hudSlot && hudExtra) {
    cfg.mountHUD?.(hudSlot, hudExtra, buildCharacterContext());
  }

  SAFE_UPGRADE_MODAL.close();
  updatePlayerHUD();
  updateCharacterHUD();
  updateCooldownUI();
  switchScreen('playing');
  startWave(1);
  startTutorialIfFirstTime();
}

function recordRunOutcome(won: boolean): void {
  STATE.lifetimeStats.bestWave = Math.max(STATE.lifetimeStats.bestWave, STATE.wave);
  STATE.lifetimeStats.totalKills += STATE.killsRun;
  STATE.lifetimeStats.totalBerries += STATE.berriesCollectedRun;
  if (won) STATE.lifetimeStats.victories += 1;
  saveLifetimeStats(STATE.lifetimeStats);
}

export function triggerGameOver(): void {
  AUDIO.playDefeat();
  SAFE_UPGRADE_MODAL.close();
  hideStageBanner();
  STATE.bossCinematic.active = false;
  const cinOverlay = document.getElementById('boss-cinematic-overlay');
  if (cinOverlay) {
    cinOverlay.classList.remove('visible');
    cinOverlay.setAttribute('aria-hidden', 'true');
  }
  const bossHud = document.getElementById('boss-hud');
  if (bossHud) {
    bossHud.style.display = 'none';
    bossHud.classList.remove('boss-morgan', 'boss-wanted');
  }
  getCharacterModule(STATE.charId).onCleanupEffects?.(STATE.player);
  const frenzyVig = document.getElementById('frenzy-vignette');
  if (frenzyVig) frenzyVig.style.display = 'none';
  recordRunOutcome(false);
  const infoEl = document.getElementById('gameover-info');
  if (infoEl) {
    infoEl.textContent =
      `Oleada alcanzada: ${STATE.wave}/${CONFIG.MAX_WAVES} • Enemigos derrotados: ${STATE.killsRun} • Berries: ${STATE.berriesCollectedRun}`;
  }
  switchScreen('gameover');
}

export function triggerVictory(): void {
  AUDIO.playVictory();
  SAFE_UPGRADE_MODAL.close();
  hideStageBanner();
  STATE.bossCinematic.active = false;
  const cinOverlay = document.getElementById('boss-cinematic-overlay');
  if (cinOverlay) {
    cinOverlay.classList.remove('visible');
    cinOverlay.setAttribute('aria-hidden', 'true');
  }
  const bossHud = document.getElementById('boss-hud');
  if (bossHud) {
    bossHud.style.display = 'none';
    bossHud.classList.remove('boss-morgan', 'boss-wanted');
  }
  getCharacterModule(STATE.charId).onCleanupEffects?.(STATE.player);
  const frenzyVig = document.getElementById('frenzy-vignette');
  if (frenzyVig) frenzyVig.style.display = 'none';
  STATE.permBonusDmg += 0.05;
  recordRunOutcome(true);
  prerenderBackground('liberated');
  const victoryInfo = document.getElementById('victory-info');
  if (victoryInfo) {
    victoryInfo.textContent =
      `¡Has superado las ${CONFIG.MAX_WAVES} oleadas y vencido al Primer Wanted: Buggy el Payaso! Enemigos: ${STATE.killsRun} • Berries: ${STATE.berriesCollectedRun}`;
  }
  const victoryReward = document.getElementById('victory-reward-text');
  if (victoryReward) {
    victoryReward.textContent =
      `+5% Daño Base Permanente (Total: +${Math.round(STATE.permBonusDmg * 100)}%) • Primer Wanted Derrotado (Orange Town Libre)`;
  }
  switchScreen('victory');
}

let startTriggered = false;
export function handleStartGame(e?: Event): void {
  if (e) e.preventDefault();
  if (startTriggered) return;
  startTriggered = true;
  AUDIO.unlock();
  AUDIO.playUIClick();
  triggerHaptic(15);
  try {
    switchScreen('select');
  } catch (_err) {
    document.querySelectorAll('.screen-modal').forEach(m => m.classList.remove('active'));
    const sel = document.getElementById('screen-select');
    if (sel) sel.classList.add('active');
  }
  setTimeout(() => { startTriggered = false; }, 200);
}

let rosterThumbsRendered = false;
let lobbyFaction: 'pirates' | 'marines' = 'pirates';
let showcaseFlashTimer: ReturnType<typeof setTimeout> | null = null;

function setLobbyFaction(faction: 'pirates' | 'marines'): void {
  lobbyFaction = faction;
  const tabPirates = document.getElementById('tab-faction-pirates');
  const tabMarines = document.getElementById('tab-faction-marines');
  const rosterPirates = document.getElementById('roster-pirates');
  const rosterMarines = document.getElementById('roster-marines');

  const isPirates = faction === 'pirates';
  tabPirates?.classList.toggle('active', isPirates);
  tabMarines?.classList.toggle('active', !isPirates);
  tabPirates?.setAttribute('aria-selected', String(isPirates));
  tabMarines?.setAttribute('aria-selected', String(!isPirates));

  if (rosterPirates) {
    rosterPirates.hidden = !isPirates;
    rosterPirates.classList.toggle('active', isPirates);
  }
  if (rosterMarines) {
    rosterMarines.hidden = isPirates;
    rosterMarines.classList.toggle('active', !isPirates);
  }
}

function updateShowcaseCard(charId: string, withFlash = true): void {
  const mod = getCharacterModule(charId);
  STATE.charId = mod.id;
  const rar = RAREZAS[mod.rarity] || RAREZAS.novato;
  const mult = rar.multiplicadorStats;
  const displayName = mod.cardMeta.displayName || mod.name;

  const showcaseCard = document.getElementById('showcase-card');
  if (showcaseCard) {
    showcaseCard.className = `showcase-card rarity-${mod.rarity}`;
    if (withFlash) {
      if (showcaseFlashTimer) clearTimeout(showcaseFlashTimer);
      void showcaseCard.offsetWidth;
      showcaseCard.classList.add('selected-flash');
      showcaseFlashTimer = setTimeout(() => {
        showcaseCard.classList.remove('selected-flash');
        showcaseFlashTimer = null;
      }, 170);
    }
  }

  const metaEl = document.getElementById('showcase-meta');
  if (metaEl) {
    metaEl.textContent = `${rar.nombre} (×${mult.toFixed(1)}) · ${mod.cardMeta.role}`;
    metaEl.style.color = rar.color === '#9E9E9E' ? '#CFD8DC' : rar.color;
  }
  const nameEl = document.getElementById('showcase-name');
  if (nameEl) {
    nameEl.textContent = displayName;
    nameEl.style.color = mod.cardMeta.nameColor;
  }
  const epithetEl = document.getElementById('showcase-epithet');
  if (epithetEl) {
    epithetEl.textContent = `«${mod.cardMeta.epithet}»`;
  }

  const effHp = Math.round(mod.hp * mult);
  const effDmg = Math.round(mod.damage * mult);
  const effArm = Math.round(mod.armor * mult);
  const effVel = Math.round(mod.speed * 52);

  const statsEl = document.getElementById('showcase-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-row">
        <span class="stat-label">HP</span>
        <div class="stat-track"><div class="stat-fill" data-stat-w="${mod.cardMeta.stats.hp}%" style="width:${mod.cardMeta.stats.hp}%;background:#4CAF50;"></div></div>
        <span class="stat-val">${effHp}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">DMG</span>
        <div class="stat-track"><div class="stat-fill" data-stat-w="${mod.cardMeta.stats.dmg}%" style="width:${mod.cardMeta.stats.dmg}%;background:#EF5350;"></div></div>
        <span class="stat-val">${effDmg}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">VEL</span>
        <div class="stat-track"><div class="stat-fill" data-stat-w="${mod.cardMeta.stats.vel}%" style="width:${mod.cardMeta.stats.vel}%;background:#38BDF8;"></div></div>
        <span class="stat-val">${effVel}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">ARM</span>
        <div class="stat-track"><div class="stat-fill" data-stat-w="${mod.cardMeta.stats.arm}%" style="width:${mod.cardMeta.stats.arm}%;background:#90A4AE;"></div></div>
        <span class="stat-val">${effArm}</span>
      </div>
    `;
  }

  const skillsEl = document.getElementById('showcase-skills');
  if (skillsEl) {
    skillsEl.innerHTML = mod.skills
      .map((sk) => `<div class="skill-pill" title="${sk.name} (${sk.cd}s)">${sk.icon} ${sk.name}</div>`)
      .join('');
  }

  const kitEl = document.getElementById('showcase-kit');
  if (kitEl) {
    const comboHtml = mod.cardMeta.comboDesc.startsWith('<b>')
      ? mod.cardMeta.comboDesc
      : `<b>Combo:</b> ${mod.cardMeta.comboDesc}`;
    kitEl.innerHTML = `
      <div class="showcase-passive" style="color:${mod.cardMeta.passiveColor};">${mod.cardMeta.passiveText}</div>
      <div class="showcase-kit-desc">${comboHtml}<br>${mod.cardMeta.skillsDesc}</div>
    `;
  }

  document.querySelectorAll('#screen-select .roster-tile').forEach((tile) => {
    tile.classList.toggle('active', tile.getAttribute('data-char') === mod.id);
  });

  renderCharacterPreviews(performance.now(), true);
}

function getFavoriteCharacterLabel(): string {
  const entries = Object.entries(STATE.lifetimeStats.charRuns);
  if (entries.length === 0) return 'Ninguno aún';
  entries.sort((a, b) => b[1] - a[1]);
  const [bestId, runs] = entries[0];
  const mod = getCharacterModule(bestId);
  const name = mod.cardMeta.displayName || mod.name;
  return `${name} (${runs})`;
}

export function openStatsModal(): void {
  const modal = document.getElementById('modal-stats');
  if (!modal) return;
  const careerEl = document.getElementById('stats-career-rows');
  const activeEl = document.getElementById('stats-active-rows');

  const lt = STATE.lifetimeStats;
  if (careerEl) {
    careerEl.innerHTML = `
      <div class="stats-kv"><span>Partidas jugadas</span><strong>${lt.runsPlayed}</strong></div>
      <div class="stats-kv"><span>Victorias</span><strong>${lt.victories}</strong></div>
      <div class="stats-kv"><span>Mejor oleada</span><strong>${lt.bestWave} / ${CONFIG.MAX_WAVES}</strong></div>
      <div class="stats-kv"><span>Enemigos derrotados</span><strong>${lt.totalKills}</strong></div>
      <div class="stats-kv"><span>Berries totales</span><strong>${lt.totalBerries}</strong></div>
      <div class="stats-kv"><span>Bono permanente</span><strong>+${Math.round(STATE.permBonusDmg * 100)}%</strong></div>
      <div class="stats-kv"><span>Personaje favorito</span><strong>${getFavoriteCharacterLabel()}</strong></div>
    `;
  }

  const mod = getCharacterModule(STATE.charId);
  const rar = RAREZAS[mod.rarity] || RAREZAS.novato;
  const mult = rar.multiplicadorStats;
  const displayName = mod.cardMeta.displayName || mod.name;
  if (activeEl) {
    activeEl.innerHTML = `
      <div class="stats-kv"><span>Personaje</span><strong>${displayName}</strong></div>
      <div class="stats-kv"><span>Epíteto</span><strong>«${mod.cardMeta.epithet}»</strong></div>
      <div class="stats-kv"><span>Rareza</span><strong>${rar.nombre} (×${mult.toFixed(1)})</strong></div>
      <div class="stats-kv"><span>HP base escalado</span><strong>${Math.round(mod.hp * mult)}</strong></div>
      <div class="stats-kv"><span>Daño base escalado</span><strong>${Math.round(mod.damage * mult)}</strong></div>
      <div class="stats-kv"><span>Armadura</span><strong>${Math.round(mod.armor * mult)}</strong></div>
      <div class="stats-kv"><span>Velocidad</span><strong>${Math.round(mod.speed * 52)}</strong></div>
    `;
  }

  modal.hidden = false;
  modal.classList.add('active');
}

export function closeStatsModal(): void {
  const modal = document.getElementById('modal-stats');
  if (!modal) return;
  modal.classList.remove('active');
  modal.hidden = true;
}

function createRosterTile(mod: (typeof CHARACTER_LIST)[number]): HTMLButtonElement {
  const rar = RAREZAS[mod.rarity] || RAREZAS.novato;
  const displayName = mod.cardMeta.displayName || mod.name;

  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = `roster-tile rarity-${mod.rarity}${mod.id === STATE.charId ? ' active' : ''} interactive`;
  tile.setAttribute('data-char', mod.id);

  tile.innerHTML = `
    <canvas id="preview-${mod.id}" class="roster-thumb-canvas" width="52" height="52"></canvas>
    <div class="roster-tile-info">
      <div class="roster-tile-rarity" style="color:${rar.color === '#9E9E9E' ? '#BDBDBD' : rar.color};">${rar.nombre}</div>
      <div class="roster-tile-name text-outline-sm" style="color:${mod.cardMeta.nameColor};">${displayName}</div>
      <div class="roster-tile-epithet">«${mod.cardMeta.epithet}»</div>
    </div>
  `;
  return tile;
}

function renderCharacterSelectCards(): void {
  const piratesGridEl = document.getElementById('pirates-roster-grid');
  const marinesGridEl = document.getElementById('marines-roster-grid');
  if (!piratesGridEl) return;

  const pirates = CHARACTER_LIST.filter((m) => (m.faction ?? 'pirates') === 'pirates');
  const marines = CHARACTER_LIST.filter((m) => m.faction === 'marines');

  const startMetaEl = document.querySelector('.start-meta-line');
  if (startMetaEl) {
    startMetaEl.textContent = `${CHARACTER_LIST.length} Personajes · ${CONFIG.MAX_WAVES} Oleadas · 3 Jefes · Primer Wanted: Buggy`;
  }

  piratesGridEl.innerHTML = '';
  if (marinesGridEl) marinesGridEl.innerHTML = '';
  rosterThumbsRendered = false;

  const piratesCountEl = document.getElementById('roster-pirates-count');
  if (piratesCountEl) {
    piratesCountEl.textContent = `${pirates.length} personajes · Toca para equipar`;
  }
  const marinesCountEl = document.getElementById('roster-marines-count');
  if (marinesCountEl) {
    marinesCountEl.textContent = `${marines.length} Almirante${marines.length === 1 ? '' : 's'} · Toca para equipar`;
  }

  pirates.forEach((mod) => piratesGridEl.appendChild(createRosterTile(mod)));
  if (marinesGridEl) {
    marines.forEach((mod) => marinesGridEl.appendChild(createRosterTile(mod)));
  }

  updateShowcaseCard(STATE.charId, false);
  setLobbyFaction(lobbyFaction);
}

let uiInitialized = false;

export function initUI(): void {
  if (uiInitialized) return;
  uiInitialized = true;

  renderCharacterSelectCards();

  let orientationDismissed = Boolean(sessionStorage.getItem('rp_orientation_dismissed'));
  function checkOrientation() {
    const overlay = document.getElementById('orientation-overlay');
    if (!overlay) return;
    if (orientationDismissed) {
      overlay.classList.remove('visible');
      return;
    }
    // Never block inside an iframe (e.g. AI Studio preview environment)
    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }
    if (inIframe) {
      overlay.classList.remove('visible');
      return;
    }

    // Only suggest orientation on mobile touch devices during active combat
    const isTouchDevice = 'ontouchstart' in window || (navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches);
    const isPortrait = window.innerHeight > window.innerWidth;

    if (isTouchDevice && isPortrait && STATE.screen === 'playing') {
      overlay.classList.add('visible');
    } else {
      overlay.classList.remove('visible');
    }
  }
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', () => {
    checkOrientation();
  });
  checkOrientation();
  setTimeout(checkOrientation, 100);
  setTimeout(checkOrientation, 500);

  const btnForceLandscape = document.getElementById('btn-force-landscape');
  const dismissOrientation = (e?: Event) => {
    if (e) e.preventDefault();
    orientationDismissed = true;
    try {
      sessionStorage.setItem('rp_orientation_dismissed', '1');
    } catch {}
    const overlay = document.getElementById('orientation-overlay');
    if (overlay) overlay.classList.remove('visible');
    AUDIO.unlock();
  };
  if (btnForceLandscape) {
    btnForceLandscape.addEventListener('touchstart', dismissOrientation, { passive: false });
    btnForceLandscape.addEventListener('click', dismissOrientation);
  }
  const overlayEl = document.getElementById('orientation-overlay');
  if (overlayEl) {
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) dismissOrientation(e);
    });
  }

  const btnStartGame = document.getElementById('btn-start-game');
  if (btnStartGame) {
    btnStartGame.addEventListener('touchstart', handleStartGame, { passive: false });
    btnStartGame.addEventListener('click', handleStartGame);
  }

  const tabPirates = document.getElementById('tab-faction-pirates');
  const tabMarines = document.getElementById('tab-faction-marines');
  const btnBackPirates = document.getElementById('btn-back-pirates');
  tabPirates?.addEventListener('click', () => {
    AUDIO.unlock();
    AUDIO.playUIClick();
    setLobbyFaction('pirates');
  });
  tabMarines?.addEventListener('click', () => {
    AUDIO.unlock();
    AUDIO.playUIClick();
    setLobbyFaction('marines');
  });
  btnBackPirates?.addEventListener('click', () => {
    AUDIO.unlock();
    AUDIO.playUIClick();
    setLobbyFaction('pirates');
  });

  const btnStats = document.getElementById('btn-lobby-stats');
  const btnCloseStats = document.getElementById('btn-close-stats');
  const modalStats = document.getElementById('modal-stats');
  btnStats?.addEventListener('click', () => {
    AUDIO.unlock();
    AUDIO.playUIClick();
    openStatsModal();
  });
  btnCloseStats?.addEventListener('click', () => {
    AUDIO.playUIClick();
    closeStatsModal();
  });
  modalStats?.addEventListener('click', (e) => {
    if (e.target === modalStats) {
      AUDIO.playUIClick();
      closeStatsModal();
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && modalStats && !modalStats.hidden) {
      AUDIO.playUIClick();
      closeStatsModal();
    }
  });

  [document.getElementById('pirates-roster-grid'), document.getElementById('marines-roster-grid')].forEach((grid) => {
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const tile = (e.target as HTMLElement | null)?.closest('.roster-tile');
      if (!tile) return;
      const charId = tile.getAttribute('data-char');
      if (!charId) return;
      AUDIO.unlock();
      AUDIO.playUIClick();
      triggerHaptic(10);
      updateShowcaseCard(charId, true);
    });
  });

  let isLaunchingChar = false;
  const launchActiveCharacter = (e?: Event) => {
    if (e) e.preventDefault();
    if (isLaunchingChar) return;
    isLaunchingChar = true;
    AUDIO.unlock();
    AUDIO.playUIClick();
    triggerHaptic(20);
    const showcase = document.getElementById('showcase-card');
    showcase?.classList.add('selected-flash');
    setTimeout(() => {
      showcase?.classList.remove('selected-flash');
      isLaunchingChar = false;
      startNewRun(STATE.charId);
    }, 120);
  };

  const btnLobbyPlay = document.getElementById('btn-lobby-play');
  if (btnLobbyPlay) {
    btnLobbyPlay.addEventListener('touchstart', launchActiveCharacter, { passive: false });
    btnLobbyPlay.addEventListener('click', launchActiveCharacter);
  }

  const btnConfirmUpg = document.getElementById('btn-confirm-upgrade');
  if (btnConfirmUpg) {
    btnConfirmUpg.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      SAFE_UPGRADE_MODAL.confirmSelection();
    }, { passive: false });
    btnConfirmUpg.addEventListener('click', (e) => {
      e.stopPropagation();
      SAFE_UPGRADE_MODAL.confirmSelection();
    });
  }

  const openPauseModal = (e?: Event) => {
    if (e) e.preventDefault();
    if (STATE.screen !== 'playing') return;
    AUDIO.playUIClick();
    const pauseStats = document.getElementById('pause-stats');
    if (pauseStats) {
      pauseStats.textContent =
        `Pirata: ${CHARACTERS[STATE.charId].name} • Oleada: ${STATE.wave}/${CONFIG.MAX_WAVES} • Mejoras: ${STATE.mods.acquiredIds.length}`;
    }
    switchScreen('pause');
  };
  document.getElementById('btn-pause')?.addEventListener('touchstart', openPauseModal, { passive: false });
  document.getElementById('btn-pause')?.addEventListener('click', openPauseModal);

  const openSettingsModal = (e?: Event) => {
    if (e) e.preventDefault();
    if (STATE.screen !== 'playing') return;
    AUDIO.playUIClick();
    const restartBox = document.getElementById('restart-confirm-box');
    if (restartBox) restartBox.style.display = 'none';
    switchScreen('settings');
  };
  document.getElementById('btn-settings')?.addEventListener('touchstart', openSettingsModal, { passive: false });
  document.getElementById('btn-settings')?.addEventListener('click', openSettingsModal);

  document.getElementById('slider-sfx')?.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    STATE.settings.sfxVolume = val / 100;
    const lbl = document.getElementById('lbl-sfx-vol');
    if (lbl) lbl.textContent = `${val}%`;
  });
  document.getElementById('slider-music')?.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    STATE.settings.musicVolume = val / 100;
    const lbl = document.getElementById('lbl-music-vol');
    if (lbl) lbl.textContent = `${val}%`;
  });
  document.getElementById('btn-toggle-vibe')?.addEventListener('click', (e) => {
    STATE.settings.vibration = !STATE.settings.vibration;
    const target = e.target as HTMLElement;
    target.textContent = STATE.settings.vibration ? 'ACTIVADA' : 'DESACTIVADA';
    AUDIO.playUIClick();
  });
  document.getElementById('btn-open-restart')?.addEventListener('click', () => {
    AUDIO.playUIClick();
    const restartBox = document.getElementById('restart-confirm-box');
    if (restartBox) restartBox.style.display = 'block';
  });
  document.getElementById('btn-cancel-restart')?.addEventListener('click', () => {
    AUDIO.playUIClick();
    const restartBox = document.getElementById('restart-confirm-box');
    if (restartBox) restartBox.style.display = 'none';
  });
  document.getElementById('btn-confirm-restart')?.addEventListener('click', () => {
    AUDIO.playUIClick();
    startNewRun(STATE.charId);
  });
  document.getElementById('btn-close-settings')?.addEventListener('click', () => {
    AUDIO.playUIClick();
    switchScreen('playing');
  });

  document.getElementById('btn-resume')?.addEventListener('click', () => { AUDIO.playUIClick(); switchScreen('playing'); });
  document.getElementById('btn-quit')?.addEventListener('click', () => { AUDIO.playUIClick(); switchScreen('menu'); });
  document.getElementById('btn-retry')?.addEventListener('click', () => { AUDIO.playUIClick(); switchScreen('select'); });
  document.getElementById('btn-play-again')?.addEventListener('click', () => { AUDIO.playUIClick(); switchScreen('select'); });

  const btnSkipCin = document.getElementById('btn-skip-cinematic');
  if (btnSkipCin) {
    const onSkip = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      AUDIO.playUIClick();
      skipBossCinematic();
    };
    btnSkipCin.addEventListener('touchstart', onSkip, { passive: false });
    btnSkipCin.addEventListener('click', onSkip);
  }
}
