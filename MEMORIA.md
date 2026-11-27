# Memoria de Implementación — Rogue Piece v2.2

## Resumen de Cambios v2.2

1. **Reestructuración de Tiers (`RAREZAS`)**:
   - Nomenclatura unificada: `novato` (×1.0), `pirata` (×1.1), `supernova` (×1.25), `shichibukai` (×1.5), `yonko` (×2.0), `almirante` (×2.0).
   - El tier `almirante` conserva la estética azul-dorado exclusiva de la Marina (`.hud-rarity-pill.almirante`, `.rarity-badge.almirante`).
   - Migrados los 15 personajes existentes sin alterar sus kits ni estadísticas base (salvo el ajuste de Bloodlust en Killer).

2. **Nuevos Personajes**:
   - **Akainu (`src/game/characters/akainu.ts`)**: Almirante (`×2.0`). Recurso **MAGMA (0-100)** pasivo que al llegar a 100 convierte la pasiva Logia en onda de calor ofensiva (80 px, 10 dps × 2s). Combo 5 golpes (`Meigo`, `Inugami Guren`, `Dai Funka`) y habilidades `Ryusei Kazan`, `Hound Blaze`, `Great Eruption`.
   - **Aokiji (`src/game/characters/aokiji.ts`)**: Almirante (`×2.0`). Recurso **HIELO (0-100)** y estado compartido `enemy.frozen`. Combo 5 golpes (`Ice Saber ×3`, `Ice Ball`, `Ice Age`) y habilidades `Ice Age` (congela + suelo resbaladizo), `Ice Saber` (3× y fractura sobre congelados) e `Ice Block: Partisan` (congelación global a 100 Hielo).
   - **Big Mom (`src/game/characters/bigmom.ts`)**: Yonko (`×2.0`). Recurso **ALMAS (0-100)** y sistema autónomo de **Homies** (`Prometheus` 🌞, `Zeus` ⚡, `Napoleon` 🎩). Combo de 5 golpes que evoluciona a `Maser Cannon` con los 3 Homies activos; `Soul Pocus`, `Heavenly Fire`, `Thunder Bolt` y pasiva `Soru Soru no Mi`.
   - **Doflamingo (`src/game/characters/doflamingo.ts`)**: Shichibukai (`×1.5`). Recurso **HILOS (0-100)**. Combo de 4 golpes (`Goshikito ×2`, `Athlete`, `Overheat`); habilidades `Parasite` (control mental conectado por hilo), `Overheat` (detona marionetas), `Birdcage` (encierra enemigos y explota al morir) y pasiva `Clon de Hilos`.

3. **Ajuste en Killer (`src/game/characters/killer.ts`)**:
   - `Bloodlust` (H2) otorga **15% de robo de vida** en ataques normales, números de daño en verde (`#4CAF50`), texto flotante de curación y goteo visual rojo/verde sobre el sprite.

4. **Reglas Preservadas**:
   - Sanji continúa sin poder dañar a Alvida con ataques normales.
   - Nombres canónicos en inglés para habilidades y golpes; comentarios organizados en español.
