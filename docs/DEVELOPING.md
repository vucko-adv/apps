# Developing

## Repo layout

```
apps/zeiger/      the app: app.json, main.js (entry), NOTICE, README
                  hud/ (fonts, layouts, pictures, intros) is packed into hud.pack by the build
shared/           the cluster-render drawing engine; app.json "shared" lists the files the app
                  needs and the build copies them in
kit/              cauliflowermossgrape's MGU App Kit (MIT, kit/LICENSE): runtime/ ships inside each app,
                  tools/ builds it. One change from upstream: kit/tools/build.py copies the app.json
                  "shared" files (marked "bimmer-lab addition")
bench/            test bench (fake cluster-render + the kit's stub head unit), see bench/README.md
tools/            fonts-src (the free fonts the theme builds use), bake_fonts.py (needs Pillow)
scripts/          deploy.sh pushes layout files to the car over SSH
docs/images/      the screenshots and GIFs in the READMEs, taken from the bench
mgu-repo.json     tells the Store how to build the app
```

## Build

`python3 kit/tools/build.py zeiger` builds the app into `dist/`. It needs an `oap-sdk/` folder. On the car the Store makes the real one from a BMW app. The bench writes a stub, which is gitignored and must never ship.

## Test on the bench

```sh
node bench/server.js zeiger        # macOS, Linux; then open http://localhost:8078
node bench/server-win.js zeiger    # Windows
```

The page has buttons for the drive mode (COMFORT, SPORT, SPORT+, ECO PRO), fed in as the car's FES signal. It builds the app with the kit and runs the build in the kit's stub head unit (Node 8.16.2, the car's version, when it's there), against a fake cluster-render. The page shows the cluster with the app's real pixels and shaders, the center-screen status and settings, and signal sliders. Details in `bench/README.md`.

## Layouts

The layouts are `apps/zeiger/hud/layouts/<name>.json` (`schemaVersion: 2`). Widget types, tokens and options are documented in the header of `shared/hud.js`. `shared/layouts.js` checks every layout and refuses a bad one with the reason, which also shows on the app's status row.

- **`atext`:** text drawn by the GPU: an effect layer that reads a glyph atlas of the font, uploaded once per connection as an R8 asset (one byte a pixel, not a layer, shared by every `atext` on that font). A value change is one uniform message of glyph codes, no pixels. Equal cells across the widget (`cells`, up to 32; the glyphs keep their shape at `w` = cells x the font's widest advance + 2 and `h` = its cell height, which the log states), `align` left, right or center, only the characters the font has. The calibration grids carry one as a probe (0.7.3 / 0.5.3), and the car drew it on both the cluster and the HUD (Nov 6 2026), so the plan is to move every readout onto this path (see `research/findings.md`, "Cost levers").
- **Cluster (1920x720):** `text`, `picture`, `segments`, `fill` (a solid colour with a see-through `hole` cut while a setting is on) and more, listed in the header of `shared/hud.js`. A layout names its own `"theme"` (colours, in `shared/hud_themes.js`).
- **Theme layouts:** each is written by its build page in `cluster-design/<theme>/` next to the repo, with its pictures and fonts; rebuild there, not by hand.
- **Calibration:** `grid` (lines every `step` px, brighter every `major` steps) and `gridlabels` (x/y labels every `step` px), in the `grid.json` layout.
- **Off:** the layout name `off` draws nothing and releases the screen. With `byMode` on, the `inComfort` / `inSport` / `inEco` settings pick the layout from the car's drive mode (FES `statusFESVehicleDynamicSwitchHMI`).
- **Effect shaders:** cluster-render's `v_uv` has (0,0) at the top-left. The bench draws the same way.
- **Layer packing:** cluster-render allows 8 layers per client connection (32 across all clients, `CompositorLimits` in its source; confirmed on the car: Nov 5 2026 one connection drew 8, Nov 6 2026 the grid's L1..L16 probe drew all sixteen over three connections on both the cluster and the HUD), so the engine packs every image widget (text, scale, icon, ...) into a few image "sheets" (one layer each, grouped by class and z, split where widgets overlap or a sheet would grow past a quarter of the target) and keeps effects one layer each; it aims for 8 layers per layout and warns in the log when a layout needs more. Put effect widgets first in a layout's file order and text after, so the text lands in as few sheets as possible. `"own": true` keeps an image widget on its own layer (the calibration probes). The limit is per connection, so `"conn": 1..3` on a widget puts its layer (or its sheet) on a second, third or fourth connection to cluster-render, each with its own 8 layers (32 service-wide); DukeAPenguin's idrive7-EVAHUD saw 28 layers shown over four sockets on his car, and the calibration grids probe it here. The service also has 16 MiB of pixel memory for every app's images together and counts each image twice, so an image layer costs w*h*8 bytes and the layout is refused past that ("the service's pixel memory is full"). The status row shows the layer count, the connections and the pixel memory; the rebuild log line says how many sheets, how many bytes the whole-sheet writes cost and the pixel memory. Text and badge widgets send only the rectangle around the pixels that changed since their last paint.
- **Any widget:** `toggle: "setting"` shows it only while that setting is on, and `"!setting"` only while it's off. `"setting=value"` shows it only while a choice setting has that value. `themes: [...]` limits it to certain themes.

**Visibility check.** Not every pixel of a target reaches the driver's eye: on the cluster the hood hides the top corners (down to y 273 at the left edge and y 240 at the right, nothing at the center), BMW paints a solid black gear box over us at x 1406-1597 y 342-419 and its seat-belt light at x 587-626 y 663-700. These numbers were measured from car photos on Nov 5 2026 (`design/photos/calibration-2026-11-05.json`, pictures next to it) and live in `shared/visible.js`. `layouts.js` runs its `check()` after validating a layout and logs one warning per widget that is under the hood, or under the box or light; it never refuses a layout for this. The bench draws the same geometry as its "car view" and flags the layers (see `bench/README.md`).

To try an edited layout on the car without reinstalling:

```sh
./scripts/deploy.sh root@<car-ip-or-hostname> apex.json
```

The file lands in the app's `data/layouts/` on the car, overrides the built-in layout of the same name, and the running app reloads it by itself.

## Fonts

Pre-baked into alpha atlases (the car never rasterizes fonts): the themes' fonts by their build pages in `cluster-design/`, from the free fonts in `tools/fonts-src`.

## Crash safety

The kit turns an uncaught exception into an app exit, and on the car a second unexpected exit uninstalls the app. Every timer, event and widget in the engine runs inside a guard that logs the error and carries on.
