# Rogue Piece — Proyecto v2.2

Roguelike de acción 2D en vista cenital inspirado en **One Piece**, optimizado para móvil horizontal táctil y navegador de escritorio (HTML5 Canvas + TypeScript + Web Audio API).

## Arquitectura

- **Entrada principal**: `index.html`, `src/main.ts`, `src/styles.css`.
- **Núcleo del juego (`src/game/`)**:
  - `config.ts`: constantes globales, oleadas, mejoras (`UPGRADE_POOL`), y sistema de rarezas `RAREZAS` (`novato`, `pirata`, `supernova`, `shichibukai`, `yonko`, `almirante`).
  - `state.ts`: estado centralizado de partida (`STATE`) y estadísticas persistentes.
  - `abilities.ts`: despachador modular `CharacterContext` y helpers de áreas (`damageEnemiesInCone`, `damageEnemiesInCircle`, `damageEnemiesInLine`, `applyBleed`).
  - `entities.ts`: generación de enemigos, jefes (Capitana Alvida en oleada 5, Capitán Morgan en oleada 10), proyectiles, y resolución de daño/estados compartidos (`frozen`, quemaduras, marcas elementales, terror, sangrado).
  - `gameLoop.ts`: bucle principal de actualización y física de estados (congelación, resbalamiento, parásito, jaula de hilos, descargas eléctricas).
  - `rendering.ts`: renderizado Canvas 2D de arena, enemigos, jugador, efectos de corte y minimapa.
  - `ui.ts`: lobby de selección por facciones (Piratas y Marines), tarjetas showcase, HUD de combate y modales.
  - `rules.ts` / `rules.test.ts`: lógica pura desacoplada y pruebas unitarias.

## Sistema de Tiers (v2.2)

| Tier | Multiplicador | Ejemplos |
| --- | --- | --- |
| **NOVATO** | ×1.0 | Luffy, Zoro, Sanji |
| **PIRATA** | ×1.1 | Usopp, Franky, Robin |
| **SUPERNOVA** | ×1.25 | Law, Kid, Killer |
| **SHICHIBUKAI** | ×1.5 | Shanks (Straw Hat), Barbablanca, Luffy PTS, Zoro (Wano), Sanji (Egghead), Katakuri, Doflamingo |
| **YONKO** | ×2.0 | Luffy G5, Kaido, Dracule Mihawk, Big Mom, Gol D. Roger |
| **ALMIRANTE** | ×2.0 | Kizaru, Akainu, Aokiji (facción Marines, estilo azul-dorado) |

## Catálogo v2.2 (24 Personajes)

- **Piratas (21)**: Luffy, Zoro, Sanji, Usopp, Franky, Robin, Law, Kid, Killer, Shanks, Barbablanca, Luffy PTS, Zoro (Wano), Sanji (Egghead), Katakuri, Doflamingo, Luffy G5, Kaido, Dracule Mihawk, Big Mom, Gol D. Roger.
- **Marines (3)**: Kizaru, Akainu, Aokiji.
