# Zeiger

<img src="icon.png" width="72" align="left" alt="Zeiger icon">

Redraws the whole instrument cluster with a hand-drawn theme. Open **Zeiger** from the apps menu on the center screen: its page shows the themes, the warnings and the settings.

<p align="center"><img src="../../docs/images/zeiger-vintage2.png" width="900" alt="Vintage 2"></p>

## Vintage 2

An LCD from 1985, cream on dark green, drawn in code by `cluster-design/vintage2/build.html`: a continuous rpm wedge (cream, orange from 5200, red from about 6750), slanted digits over ghost 8s, P R N D S M, oil / water / fuel bars under pixel icons, a dot-matrix message line, scanlines, and a 2.5 s self-test at power-on.

## Vintage 1

An 80s LCD dash in amber and green, from `CAJGER-vintage.svg`: a 48-segment rpm bar (amber from 5200, red past 7000), oil / water / fuel bars with their values, speed, gear, clock and outside temperature.

## Settings

- **Change with SPORT / COMFORT / ECO PRO:** a theme per drive mode, or one theme always.
- **Units:** metric (km/h and °C are part of the drawing). **Clock:** 12 or 24 hours. **Time zone.** **Tank size.**
- **Warnings:** oil and water values flash red over their limits.
- **Calibration grid** and **Map calibration** help measure what BMW hides on your car's cluster.

## How a theme is made

1. Draw the cluster at 1920x720 (Illustrator, export SVG).
2. A build page turns the drawing into a face picture, segment bars and fonts (`cluster-design/vintage/build.html` next to this repo).
3. The layout (`hud/layouts/<name>.json`) places the live parts. Widget types are documented in `shared/hud.js`.
