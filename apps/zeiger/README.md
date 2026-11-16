# Zeiger

<img src="icon.png" width="72" align="left" alt="Zeiger icon">

Redraws the whole instrument cluster with a hand-drawn theme. Open **Zeiger** from the apps menu on the center screen: its page shows the themes, the warnings and the settings.

<p align="center"><img src="../../docs/images/zeiger-vintage-green.png" width="900" alt="Vintage Green"></p>

## Vintage Green and Vintage Cyan

An LCD from 1985, drawn in code by `cluster-design/vintage2/build.html` (`?v=green`, `?v=cyan`), one layout in two colourings: Green cream readouts on dark green windows, Cyan cyan fluorescent readouts on dark teal windows. Slanted digits over ghost 8s, P R N D S M and the gear, oil / water / fuel bars under pixel icons, scanlines, and a 2.5 s self-test at power-on.

- **Rpm:** a dot-matrix band (286 dot columns, ghost dots unlit, orange from 5200, red from about 6750) over a tick scale with dot-matrix numbers.
- **TURBO** (left of the speed): a lamp over a boost bar of 16 rising segments, 0.1 bar each.
- **ECON** (right of the speed): two halves of 8 segments growing from the middle outward.
  - Green: `econEco`, the engine load under 35 % of its peak torque; coasting fills it.
  - Red: `econLoad`, the load over it; full torque fills it.
