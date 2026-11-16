# Changes

Newest first. Dates are when the build was pushed.

## Nov 16 2026

- **Zeiger 0.46.0:** a test toward showing the cruise control and the speed limit on the themes. Settings, About, **Look for cruise and speed limit** lists what the car offers apps about them: every interface and field in the head unit's SOME/IP catalog whose name says cruise control (cruise, tempomat, FGR, ACC, DCC, limiter) or a speed limit (SLI, SLA, VZE, traffic sign, KAFAS), and the driver-assistance and guidance interfaces, in two columns on the page (a tap for the next page). Nothing is read from the car yet and nothing on the cluster changes; the next build reads the fields found.

- **Sound Test removed** from this source and the Store: on the car the app found no way to play sound (the app has no access to the audio devices, and the head unit has no player or PulseAudio it may use). Parked for now.

- **Zeiger 0.45.0:** **Ember can be customised (beta).** CUSTOMISE on Ember picks the font of its big readouts (Classic, Clean, Retro or Motor: Barlow, Inter Tight, Jost, Saira Condensed) and puts BMW's M badge under the car; the photo is framed so the car sits in the middle, under the speed and over the badge, and the gear letter with its number is centred over the drive mode, with the same preview and Apply as Apex. A change no longer shows the black curtain: when a setting makes a theme drop layers, the old picture now stays until the new one shows, as between themes. **Zeiger is in beta:** a BETA mark in the page's header, and About and the install text say so. Checked on the bench (every font and the badge, 2.3-2.6 MiB, no curtain, nothing over BMW's gear letter); the page in the emulator; not yet on a car.

- **Zeiger 0.44.0:** **the gallery in groups:** Vintage (Vintage Green, Vintage Cyan, VFD), Sport (Apex, Apex Sport) and Photo (Map Mist, Dark Moon, Underpass, Sunrise, Mist, Peaks, Ember), ready for more themes of each kind. Under the big card a chip per group with a dot per theme; a tap goes to that group, and swiping runs on from one group into the next. **About** now says what Zeiger is (a hobby project by an enthusiast, for nicer drives and the custom-app community), and **the text shown when the app is installed** starts with what is new in that version (app.json `whatsNew`, written for every release; the kit's build.py puts it before `description`). Checked in the emulator; not yet on a car.

- **Zeiger 0.43.0:** **Peaks by day and by night.** Its photo was darkened so the readouts stand out, which suits the night but looked a little dim in daylight. Now it has a day picture, a little brighter, and the night one as before; it changes by itself at sunrise and sunset (worked out from the time zone setting), keeping the old picture up until the new one shows, so there is no black. Layouts can do the same with the toggle `@night`. Checked on the bench (both pictures, the change both ways without the curtain, 2.3 MiB); not yet on a car.

- **Zeiger 0.42.0:** **new theme: Ember**, an old BMW at night in a field with its cabin glowing red; the speed, a hairline rev line that turns amber and red, the gear and drive mode, range, clock and outside temperature in a warm white above the car. It fades in at the start like the other photo themes and takes 2.3 MiB, so it changes to and from the others without black. **Customise** no longer shows the pick's name over a part as it changes. Checked on the bench; not yet on a car.

- **Zeiger 0.41.0:** **Customise with a preview.** CUSTOMISE on Apex or Apex Sport opens the theme across the centre screen and every part you can change is live: swipe the left block or the big number up and down, the clock / M badge sideways, or tap a part or its small arrows; the new pick fades in. They change only the preview; **Apply** puts them all on the cluster at once. Reset goes back, Back leaves without applying. A pick no longer redraws the whole cluster: since 0.39.0 the pieces round BMW's gear letter had made Apex drop six layers (and show the curtain) at every pick; now it keeps them all and sends only what changed. Checked in the emulator (the preview follows the picks, Apply saves them) and on the bench (picks keep every layer); not yet on a car.

- **Zeiger 0.40.0:** **every photo theme compressed** (Dark Moon, Mist, Underpass, Map Mist and Sunrise's hills, as Peaks since 0.38.0): each takes 2.3-3.1 MiB of the renderer's memory instead of 6-12.4, so changing between any two themes but Apex and Apex Sport now keeps the old one up until the new one shows, with no black. **Their bottoms fade softly to black**, so the photo meets BMW's black strip and the small window over its gear letter without a hard edge. Checked on the bench (every photo theme, the switches, nothing over the gear letter); not yet on a car.
  - **0.39.0 on the car (G20, Nov 16 2026): BMW's black gear box is gone.** Leaving its gear letter uncovered by every layer's rectangle works.

- **Zeiger 0.39.0:** **BMW's black gear box, again.** bimmer-lab found on a car that BMW draws it whenever anything covers its gear letter (P R N D) in the bottom strip, and that a layer counts by its rectangle, not its pixels; our 0.29.0 test had only made the pixels see-through. Now no part of any theme reaches over the letter: backgrounds, photos and the curtain are cut in pieces that go round it, and BMW's strip shows with its letter in that small spot. On by default (Settings, BMW's cluster, Leave BMW's gear letter open). Checked on the bench: no layer of any theme over the letter, the pieces join without a seam, memory as before. Not yet on a car.

- **Sound Test 0.1.0** (new app, a test): can an app play sound through the car's speakers? It shows what the head unit has for sound (cards, devices the app may open, players, PulseAudio, ALSA's PCM names) and plays a short, quiet tone or a made-up engine sweep through aplay (to a device you pick), paplay or GStreamer, telling how each ended. The first step toward an engine sound app; it changes nothing on the head unit. Checked in the emulator (the page, a probe and a failed play on Windows); not yet on a car.

- **Zeiger 0.38.2:** a test pattern for the home-screen widget (Settings, Home-screen widget, Shows: Test pattern), to see on the car how sharp the HMI shows the widget's picture: stripes 1, 2 and 3 px wide of the 1152 x 768 picture sent since 0.30.0 (A, B, C, upright and lying), text at three sizes, and a 1 px frame round the part the HMI keeps. Stripes the HMI can't show turn to an even grey: if only C keeps its stripes, the HMI shows the picture at about 384 x 256 whatever size it gets, and the widgets must be drawn for that.

- **Zeiger 0.38.1:** fixes from a check of the whole app (every theme and the diesel versions on the bench, every page in the emulator, the home-screen widget, and a code review of 0.35-0.38).
  - **The black curtain between themes (0.37.0) most likely never showed on the car:** its shader used `u_p`, a name the renderer keeps for itself, so the car refused it (the bench's WebGL took it). Renamed; the bench now refuses such shaders as the car does.
  - **Holding the old theme:** its fail-safe stopped being renewed, so it would have vanished after 1.2 s if the new theme took longer to come; now it stays until the new one shows.
  - **A renderer that refuses layers or pictures:** the fail-safe no longer switches off for it, no curtain or messages are sent to a layer that was never made, a compressed picture refused for room makes the theme again, and a refused one is let go.
  - **The page:** Customise's left-block names are shorter ("Boost, brake", "Oil, water", ...) and the value steps its font down before it is cut short ("Boost and br..." before); the theme card's name sits on a darker strip (the picture's own bottom readouts showed through); Sunrise named under Today's weather; the credits say cluster-render client.
  - **Bench:** the renderer's current limits (64 layers a connection, 96 in all, since cluster-render 0.4.2).

- **Zeiger 0.38.0:** Peaks' photo goes to the cluster compressed (ETC2): the theme takes 2.3 MiB of the renderer's 16 MiB instead of 11.5, and a quarter of the upload, so it now changes to and from other themes without the black curtain. The look is nearly the same (46 dB; ridges and sky checked side by side). If the renderer can't take compressed pictures, the app sends it uncompressed as before. Checked on the bench (Peaks, its strip cut, theme position, start animation, the switches, the fallback); not yet on a car. The pixel watermark doesn't survive compression; Peaks' picture keeps its author fields.

## Nov 15 2026

- **Zeiger 0.37.0:** smoother changes.
  - **Changing themes:** the old theme stays on the cluster until the new one is there, when the two fit in the renderer's memory together (Apex, Apex Sport, Vintage, VFD, Sunrise with each other). The photo themes (Peaks, Dark Moon, Mist, Underpass) still change under the black curtain, which now has a thin loading line in the middle.
  - **Customise:** a pick no longer flashes BMW's own cluster: the theme keeps its layers and only the part that changed is sent again.
  - **Apex Sport:** its shift flash was a 9th layer on its first connection (never drawn on the car, and the curtain always waited its full 4 s); it has a connection of its own now.
  - **BMW's black boxes:** the see-through layer that holds BMW's guidance-box slot was a 9th layer on Apex's second connection; it is on the curtain's connection now. Whether that keeps the gear box away is not known yet.
  - **The page:** a swipe slides the next theme in from that side and fades it up; the neighbours' pictures are sent ahead sooner.
  - **Checked:** the bench (holding Apex and Sunrise, the curtain for Peaks, the fallback when the renderer refuses, Customise picks keeping every layer) and the emulator (the slide). Not yet on a car.

- **Zeiger 0.36.0:** Apex's and Apex Sport's left block is now one pick, **Left block** (CUSTOMISE on their card), in pairs: boost and braking, oil and water, intake air and boost, accelerating and braking g, torque and power. Or the **tyres**: a car from above with each tyre's pressure beside its wheel; a tyre under the new **Warnings, Tyre pressure** setting (2.0 bar by default) turns orange. Checked on the bench (the tyres with a low pair, the g pair, at 8 layers); not yet on a car.

- **Zeiger 0.35.0:** Apex's and Apex Sport's two bars can be customised (CUSTOMISE on their card): **Upper bar** and **Lower bar** each show boost, braking, oil, coolant, intake air, torque %, power %, or nothing. Their labels are now text, so they change with the pick. Checked on the bench (oil on the upper bar, the lower one empty, the M badge); not yet on a car.

- **Zeiger 0.34.0:** Apex and Apex Sport can be customised.
  - A **CUSTOMISE** button on their gallery card opens a list of places. **Bottom middle:** clock, BMW's M badge, or empty. **Big number:** speed, rpm, or empty. Each theme keeps its own picks.
  - **Checked:** the list in the emulator; Apex Sport with the M badge and the rpm on the bench. Not yet on a car.

- **Zeiger 0.33.1:** **Peaks** on its other photo: sunlit ridges under a deep blue sky, darkened a little toward the top, the readouts in white and a soft grey (it was a peak against a pale evening sky in a dark ink). Checked on the bench.

- **Zeiger 0.33.0:** a new theme, **Peaks**.
  - A minimal theme on a photo of a peak at dusk: the speed with a hairline rev line under it, the gear and drive mode on the left, range, clock and outside temperature on the right, in a warm dark ink on the light sky.
  - The rev line's yellow and red zones show faintly ahead of the rpm and move with the cold-engine guard (the new segments option `"zoneFaint"`).
  - **Checked:** on the bench; not yet on a car. The app grows by about 3 MB (the photo).

- **Zeiger 0.32.0:** Sunrise over the whole panel, and **Leave BMW's bottom strip clear** cuts the theme instead of squeezing it.
  - **Sunrise** covers the whole panel again, as the first Sunrise did: the hills and trees to the bottom edge, no black band, the range and coolant where they were. BMW's strip shows only with the switch on. New gallery picture.
  - **Leave BMW's bottom strip clear:** the theme stays exactly as it is and is only cut at the strip (from y 662): image pixels there are see-through, a fill gets the strip as its hole, and a readout that sits mostly in the strip is left out. It used to squeeze every layer to 662 / 720 of its height.
  - **Checked:** on the bench (Sunrise and Vintage Green with the switch on and off); not yet on a car.

- **Zeiger 0.31.1:** the **Night colours** setting is gone. It dimmed only what the app draws itself (text, bars) after sunset, and every Zeiger theme's face is a picture, so all of them were marked to skip it (`"noNightDim"`) and it changed nothing. The car dims the cluster at night itself.

- **Zeiger 0.31.0:** the author in About and on GitHub.
  - **About** (Settings) shows the author's card beside the credits: vucko-adv's photo, @vucko.adv and instagram.com/vucko.adv.
  - **README:** an Author section with the same photo and the Instagram link.

- **Zeiger 0.30.1:** **Theme position** is 0 by default (it was -12, which only suited Vintage).
  - Vintage Green and Vintage Cyan (and their diesel versions) carry their own -12 px in the layout (`"shiftX"`), added to the setting, so at 0 every theme sits where it should.
  - A car that already has -12 saved keeps it: set **Theme position** to 0 once (Settings, Cluster).

- **Zeiger 0.30.0:** a cleaner theme change, the gallery's taps, Apex's zones, and a sharp widget.
  - **Changing themes:** a black curtain covers the cluster while the new theme's layers arrive, then fades, so BMW's own cluster no longer shows in between.
  - **Gallery:** a tap left or right of the big card no longer lights half the page orange. A tap on the big card puts that theme on the cluster, and the card lights up with ON THE CLUSTER. The last 4 big pictures are kept and the neighbours' sent ahead, so swiping waits less.
  - **Apex and Apex Sport:** no orange between 6000 and 6500 any more. The yellow zone is the app's amber, and the track under unlit strips is drawn by the app, so the cold-engine guard's zones show no orange between the reds.
  - **Apex Sport's start animation:** the plain rev band sweep. No theme flashes its shift light or band during a start animation.
  - **Home-screen widget:** drawn 3 times as big (1152 x 768), so its text is sharp on the car.
  - **Checked:** Apex and Apex Sport zones and the curtain on the bench, the gallery in the emulator, the widget pictures rendered; not yet on a car.

- **Zeiger 0.29.1:** **Leave BMW's gear letter open** is gone again, and **Watch BMW's slots** shows more.
  - **Car test of 0.29.0 (G20):** BMW's black gear box shows when a theme starts and goes at the first gear change, on every theme, the gear letter open or not; the switch made no difference.
  - **The slot watch:** while it is on, BMW's cluster group shows only its switch and the watch: every slot now (0.29.0 showed the first four), and each change before with the slot and what it had before and after (0.29.0 showed only the times). The last 40 changes are kept.
  - **Checked:** in the emulator (a made-up slot table, the changes listed right; the group's rows back with the watch off); not yet on a car.

- **Zeiger 0.29.0:** **Leave BMW's gear letter open** (Settings, BMW's cluster; a test, off by default).
  - Every theme leaves BMW's drive mode and gear letter in its bottom strip see-through (x 1150-1470, y 660-720).
  - bimmer-lab found on a test car that BMW then leaves out its black gear box over the theme (their Cluster Themes 0.17.6, issue #5); on their car it went at the next gear change.
  - **Checked:** on the bench (Vintage Green, Mist, Apex Sport: the window open, the rest of the theme as it was); not yet on a car.
  - **Sunrise is back, for a test** (`sunrise_hills`, as it was in 0.21.0): hills at sunrise with today's weather, ending above BMW's own bottom strip, so BMW shows its strip. Its start animation is now the soft fade of Mist and the others (the sky no longer slides).

- **Zeiger 0.28.0:** a test for BMW's gear box.
  - **Watch BMW's slots** (Settings, BMW's cluster): the KOMBI's slot table from cluster-render every second while on, the slots now and the last changes on the page, every change in the log.
  - To find out whether the on-board computer's views (the song, the consumption), with which the KOMBI moves the gear down and drops its box, are the head unit's content in a slot that cluster-render could hold with an empty scene. Nothing on the cluster changes.
  - **Checked:** on the page in the emulator (no cluster-render there); not yet on a car.

- **Zeiger 0.27.0:** the rev range: BMW's yellow and red zones, a diesel version, and zones that move with the oil temperature.
  - **Settings, Rev range:** Engine (Petrol: scale to 8000, yellow from 6000, red from 6500; Diesel: scale to 6000, yellow from 4500, red from 5000), and Red zone from / Yellow zone from to set them by hand. They replace "Redline" (7000).
  - Every rpm bar is coloured by these zones, whatever its picture has.
  - **Diesel:** Vintage Green, Vintage Cyan, VFD, Apex and Apex Sport have a 0-6 scale version, shown with Engine: Diesel (the app grows by about 0.5 MB: only the pictures that differ are in twice).
  - With a cold engine the red zone starts at 3500 rpm (diesel 3000; oil at 30 °C or under) and moves back as the oil warms to 80 °C, the yellow zone with it. In it, segments are dim red under the rpm and bright red once reached.
  - Vintage Green, Vintage Cyan, VFD, Apex and Apex Sport; drawn from each bar's own picture, no new pictures.
  - The cold shift point follows the zone (300 rpm under it by default) instead of the old fixed 4500 at 30 °C.
  - **VFD:** the scale's red end (red ticks and the dashed line, 7000-8000) moves down with the zone instead; the band's columns in the zone light red only once reached. The coolant line C-H is level now (it fell 8 px toward H).
  - **Checked:** on the bench (petrol and diesel, cold and warm, Vintage Green, Apex, VFD); every layout loads with the app's own checks. Not yet on a car.

- **Zeiger 0.26.0:** the page and the widgets after the first look on the car.
  - **Gallery:** a tap on the left or right half of the screen, or a finger swiped sideways, goes through the themes. The round arrows beside the card are gone; plain arrows sit at the screen's edges.
  - **BMW's own cluster** is a quick switch in the bottom right corner, not a card; switched off, the theme from before comes back.
  - **All settings** is gone from the header: everything is on the page. The calibration grid and map frame are a row in BMW's cluster.
  - Lists of choices (the widget, units, clock, ...) go round with - and +; numbers still stop at their ends.
  - **Widgets:** measured on a G20 from photos, the HMI cuts about 8 % / 7.5 % off each side. The Engine and weather widgets keep 14 px inside that, with smaller text; a cold value lights the bar's first segment.
  - The kit: `ctx.onSwipe(fn)` for a sideways swipe on the page (display.js, mgu.js, the emulator's hu-stub.js).
  - **Checked:** in the kit's emulator (taps, swipes, the switch, the steppers going round) and the widgets drawn as the G20 cuts them; not yet on a car.

- **Zeiger 0.25.1:** the start animation of Dark Moon, Mist and Underpass is a soft fade now.
  - The picture fades up out of black over 1.4 s (eased in and out), the readouts 0.3 s after it; 1.8 s in all.
  - The picture no longer slides in from the side (or from below): on the car it looked like the picture shaking.
  - **Checked:** the curves in the files; not yet on a car.

- **Zeiger 0.25.0:** a new home-screen widget, **Engine**, now the default.
  - Oil, coolant and boost, each as a big value and a bar of segments: blue while the engine is cold, green when warm, red over the Warnings limits; boost in orange, with its peak of the last 5 s held.
  - On top, READY, or COLD and the shift point the cold-engine guard asks for.
  - Every widget is brighter (on the car they looked faded).
  - **Checked:** drawn for cold, warm and hot states on the computer; not yet on a car. Where the widget's window sits on a G20 is still to be measured from a photo.

- **Zeiger 0.24.0:** a new page on the centre screen, written from scratch.
  - **Themes:** a gallery. One theme big in the middle, its neighbours beside it, a dot per theme under it. Looking through it changes nothing on the cluster; **Use this theme** (or **Use for COMFORT / SPORT / ECO PRO**) does. Under it, the drive modes and the theme of each.
  - **Settings:** seven groups (Cluster, BMW's cluster, Warnings, Shift point, Units and time, Home-screen widget, About), each showing what it is set to; the open group's rows on the right, with a switch or `- value +` for every setting. The warnings (Alerts before) are a group here now.
  - The whole screen in the kit's full-screen layout, in Barlow Semi Condensed and Michroma, Zeiger orange for what is picked.
  - The kit's settings list stays as **All settings** (its tab now carries the button's own label).
  - bimmer-lab's page (`shared/page.js`, `shared/previews.js`) is gone from the repo.
  - **Checked:** in the kit's emulator, by touch and by the controller; not yet on a car.

- **Zeiger 0.23.1:** every theme's pictures, layouts, start animations and gallery pictures name their author (vucko-adv). Nothing changes on the cluster.

## Nov 14 2026

- **Zeiger 0.23.0:** the start animation waits until the theme is on the cluster.
  - On the car only Vintage's start animation could be seen; VFD's, Apex's, Mist's and Dark Moon's played out before the theme showed.
  - The likely reason: the animation started 0.5 s after the theme was made, while its pictures take seconds to reach the cluster (Apex about 4 MB, a photo theme's picture 5.5 MB), and at power-on BMW holds the display a while first.
  - It now holds its first frame until cluster-render says every layer of the theme is shown, then starts 0.3 s later (photo themes 0.4 s).
  - If some layers still aren't shown after 15 s, it plays anyway; if none are, it's skipped.
  - The log says how long it waited.
  - **Checked:** on the bench, also with layers held back by the bench's layer cap; not yet on a car.

- **Zeiger 0.22.0:** fewer themes, Vintage Green in Vintage Cyan's layout, and fixes from the first drive with 0.20 and 0.21.
  - **Removed:**
    - **Sunrise**: BMW's bottom strip under it didn't take BMW's black boxes away on a G20.
    - **Map** and **Map Underpass**: **Map Mist** is the one theme with the phone's map now.
    - **Vintage Amber**, and Vintage Green's and Amber's versions with the phone's map.
    - A car set to a removed theme shows the nearest one left: Sunrise shows Mist, Map and Map Underpass show Map Mist, Vintage Amber shows Vintage Green.
    - The home-screen widget's **Weather, Sunrise** stays.
  - **Vintage Green:** Vintage Cyan's layout in Green's colours, cream readouts on dark green windows.
    - A dot-matrix rpm band in place of the wedge.
    - TURBO and ECON beside the speed.
    - Three dot-matrix strips along the bottom: outside temperature, range and average speed, clock.
    - The roundel in the theme's colours.
    - The same start animation as Cyan's, TURBO and ECON included.
  - **Boost:**
    - Vintage Cyan's TURBO bar rarely got past half at full throttle, while Apex's boost bar was full of life on the same car.
    - Boost now comes from the sport display only while that value comes several times a second; otherwise the engine unit is asked up to 4 times a second, and its value wins.
    - Before, the engine unit was asked only after 3 s with no sport display value at all, so a value sent now and then could stand for seconds: the likely cause, not yet confirmed on the car.
    - The log says which source is used.
  - **TURBO and ECON labels** (Green and Cyan):
    - Sharp, with no glow round them.
    - The speed window's layer also held the labels' ends, so they were drawn twice; now each face piece holds only its own pixels (`cluster-design/vintage2/build.html`).
    - That also fixes the start animation's TURBO blink, which dimmed only half the word.
  - **Checked:** on the bench, not yet on a car.

- **Zeiger 0.21.0:** a **start animation** for the themes, about 2.5 s, when the car starts.
  - **VFD:** the tube strikes, everything lights, the windows come on left to right, then SYSTEM CHECK and OK.
  - **Vintage:**
    - The rpm sweeps to the end and back, the bars fill one after another, and the speed counts 000 to 888.
    - The message types BMW · SYSTEM CHECK, then ALL OK.
    - Vintage Cyan: TURBO blinks and sweeps, and ECON sweeps green, then red.
  - **Apex:** a rev sweep. Apex Sport's band flashes white, yellow, red.
  - **Dark Moon, Mist, Underpass:** the picture comes up out of black.
  - **Sunrise:** the mountains, then the sky's glow behind them.
  - **When it plays:**
    - Once per theme after the car starts, or when a theme is first picked.
    - Only while the car stands still; it stops at once when the car moves off.
    - The new setting **Start animation** turns it off.
  - **Engine (`shared/hud.js`):** a layout's `intro`, or `hud/intros/<layout>.json` (made by `cluster-design/intro/make_intros.js`):
    - keyframes for values;
    - stepped texts;
    - a self-test stretch;
    - layer opacity curves;
    - renderer slides;
    - a black underlay.
  - **VFD:** a hidden dot-matrix text in its middle window, for SYSTEM CHECK.
  - **Checked:** on the bench, every theme. Layer opacity and slides are not yet tried on a car.
- **Zeiger 0.20.0:** a new theme, **VFD**: a fluorescent display as the late-80s Japanese digital dashes had.
  - **The look:**
    - Pale mint phosphor glowing on black.
    - Dot-matrix fuel and rpm bands; the rpm scale has a red dashed end.
    - A dot block riding along the coolant line from C to H.
    - Big slanted segment digits for the speed.
    - Three teal filter windows: shift position and gear; the clock with the oil and outside temperatures; the range.
    - The drive mode in a green lamp.
    - A 2.5 s self-test at power-on. No roundel, as the dashes it follows had none.
  - **On the cluster:** BMW's gear box falls on black. It takes 4.4 MiB of cluster-render's 16 MiB in 19 layers on 3 connections.
  - **Engine:** a `segments` widget's `"one": true` lights only the last segment reached: a marker riding along a scale. VFD uses it for the coolant block, and for the pump that turns orange under 15 % fuel.
  - Checked on the bench, not yet on a car.
- **Also in 0.20.0:** a third Vintage, **Vintage Cyan**, with a layout of its own.
  - **Colours:** cyan fluorescent readouts on dark teal windows. The roundel is drawn in the theme's colours.
  - **Rpm:** a dot-matrix band with ghost dots, orange from 5200 and red from 6750, over a tick scale with dot-matrix numbers. It replaces the long wedge.
  - **Middle row:** the speed sits 78 px higher. Left of it, an amber **TURBO** lamp over a boost bar (0-1.6 bar, rising segments).
  - **ECON bar,** right of the speed, as on 80s econometers:
    - Green fills to the left while you drive economically; coasting fills it.
    - Red fills to the right under load; full throttle fills it.
    - Its segments grow from the middle toward the ends.
    - It reads the engine's load from its torque. Standing still, it stays empty.
  - **Bottom:** three dot-matrix strips: the outside temperature; the range and average speed (under the speed); the clock.
  - **Size and limits:** 6.7 MiB in 23 layers. BMW's gear box falls on black. There is no map version yet: while the phone's map is on, it stays as it is.
  - **Engine:** measures `econEco` and `econLoad`, the engine load (torquePct) under or over 35 % of its peak torque, each 0..1. The message font (`v2_dots`) gains the degree sign.
  - Checked on the bench, not yet on a car.
- **Zeiger 0.19.0:** **Sunrise** is back: the first Sunrise theme (a sunrise over mountains, today's weather), as its own theme next to Dark Moon.
  - **It ends above BMW's own bottom strip:**
    - Nothing is drawn below y 646 except a black band to 662 (to 658 over the strip's drive mode and gear, x 1196-1424).
    - BMW's strip (gear, drive mode, ranges, time, outside temperature, warning lights) shows below the theme.
    - With the strip showing, BMW is reported to leave out its black boxes. The measures are from eroobeeroo's Cluster Layouts, found on cars by thatgrayg22. This is a test: not yet tried on a G20 with Zeiger.
  - **The other themes are unchanged.**
  - **Engine:**
    - A layout's `"ownStrip": true` says it already ends above BMW's strip; **Leave BMW's bottom strip clear** doesn't squeeze it.
    - A widget's `"fixed": true` stays put when **Theme position** moves the rest.
  - **Theme:** the land fades to black above the band, and the range and coolant groups sit 36 px higher (`cluster-design/sunrise/strip_sunrise.js` rebuilds it from the 0.8.2 files).
- **Zeiger 0.18.1:** Vintage Green and Amber load faster and stay on when the phone's map starts.
  - **Why they went dark:**
    - Vintage's layers took 10.5 MiB of cluster-render's 16 MiB (its map version 12.2). That memory is for every app together, and the phone's map takes another 3.2 MiB.
    - At the switch to the map version the old and new layers counted together for a moment, so layers were refused.
    - Each start sent 5.5-6.4 MB over the link to the cluster, which carries 2-5.5 MB/s for everything, the map's video included.
  - **Vintage's layers:**
    - Each face piece is now in a z group of its own, so the planner no longer packs far-apart pieces into big, mostly empty sheets.
    - They are spread over three connections: 6.5 MiB (map version 7.3) and 3.4 MB sent at a start.
  - **Engine (shared/hud.js):**
    - A rebuild keeps a sheet the new layout has again, pixel for pixel. The switch to the map version keeps the face pieces both versions share, so it sends 2.6 MB instead of 6.4.
    - A layer refused for room has the layout made again 2 s later, at most twice.
    - Only the shown theme's pictures stay decoded. After going through every theme the app used 138 MB instead of 216 MB on the bench.
  - Bench: every theme in turn and back to back with the map on, no refusals. Not yet seen on a car.
- **Zeiger 0.18.0:** the home-screen widget can show the **weather**: the temperature now, the weather in a word, today's high, low and chance of rain, and the next three days.
  - **Two looks:** **Mist** (the Mist theme's photo, the default) and **Sunrise** (the first Sunrise theme's sunrise over mountains, from before Dark Moon). The text uses the cluster themes' own fonts and colours.
  - The new setting **Home-screen widget** picks Weather, Mist, Weather, Sunrise, or the cluster's theme as before.
  - **Weather data:** `shared/weather.js` now fetches 4 days and the weather right now. It fetches while a theme with weather shows or a widget shows the weather. Each asks on its own, so the **Today's weather** setting still only concerns the themes.
  - When the forecast shown is an old one and there's no internet, OFFLINE shows beside the place.
  - Not yet seen on a car.
- **Zeiger 0.17.0:** a **home-screen widget**. Hold a finger on a home-screen tile and pick Zeiger.
  - **Big widget:** the theme the cluster shows now, with its picture and name, and the drive mode when the theme follows it. **Off** when Zeiger isn't drawing.
  - **Small widget:** the same in words.
  - It's BMW's own widget mechanism for apps (StartWidget), which the kit already had, on the Drive Recorder layout checked on a G05. The build makes its resources.
  - Not yet seen on a car.

## Nov 13 2026

- **Zeiger 0.16.1:** Apex Sport's shift flash shader asks for `highp` only where the GPU has it in fragment shaders, else `mediump`. Many embedded GPUs lack it, and a shader that demands it doesn't compile there; cruzen991/Cluster saw that on a car. On a GPU with `highp` nothing changes. Without it, the flash now shows, its edges a little coarser.
- **Zeiger 0.16.0:** a **fail-safe**, after G's Dash's.
  - **If Zeiger hangs:** its theme disappears within about 1.2 s and BMW's own cluster shows. Every layer plays a cluster-render animation that holds its scale and then shrinks it to nothing, and Zeiger renews it every 200 ms.
  - **If the speed signal stops while the car moves:** for over a second, the theme hides at once and comes back half a second after the speed returns.
  - Both were tested on the bench, not yet in the car.
  - Engine: the kit's `car.ageOf()`, and `animate` taking the caller's animation number.
  - Bench: animations, the hang test (`POST /hang`) and `stall` in manual signals.
- **Zeiger 0.15.1:** the same small grey **clock** on **Map**, **Map Underpass** and **Map Mist**, under the map's window between the range and the coolant. Map's small font gains the colon. The clock is on the second connection, so the layouts keep their small sheets.
- **Zeiger 0.15.0:** Dark Moon, Underpass and Mist get a small grey **clock** in the middle of the bottom row, between the range and the coolant. It uses the readouts' own font and follows the **Clock** setting (12 or 24 hours).
- **Zeiger 0.14.0:** Apex and Apex Sport get a **clock**: white, in their racing face, in the middle of the bottom row. Apex Sport gets a **shift flash**:
  - Toward the shift point the whole rev band flashes: white from 500 rpm before it, yellow from 250 before, red at it.
  - The shift point is **Redline (shift light)** less **Shift point before redline**, lower while the engine is cold.
  - The new setting **Shift flash** turns it off.
  - Engine: the `bandflash` effect widget. A flash sends a colour and an on / off, not pixels.
- **Zeiger 0.13.0:** two new themes, **Apex** and **Apex Sport**: a racing cluster.
  - **Rpm:** a 32-block band across the top (up to 1500, level to 6500, down to 8000). It fills in one continuous line through the blocks, white (Sport: yellow), orange from 6000, red from 6500.
  - **Middle:** the speed, with the gear and P R N D M (S in the sport programme) to its right.
  - **Bars:** boost and braking bars to its left.
  - **Bottom row:** coolant and fuel / range.
  - **Apex Sport** adds a red glow over a red tray line and a thicker band. It is meant for SPORT with **Change with SPORT / COMFORT / ECO PRO**.
  - **Engine:**
    - `{{brakeG}}` (braking in g, also a `measure`) and `{{isnt:<token>:<value>[:<other>...]}}`.
    - A layout's glow can be a small stretched picture that is the background too (no `fill` layer).
    - Both themes take about 8-9 MiB of pixel memory.
- **Zeiger 0.12.1:** a soft black fade along the bottom of Dark Moon, Underpass, Mist, Map, Map Underpass and Map Mist (from y 628 down, nearly black in BMW's bottom strip), so the dark backing BMW draws behind its gear letter there (P R N D, always shown) blends in. The readouts above keep their background. The Vintage themes are black there already.
- **Zeiger 0.12.0:** **Vintage Green and Vintage Amber with the phone's map.** While waze-on-cluster streams the phone's map, they change by themselves to a layout with the map:
  - the map in a window (x 656-1296, y 341-600) under a veil in the theme's colours, with scanlines and a vignette;
  - the temperature and clock to its left, under a smaller dot-matrix strip;
  - the speed to its right;
  - between them, a window as tall as the speed's, with the selector's letter over the gear number.

  The plain layout comes back 8 s after the map stops, without the self-test. The setting **Show the phone's map** turns it off. Engine changes (shared/hud.js): a layout's `withMap` names the one to show while the map streams, a full-width fill's map window can follow Theme position (`holeFollowsShift`), and waze.js reports `streaming` on any target. The map stays at waze-on-cluster's own size, so the Map themes are unaffected. 12.2 of the cluster's 16 MiB.
- **Zeiger 0.11.0:** two more themes, **Map Underpass** and **Map Mist**: the Map theme's window onto the phone's map and its readouts (the speed on the left, the selector on the right, range and coolant at the bottom) on Underpass's and Mist's photos, black where BMW's gear box lands. `cluster-design/photo/photo_theme.js` makes them with `map: true`. 11.7 of the cluster's 16 MiB each.
- **Zeiger 0.10.0:** two new themes, **Underpass** and **Mist**: Dark Moon's readouts and weather over a photo (low sun on a tiled wall over a stairway; a misty valley between two dark hills). `cluster-design/photo/photo_theme.js` fits a 1920x720 photo to the cluster: soft scrims behind the readouts (white on them reads at 8:1 or better), black wherever BMW's gear box lands (Mist's right hill raised there), the picture moving with Theme position. 12.3 of the cluster's 16 MiB each.
- **Zeiger 0.9.1:** **Dark Moon**: the speed and the selector line up with the weather. All three columns share one band: the speed's digits, the selector letter and the temperature start on one line (y 245), and km/h, the drive mode and the forecast's last line end on one line (y 413).
- **Zeiger 0.9.0:** a new theme, **Dark Moon**, in place of Sunrise (a saved Sunrise choice opens Dark Moon): a sunrise seen from orbit, drawn in code (`cluster-design/darkmoon/orbit_scene.js`). Black space and stars, the sun coming up behind the top of a dark moon over the Earth's thin blue limb, dark cloud tops below, warm under the sun. The speed sits in the moon's disc right under the sun; the weather on the left and the selector on the right, the range group and the coolant group at the bottom mirror each other about the middle. **Map** has Dark Moon's look: the phone's map in a window in the middle with the sun rising on its top edge, the window cut equally from both sides of the map, the speed on the left, the selector on the right. Both pictures move with **Theme position** like the readouts (shared/hud.js `followsShift`: the picture's own pixels move, so the panel stays covered), and BMW's gear box falls on black space in every theme. Dark Moon uses 12.4 and Map 11.7 of the cluster's 16 MiB.
- **Zeiger 0.8.2:** the **Map** theme shows the phone's map in a window in the middle of a black cluster, at waze-on-cluster's own size (`map_rect` left empty), and the window ends just left of the black box BMW draws behind its gear display (on a G20 about x 1420-1610, y 318-433), so the box falls on black. The map over the whole cluster (`map_rect = 0,0,1920,720`), the **Map size** setting and the dark shades under the readouts are gone. Docs: black boxes in the middle come from a cluster coded to BMW's M layout on a car that isn't a real M; coding it back to M Sport or M Performance removes them.
- **Zeiger 0.8.1:** a new app icon, a dot-matrix Z in Vintage Green's colours (cluster-design/icon/concepts.html).
- **Zeiger 0.8.0:** **Sunrise** now shows in the page's theme gallery (it lists the drive-mode theme choices, which lacked it) and in the drive-mode lists, and shows the drive mode (COMFORT, SPORT, SPORT+, ECO PRO) under the selector. **Vintage 1** is gone; **Vintage 2** is now **Vintage Green**, and **Vintage Amber** is the same layout in Vintage 1's colours (amber readouts, green lit segments and labels, dark amber windows). Their message line shows the range and the average speed this drive instead of the oil temperature (it has its bar); the strip is wider for it. A car set to Vintage 1 or 2 shows Vintage Green. **Theme position** is -12 px by default. For the black boxes BMW draws over the themes with the ignition on: the Settings tab now shows, above the status line, what BMW shows in each display slot and the state of cluster-render's map and guide hold (**BMW slots: ...**), so a photo with the ignition on and one with it off tell which of BMW's panels the boxes are. Engine: `{{modeShort}}`, and the demo drive shows COMFORT as its drive mode.
- **Zeiger 0.7.0:** a fourth theme, **Sunrise**: a sunrise over mountains drawn in code, the speed in the middle, the selector and drive mode on the right, and on the left **today's weather**: an icon for the day, the outside temperature from the car, the day's weather in words and its high / low / chance of rain. The forecast is Open-Meteo's, for where the internet connection is (ipinfo.io, rounded to 0.1°), checked every 30 min and kept for the day. Internet only through the Store's **Internet uplink** (a phone's hotspot, USB tethering or an LTE stick): Zeiger now asks for it (`"internet": true` in app.json, `mguInternet` in the package) and resolves names through the uplink's DNS servers. New setting **Today's weather** (on) turns it off. Engine: `wantsWeather` and the `{{wx...}}` tokens (shared/weather.js).
- **Zeiger 0.6.0:** a third theme, **Map**: the phone's map (waze-on-cluster) over the whole cluster with only the speed, the selector and drive mode, range and coolant over it, on dark shades so they read on a day map too. **Show the phone's map** is now on by default, and the new **Map size** setting says how waze-on-cluster draws it: Full screen (its `map_rect = 0,0,1920,720`) or Centre (1088x480, black round it). Engine: a picture with `stretch` (a small image drawn over a large rect, for gradients) and `toggle` lists.
- **Zeiger 0.5.0:** two themes now, **Vintage 1** and the new **Vintage 2**, an LCD from 1985: a continuous rpm wedge lit cream into orange into red (the red from the scale's red line), slanted seven-segment digits over ghost 8s, P R N D S M with the one in use lit, pixel icons over the oil / water / fuel bars, a dot-matrix message line (oil, range), scanlines, and a 2.5 s self-test at power-on. Vintage, Vintage 3 and Vintage 4 are gone; a car set to one of them shows Vintage 2. New in the engine: a layout's `selfTest` (ms with every segment lit and every text showing its `test` string) and the `{{is:<token>:<value>}}` text token.

## Nov 12 2026

- **Zeiger 0.4.1:** new setting **Theme position (px to the right)**, 6 by default: on a G20 the themes sat about 6 px left of BMW's own cluster. It moves every widget but the full-screen black backdrop, so BMW's cluster never shows at an edge; -20 to 20 px, on the Settings tab.
- **Zeiger 0.4.0:** two more themes after a design review, with Vintage and Vintage 1 kept as they are. **Vintage 3** is Vintage with an orange warning zone (rpm from 5200, the bars' cold and low ends: the old yellow was too close to the cream to stand out) and ghost 8s behind the speed and gear, the unlit segments of an LCD. **Vintage 4** is Vintage 1 with the same, plus dimmer green labels (they no longer pull the eye like readouts), slightly lighter windows, and an orange warning zone apart from the amber readouts. Fixed: a text's `zeros` never padded (a broken pattern); Vintage and Vintage 1 drop it, so they look as they did in the car.
- **Zeiger 0.3.0:** new setting **Hide BMW's black boxes (test)**, on by default. On a G20 the KOMBI drew two solid black boxes over every theme (about x 796-1037 y 267-369 and x 1224-1395 y 300-375), but none over Waze on the map. cluster-render hides the stock CarPlay maneuver box (its guide hold) only while its `map` target is shown, so while a theme is up Zeiger keeps a see-through 16x16 layer on `map`, on a second connection. Not yet tried on the car. **Leave BMW's bottom strip clear** is now on the Settings tab too.
- **Zeiger 0.2.1:** Vintage and Vintage 1 have a black backdrop again. Since 0.1.1 the face is cut into pieces without its black, and BMW's own cluster showed between them; a full-screen `fill` effect layer under the pieces hides it and costs no pixel memory (8 layers, 9.3 MiB).
- **Zeiger 0.2.0:** a second theme, **Vintage 1**: the Vintage artwork in the 80s amber/green LCD colours (amber readouts and scale, green lit segments and labels, dark amber windows, the rpm bar amber from 5200). `cluster-design/vintage/build.html?v=1` builds it.
- **Zeiger 0.1.1:** Vintage fits the car's pixel memory. In the car the speed, gear, clock and outside temperature stayed empty: the face was one 1920x720 picture (10.5 MiB of the 16 MiB every app shares), and the sheet with those readouts was refused. The face is now cut into its 9 drawn pieces, and pictures and segment bars with `"own": false` pack into sheets like text: 7 layers and 9.3 MiB instead of 14.0.
- **Zeiger 0.1.0:** the first build of this fork. Cluster Themes becomes **Zeiger**, with one theme of its own: **Vintage**, an 80s LCD dash in cream on dark green, with a 48-segment rpm bar (yellow from 5200, red past 7000), oil, water and fuel segment bars with centred values, the speed (3 digits), gear, clock and outside temperature (centred with its °C) in Technology Bold and Grand Sport Condensed. The other themes and HUD Widgets are gone. New widget types for themes drawn in a design tool: `picture` (a picture as it is), `needle` (a picture turned about a pivot by a value table) and `segments` (a bar lit segment by segment from a picture of its lit state); text `zeros` pads a value with leading zeros. `bench/server-win.js` runs the bench on Windows.

Older entries are in [bimmer-lab/apps](https://github.com/bimmer-lab/apps), the Cluster Themes that Zeiger is forked from.
