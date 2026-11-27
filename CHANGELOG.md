# Changelog - Rogue Piece: Shells Town

## [v2.2] - 2026-11-26
### Added
- Reestructuración de rarezas (`RAREZAS`): `novato`, `pirata`, `supernova`, `shichibukai`, `yonko` y `almirante` (conservando estilo azul-dorado para la Marina).
- Añadidos 4 nuevos personajes jugables: **Akainu**, **Aokiji**, **Big Mom** y **Doflamingo** (total: 19 personajes, 16 Piratas y 3 Almirantes).
- Sistema compartido de congelación (`frozen`), marcas elementales, terror (`fearTimer`), control mental (`Parasite`) y encierro (`Birdcage`).
- Ajuste en **Killer**: 15% de robo de vida en ataques normales durante `Bloodlust` con números de daño verdes y efecto visual de goteo.
- Añadidos **Zoro (Wano)** (`shichibukai`), **Dracule Mihawk** (`yonko`) y **Sanji (Egghead)** (`shichibukai`) con VFX y animaciones propias en Canvas 2D.
- Rework integral de ataques y VFX de **Akainu**, **Aokiji**, **Big Mom** y **Doflamingo** manteniendo sus modelos, pasivas y recursos.
- Mejoras a **Dracule Mihawk** (combo finisher de 3 ondas en abanico, H2 *Tri-Crescent* de 3 cortes lentos DPS que rompen el suelo y menor enfriamiento en H3) y **Sanji (Egghead)** (animaciones de piernas, botas DOM y llamas azules Ifrit visibles en todas sus patadas).
- Añadidos **Charlotte Katakuri** (`shichibukai`) y **Gol D. Roger** (`yonko`) (total: 24 personajes, 21 Piratas y 3 Almirantes).
- Documentación actualizada en `PROYECTO.md` y `MEMORIA.md`.

## [v1.9b-playable] - 2026-11-23
### Fixed
- Cerrado el bloque `function trySkill(idx)` después de `luffy_pts` y eliminada la llave sobrante al final del script para restaurar el alcance global de `update()`, `render()`, listeners y `gameLoop()`.
- Eliminado el overlay temporal `#__dbg_box` y funciones duplicadas (`addShanksHaki`, `addWhitebeardEnergy`).
- Añadido soporte completo de teclado (`WASD`/Flechas, `Espacio`/`J` atacar, `Shift`/`K` dash, `1`/`2`/`3` habilidades, `Esc`/`P` pausa) y clics de ratón en todos los botones del HUD.
- Ajustados `.skill-label` y `#tutorial-tooltip` para evitar solapamientos en pantalla.

## [v1.9b] - 2026-11-23
- Ajustes de los 3 Legendarios (Shanks Straw Hat, Barbablanca, Luffy PTS), 9 personajes base intactos y regla Sanji vs Alvida.

## [v1.9] - 2026-11-23
- Rediseño integral de los 3 Legendarios con mecánicas de combate avanzadas, hit-stops y shakes calibrados.

## [v1.8] - 2026-11-22
- Añadidos Shanks Straw Hat, Barbablanca y Luffy PTS, rarezas Legendario (1.5x) y Yonko (2.0x), y selector ampliado a 12 piratas.

## [v1.7b] - 2026-11-22
- Versión base funcional en `index.html` (HTML5 Canvas + Web Audio API) con 9 personajes y Alvida como boss.
