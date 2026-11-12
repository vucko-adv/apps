<h1 align="center">Zeiger</h1>

<p align="center">Hand-drawn instrument cluster themes for BMW iDrive 7 head units (MGU), installed through the community MGU Store.</p>

<p align="center"><img src="docs/images/zeiger-vintage.png" width="900" alt="The Vintage theme on the instrument cluster"></p>

## Themes

**Vintage**: an 80s LCD dash in cream on dark green.

- **Rpm:** a 48-segment bar from 0 to 8000. Cream up to 5200, yellow from 5200, red past 7000.
- **Oil, water, fuel:** 10-segment bars with their values under them (oil 40-150 °C, water 40-130 °C, fuel 0-100 %).
- **Speed:** three digits with leading zeros, in km/h. **Gear:** the gear number, or P, R, N.
- **Clock** and **outside temperature**.

**Vintage 1**: the same dash in the 80s amber/green LCD colours: amber readouts and scale, green lit segments and labels, dark amber windows, the rpm bar amber from 5200.

<p align="center"><img src="docs/images/zeiger-vintage1.png" width="900" alt="The Vintage 1 theme"></p>

More themes will follow. Each one starts as a drawing (Illustrator, SVG) that is turned into a theme.

**Calibration grid** and **Map calibration** (in the Theme list, with "Change with SPORT / COMFORT / ECO PRO" off) show what part of the cluster the driver sees on your car.

## Install

1. Install **cluster-render** first: Zeiger draws through it. It comes from the `robertnisipeanu/idrive-apps` Store source.
2. In the Store, go to **Settings, Add source**, enter **`vucko-adv/apps`**, pick **Branch main**, and install **Zeiger**.
3. Open Zeiger on the center screen and pick a theme. Set the units to metric: km/h and °C are drawn into the theme.

If bimmer-lab's Cluster Themes is installed, remove it first, so the two apps don't take turns on the cluster.

Installing apps that don't come from BMW on your head unit is done at your own risk and may affect your warranty.

## Credits

Zeiger is a fork of [bimmer-lab/apps](https://github.com/bimmer-lab/apps) (Cluster Themes), MIT. It uses cauliflowermossgrape's MGU App Kit and Robert Nisipeanu's cluster-render. Details in [apps/zeiger/NOTICE](apps/zeiger/NOTICE).

## Developing

See [docs/DEVELOPING.md](docs/DEVELOPING.md). The bench runs on Windows too: `node bench/server-win.js zeiger`, then open http://localhost:8078.
