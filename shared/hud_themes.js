'use strict';
/**
 * HUD colour themes. Layouts name colour *roles* ("fg", "dim", "arc", ...) and
 * the active theme fills them in, so every layout works in every theme.
 *
 * HUD rule (Nov 7 2026, from road photos: greys were hard to see even at night): the HUD is a projector, so a dim or
 * see-through colour comes out faint on the glass. Every HUD role is opaque and no lit colour is darker than
 * about 70 % brightness; only "track" (the unlit part of a bar) stays partly see-through, at 96..110 of 255.
 *
 * Colours are [r, g, b, a] 0-255. On the HUD, black is see-through glass, so a
 * theme only ever adds light. Dark blue is the weakest colour on a HUD in sun;
 * M's mid blue is kept brighter than the paint-chip M blue for that reason.
 *
 * bar: the shift bar's three zones. lowColor up to midAt, midColor up to the
 * red zone, highColor from there. midAt: 'shift' = where the shift zone starts
 * (redline - 1500), or a fraction of the bar (M climbs light blue -> blue at 50%).
 */
const THEMES = {
    classic: {
        name: 'Classic',
        fg: [243, 246, 250, 255], dim: [200, 208, 220, 255], track: [243, 246, 250, 96], arc: [243, 246, 250, 255],
        glow: 0.35, stripe: false,
        bar: { low: [243, 246, 250], mid: [255, 154, 60], high: [255, 75, 62], midAt: 'shift' },
        rev: { from: [185, 192, 204], to: [243, 246, 250] },
    },
    m: {
        name: 'M',
        fg: [243, 246, 250, 255], dim: [170, 205, 255, 255], track: [80, 150, 255, 110], arc: [79, 180, 255, 255],
        glow: 0.4, stripe: true,
        bar: { low: [79, 180, 255], mid: [51, 102, 255], high: [232, 38, 45], midAt: 0.5 },
        rev: { from: [51, 102, 255], to: [110, 170, 255] },
    },
    night: {
        name: 'Night',
        fg: [255, 179, 71, 255], dim: [235, 165, 70, 255], track: [255, 179, 71, 96], arc: [255, 179, 71, 255],
        glow: 0.3, stripe: false,
        bar: { low: [255, 179, 71], mid: [255, 179, 71], high: [255, 75, 62], midAt: 'shift' },
        rev: { from: [205, 135, 55], to: [255, 179, 71] },
    },
    // Cluster theme (a layout's own "theme"). The cluster is an LCD, not glass: black is solid black there,
    // and it covers BMW's gauges under it. Extra roles: bg (the screen), panel (box inside), line (box
    // frame), head (box header strip), ink (text on a header), accent (a highlighted header).
    // The car brightens dark tints (Nov 5 2026: a navy backdrop came out light steel blue), so until that curve
    // is measured every large area (bg, panel, well) is pure black in all the cluster themes.
    gt3: {
        name: 'GT3',
        fg: [244, 244, 244, 255], dim: [150, 154, 160, 255], track: [255, 255, 255, 26], arc: [244, 244, 244, 255],
        glow: 0, stripe: false,
        bar: { low: [57, 222, 72], mid: [255, 196, 0], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [57, 222, 72], to: [57, 222, 72] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [205, 208, 214, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [255, 196, 0, 255], well: [0, 0, 0, 255], wellLine: [70, 74, 80, 255],
    },
    // Sport (layout sport.json): BMW's Live Cockpit Sport view, blue speed and red revs round the map.
    // Extra roles: sblue / spink (the speed and rpm scale numbers), sred (the rpm caption).
    sportdash: {
        name: 'Sport',
        fg: [244, 247, 252, 255], dim: [150, 170, 205, 255], track: [70, 80, 100, 255], arc: [60, 215, 255, 255],
        glow: 0, stripe: false,
        bar: { low: [60, 215, 255], mid: [60, 215, 255], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [224, 26, 56], to: [224, 26, 56] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [60, 215, 255, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [60, 215, 255, 255], well: [0, 0, 0, 255], faint: [96, 110, 135, 255],
        sblue: [120, 170, 245, 255], spink: [236, 140, 140, 255], sred: [235, 60, 70, 255],
    },
    // M cluster look (layout m.json, after design/photos/ref-m8-cluster.png): black, white numbers with a chrome
    // fade, M red needles and setup bars. Extra roles: redTrack, chrome (bottom of a chrome fade), grey / grey2
    // (the dim gear number's fade), faint.
    mdash: {
        name: 'M',
        fg: [238, 241, 246, 255], dim: [132, 140, 152, 255], track: [104, 110, 120, 255], arc: [226, 36, 44, 255],
        glow: 0, stripe: false,
        bar: { low: [226, 36, 44], mid: [226, 36, 44], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [226, 36, 44], to: [226, 36, 44] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [196, 202, 212, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [226, 36, 44, 255], well: [0, 0, 0, 255], redTrack: [90, 16, 20, 255],
        chrome: [182, 188, 198, 255], grey: [160, 166, 176, 255], grey2: [104, 110, 122, 255], faint: [96, 104, 118, 255],
    },
    // Minimal (layout minimal.json): white on black, nothing but the speed, the gear and a fuel line.
    minimal: {
        name: 'Minimal',
        fg: [240, 243, 248, 255], dim: [128, 134, 146, 255], track: [44, 48, 56, 255], arc: [240, 243, 248, 255],
        glow: 0, stripe: false,
        bar: { low: [240, 243, 248], mid: [240, 243, 248], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [240, 243, 248], to: [240, 243, 248] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [70, 74, 82, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [240, 243, 248, 255], well: [0, 0, 0, 255],
    },
    // Vintage Green (layout vintage_green.json, was Vintage 2): an LCD from 1985, cream on dark green, a gradient rpm
    // wedge, slanted digits over ghost 8s, scanlines; "glow" lights the readouts (Zeiger addition)
    vintage_green: {
        name: 'Vintage Green',
        fg: [232, 240, 191, 255], dim: [120, 140, 100, 255], track: [19, 74, 51, 255], arc: [238, 52, 50, 255],
        glow: 0.6, stripe: false,
        bar: { low: [232, 240, 191], mid: [255, 163, 26], high: [238, 52, 50], midAt: 'shift' },
        rev: { from: [232, 240, 191], to: [232, 240, 191] },
        bg: [1, 1, 1, 255], panel: [19, 74, 51, 255], line: [232, 240, 191, 255], head: [232, 240, 191, 255],
        ink: [1, 1, 1, 255], accent: [238, 52, 50, 255], well: [19, 74, 51, 255],
    },
    // Vintage Amber (layout vintage_amber.json): Vintage Green's layout in the old Vintage 1's colours, amber readouts,
    // green lit segments and labels, dark amber windows (Zeiger addition)
    vintage_amber: {
        name: 'Vintage Amber',
        fg: [255, 176, 32, 255], dim: [140, 100, 30, 255], track: [63, 45, 14, 255], arc: [238, 52, 50, 255],
        glow: 0.6, stripe: false,
        bar: { low: [77, 255, 122], mid: [255, 176, 32], high: [238, 52, 50], midAt: 'shift' },
        rev: { from: [77, 255, 122], to: [77, 255, 122] },
        bg: [1, 1, 1, 255], panel: [63, 45, 14, 255], line: [255, 176, 32, 255], head: [77, 255, 122, 255],
        ink: [1, 1, 1, 255], accent: [238, 52, 50, 255], well: [63, 45, 14, 255],
    },
    // Vintage Green Map (layout vintage_green_map.json, Zeiger): Vintage Green's colours, shown in its place while the phone's map is on
    vintage_green_map: {
        name: 'Vintage Green Map',
        fg: [232, 240, 191, 255], dim: [120, 140, 100, 255], track: [19, 74, 51, 255], arc: [238, 52, 50, 255],
        glow: 0.6, stripe: false,
        bar: { low: [232, 240, 191], mid: [255, 163, 26], high: [238, 52, 50], midAt: 'shift' },
        rev: { from: [232, 240, 191], to: [232, 240, 191] },
        bg: [1, 1, 1, 255], panel: [19, 74, 51, 255], line: [232, 240, 191, 255], head: [232, 240, 191, 255],
        ink: [1, 1, 1, 255], accent: [238, 52, 50, 255], well: [19, 74, 51, 255],
    },
    // Vintage Amber Map (layout vintage_amber_map.json, Zeiger): Vintage Amber's colours, shown in its place while the phone's map is on
    vintage_amber_map: {
        name: 'Vintage Amber Map',
        fg: [255, 176, 32, 255], dim: [140, 100, 30, 255], track: [63, 45, 14, 255], arc: [238, 52, 50, 255],
        glow: 0.6, stripe: false,
        bar: { low: [77, 255, 122], mid: [255, 176, 32], high: [238, 52, 50], midAt: 'shift' },
        rev: { from: [77, 255, 122], to: [77, 255, 122] },
        bg: [1, 1, 1, 255], panel: [63, 45, 14, 255], line: [255, 176, 32, 255], head: [77, 255, 122, 255],
        ink: [1, 1, 1, 255], accent: [238, 52, 50, 255], well: [63, 45, 14, 255],
    },
    // Vintage Cyan (layout vintage_cyan.json, Zeiger): Vintage's LCD in cyan fluorescent readouts on dark teal windows,
    // with its own layout (a dot-matrix rpm band, the TURBO and ECON bars beside the speed, three dot-matrix strips)
    vintage_cyan: {
        name: 'Vintage Cyan',
        fg: [79, 247, 230, 255], dim: [40, 130, 125, 255], track: [11, 48, 47, 255], arc: [255, 74, 58, 255],
        glow: 0.6, stripe: false,
        bar: { low: [79, 247, 230], mid: [255, 207, 58], high: [255, 74, 58], midAt: 'shift' },
        rev: { from: [79, 247, 230], to: [79, 247, 230] },
        bg: [1, 1, 1, 255], panel: [11, 48, 47, 255], line: [79, 247, 230, 255], head: [79, 247, 230, 255],
        ink: [1, 1, 1, 255], accent: [255, 74, 58, 255], well: [11, 48, 47, 255],
    },
    // VFD (layout vfd.json, Zeiger): a fluorescent display, pale mint phosphor on black, teal filter windows along the
    // bottom; "win" the windows' yellow-green readouts, "lamp" the drive mode's green. The bloom is drawn into the fonts
    // and pictures (cluster-design/vfd/build.html), so "glow" stays 0
    vfd: {
        name: 'VFD',
        fg: [217, 251, 227, 255], dim: [191, 230, 205, 255], track: [20, 106, 115, 255], arc: [255, 74, 58, 255],
        glow: 0, stripe: false,
        bar: { low: [217, 251, 227], mid: [255, 122, 34], high: [255, 74, 58], midAt: 'shift' },
        rev: { from: [217, 251, 227], to: [217, 251, 227] },
        bg: [1, 1, 1, 255], panel: [18, 98, 107, 255], line: [217, 251, 227, 255], head: [230, 247, 164, 255],
        ink: [1, 1, 1, 255], accent: [255, 122, 34, 255], well: [12, 69, 76, 255],
        win: [230, 247, 164, 255], lamp: [76, 240, 111, 255],
    },
    // Apex (layout apex.json, Zeiger): a racing cluster, white readouts, the gear orange; "off" is the unlit selector
    // letters' grey. The glows are drawn into the fonts (cluster-design/apex/build.html), so "glow" stays 0
    apex: {
        name: 'Apex',
        fg: [242, 244, 247, 255], dim: [138, 144, 153, 255], track: [22, 24, 28, 255], arc: [255, 59, 48, 255],
        glow: 0, stripe: false,
        bar: { low: [242, 244, 247], mid: [255, 159, 28], high: [255, 59, 48], midAt: 'shift' },
        rev: { from: [174, 180, 189], to: [236, 239, 243] },
        bg: [0, 0, 0, 255], panel: [22, 24, 28, 255], line: [242, 244, 247, 255], head: [138, 144, 153, 255],
        ink: [0, 0, 0, 255], accent: [255, 159, 28, 255], well: [22, 24, 28, 255], off: [74, 79, 87, 255],
    },
    // Apex Sport (layout apex_sport.json, Zeiger): Apex for SPORT, a red glow behind the middle, the band and the gear yellow
    apex_sport: {
        name: 'Apex Sport',
        fg: [242, 244, 247, 255], dim: [138, 144, 153, 255], track: [27, 13, 13, 255], arc: [255, 42, 31, 255],
        glow: 0, stripe: false,
        bar: { low: [255, 236, 60], mid: [255, 138, 0], high: [255, 42, 31], midAt: 'shift' },
        rev: { from: [240, 196, 0], to: [255, 236, 60] },
        bg: [0, 0, 0, 255], panel: [27, 13, 13, 255], line: [255, 42, 31, 255], head: [138, 144, 153, 255],
        ink: [0, 0, 0, 255], accent: [255, 210, 26, 255], well: [27, 13, 13, 255], off: [74, 79, 87, 255],
    },
    // Map (layout map.json): the phone's map in a window in the middle, white readouts round it on black (Zeiger addition)
    map: {
        name: 'Map',
        fg: [255, 255, 255, 255], dim: [175, 185, 200, 255], track: [60, 70, 85, 255], arc: [255, 59, 59, 255],
        glow: 0, stripe: false,
        bar: { low: [255, 255, 255], mid: [255, 154, 60], high: [255, 59, 59], midAt: 'shift' },
        rev: { from: [127, 212, 255], to: [255, 255, 255] },
        bg: [1, 1, 1, 255], panel: [12, 16, 24, 255], line: [255, 255, 255, 255], head: [175, 185, 200, 255],
        ink: [1, 1, 1, 255], accent: [255, 59, 59, 255], well: [12, 16, 24, 255],
    },
    // Dark Moon (layout dark_moon.json, Zeiger): white readouts over a sunrise seen from orbit, the second line a cool grey
    dark_moon: {
        name: 'Dark Moon',
        fg: [255, 255, 255, 255], dim: [196, 208, 220, 255], track: [60, 70, 85, 255], arc: [255, 59, 59, 255],
        glow: 0, stripe: false,
        bar: { low: [255, 255, 255], mid: [255, 154, 60], high: [255, 59, 59], midAt: 'shift' },
        rev: { from: [127, 212, 255], to: [255, 255, 255] },
        bg: [1, 1, 1, 255], panel: [12, 16, 24, 255], line: [255, 255, 255, 255], head: [196, 208, 220, 255],
        ink: [1, 1, 1, 255], accent: [255, 59, 59, 255], well: [12, 16, 24, 255],
    },
    // Underpass (layout underpass.json, Zeiger): Dark Moon's readouts over a photo, the second line a warm grey
    underpass: {
        name: 'Underpass',
        fg: [255, 255, 255, 255], dim: [216, 208, 198, 255], track: [60, 70, 85, 255], arc: [255, 59, 59, 255],
        glow: 0, stripe: false,
        bar: { low: [255, 255, 255], mid: [255, 154, 60], high: [255, 59, 59], midAt: 'shift' },
        rev: { from: [127, 212, 255], to: [255, 255, 255] },
        bg: [1, 1, 1, 255], panel: [12, 16, 24, 255], line: [255, 255, 255, 255], head: [216, 208, 198, 255],
        ink: [1, 1, 1, 255], accent: [255, 59, 59, 255], well: [12, 16, 24, 255],
    },
    // Mist (layout mist.json, Zeiger): Dark Moon's readouts over a photo, the second line a cool grey
    mist: {
        name: 'Mist',
        fg: [255, 255, 255, 255], dim: [200, 208, 216, 255], track: [60, 70, 85, 255], arc: [255, 59, 59, 255],
        glow: 0, stripe: false,
        bar: { low: [255, 255, 255], mid: [255, 154, 60], high: [255, 59, 59], midAt: 'shift' },
        rev: { from: [127, 212, 255], to: [255, 255, 255] },
        bg: [1, 1, 1, 255], panel: [12, 16, 24, 255], line: [255, 255, 255, 255], head: [200, 208, 216, 255],
        ink: [1, 1, 1, 255], accent: [255, 59, 59, 255], well: [12, 16, 24, 255],
    },
    // Map Underpass (layout map_underpass.json, Zeiger): Map's readouts round the phone's map over Underpass's photo, Underpass's colours
    map_underpass: {
        name: 'Map Underpass',
        fg: [255, 255, 255, 255], dim: [216, 208, 198, 255], track: [60, 70, 85, 255], arc: [255, 59, 59, 255],
        glow: 0, stripe: false,
        bar: { low: [255, 255, 255], mid: [255, 154, 60], high: [255, 59, 59], midAt: 'shift' },
        rev: { from: [127, 212, 255], to: [255, 255, 255] },
        bg: [1, 1, 1, 255], panel: [12, 16, 24, 255], line: [255, 255, 255, 255], head: [216, 208, 198, 255],
        ink: [1, 1, 1, 255], accent: [255, 59, 59, 255], well: [12, 16, 24, 255],
    },
    // Map Mist (layout map_mist.json, Zeiger): Map's readouts round the phone's map over Mist's photo, Mist's colours
    map_mist: {
        name: 'Map Mist',
        fg: [255, 255, 255, 255], dim: [200, 208, 216, 255], track: [60, 70, 85, 255], arc: [255, 59, 59, 255],
        glow: 0, stripe: false,
        bar: { low: [255, 255, 255], mid: [255, 154, 60], high: [255, 59, 59], midAt: 'shift' },
        rev: { from: [127, 212, 255], to: [255, 255, 255] },
        bg: [1, 1, 1, 255], panel: [12, 16, 24, 255], line: [255, 255, 255, 255], head: [200, 208, 216, 255],
        ink: [1, 1, 1, 255], accent: [255, 59, 59, 255], well: [12, 16, 24, 255],
    },
    // Speed Meter (layout speedmeter.json): a picture of the speed_meter.svg artwork with its own needles; the
    // readouts in its off-white #f2f2f2 (fork addition)
    speedmeter: {
        name: 'Speed Meter',
        fg: [242, 242, 242, 255], dim: [150, 150, 150, 255], track: [52, 52, 52, 255], arc: [230, 30, 30, 255],
        glow: 0, stripe: false,
        bar: { low: [242, 242, 242], mid: [255, 170, 40], high: [230, 30, 30], midAt: 'shift' },
        rev: { from: [242, 242, 242], to: [242, 242, 242] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [200, 200, 200, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [230, 30, 30, 255], well: [0, 0, 0, 255],
    },
    // Roadster (layout roadster.json): two classic round dials, ivory numbers, a chrome ring, an orange needle.
    roadster: {
        name: 'Roadster',
        fg: [246, 238, 222, 255], dim: [150, 146, 138, 255], track: [52, 50, 48, 255], arc: [255, 120, 40, 255],
        glow: 0, stripe: false,
        bar: { low: [246, 238, 222], mid: [255, 170, 60], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [246, 238, 222], to: [246, 238, 222] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [222, 226, 232, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [255, 120, 40, 255], well: [0, 0, 0, 255],
        chrome: [222, 226, 232, 255], chrome2: [96, 100, 108, 255], needle: [255, 96, 32, 255], face: [6, 6, 8, 255],
    },
    // Track (layout track.json): the race-dash frame of GT3 with amber headers, tyres and temps round a big gear.
    track: {
        name: 'Track',
        fg: [244, 244, 244, 255], dim: [150, 154, 160, 255], track: [255, 255, 255, 30], arc: [244, 244, 244, 255],
        glow: 0, stripe: false,
        bar: { low: [57, 222, 72], mid: [255, 196, 0], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [57, 222, 72], to: [57, 222, 72] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [205, 208, 214, 255], head: [255, 176, 0, 255],
        ink: [12, 12, 14, 255], accent: [226, 228, 232, 255], well: [0, 0, 0, 255],
    },
    // Drag (layout drag.json): a full-width shift bar, the 0-60 timer, green for go.
    drag: {
        name: 'Drag',
        fg: [244, 246, 250, 255], dim: [140, 148, 160, 255], track: [255, 255, 255, 30], arc: [80, 230, 110, 255],
        glow: 0, stripe: false,
        bar: { low: [80, 230, 110], mid: [255, 205, 0], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [80, 230, 110], to: [80, 230, 110] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [190, 196, 206, 255], head: [226, 228, 232, 255],
        ink: [12, 12, 14, 255], accent: [80, 230, 110, 255], well: [0, 0, 0, 255], go: [80, 230, 110, 255],
    },
    // Rally (layout rally.json): a sweeping rev arc over a huge gear, a G-meter, rally yellow.
    rally: {
        name: 'Rally',
        fg: [246, 246, 246, 255], dim: [160, 164, 170, 255], track: [255, 255, 255, 34], arc: [255, 210, 0, 255],
        glow: 0, stripe: false,
        bar: { low: [246, 246, 246], mid: [255, 210, 0], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [246, 246, 246], to: [255, 210, 0] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [205, 208, 214, 255], head: [255, 210, 0, 255],
        ink: [12, 12, 14, 255], accent: [255, 210, 0, 255], well: [0, 0, 0, 255],
    },
    // Retro (layouts retro80s.json, HUD retro.json): an 80s digital dash, amber seven-segment digits over their
    // unlit 8s, green-amber-red bar graphs. Kept bright enough for the HUD rule above.
    retro: {
        name: 'Retro',
        fg: [255, 178, 36, 255], dim: [226, 156, 40, 255], track: [255, 170, 40, 100], arc: [80, 255, 120, 255],
        glow: 0, stripe: false,
        bar: { low: [80, 255, 120], mid: [255, 178, 36], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [80, 255, 120], to: [255, 178, 36] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [255, 178, 36, 255], head: [80, 255, 120, 255],
        ink: [12, 12, 14, 255], accent: [80, 255, 120, 255], well: [0, 0, 0, 255],
        green: [80, 255, 120, 255], ghost: [255, 170, 40, 40],
    },
    // Cruise (layouts cruise.json): calm and quiet for the highway, soft white and a cool teal, no reds until needed.
    cruise: {
        name: 'Cruise',
        fg: [228, 234, 242, 255], dim: [176, 188, 204, 255], track: [255, 255, 255, 100], arc: [120, 212, 222, 255],
        glow: 0, stripe: false,
        bar: { low: [120, 212, 222], mid: [228, 234, 242], high: [255, 42, 42], midAt: 'shift' },
        rev: { from: [120, 212, 222], to: [120, 212, 222] },
        bg: [0, 0, 0, 255], panel: [0, 0, 0, 255], line: [96, 110, 126, 255], head: [120, 212, 222, 255],
        ink: [12, 12, 14, 255], accent: [120, 212, 222, 255], well: [0, 0, 0, 255],
    },
    // Dyno (layout dyno.json, Nov 8 2026): readout tiles in BMW M's colours: near-black tiles with an M light-blue
    // strip, bars light blue -> dark blue -> red (bar1, bar2, hot), a tile goes M red (warn) over its warning limit
    dyno: {
        name: 'Dyno',
        fg: [242, 245, 250, 255], dim: [150, 164, 184, 255], track: [255, 255, 255, 28], arc: [0, 150, 224, 255],
        glow: 0, stripe: false,
        bar: { low: [0, 150, 224], mid: [40, 92, 200], high: [226, 39, 46], midAt: 'shift' },
        rev: { from: [0, 150, 224], to: [0, 150, 224] },
        bg: [0, 0, 0, 255], panel: [14, 17, 23, 255], line: [46, 56, 72, 255], head: [0, 150, 224, 255],
        ink: [12, 12, 14, 255], accent: [0, 150, 224, 255], well: [0, 0, 0, 255],
        bar1: [0, 150, 224, 255], bar2: [40, 92, 200, 255], warn: [226, 39, 46, 255],
    },
};
// every theme: the shift-point red, used by "hot" (the gear and SHIFT at the shift point, the rev bar past it)
Object.keys(THEMES).forEach((k) => { THEMES[k].hot = [255, 42, 42, 255]; });

// Redline layout (after cauliflowermossgrape's Redline app): rev bar segments ramp rev.from -> rev.to up to
// the shift point; the shift lights run green -> yellow -> red in every theme; grade badges by verdict.
const LIGHTS = { green: [47, 210, 122], yellow: [255, 194, 26], red: [255, 42, 42], blue: [40, 110, 255] };
const VERDICT = {
    'SPOT ON': [47, 210, 122, 255], EARLY: [255, 194, 26, 255], LATE: [255, 138, 26, 255],
    LIMITER: [255, 42, 42, 255], 'COLD REV': [61, 139, 255, 255], COLD: [61, 139, 255, 255],
};

// The M tricolour stripe: light blue, dark blue, red (brightened for the HUD).
const M_STRIPE = [[79, 180, 255, 255], [47, 91, 216, 255], [232, 38, 45, 255]];

/** A colour from a role name ("fg") or a literal [r,g,b,a]. */
function color(theme, c) {
    if (Array.isArray(c)) return c;
    return theme[c] || theme.fg;
}

module.exports = { THEMES, M_STRIPE, LIGHTS, VERDICT, color };