- **Bottom:** three dot-matrix strips: the outside temperature, the range and average speed, the clock.
- **Roundel:** drawn in code in the theme's colours (BMW's white quadrants lit, its blue ones the windows' ghost colour).
- **Size:** 6.7 MiB in 23 layers on 3 connections, each.
- **Layers:** each face piece holds only its own pixels (a piece's box may take in the end of another, which was then drawn twice).

## VFD

A fluorescent display in the manner of the late-80s Japanese digital dashes, drawn in code by `cluster-design/vfd/build.html` (the design picture: `design.html`). Pale mint phosphor with a soft bloom on black.

- **Top:** the fuel band (dot columns, E to F, the pump orange under 15 %), the speed in slanted segment digits with SPEED and km/h, and the coolant line (C to H) with a 4x4 dot block riding on it, one of 17 places 5 °C apart.
- **Middle:** the rpm band (207 dot columns, red from 7000) over a straight scale 0-8 with a red dashed end, and the drive mode in a green lamp on the left. Right of the scale is black, where BMW draws its gear box.
- **Bottom:** three teal filter windows: SHIFT POSITION with the selector's letter and the gear number; the clock with OIL and OUT in dot matrix; RANGE.
- **Self-test:** 2.5 s with everything lit at power-on. No roundel: the dashes it follows had none.
- **Engine:** the coolant block and the orange pump are `segments` with `"one": true` (only the last segment reached is lit). The bloom is drawn into the fonts and pictures, so the colour theme's glow stays 0. The face is cut into 8 regions, each a z group of its own: 20 layers on 3 connections and 4.5 MiB of cluster-render's 16 MiB (with the start animation's hidden SYSTEM CHECK text).

## Apex and Apex Sport

A racing cluster, drawn in code by `cluster-design/apex/build.html` (`?v=sport` for Apex Sport) from the same drawing as its design pictures (`draw.js`).

- **Rpm:** a band of 32 blocks (up to 1500, level to 6500, down to 8000) that fills in one continuous line through the blocks: 4 px strips of a `segments` widget, lit white (Sport: yellow), the yellow zone amber, the red zone red.
- **Zones (0.30.0):** the pictures still have the band orange from 6000 and its track dark orange and dark red, but the layout's `zoneSteps`, `zoneColors` and `zoneTrack` (shared/hud.js) take over: each strip's zone comes from its rpm, a lit strip in the yellow zone is the app's amber (no orange), and every unlit strip is drawn opaque over the track, dark amber or dark red in the yellow and red zones and the plain track elsewhere. So when the cold-engine guard moves the zones down, no orange is left between the reds.
- **Middle:** the speed, the gear (`{{gearnum}}`) and P R N D M. The letter in use is bigger and white (`{{is:stage:X}}`); the others are dim (`{{isnt:stage:X}}`), and the fourth place shows D, or S in the sport programme.
- **Bars:** boost (0-1.6 bar) and braking (`brakeG`, 0-1.2 g), one segment at a time.
- **Bottom row:** coolant (40-130 °C) and fuel in 2 px strips, and the clock (`{{time}}`, white, Michroma 38 px) between them, where the design had a logo.
- **Apex Sport:** a red glow over a red tray line, the band thicker.
- **Shift flash (Apex Sport):** a `bandflash` effect layer (shaders.js) draws the whole band in one colour and flashes it 5 times a second. It is white from 500 rpm before the shift point, yellow from 250 before, and red at it. Only a colour and an on / off go to the car, never pixels. The setting **Shift flash** turns it off. It doesn't flash during the start animation (0.30.0), nor does any theme's shift light.

- **Customise (0.34.0):** a **CUSTOMISE** button on Apex's and Apex Sport's gallery card opens a list of places and what each shows (page.js `CUSTOM`; the settings `apexMid` / `apexBig`, `apexSportMid` / `apexSportBig`, the diesel versions sharing their petrol one's). **Bottom middle:** the clock, BMW's M badge (`apex_mbadge`, drawn by build.html from the user's picture), or empty. **Big number:** the speed, the rpm (four digits in the speed's font, "rpm" under them), or empty. **Left block** (0.36.0; `apexLeft` / `apexSportLeft`, replacing 0.35.0's separate upper and lower bar): a pair of bars, upper and lower: boost and braking (the default), oil and water, intake air and boost, accelerating and braking g, torque and power %; or the **tyres**; or empty (build.html `PAIRS`). The scales: boost 0-1.6 bar, braking and accelerating 0-1.2 g (braking red), oil 40-150 °C, coolant 40-130 °C, intake air 0-80 °C, torque and power 0-100 %; orange from a high mark (1.2 bar, 130 / 115 / 60 °C, 90 %). The tyres: a car from above between the bars' two rows, each tyre's pressure beside its wheel, the same distance from the car on both sides (measured at the slanted digits' mid-height), "TYRES bar" centred under the car; a pressure under **Warnings, Tyre pressure** (`warnTyre`, default 2.0 bar, 0 = off) turns the theme's accent, steady (text `"tyreLow": "FL"`). A widget for several pairs has the toggle `"apexLeft=boostBrake|gForce"` (any of those values, shared/hud.js and shared/layouts.js). Each pick has its own label, value, unit and lit bar (build.html `PICKS`); the unlit tracks are widgets too (16 segments, or 12 for braking), on a layer of their own under the bars, so the connection stays at 8 layers. Each layout widget shows for its pick only (`"toggle": "apexMid=clock"`, shared/hud.js), so a pick rebuilds the theme. The bottom corners and the gear are next.
- **Customise with a preview (0.41.0):** the page shows the theme as big as it fits, as it will look with the picks being tried. Each part that can change has a frame and its pick's name; a tap picks a part, which then gets arrows (up and down for the left block, left and right for the big number and the bottom middle), and the arrows or a sideways swipe go through its picks. Nothing goes to the cluster until **Apply**; then every pick goes at once (one rebuild: hud.js `_rebuildSoon` gathers setting changes 30 ms apart). Reset goes back to what is set; Back leaves without applying. The preview is the theme's pieces laid together: build.html ("Customise previews") draws the theme with its defaults and, for each Customise setting, the rect its widgets take once per pick (`hud/previews/<theme>_custom.json`, 0.6 of the panel's size); the rects don't overlap, so any mix of picks shows as the cluster draws it. A pick keeps every layer of the theme on the cluster: a (connection, class, z) group that has the same layers in the same order before and after stays as it is (`_sameGroups`; the pieces round BMW's gear letter put three layers in one group), and only the pixels that changed go up.

The glows are one quarter-size picture stretched by the GPU. The rest of the face is 6-7 pieces. Every sheet is chosen by its z group, so the theme takes about 8-9 MiB of pixel memory and 15-16 layers on two connections.

## Dark Moon

A sunrise seen from orbit, drawn in code by `cluster-design/darkmoon/build.html`: the speed in a dark moon's disc under the sun, the selector and drive mode on the right, today's weather on the left (Open-Meteo, through the Store's Internet uplink), range and coolant at the bottom with a small clock between them (`{{time}}` in the second line's grey), everything mirrored about the middle.

## Peaks (0.33.0)

A minimal theme (`cluster-design/peaks/build.html`, drafted in `design.html`) on a photo of sunlit ridges under a deep blue sky (since 0.33.1; 0.33.0 had a peak against a pale evening sky in a dark ink), darkened a little toward the top, over the whole panel. The photo came from a friend of the author. Little on it, in white and a soft grey (colour theme `peaks`): the speed (Barlow Medium 150, font `p_speed`) with km/h and a hairline rev line under it, the selector letter with the gear (`{{gearInD}}`) and the drive mode on the left, range and the clock with the outside temperature on the right. The rev line is a `segments` bar drawn white and coloured by the engine (`zoneColors`: the ink, the yellow and the red zone); `"zoneFaint"` (new) shows the yellow and red zones faintly ahead of the rpm all the time, and they move with the cold-engine guard. Its start animation is the soft fade of the photo themes.

### Compressed background (0.38.0, a test)

Peaks' photo goes to the cluster ETC2-compressed: 1.32 MiB of cluster-render's pixel memory instead of 10.5 (an RGBA image layer counts twice its 5.5 MB, a compressed asset its blocks once), and a quarter of the upload. The whole theme is 2.3 MiB instead of 11.5, so it is held like the others when the theme changes (no curtain).
- **How:** `tools/etc2_picture.js zeiger peaks_bg` turns the picture into `etc2rgba` blocks in place (`"format"` in the picture file; `cluster-design/peaks/install.js` runs it). `shared/etc2.js` is the encoder and decoder, written for this repo: ETC1's individual and differential modes and ETC2's planar mode for smooth skies, EAC alpha. It decodes bit for bit as SwiftShader does (Chrome `--use-angle=swiftshader`, `WEBGL_compressed_texture_etc`), checked on Peaks and Dark Moon. Peaks: 46.0 dB against the original.
- **On the cluster:** an `etc2rgba` asset (cluster-render 0.5.8 or later; the car has 0.6.0) drawn by an effect layer that samples it (shaders.js `TEXPIC`: the theme position as a shift, the start animation's fade, BMW's strip cut as a see-through rect). The asset is dropped after its layer.
- **Older renderer:** if cluster-render refuses the format or the texture, the app decodes the picture itself (`pictures.rgbaOf`, Node 8 has no BigInt, so etc2.js does without) and sends it as an image layer, as before, for the rest of the run. The bench imitates that with `BENCH_NO_ETC2=1`.
- **Watermark:** the pixel mark does not survive the compression; a compressed picture keeps only its `author` and `copyright` fields (the watermark tool leaves its blocks alone).
- **Since 0.40.0 every photo theme:** Dark Moon, Mist, Underpass, Map Mist and Sunrise's hills too (each theme now 2.3-3.1 MiB instead of 6-12.4), so every change between themes can hold the old one. Their bottoms fade to black from row 560 to 716 (`--fade 560,716,0.95`), so the photo meets BMW's black strip and the small window left open over its gear letter without an edge. Sunrise's hills got two see-through rows on top (ETC2 is 4x4 blocks), their widget starts at 428. The themes' installers in cluster-design run the tool with the same fade.
- **Not yet:** `etc2rgb` (0.5 byte a pixel, opaque) is not checked on an iDrive 7 cluster upstream.

## Underpass and Mist

Dark Moon's readouts and weather over a photo (`cluster-design/underpass` and `cluster-design/mist`, built by `cluster-design/photo/photo_theme.js`): soft scrims behind the readouts so they read on it, and black wherever BMW's gear box lands.

## Map Mist

The phone's map (waze-on-cluster) in a window in the middle of Mist's photo (`cluster-design/map_mist`): the speed on the left, the selector and drive mode on the right, range and coolant at the bottom with a small grey clock under the map between them.

## Removed themes

A car set to a removed theme shows the nearest one left (shared/hud.js `RENAMED`): Sunrise shows Mist, Map and Map Underpass show Map Mist, Vintage Amber shows Vintage Green. The engine features only they used stay in `shared/hud.js`: `"ownStrip"`, `"fixed"`, `"withMap"`.

## Home-screen widget

`widget.js`, through app.json `startWidget` and the kit's `ctx.widget` (kit/runtime/mgu.js). It uses BMW's Drive Recorder widget layout, as the kit's Live Data does (checked on a G05). The setting **Home-screen widget** picks what it shows:

- **Sharpness (0.30.0):** the HMI shows the picture about 2.8 times the 384 x 256 it was drawn at, so text came out soft. It is still laid out in 384 x 256 but drawn 3 times as big (`startWidget.size` 1152 x 768, `scaledCanvas` in widget.js), and the theme pictures and the weather's text masks are made at that size.
- **Fit (0.26.0):** the part of the picture the HMI shows was measured on a G20 from photos: about 8 % of the width and 7.5 % of the height is cut off each side (`startWidget.safe`). Everything keeps 14 px more inside that, smaller than before, and the weather sits in the middle of the window's height (Sunrise's at the top, over its horizon).
- **Engine** (the default since 0.25.0): oil, coolant and boost, each as its value and a bar of 20 segments. The temperature bars are blue while cold (oil under 80 °C, coolant under 70 °C), green when warm and red over the Warnings limits, which show as a red tick; boost is orange, its peak of the last 5 s held as a white segment. On top: READY, or COLD and the shift point the cold-engine guard asks for. Boost comes from the sport display or, while the widget is placed, the engine unit (shared/hud.js `widgetBoost`).
- **Weather, Mist** (the default) and **Weather, Sunrise:** the weather on Mist's photo, or on a sunrise over mountains (an earlier Sunrise theme's). On the left: the place, the temperature now with its icon, the weather now in a word, and today's high, low and chance of rain (in blue). On the right: the next three days, each with its icon, high (white) and low (grey). It uses the cluster themes' own fonts and colours. Every line on the left shares a baseline with the right, and nothing goes below Sunrise's horizon. While the forecast shown is an old one and there's no internet, OFFLINE shows in amber beside the place. Backgrounds: `cluster-design/mist/widget_bg.html` and `cluster-design/sunrise/widget_bg.html`.
- **The cluster's theme:** ZEIGER, the shown theme's gallery picture (hud/previews, shrunk by averaging), its name, and the drive mode while "Change with SPORT / COMFORT / ECO PRO" is on.
- **Weather fetching:** the forecast (`shared/weather.js`, Open-Meteo, 4 days) is fetched while a widget is placed and shows the weather. This is apart from the themes' weather and the **Today's weather** setting. Like the themes, it needs the Store's Internet uplink.
- **Small widget:** the layout's text lines only (ASCII: the place, the weather now, today's high / low / rain, the next days).
- **Refresh:** redrawn when what it shows changes, else the same picture again every 30 s, in case the HMI dropped it.

## Changing themes: the curtain (0.30.0)

A new theme's layers are made after the old one's are gone (cluster-render's 16 MiB of pixel memory), and its big pictures take a moment through the upload budget. In between, BMW's own cluster showed, and the change looked like a glitch. Now a black fill over the whole panel goes up when the theme changes, on a fourth connection no layout uses (an effect layer: no pixel memory), and fades out in 0.35 s once cluster-render says every layer of the new theme is shown (4 s at most). To BMW's own cluster it fades out at once. The log says how long it stood (`curtain: ...`).

**Since 0.37.0** (and 0.38.0: Peaks compressed, 2.3 MiB, so it is held too):
- **The old theme is held** while the new one is made, when both fit in cluster-render's pixel memory together (96 % of the 16 MiB) and its layer limits (64 a connection, 96 in all since cluster-render 0.4.2): the new theme's layers are made 200 z above the old ones, the old go once every new layer is shown (5 s at most), and the new ones go back to their own z (shared/hud.js `HOLD_*`, `_canHold`, `_holdEnd`). No black at all, e.g. Apex and Sunrise. The photo themes (Peaks 11.5 MiB, Dark Moon 12.4 MiB) don't fit with another theme, so they still change under the curtain. If cluster-render refuses a layer while holding, the old theme goes, the curtain comes up and the curtain is used for the rest of the drive. The log says `holding ...` and `hold over: ...`.
- **The curtain has a loading line** in its middle (240 x 3 px) that fills as the new theme's layers show (shaders.js `CURTAIN`), so the wait reads as loading and not as a fault. On the car the wait is mostly the new pictures going through cluster-render's upload budget (2000-5500 KB/s).
- **The same theme made again** (a Customise pick, a setting) keeps its layers: a sheet whose box stays the same gets only the rectangle that changed (`_createSheet`), every sheet takes in the box of the widgets toggled off now so its box is the same whichever pick is on (`_steadySheets`), and an own still picture, fill or band flash that is the same stays (`_keepableOwn`). Before, the changed layers were dropped and made again, and BMW's own cluster showed through for a moment. Where a layer still has to go, the curtain covers it.

## Fail-safe

Every layer of the theme plays a cluster-render animation: it holds its scale for 1.2 s and then shrinks to nothing. The engine (shared/hud.js `_failsafe`) starts it over every 200 ms, with the same animation number, so the service replaces it. If Zeiger hangs, the renewals stop and cluster-render takes the theme away on its own clock, so BMW's own cluster shows.

While the car moves, if the speed signal is over a second old, the theme hides at once and comes back half a second after the speed returns. Only the speed is checked, because a hybrid's rpm stays at 0, unchanged, while it drives on electricity. The log notes the longest gap between renewals once a minute when it is over 400 ms.

The bench shows both (bench/README.md): the hang button (`POST /hang`) and `stall: ["speed"]` in manual signals.

## Start animation

`shared/hud.js` plays a theme's start animation ("intro") once per run of the app: when the car starts, or when the theme is first picked. The animations are written to `hud/intros/<layout>.json` by `cluster-design/intro/make_intros.js`, which also describes each theme's scenario.

- **Not while moving:** it doesn't play while the car moves faster than 3 km/h, and it ends at once when the car moves off. The bench's demo drive plays it anyway.
- **Timing:** it holds its first frame until cluster-render says every layer of the theme is shown on the display (its `layer` events), then starts 0.3 s later (the photo themes too, since 0.25.1): big pictures take seconds through the renderer's upload budget, and at power-on BMW holds the display a while first. If some layers aren't shown 15 s after the layout was made, it plays anyway; if none are, it's dropped. The log says how long it waited (`start animation: ...`).
- **Values:** keyframes for rpm, speed, fuel, oil, coolant, boost, braking or ECON, straight between keys. `live` is the car's own value; `shift` and `shift-250` are relative to the shift point.
- **Texts:** a text per step, for typed-out lines and counters. `test` shows the widget's self-test string.
- **Self-test:** for a stretch it can be on too (`"test"` ms).
- **Layers:** a layer's opacity can follow a curve (`fade`), and the renderer can slide a layer into place (`move`).
- **Apex Sport (0.30.0):** the same rev band sweep as Apex. It used to step through the shift flash's stages, and on the car that flashed too hard.
- **Dark Moon, Mist, Underpass:** since 0.25.1 only a soft fade up out of black: the picture over 1.4 s, eased in and out, the readouts 0.3 s after it. The picture no longer slides in (on the car the slide looked like shaking).
- **Black underlay:** the photo themes get a black underlay (an effect layer, no pixel memory), so a fading picture never shows BMW's own cluster through it. An intro's `"underlay"` can be a rect, for a theme that leaves BMW's own strip showing.
- **Warnings:** no warning flashes during the animation, as its values are made up.
- **Cluster-render features:** the opacity and moves use cluster-render layer opacity and animations. Seen on the bench, not yet on a car. Where the car ignores them, the values and texts still play.
- **The setting:** **Start animation** turns it off, and with it the 2.5 s self-test of themes without an animation.

## The page

`page.js`, Zeiger's own page on the centre screen (since 0.24.0, written new; the design is `cluster-design/app_ui/mock.html` next to this repo). Two tabs in the header (since 0.26.0 without the kit's **All settings** list: everything is on the page):

- **Themes:** a gallery. The theme looked at is big in the middle, with its neighbours beside it and a dot per theme under it. A tap left or right of the big card, a finger swiped sideways (the kit's `ctx.onSwipe`, a Zeiger addition) or the iDrive controller go through them; the arrows at the screen's edges only show the way. Since 0.30.0 those taps don't light up (the kit's quiet targets), and **a tap on the big card puts that theme on the cluster**: the card lights up in orange with ON THE CLUSTER for a moment. The big pictures of the last 4 themes looked at are kept, and the neighbours' are sent ahead, so swiping no longer waits for a 2 MB picture. **BMW's own cluster** is not a card but a switch in the bottom right corner: on, BMW's own cluster shows (for the drive mode being set, while the theme changes with it); off, the theme from before comes back. Looking changes nothing on the cluster: **Use this theme** (or **Use for COMFORT / SPORT / ECO PRO**) does. Under it, **Change with the drive mode**, and with it on, the theme of each drive mode: tap one to give it another theme. The car's drive mode now is marked NOW.
- **About (0.31.0):** the credits, and on the right the author's card: a photo (`hud/pictures/author_photo.json`, baked by `cluster-design/author/bake.html`) and the Instagram, @vucko.adv / instagram.com/vucko.adv.
- **Settings:** groups on the left, each with what it is set to now; the open group's rows on the right, a switch or `- value +`. The groups:
  - **Cluster:** start animation, today's weather, the phone's map in Map Mist, theme position (px to the right, 0 by default since 0.30.1; Vintage Green and Cyan carry their own -12 in the layout, `"shiftX"`, so at 0 every theme sits where it should). **Night colours** left in 0.31.1: every Zeiger theme's face is a picture (`"noNightDim"`), so it changed nothing.
  - **BMW's cluster:** hide BMW's black boxes (test), leave BMW's bottom strip clear (the theme cut above it, not squeezed, since 0.32.0).
  - **Warnings:** oil and coolant temperature and boost; over its limit, the value flashes red on the cluster.
  - **Rev range:** engine (petrol or diesel), where the red and the yellow zones start, the shift point before the red, shift flash, cold-engine rev guard.

## Rev range: petrol, diesel, yellow and red (0.27.0)

- **Engine** (Settings, Rev range): **Petrol**, BMW's: the scale to 8000, yellow from 6000, red from 6500; **Diesel**: the scale to 6000, yellow from 4500, red from 5000. **Red zone from** and **Yellow zone from** set them by hand (Auto: the engine's; yellow Auto is 500 under the red). The red zone's start is also the "redline" everything else uses (the shift point is "Shift point" before it, the Engine widget, Apex Sport's flash).
- **The bars:** every rpm bar is drawn in the zones the settings say, whatever its picture has: a segment in another zone than its picture's is recoloured (shared/hud.js `_updateZone`; the yellow and red are the picture's own where it has them). Unlit yellow and red segments show dim (Vintage, Apex) or dark (VFD).
- **Diesel scales:** Vintage Green, Vintage Cyan, VFD, Apex and Apex Sport have a diesel version, `<theme>_diesel` (its scale 0-6, built with `build.html?d=1` in `cluster-design/vintage2`, `vfd`, `apex`), which the app shows in place of the theme with Engine: Diesel. Only the pictures that differ are in the app twice (`cluster-design/dedupe_diesel.js` points the rest at the petrol ones; run it after `watermark.js mark`). The photo themes have no rev scale and look the same for both.

