# Zeiger

<img src="icon.png" width="72" align="left" alt="Zeiger icon">

Redraws the whole instrument cluster with a hand-drawn theme. Open **Zeiger** from the apps menu on the center screen: its page shows the themes, the warnings and the settings.

<p align="center"><img src="../../docs/images/zeiger-vintage-green.png" width="900" alt="Vintage Green"></p>

## Vintage Green and Vintage Amber

An LCD from 1985, drawn in code by `cluster-design/vintage2/build.html` (`?v=green`, `?v=amber`): a continuous rpm wedge (lit, orange or amber from 5200, red from about 6750), slanted digits over ghost 8s, P R N D S M, oil / water / fuel bars under pixel icons, a dot-matrix line with the range and the average speed, scanlines, and a 2.5 s self-test at power-on. Green is cream on dark green; Amber has amber readouts, green lit segments and labels and dark amber windows.

## Map

The phone's map (waze-on-cluster) over the whole cluster, the speed, selector, drive mode, range and coolant over it.

## Sunrise

A sunrise over mountains drawn in code by `cluster-design/sunrise/build.html`, the speed, selector and drive mode, and today's weather (Open-Meteo, through the Store's Internet uplink).

## Settings

- **Change with SPORT / COMFORT / ECO PRO:** a theme per drive mode, or one theme always.
- **Theme position:** px to the right (negative: left), -12 by default.
- **Today's weather** (Sunrise): on by default.
- **Units:** metric (km/h and °C are part of the drawing). **Clock:** 12 or 24 hours. **Time zone.** **Tank size.**
- **Warnings:** oil and water values flash red over their limits.
- **Calibration grid** and **Map calibration** help measure what BMW hides on your car's cluster.

## How a theme is made

1. Draw the cluster at 1920x720 (Illustrator, export SVG).
2. A build page turns the drawing into a face picture, segment bars and fonts (`cluster-design/<theme>/build.html` next to this repo).
3. The layout (`hud/layouts/<name>.json`) places the live parts. Widget types are documented in `shared/hud.js`.
