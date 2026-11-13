# Zeiger

<img src="icon.png" width="72" align="left" alt="Zeiger icon">

Redraws the whole instrument cluster with a hand-drawn theme. Open **Zeiger** from the apps menu on the center screen: its page shows the themes, the warnings and the settings.

<p align="center"><img src="../../docs/images/zeiger-vintage-green.png" width="900" alt="Vintage Green"></p>

## Vintage Green and Vintage Amber

An LCD from 1985, drawn in code by `cluster-design/vintage2/build.html` (`?v=green`, `?v=amber`): a continuous rpm wedge (lit, orange or amber from 5200, red from about 6750), slanted digits over ghost 8s, P R N D S M, oil / water / fuel bars under pixel icons, a dot-matrix line with the range and the average speed, scanlines, and a 2.5 s self-test at power-on. Green is cream on dark green; Amber has amber readouts, green lit segments and labels and dark amber windows.

## Dark Moon

A sunrise seen from orbit, drawn in code by `cluster-design/darkmoon/build.html`: the speed in a dark moon's disc under the sun, the selector and drive mode on the right, today's weather on the left (Open-Meteo, through the Store's Internet uplink), everything mirrored about the middle.

## Underpass and Mist

Dark Moon's readouts and weather over a photo (`cluster-design/underpass` and `cluster-design/mist`, built by `cluster-design/photo/photo_theme.js`): soft scrims behind the readouts so they read on it, and black wherever BMW's gear box lands.

## Map

Dark Moon's look round the phone's map (waze-on-cluster): the map in a window in the middle with the sun on its top edge, the speed on the left, the selector and drive mode on the right, range and coolant at the bottom. **Map Underpass** and **Map Mist**: the same window and readouts on Underpass's and Mist's photos (`cluster-design/map_underpass`, `cluster-design/map_mist`).

## Settings

- **Change with SPORT / COMFORT / ECO PRO:** a theme per drive mode, or one theme always.
- **Theme position:** px to the right (negative: left), -12 by default.
- **Today's weather** (Dark Moon, Underpass, Mist): on by default.
- **Units:** metric (km/h and °C are part of the drawing). **Clock:** 12 or 24 hours. **Time zone.** **Tank size.**
- **Warnings:** oil and water values flash red over their limits.
- **Calibration grid** and **Map calibration** help measure what BMW hides on your car's cluster.

## Black boxes

- **In the middle, with the engine running, on a car that is not a real M:** the cluster is coded to BMW's M layout (often done with BimmerCode on cars with the M Sport or M Performance package). Code it back to the car's own layout (M Sport or M Performance) and restart the head unit; the boxes go away (checked on a G20, November 2026).
- **Just left of the gear letter:** BMW draws it behind its gear display on every car, over any theme. It can't be seen on any of Zeiger's themes (black background there).

## How a theme is made

1. Draw the cluster at 1920x720 (Illustrator, export SVG).
2. A build page turns the drawing into a face picture, segment bars and fonts (`cluster-design/<theme>/build.html` next to this repo).
3. The layout (`hud/layouts/<name>.json`) places the live parts. Widget types are documented in `shared/hud.js`.