## Cold engine: the zones move (0.27.0)

With **Cold-engine rev guard** on (the default), the rev bars of Vintage Green, Vintage Cyan, VFD, Apex and Apex Sport start their red zone lower while the oil is cold: at 3500 rpm (diesel 3000) with the oil at 30 °C or under, then straight up with the oil temperature (100 rpm steps) back to the red zone's setting at 80 °C. The yellow zone keeps its distance under it. In the zone the bar's segments are drawn red: dim while the rpm is under them, bright red once it reaches them; the bar's own red end keeps its colour. The shift point follows: "Shift point" under the zone's start (3200 rpm cold with the default 300), so the Engine widget's COLD · SHIFT BY and Apex Sport's flash say the same.

- **How:** a segments widget with `"zone": true` (the layouts' rpm bars; the builders in `cluster-design/vintage2`, `vfd` and `apex` set it). shared/hud.js `_updateZone` redraws the segments whose state changed, the picture's own pixels recoloured, so no theme needed new pictures. The zone's start is `ShiftScore.coldRed(oil)` (shared/shift_score.js).
- **VFD** does it its own way: the scale's red end (the red ticks and the red dashed line, from 7000) is no longer on the face but a bar of its own (`red_scale`, `"above": true`, measure `redFrom`) that starts at the zone's start, so the red end moves down while cold. The rpm band's columns in the zone light red as over 7000, and stay dark under the rpm (`"dim": 0`).
- **Not during** the start animation or the self-test (their values are made up).
  - **Units and time:** units (metric: km/h and °C are part of the drawing), clock, time zone, fuel tank size.
  - **Home-screen widget:** Weather, Mist (default), Weather, Sunrise, or The cluster's theme.
  - **About:** demo data, the version and the credits.
- **Pictures:** the gallery's big card uses `hero` (1152x432) from `hud/previews/<layout>.json`, made from the bench captures in `docs/images` by `cluster-design/app_ui/make_hero.js`; the rest `big` and `small`. One big picture is kept in memory at a time.
- **Fonts:** Barlow Semi Condensed (SemiBold `zsb`, Medium `zsm`) and Michroma (`zmi`) in the kit's atlas format (`kit/runtime/fonts/`), baked by `cluster-design/app_ui/bake_fonts.html`.
- **Steppers:** a list of choices (the widget, units, clock, ...) goes round: past the last, the first again. Numbers (redline, limits, position) stop at their ends.
- **Calibration** (BMW's cluster group): Off, Grid or Map frame on the cluster, to measure what BMW hides on your car's cluster; Off puts the themes from before back.

## Black boxes

- **In the middle, with the engine running, on a car that is not a real M:** the cluster is coded to BMW's M layout (often done with BimmerCode on cars with the M Sport or M Performance package). Code it back to the car's own layout (M Sport or M Performance) and restart the head unit; the boxes go away (checked on a G20, November 2026).
- **Just left of the gear letter:** BMW draws it behind its gear display on every car, over any theme. It can't be seen on any of Zeiger's themes (black background there).
- **A small one at the right edge** (about x 1840-1900, y 230-270): seen on a G20 over the Sunrise theme's sky. Zeiger's themes are black or nearly black there.
- **BMW's own bottom strip showing** under a theme doesn't take them away on a G20.

### Sunrise (back in 0.29.0)

`sunrise_hills`. In 0.29.0-0.31.1 it ended above BMW's own bottom strip (`"ownStrip"`), so BMW showed its strip. Since 0.32.0 it covers the whole panel again, as the first Sunrise did (0.8.2, `cluster-design/sunrise/full_sunrise.js`): the hills and trees to the bottom edge, the range and coolant where they were. BMW's strip shows only with **Leave BMW's bottom strip clear** on. Its start animation is the soft fade over the whole panel (`cluster-design/intro/make_intros.js`).

### Leave BMW's bottom strip clear (0.32.0: cut, not squeezed)

With the switch on, BMW's own strip (from y 662) shows under the theme. Up to 0.31.1 every layer was squeezed to 662 / 720 of its height, so the whole theme moved up and got flatter. Since 0.32.0 the theme stays exactly as it is and is only cut at the strip (`STRIP_CUT` in shared/hud.js): every image layer's pixels in the strip are made see-through as they are sent (`_punch`), a fill over it gets the strip as its hole (`_cutLayout`), and a readout that sits mostly in the strip is left out. Turning it on or off rebuilds the layout.

### Leave BMW's gear letter open (0.39.0, on by default)

bimmer-lab found on a car (Cluster Themes 0.17.6-0.17.8, their issue #5) that BMW draws its black gear box over a theme whenever anything covers its gear letter (P R N D) in its bottom strip, and that a layer's rectangle counts even where its pixels are see-through. Zeiger 0.29.0 had only made the pixels see-through (a hole in the fills, the pictures' pixels cut), which changed nothing on the user's car. Since 0.39.0 no layer's rectangle reaches over the letter (x 1380-1460, y 660 down, bimmer-lab's window; `GEAR_LETTER` in shared/hud.js):
- every widget over it is cut in pieces that go round it (`_gearCut`): above it, left and right of it; a fill keeps its colour and hole, a picture's piece shows its part (`crop`, a stretched one's scaled), a compressed one's pieces sample one texture (`u_src`);
- a sheet's box never reaches over it (`_plan`, `_steadySheets`), and the curtain between themes is three pieces;
- on the car BMW's strip shows in that small window, with its gear letter. **Confirmed on the user's G20 (Nov 16 2026): no black box.**

The cut adds a layer or two to the themes with a full-panel background, so the planner now aims at 16 layers a connection (`LAYER_BUDGET`; cluster-render takes 64 a connection since its 0.4.2). Turn it off in Settings, BMW's cluster, Leave BMW's gear letter open.

### When BMW's gear box shows (car test, Nov 15 2026)

On the user's G20 BMW draws its black gear box when a theme starts (the car started, or another theme picked) and takes it away at the first gear change (P to D, or N), on every theme: Sunrise, which leaves BMW's strip open, and themes that cover it alike. Once gone it stays gone until a theme starts again; settings changes don't bring it back. 0.29.0's **Leave BMW's gear letter open** (after bimmer-lab's Cluster Themes 0.17.6, issue #5) made no difference, so 0.29.1 took it out again: on their test car too the box most likely went with the gear change, not with the open strip.

### The gear box, and the slot watch (0.28.0, a test)

BMW's KOMBI draws its gear box (about x 1406-1597, y 342-419) over every theme. With one of the on-board computer's views picked (the song, the consumption, through the stalk's button) it moves the gear down into the bottom line and the box goes. The KOMBI shows the head unit's content in numbered slots (cluster-render's README, "Arbitration": 0x100 the map, 0x203 our panel, 0x103 / 0x105 the guidance box, 0x323 the HUD) and lays itself out round what they show. If such a view is the head unit's content in a slot of its own, cluster-render could hold that slot with an empty scene of ours, as it already does for the guidance box (its "guide hold", `guide_slots`): the KOMBI would lay itself out as for the view, the gear down and no box, with nothing of BMW's to see. If the view is the KOMBI's own drawing, no slot changes and that way is closed.

**Watch BMW's slots** (Settings, BMW's cluster) finds out: while it is on, the app asks cluster-render for its status every second and keeps the changes of the KOMBI's slot table (its `slot 0x...` lines, the last 40). The group then shows only its switch and the watch: on the left every slot now (`0x105 [2] 1000310 shown, 1000314 parked`: the slot, its status, each content in it, shown or parked), on the right the changes, newest first, each slot that changed with what it had before and after (since 0.29.1; 0.29.0 showed only the first four slots and the times). The changes are also in the app's log (`slot table: ...`).

The first car test (0.29.0) saw the table change for three seconds right about when the gear box went at the gear change, in a slot the page didn't show then. The test for 0.29.1: start a theme in P (the box shows), shift to D (it goes), and photograph the watch; the same with the parking brake or Auto Hold for the small box at the right edge. If the box is a content in a slot, an empty scene of ours can hold that slot from the start, as for the guidance box; if no slot changes, the KOMBI draws it itself and it can't be kept away from here.

## Boost

Boost (Apex's and Apex Sport's bar and readout, Vintage Green's and Cyan's TURBO bar) comes from two places:

- **The sport display's signal** (FES `displayBoostPressure`): used while it comes several times a second (two values under 600 ms apart, the last one under 600 ms old).
- **The engine unit** (read-only UDS 0x22, `config.dme.boost`): asked up to 4 times a second whenever the sport display's value doesn't come that often, and then its value wins.

The log says which source is used (`boost from ...`).

## How a theme is made

1. Draw the cluster at 1920x720 (Illustrator, export SVG).
2. A build page turns the drawing into a face picture, segment bars and fonts (`cluster-design/<theme>/build.html` next to this repo).
3. The layout (`hud/layouts/<name>.json`) places the live parts. Widget types are documented in `shared/hud.js`.

Building, the bench and the engine: [docs/DEVELOPING.md](../../docs/DEVELOPING.md).
