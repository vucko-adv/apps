'use strict';
/**
 * page.js - Zeiger's own page on the centre screen (written new for 0.24.0, Nov 15 2026; the design:
 * cluster-design/app_ui/mock.html ?v=c and ?v=c2 next to this repo).
 *
 * Two tabs in the header:
 *   Themes    a gallery: the theme being looked at big in the middle, its neighbours beside it, under it the groups
 *             (Vintage, Sport, Photo: THEME_GROUPS; a tap goes to the group, a dot per theme in each), and under that
 *             the drive modes (with "Change with the drive mode" on: which theme each one
 *             shows; a tap on one picks it, and "Use for ..." on the big card gives it the theme looked at).
 *             Looking through the gallery changes nothing on the cluster; only "Use" does.
 *   Settings  the groups on the left (each with what it is set to now), the open group's rows on the right: a
 *             switch, or - value + for numbers and choices (every step a tap or a press of the iDrive controller).
 *
 * Drawn on the kit's canvas screen (kit/runtime/display.js), 1600 x 520 logical px (more below when the kit's
 * full-screen layout has room: G.pageBottom), in the fonts baked for it (kit/runtime/fonts/zsb, zsm, zmi: Barlow
 * Semi Condensed and Michroma, cluster-design/app_ui/bake_fonts.html). Every tap target is also a stop for the
 * iDrive controller: the kit moves its focus between them. Plain Node 8 (the car's 8.16.2).
 *
 *   new Page(ctx, hud).start()
 */
const zlib = require('zlib');
const G = require('./kit/gauges');
const rec = require('./kit/record');
const data = require('./hud_data');
const tz = require('./tz');
const probe = require('./probe');

const W = 1600, H = 520, L = 12, R = 1588;          // the part between L and R shows in the full-screen layout too
const B = 'zsb', M = 'zsm', MI = 'zmi';              // fonts: bold, medium, Michroma
const C = {
    bg: '#050608', text: '#ffffff', soft: '#c9ced8', dim: '#9aa3b2', faint: '#ffffff17', glass: '#ffffff0d',
    acc: '#ff6a1f', accSoft: '#ffb08a', ok: '#3ddc84', warn: '#ffb020', panel: '#0b0d11',
};
const A = G.withAlpha;
const MODES = [['inComfort', 'COMFORT', 'comfort'], ['inSport', 'SPORT', 'sport'], ['inEco', 'ECO PRO', 'eco']];
const ABOUT = {
    vintage_green: 'An LCD from 1985 · cream on dark green · turbo and econ',
    vintage_cyan: 'An LCD from 1985 · cyan on dark teal · turbo and econ',
    vfd: 'A late-80s fluorescent display · mint on black',
    apex: 'A racing cluster · rev band, boost and braking',
    apex_sport: 'Apex made for SPORT · red glow and shift flash',
    dark_moon: 'A sunrise seen from orbit · today\'s weather',
    underpass: 'A photo · low sun on a tiled wall · today\'s weather',
    mist: 'A photo · a misty valley · today\'s weather',
    peaks: 'Ridges under a deep blue sky · minimal',
    ember: 'An old BMW at night, its cabin glowing red',
    sunrise_hills: 'Hills at sunrise · today\'s weather',
    map_mist: 'The phone\'s map in the middle of Mist\'s photo',
    off: 'No theme: BMW\'s own cluster shows',
};

/* ---------- the settings, in groups ---------- */
const GROUPS = [
    { name: 'Cluster', about: 'How the themes show on the cluster.', rows: [
        ['startAnim', 'Start animation', 'when a theme first shows, never while moving'],
        ['weather', 'Today\'s weather', 'Dark Moon, Sunrise, Underpass, Mist · needs the internet uplink'],
        ['mapInTheme', 'The phone\'s map in Map Mist', 'through waze-on-cluster'],
        ['shiftX', 'Theme position', 'to the right of BMW\'s own cluster'],
    ] },
    { name: 'BMW\'s cluster', about: 'What BMW draws under and over the themes.', rows: [
        ['hideBoxes', 'Hide BMW\'s black boxes', 'test'],
        ['gearLetter', 'Leave BMW\'s gear letter open', 'keeps BMW\'s black gear box away (bimmer-lab\'s car test)'],
        ['stripClear', 'Leave BMW\'s bottom strip clear', 'the theme stays as it is, cut above the strip'],
        ['calib', 'Calibration', 'a grid or the map frame on the cluster, to measure what BMW hides'],
        ['slotWatch', 'Watch BMW\'s slots', 'test: every slot now, and what changed when'],
    ] },
    { name: 'Warnings', about: 'Over its limit, the value flashes red on the cluster; a tyre under its pressure turns orange. Not during the start animation.', rows: [
        ['warnOil', 'Oil temperature', 'flashes from', 'OIL', '#ffb23e'],
        ['warnCoolant', 'Coolant temperature', 'flashes from', 'H₂O', '#59c7ff'],
        ['warnBoost', 'Boost', 'Apex, Vintage · flashes from', 'BAR', '#c58cff'],
        ['warnTyre', 'Tyre pressure', 'Apex tyres · orange under', 'TPMS', '#7ee08a'],
    ] },
    { name: 'Rev range', about: 'The rev bars\' yellow and red zones, and the shift point.', rows: [
        ['engine', 'Engine', 'petrol: scale to 8000 · diesel: scale to 6000'],
        ['redFrom', 'Red zone from', 'Auto: BMW\'s, 6500 petrol, 5000 diesel'],
        ['yellowFrom', 'Yellow zone from', 'Auto: 500 under the red'],
        ['shiftBefore', 'Shift point', 'before the red zone'],
        ['shiftFlash', 'Shift flash', 'Apex Sport: white, yellow, then red'],
        ['coldGuard', 'Cold-engine rev guard', 'both zones lower while the oil is cold'],
    ] },
    { name: 'Units and time', about: 'km/h and °C are drawn into the themes: keep the units metric.', rows: [
        ['units', 'Units', 'speed, temperatures, pressure'],
        ['clock', 'Clock', '12 or 24 hours'],
        ['timeZone', 'Time zone', 'the head unit\'s clock runs on UTC'],
        ['tankLitres', 'Fuel tank', 'for the fuel level, where the engine unit doesn\'t give it'],
    ] },
    { name: 'Home-screen widget', about: 'Hold a finger on an iDrive home-screen tile and pick Zeiger to place it. Place a few for an overview: a tap on one changes only that one.', rows: [
        ['widgetShows', 'Shows', 'every widget: oil, water and turbo; the weather; or the cluster\'s theme'],
        ['widgetTap', 'Tap on a widget', 'the next view on that widget, or open Zeiger'],
    ] },
    // About (0.44.0): what Zeiger is, as app.json "description" says it at install (lines: the panel's width)
    { name: 'About', about: [
        'Zeiger is in beta: custom themes for the BMW instrument cluster, from 80s LCD dashes to photo themes.',
        'A hobby project by an enthusiast, made to make every drive a little nicer and to give back to the',
        'community that keeps custom iDrive apps going. Not made by or connected with BMW. Improved all the time.',
    ], rows: [
        ['demo', 'Demo data', 'made-up values while the car sends none'],
        ['probe', 'Look for cruise and speed limit', 'test: what the car offers apps, listed here'],
    ] },
];
// Customise (Zeiger 0.34.0): the themes whose places can show other things, the setting prefix and the rows (the
// setting key's ending, label, the line under it); the layouts show a widget for its pick ("toggle": "<key>=<value>")
const CUSTOM = {
    apex: { key: 'apex', rows: [['Big', 'Big number', 'in the middle'], ['Left', 'Left block', 'two bars, the tyres, or empty'], ['Mid', 'Bottom middle', 'where the clock is']] },
    apex_sport: { key: 'apexSport', rows: [['Big', 'Big number', 'in the middle'], ['Left', 'Left block', 'two bars, the tyres, or empty'], ['Mid', 'Bottom middle', 'where the clock is']] },
    // 0.45.0, a beta: the photo themes' Customise starts here (the readouts' font, the M badge under the car)
    ember: { key: 'ember', beta: true, rows: [['Font', 'Font', 'the readouts\' lettering'], ['Mid', 'Bottom middle', 'under the car']] },
};
// Zeiger is in beta (0.45.0): a BETA mark in the header, and on a Customise that is newer still ("beta" above)
const BETA = true;
// the slot watch (BMW's cluster group): while it is on, the group shows only its switch, the rest is the watch
const WATCH_ROW = 64, WATCH_LH = 22;
// the gallery's groups (0.44.0), in this order; a swipe goes on into the next group at a group's end. A theme in none
// goes to MORE at the end, so a new theme shows before it is given a group. Groups with no theme don't show.
const THEME_GROUPS = [
    ['VINTAGE', ['vintage_green', 'vintage_cyan', 'vfd']],
    ['SPORT', ['apex', 'apex_sport']],
    ['PHOTO', ['map_mist', 'dark_moon', 'underpass', 'sunrise_hills', 'mist', 'peaks', 'ember']],
];
// the calibration layouts (hudLayout values), for the row in BMW's cluster
const CALIB = [['', 'Off'], ['grid', 'Grid'], ['mapcal', 'Map frame']];
const CREDITS = [
    'Zeiger by vucko-adv. Every theme is drawn by vucko-adv.',
    'Forked from bimmer-lab/apps (Cluster Themes), MIT.',
    'MGU App Kit by cauliflowermossgrape (MIT).',
    'cluster-render client by Robert Nisipeanu (MPL 2.0).',
    'Fonts: Barlow, Michroma, Inter Tight, Jost, Saira (SIL Open Font License). Details: NOTICE.',
];

// the author's card in About (0.31.0): the photo (hud/pictures/author_photo.json, a 128 px circle, baked by
// cluster-design/author/bake.html) and the Instagram
const AUTHOR = { handle: '@vucko.adv', link: 'instagram.com/vucko.adv' };

/* ---------- theme pictures (hud/previews/<layout>.json: big, small, hero) ---------- */
const IMG = 0x5a500000;              // our image ids ('ZP' + n), clear of the kit's own
const pics = Object.create(null);
let nextImg = 1;
function decode(name, size) {
    try {
        const p = (data.json('previews/' + name + '.json') || {})[size];
        if (!p || !p.z) return null;
        const px = zlib.inflateSync(Buffer.from(p.z, 'base64'));
        return px.length === p.w * p.h * 4 ? { w: p.w, h: p.h, px } : null;
    } catch (e) { return null; }
}
/** { id, w, h } of a theme's 'big' or 'small' picture, or null */
function pic(name, size) {
    const k = name + ':' + size;
    if (pics[k] !== undefined) return pics[k];
    const d = name === 'off' ? null : decode(name, size);
    pics[k] = d ? { id: IMG + nextImg++, w: d.w, h: d.h } : null;
    if (d) rec.setImage(pics[k].id, d.w, d.h, d.px);
    return pics[k];
}
let authorPic;
/** the author's photo as an image { id, w, h }, or null */
function authorPhoto() {
    if (authorPic !== undefined) return authorPic;
    authorPic = null;
    try {
        const p = data.json('pictures/author_photo.json');
        const px = zlib.inflateSync(Buffer.from(p.z, 'base64'));
        if (px.length === p.w * p.h * 4) { authorPic = { id: IMG + 0xfff0, w: p.w, h: p.h }; rec.setImage(authorPic.id, p.w, p.h, px); }
    } catch (e) { authorPic = null; }
    return authorPic;
}
// the big card's picture: 'hero' (1152 x 432) where there is one, else 'big'. Since 0.30.0 HERO_SLOTS of them are kept
// (each its own image, so the renderer keeps its copy too) and the neighbours are sent ahead (gallery()): a swipe shows
// a picture already there, without decoding and sending 2 MB first. The one used longest ago gives up its slot.
const HERO_IDS = 0x5a5f0000, HERO_SLOTS = 4;
// a swipe (or a tap beside the card) slides the next card in from that side and fades it up (0.37.0), so the finger
// sees at once that it did something; its neighbours' pictures are sent ahead PRELOAD_MS after it lands, and the one
// after next in the swipe's direction too
const SLIDE_MS = 260, SLIDE_PX = 170, PRELOAD_MS = 300;
// Customise's preview (0.41.0): hud/previews/<theme>_custom.json (cluster-design/apex/build.html "Customise previews"):
// the theme with its defaults, and for each Customise setting its rect drawn once per pick; the page lays the picks being
// tried over the base, so the theme shows as it will on the cluster before Apply sends them. Each its own image.
const CUSTOM_IDS = 0x5a5e0000;
// a part changing on the preview: the new pick fades in over the old one, sliding PART_SLIDE px from the side it came
// from, in PART_MS (no name over it: the preview shows what it is)
const PART_MS = 240, PART_SLIDE = 26;
// which way a part changes: up and down for the left block and the big number, sideways for the bottom middle
const partAxis = (key) => (/Mid$/.test(key) ? 'x' : 'y');
const customPics = Object.create(null);
function customPreview(theme) {
    if (customPics[theme] !== undefined) return customPics[theme];
    let out = null;
    try {
        const j = data.json('previews/' + theme + '_custom.json');
        if (j && j.base && j.keys) {
            let id = CUSTOM_IDS + Object.keys(customPics).length * 0x100;
            const img = (o) => {
                const px = zlib.inflateSync(Buffer.from(o.z, 'base64'));
                if (px.length !== o.w * o.h * 4) throw new Error('bad piece');
                const me = id++;
                rec.setImage(me, o.w, o.h, px);
                return { id: me, w: o.w, h: o.h };
            };
            out = { scale: j.scale, base: img(j.base), keys: {} };
            Object.keys(j.keys).forEach((k) => {
                const r = j.keys[k], opts = {};
                Object.keys(r.opts).forEach((v) => { opts[v] = img(r.opts[v]); });
                out.keys[k] = { x: r.x, y: r.y, w: r.w, h: r.h, opts };
            });
        }
    } catch (e) { out = null; }
    customPics[theme] = out;
    return out;
}
const heroes = [], noHero = new Set();
function hero(name) {
    if (name === 'off' || noHero.has(name)) return null;
    let h = heroes.find((q) => q && q.name === name);
    if (!h) {
        const d = decode(name, 'hero') || decode(name, 'big');
        if (!d) { noHero.add(name); return null; }
        let slot = heroes.length;
        if (slot >= HERO_SLOTS) { slot = 0; heroes.forEach((q, i) => { if (q.used < heroes[slot].used) slot = i; }); }
        h = { name, id: HERO_IDS + slot, w: d.w, h: d.h, used: 0 };
        heroes[slot] = h;
        rec.setImage(h.id, d.w, d.h, d.px);
    }
    h.used = Date.now();
    return h;
}

class Page {
    constructor(ctx, hud) {
        this.ctx = ctx; this.hud = hud;
        this.tab = 0;                // 0 Themes, 1 Settings
        this.mode = null;            // the drive mode whose theme the gallery edits (a MODES key), null: the car's
        this.at = null;              // the theme looked at in the gallery
        this.atFor = null;           // ... for this key (looking starts over at its theme when the key changes)
        this.group = 0;              // the open settings group
        this.loop = null;
        this.prev = {};              // the theme each setting had before BMW's own was switched on (the corner shortcut)
        this.calPrev = null;         // byMode and hudLayout from before a calibration layout was put on
    }

    start() {
        const ctx = this.ctx;
        // the kit's header in Zeiger's orange
        Object.assign(ctx.theme(), { sel: C.acc, selText: '#ffffff', accent2: C.accSoft, bg: C.bg });
        if (ctx.onTab) ctx.onTab((i) => this.openTab(i));
        // a finger swiped sideways goes through the gallery (Themes tab only)
        if (ctx.onSwipe) ctx.onSwipe((d, at) => {
            if (this.tab !== 0) return;
            // in Customise a swipe changes the part it started on, in that part's direction; else it goes through the gallery
            if (this.custom && this.draft) {
                const r = at && (this.cParts || []).find((q) => at.x >= q.x && at.x < q.x + q.w && at.y >= q.y && at.y < q.y + q.h);
                if (r && at.axis === r.axis) this.stepDraft(r.key, d);
                return;
            }
            if (this.goBy) this.goBy(d);
        });
        this.loop = ctx.loop('MAIN', 10, () => this.render());
        ctx.settings.onChange(() => this.kick());
        ctx.onLayout(() => this.kick());
        this.hud.onStatus(() => this.kick());
        this.render();
    }
    kick() { if (this.loop && this.loop.kick) this.loop.kick(); }
    openTab(i) { if (i === 0 || i === 1) { this.tab = i; this.custom = null; this.kick(); } }
    /** Customise for theme v: the picks start as they are set (the draft), and change only the preview until Apply */
    openCustom(v) {
        const c = CUSTOM[v];
        if (!c) return;
        this.custom = v; this.draft = {}; this.applied = null;
        c.rows.forEach(([end]) => { this.draft[c.key + end] = this.get(c.key + end); });
        this.cAnim = {};
        this.kick();
    }
    /** the draft's keys whose pick differs from what is set */
    draftChanges() { return Object.keys(this.draft || {}).filter((k) => this.draft[k] !== this.get(k)); }
    stepDraft(k, d) {
        const list = this.steps(k);
        if (!list.length) return;
        const i = Math.max(0, list.indexOf(this.draft[k])), from = this.draft[k];
        this.draft[k] = list[(i + d + list.length) % list.length];
        if (!this.cAnim) this.cAnim = {};
        this.cAnim[k] = { from, d, t: Date.now() };
        this.kick();
    }
    /** every pick of the draft to the cluster at once (one rebuild: hud.js _rebuildSoon) */
    applyDraft() {
        const ch = this.draftChanges();
        if (!ch.length) return;
        ch.forEach((k) => this.set(k, this.draft[k]));
        this.applied = Date.now();
        [150, 400, 800, 1300, 1700].forEach((ms) => setTimeout(() => this.kick(), ms));
    }

    /* ---------- settings ---------- */
    get(k) { return this.hud.setting(k); }
    set(k, v) { if (this.ctx.settings.get(k) !== v) this.ctx.settings.set(k, v); this.kick(); }
    item(k) { return this.ctx.settings.item(k) || {}; }
    optLabel(k, v) { const o = (this.item(k).options || []).find((x) => x[0] === v); return o ? o[1] : String(v); }
    /** the values a stepper goes through */
    steps(k) {
        if (k === 'calib') return CALIB.map((c) => c[0]);
        const it = this.item(k);
        if (it.steps) return it.steps;
        if (it.options) return it.options.map((o) => o[0]);
        return [];
    }
    step(k, d) {
        const list = this.steps(k), v = this.get(k);
        if (!list.length) return;
        let i = list.indexOf(v);
        if (i < 0) i = list.reduce((b, x, j) => (Math.abs(x - v) < Math.abs(list[b] - v) ? j : b), 0);
        // a list of choices goes round (past the last, the first again); a range of numbers stops at its ends
        const round = k === 'calib' || (!this.item(k).steps && !!this.item(k).options);
        const j = round ? (i + d + list.length) % list.length : Math.max(0, Math.min(list.length - 1, i + d));
        if (k === 'calib') this.calib(list[j]); else this.set(k, list[j]);
    }
    /** the calibration layout on the cluster now: '' (none), 'grid' or 'mapcal' */
    calibNow() { const v = this.get('hudLayout'); return this.get('byMode') !== true && CALIB.some((c) => c[0] && c[0] === v) ? v : ''; }
    calib(v) {
        if (v) {
            if (!this.calibNow()) this.calPrev = { byMode: this.get('byMode') === true, hudLayout: this.get('hudLayout') };
            this.set('byMode', false); this.set('hudLayout', v);
        } else if (this.calibNow()) {
            const p = this.calPrev || { byMode: false, hudLayout: this.looks()[0] };
            this.set('hudLayout', p.hudLayout && !CALIB.some((c) => c[0] === p.hudLayout) ? p.hudLayout : this.looks()[0]);
            this.set('byMode', p.byMode);
            this.calPrev = null;
        }
    }
    us() { return this.get('units') === 'us'; }
    valueText(k) {
        if (k === 'calib') { const n = this.calibNow(); return CALIB.find((c) => c[0] === n)[1]; }
        const v = this.get(k), it = this.item(k);
        if (k === 'warnOil' || k === 'warnCoolant') return v ? (this.us() ? Math.round(v * 9 / 5 + 32) + ' °F' : v + ' °C') : 'Off';
        if (k === 'warnBoost' || k === 'warnTyre') return v ? (this.us() ? Math.round(v * 14.5) + ' psi' : v.toFixed(1) + ' bar') : 'Off';
        if (k === 'shiftX') return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' px';
        if (k === 'engine') return v === 'diesel' ? 'Diesel' : 'Petrol';
        if (k === 'redFrom') return v > 0 ? num(v) + ' rpm' : 'Auto · ' + num(this.hud.setting('redline'));
        if (k === 'yellowFrom') return v > 0 ? num(v) + ' rpm' : 'Auto · ' + num(this.hud.setting('yellowLine'));
        if (k === 'shiftBefore') return v ? num(v) + ' rpm' : 'At the redline';
        if (k === 'tankLitres') return v + ' L';
        if (k === 'timeZone') return tz.name(v);
        if (k === 'widgetTap') return v === 'open' ? 'Opens Zeiger' : 'Next view';
        if (k === 'widgetShows') return { engine: 'Engine', mist: 'Weather, Mist', sunrise: 'Weather, Sunrise', theme: 'Cluster theme', test: 'Test pattern' }[v] || this.optLabel(k, v);
        if (it.type === 'bool') return v ? 'On' : 'Off';
        return this.optLabel(k, v);
    }
    summary(g) {
        const on = (k) => this.get(k) === true;
        if (g.name === 'Cluster') return 'start animation ' + (on('startAnim') ? 'on' : 'off') + ' · position ' + this.valueText('shiftX');
        if (g.name === 'Warnings') {
            const s = [['warnOil', 'oil'], ['warnCoolant', 'coolant'], ['warnBoost', 'boost'], ['warnTyre', 'tyres']].filter((x) => this.get(x[0])).map((x) => x[1] + ' ' + this.valueText(x[0]));
            return s.length ? s.join(' · ') : 'all off';
        }
        if (g.name === 'Rev range') return this.valueText('engine') + ' · yellow ' + num(this.hud.setting('yellowLine')) + ' · red ' + num(this.hud.setting('redline'));
        if (g.name === 'Units and time') return (this.us() ? 'mph' : 'km/h') + ' · ' + this.valueText('clock') + ' · ' + this.valueText('timeZone');
        if (g.name === 'Home-screen widget') return this.valueText('widgetShows') + ' · tap: ' + (this.get('widgetTap') === 'open' ? 'opens Zeiger' : 'next view');
        if (g.name === 'BMW\'s cluster') return 'black boxes ' + (on('hideBoxes') ? 'hidden' : 'shown') + ' · bottom strip ' + (on('stripClear') ? 'clear' : 'covered') + (this.calibNow() ? ' · calibrating' : '');
        return 'version ' + ((this.ctx.spec && this.ctx.spec.version) || '?') + ' · credits';
    }

    /* ---------- themes ---------- */
    /** the gallery's themes (BMW's own is the corner shortcut, not a card) */
    looks() { return this.groups().reduce((a, g) => a.concat(g.list), []); }
    /** the gallery's groups with their themes (THEME_GROUPS; MORE: themes in none), those with none left out */
    groups() {
        const all = (this.item('inSport').options || []).map((o) => o[0]).filter((v) => v !== 'off');
        const gs = THEME_GROUPS.map(([name, vs]) => ({ name, list: vs.filter((v) => all.indexOf(v) >= 0) }));
        gs.push({ name: 'MORE', list: all.filter((v) => !THEME_GROUPS.some((g) => g[1].indexOf(v) >= 0)) });
        return gs.filter((g) => g.list.length);
    }
    name(v) { return v === 'off' ? 'BMW\'s own' : this.optLabel('hudLayout', v); }
    shown() { return this.hud.activeName || this.hud._layoutName() || 'off'; }
    carMode() { const m = MODES.find((x) => x[2] === this.hud.driveMode); return m ? m[0] : null; }
    /** the setting the gallery's "Use" sets: a drive mode's own while the theme changes with it, else hudLayout */
    key() { return this.get('byMode') === true ? this.mode || this.carMode() || 'inComfort' : 'hudLayout'; }
    /** the corner shortcut: BMW's own cluster on (the theme remembered), or the theme from before it back */
    bmw() {
        const k = this.key(), cur = this.get(k);
        if (cur === 'off') this.use(this.prev[k] && this.prev[k] !== 'off' ? this.prev[k] : this.at || this.looks()[0]);
        else { this.prev[k] = cur; this.use('off'); }
    }
    /** a tap on the big card: that theme on the cluster, and the card lights up a moment (pickedAt) */
    pick() {
        const v = this.at;
        if (v !== this.get(this.key())) this.use(v);
        this.picked = { v, t: Date.now() };
        [120, 240, 360, 480, 600, 900, 1300, 1700].forEach((ms) => setTimeout(() => this.kick(), ms));
    }
    use(v) {
        const scr = this.hud.screen;
        if (scr) { if (v !== 'off' && scr.otherOn()) scr.claim(); else scr.release(); }
        this.set(this.key(), v);
    }

    /* ---------- drawing ---------- */
    render() {
        const cv = this.ctx.canvas(W, H), bottom = G.pageBottom(cv);
        cv.clear(C.bg);
        cv.gradientRect(0, 0, W, bottom + 8, [[0, '#0b0e13'], [0.6, C.bg], [1, C.bg]]);
        const on = this.hud.activeName && this.hud.activeName !== 'off', demo = this.hud.car && this.hud.car.data().demo;
        G.frame(cv, this.ctx.theme(), ['Themes', 'Settings'], this.tab, [
            BETA ? { text: 'BETA', color: C.accSoft } : null,
            demo ? { text: 'DEMO DATA', color: C.warn } : null,
            { text: on ? 'CLUSTER ON' : 'CLUSTER OFF', color: on ? C.ok : C.dim },
        ]);
        // the header drawn on the page itself (not the kit's full-screen one): its tabs take taps here
        if (!cv.chrome && cv.tabRects) cv.tabRects.forEach((r) => cv.target(r.x, r.y, r.w, r.h, () => this.openTab(r.i), 'tab:' + r.i, 0));
        if (this.ctx.display) this.ctx.display.swipeV = !!(this.tab === 0 && this.custom && this.draft);
        if (this.tab === 0 && this.custom && CUSTOM[this.custom]) this.customise(cv, bottom);
        else if (this.tab === 0) this.gallery(cv, bottom); else this.settings(cv, bottom);
        return this.ctx.ui.image('MAIN_GFX', cv);
    }

    gallery(cv, bottom) {
        const looks = this.looks(), key = this.key(), cur = this.get(key), shown = this.shown();
        if (this.atFor !== key || looks.indexOf(this.at) < 0) {
            const back = this.prev[key];
            this.at = looks.indexOf(cur) >= 0 ? cur : looks.indexOf(back) >= 0 ? back : looks[0]; this.atFor = key;
        }
        const i = looks.indexOf(this.at), go = (d) => () => {
            this.at = looks[(i + d + looks.length) % looks.length];
            this.slide = { d, to: this.at, t: Date.now() };
            this.kick();
        };
        this.goBy = (d) => go(d)();
        // landed on a theme: its neighbours' big pictures sent ahead a moment later (drawn off the page, 1 px)
        if (this.atWas !== this.at) { this.atWas = this.at; this.atSince = Date.now(); setTimeout(() => this.kick(), PRELOAD_MS + 50); }
        // the big card and its neighbours
        const ch = Math.min(440, bottom - 48 - 104), cw = Math.round(ch * 8 / 3), cy = 48;
        let cx = (W - cw) / 2;
        const sh = Math.round(ch * 0.8), sw = Math.round(sh * 8 / 3), sy = cy + (ch - sh) / 2;
        const side = (v, x, d) => {
            cv.clip(L, sy, R - L, sh);
            this.picture(cv, v, 'big', x, sy, sw, sh);
            cv.roundRect(x, sy, sw, sh, 18, A(C.bg, 0.62));
            cv.noclip();
        };
        side(looks[(i - 1 + looks.length) % looks.length], cx - 24 - sw, -1);
        side(looks[(i + 1) % looks.length], cx + cw + 24, 1);
        if (Date.now() - this.atSince >= PRELOAD_MS) {
            const ahead = this.slide && this.slide.to === this.at ? [looks[(i + 2 * this.slide.d + 2 * looks.length) % looks.length]] : [];
            [looks[(i - 1 + looks.length) % looks.length], looks[(i + 1) % looks.length]].concat(ahead).forEach((v) => { const h = hero(v); if (h) cv.image(h.id, -8, -8, 1, 1); });
        }
        // the slide: the card comes in from the side it was swiped from, easing out, and fades up
        const sp = this.slide && this.slide.to === this.at ? (Date.now() - this.slide.t) / SLIDE_MS : 1;
        const cx0 = cx;
        let fade = 1;
        if (sp < 1) {
            const k = 1 - Math.pow(1 - Math.max(0, sp), 3);
            cx += Math.round(this.slide.d * (1 - k) * SLIDE_PX);
            fade = 0.3 + 0.7 * k;
            setTimeout(() => this.kick(), 16);
            cv.clip(L, cy - 4, R - L, ch + 8);
            if (cv.alpha) cv.alpha(fade);
        }
        this.picture(cv, this.at, 'hero', cx, cy, cw, ch);
        // dark enough at the bottom that the picture's own bottom readouts don't show through the theme's name
        cv.gradientRect(cx, cy + ch - 180, cw, 180, [[0, A('#000000', 0)], [0.35, A('#000000', 0.82)], [0.6, A('#000000', 0.95)], [1, A('#000000', 0.97)]]);
        cv.strokeRoundRect(cx, cy, cw, ch, 22, 1, A('#ffffff', 0.12));
        cv.text(this.name(this.at), cx + 30, cy + ch - 56, 46, C.text, { font: B, literal: true });
        cv.text(ABOUT[this.at] || '', cx + 30, cy + ch - 22, 21, C.soft, { font: M, literal: true });
        if (this.at === shown) pill(cv, cx + cw - 22, cy + 20, 'ON THE CLUSTER', C.ok);
        // a theme whose places can show other things: Customise, top left on the card
        if (CUSTOM[this.at]) {
            const s = CUSTOM[this.at].beta ? 'CUSTOMISE · BETA' : 'CUSTOMISE', w = cv.textWidth(s, 17, { font: B, spacing: 2, literal: true }) + 56, x = cx + 22, y = cy + 20;
            cv.roundRect(x, y, w, 40, 20, A('#000000', 0.66));
            cv.strokeRoundRect(x, y, w, 40, 20, 1.5, A(C.acc, 0.9));
            cv.text(s, x + w / 2, y + 27, 17, C.accSoft, { font: B, spacing: 2, align: 'center', literal: true });
            cv.target(x, y, w, 40, () => this.openCustom(this.at), 'customise', 20);
        }
        // just picked (a tap on the card): the card lights up in the accent, then a frame stays a little longer
        const pk = this.picked && this.picked.v === this.at ? Date.now() - this.picked.t : Infinity;
        if (pk < 1600) {
            if (pk < 500) cv.roundRect(cx, cy, cw, ch, 22, A(C.acc, 0.28 * (1 - pk / 500)));
            const fa = pk < 1100 ? 1 : (1600 - pk) / 500;
            cv.strokeRoundRect(cx - 3, cy - 3, cw + 6, ch + 6, 25, 4, A(C.acc, fa));
            const s = 'ON THE CLUSTER', sw = cv.textWidth(s, 26, { font: B, spacing: 2, literal: true }) + 64;
            cv.roundRect(cx + (cw - sw) / 2, cy + ch / 2 - 34, sw, 68, 34, A('#000000', 0.72 * fa));
            cv.text(s, cx + cw / 2, cy + ch / 2 + 10, 26, A(C.acc, fa), { font: B, spacing: 2, align: 'center', literal: true });
        }
        // Use
        const mode = MODES.find((m) => m[0] === key), what = mode ? 'for ' + mode[1] : '';
        if (this.at === cur) {
            const s = 'In use' + (what ? ' ' + what : ''), bw = cv.textWidth(s, 22, { font: B, literal: true }) + 56;
            cv.roundRect(cx + cw - 24 - bw, cy + ch - 76, bw, 52, 26, A('#ffffff', 0.10));
            cv.text(s, cx + cw - 24 - bw / 2, cy + ch - 42, 22, C.soft, { font: B, align: 'center', literal: true });
        } else {
            const s = 'Use ' + (what || 'this theme'), bw = cv.textWidth(s, 23, { font: B, literal: true }) + 60;
            const bx = cx + cw - 24 - bw, by = cy + ch - 76;
            cv.roundRect(bx, by, bw, 52, 26, C.acc);
            cv.text(s, bx + bw / 2, by + 34, 23, '#ffffff', { font: B, align: 'center', literal: true });
            cv.target(bx, by, bw, 52, () => this.use(this.at), 'use', 26);
        }
        if (fade < 1) { if (cv.alpha) cv.alpha(1); cv.noclip(); }
        cx = cx0;
        // plain arrows at the screen's edges; the taps are the whole left and right half (added last: the buttons win)
        arrow(cv, L + 26, cy + ch / 2, -1); arrow(cv, R - 26, cy + ch / 2, 1);
        // the groups: a chip each with its name and a dot per theme; the one looked at lit. A tap goes to the group (the
        // theme last looked at in it, else the one in use there, else its first)
        const gy = cy + ch + 8, gh = 34, gs = this.groups();
        if (!this.groupAt) this.groupAt = {};
        const chips = gs.map((g) => {
            const here = g.list.indexOf(this.at) >= 0;
            if (here) this.groupAt[g.name] = this.at;
            const tw = cv.textWidth(g.name, 15, { font: B, spacing: 2, literal: true });
            const dots = g.list.reduce((a, v) => a + (v === this.at ? 22 : 7) + 6, -6);
            return { g, here, tw, w: 22 + tw + 14 + dots + 20 };
        });
        let gx = (W - chips.reduce((a, c) => a + c.w + 12, -12)) / 2;
        chips.forEach((c) => {
            cv.roundRect(gx, gy, c.w, gh, gh / 2, c.here ? A('#ffffff', 0.10) : A('#ffffff', 0.04));
            if (c.here) cv.strokeRoundRect(gx, gy, c.w, gh, gh / 2, 1, A(C.acc, 0.55));
            cv.text(c.g.name, gx + 22, gy + 23, 15, c.here ? C.text : C.dim, { font: B, spacing: 2, literal: true });
            let dx = gx + 22 + c.tw + 14;
            c.g.list.forEach((v) => {
                const w = v === this.at ? 22 : 7;
                cv.roundRect(dx, gy + gh / 2 - 3.5, w, 7, 3.5, v === this.at ? C.acc : A('#ffffff', c.here ? 0.30 : 0.18));
                dx += w + 6;
            });
            const to = () => {
                if (c.here) return;
                const l = c.g.list, last = this.groupAt[c.g.name];
                const v = l.indexOf(last) >= 0 ? last : l.indexOf(cur) >= 0 ? cur : l[0];
                const d = looks.indexOf(v) > i ? 1 : -1;
                this.at = v; this.slide = { d, to: v, t: Date.now() }; this.kick();
            };
            cv.target(gx, gy - 4, c.w, gh + 8, to, 'group:' + c.g.name, gh / 2, true);
            gx += c.w + 12;
        });
        // the drive modes
        const y = bottom - 58, h = 54, byMode = this.get('byMode') === true;
        let x = 24;
        const tw = 236;
        glass(cv, x, y, tw, h, false);
        cv.text('Change with', x + 18, y + 23, 16, C.dim, { font: M, literal: true });
        cv.text('the drive mode', x + 18, y + 44, 20, C.text, { font: B, literal: true });
        toggle(cv, x + tw - 72, y + 13, byMode);
        cv.target(x, y, tw, h, () => { this.set('byMode', !byMode); this.mode = null; }, 'byMode', 14);
        x += tw + 14;
        const cell = (k, label, now, sel, w) => {
            glass(cv, x, y, w, h, sel);
            this.picture(cv, this.get(k), 'small', x + 8, y + 8, 100, 38, 6);
            cv.text(label + (now ? ' · NOW' : ''), x + 122, y + 22, 14, sel ? C.acc : C.dim, { font: B, spacing: 2, literal: true });
            cv.text(this.name(this.get(k)), x + 122, y + 45, 21, C.text, { font: B, literal: true });
            const at = x;
            cv.target(at, y, w, h, () => { this.mode = k === 'hudLayout' ? null : k; this.at = this.get(k); this.atFor = this.key(); this.kick(); }, 'mode:' + k, 14);
            x += w + 12;
        };
        if (byMode) MODES.forEach((m) => cell(m[0], m[1], m[0] === this.carMode(), m[0] === key, 300));
        else cell('hudLayout', 'EVERY DRIVE MODE', false, true, 360);
        // the corner shortcut: BMW's own cluster
        const bw = 264, bx = R - 12 - bw, own = cur === 'off';
        glass(cv, bx, y, bw, h, own);
        cv.text(byMode ? 'For ' + (mode ? mode[1] : '') : 'Quick switch', bx + 18, y + 23, 16, own ? C.accSoft : C.dim, { font: M, literal: true });
        cv.text("BMW's own cluster", bx + 18, y + 44, 20, C.text, { font: B, literal: true });
        toggle(cv, bx + bw - 72, y + 13, own);
        cv.target(bx, y, bw, h, () => this.bmw(), 'bmw', 14);
        // a tap on the big card puts it on the cluster; beside it, left goes back and right goes on (no press flash:
        // since 0.30.0, the orange half page read as a choice)
        cv.target(cx, cy, cw, ch, () => this.pick(), 'card', 22, true);
        cv.target(L, cy, cx - L, ch + 40, go(-1), 'prev', 0, true);
        cv.target(cx + cw, cy, R - cx - cw, ch + 40, go(1), 'next', 0, true);
    }

    settings(cv, bottom) {
        // the groups
        const gx = 24, gw = 476, gy = 48, gap = 8, gh = Math.min(72, Math.floor((bottom - 6 - gy - gap * (GROUPS.length - 1)) / GROUPS.length));
        GROUPS.forEach((g, i) => {
            const y = gy + i * (gh + gap), sel = i === this.group;
            glass(cv, gx, y, gw, gh, sel);
            cv.text(g.name, gx + 22, y + gh / 2 - 2, 25, C.text, { font: B, literal: true });
            cv.text(fit(cv, this.summary(g), 17, gw - 44, M), gx + 22, y + gh / 2 + 22, 17, sel ? C.accSoft : C.dim, { font: M, literal: true });
            cv.target(gx, y, gw, gh, () => { this.group = i; this.kick(); }, 'group:' + i, 14);
        });
        // the open group
        const g = GROUPS[this.group], px = 524, pw = R - 12 - px, py = gy, ph = bottom - 6 - py;
        cv.roundRect(px, py, pw, ph, 20, A(C.panel, 0.92));
        cv.strokeRoundRect(px, py, pw, ph, 20, 1, C.faint);
        cv.text(g.name, px + 32, py + 52, 38, C.text, { font: B, literal: true });
        let y = py + 70;
        if (g.about) {
            const lines = [].concat(g.about);
            lines.forEach((l, j) => cv.text(l, px + 32, py + 86 + j * 24, 19, C.dim, { font: M, literal: true }));
            y = py + 104 + (lines.length - 1) * 24;
        }
        const credits = g.name === 'About', watch = g.name === 'BMW\'s cluster' && this.get('slotWatch') === true;
        const rows = watch ? g.rows.filter((r) => r[0] === 'slotWatch') : g.rows;
        const room = py + ph - 10 - y - (credits ? Math.max(CREDITS.length * 26 + 24, 196) : 0);
        // the slot watch and the probe (0.46.0) give their lines the room: their rows as low as they go
        const rh = watch || (credits && this.get('probe') === true) ? WATCH_ROW : Math.min(84, Math.floor(room / rows.length));
        rows.forEach((row, j) => this.row(cv, px + 32, y + j * rh, pw - 64, rh, row));
        if (watch) {
            const wy = y + rh + 18;
            this.watchLines(cv, px + 32, wy, pw - 64, Math.max(3, Math.floor((py + ph - 14 - wy - 18) / WATCH_LH)));
        }
        if (credits && this.get('probe') === true) {
            this.probeLines(cv, px + 32, y + g.rows.length * rh + 18, pw - 64, py + ph - 14);
        } else if (credits) {
            if (this.get('probe') !== true) this.probeR = undefined;
            const cy = y + g.rows.length * rh + 18;
            cv.fillRect(px + 32, cy - 8, pw - 64, 1, C.faint);
            CREDITS.forEach((s, j) => cv.text(s, px + 32, cy + 22 + j * 26, 18, j ? C.dim : C.soft, { font: M, literal: true }));
            // the author's card on the right: the photo in a ring, the Instagram under it
            const cw = 280, cx = px + pw - 32 - cw / 2, ph0 = 104, ay = cy + 6, ap = authorPhoto();
            cv.circle(cx, ay + ph0 / 2, ph0 / 2 + 3, C.acc);
            if (ap) cv.image(ap.id, cx - ph0 / 2, ay, ph0, ph0);
            else cv.circle(cx, ay + ph0 / 2, ph0 / 2, C.glass);
            cv.text(AUTHOR.handle, cx, ay + ph0 + 32, 23, C.text, { font: B, align: 'center', literal: true });
            cv.text(AUTHOR.link, cx, ay + ph0 + 56, 17, C.accSoft, { font: M, align: 'center', literal: true });
        }
    }

    /**
     * The probe (0.46.0, a test, probe.js): the car's SOME/IP catalog searched for the cruise control and the speed
     * limit, its lines in place of the credits; a tap on them shows the next page. Read once each time it is switched on.
     */
    probeLines(cv, x, y, w, bottom) {
        const F = { font: M, literal: true }, LH = 22;
        if (this.probeR === undefined) {
            this.probeR = null; this.probePage = 0;
            probe.run(this.ctx.log, this.ctx.dataDir, (r) => { this.probeR = r; this.kick(); });
        }
        cv.fillRect(x, y - 8, w, 1, C.faint);
        // two columns side by side, the first line (how many) across both
        const all = probe.lines(this.probeR), rows = Math.max(3, Math.floor((bottom - y - 12) / LH) - 1);
        cv.text(fit(cv, all[0], 17, w, M), x, y + 18, 17, C.soft, F);
        const rest = all.slice(1), cw = Math.floor((w - 24) / 2), per = (rows - 1) * 2;
        const pages = Math.max(1, Math.ceil(rest.length / per)), page = (this.probePage || 0) % pages;
        rest.slice(page * per, page * per + per).forEach((l, i) => {
            const sub = /^ {4}/.test(l), cx = x + (i < rows - 1 ? 0 : cw + 24), cy = y + 18 + ((i % (rows - 1)) + 1) * LH;
            cv.text(fit(cv, l.trim(), sub ? 16 : 17, cw - (sub ? 20 : 0), M), cx + (sub ? 20 : 0), cy, sub ? 16 : 17, sub ? C.text : C.accSoft, F);
        });
        if (pages > 1) cv.text('page ' + (page + 1) + ' of ' + pages + ' · tap for the next', x + w, y + 18 + rows * LH, 15, C.dim, Object.assign({ align: 'right' }, F));
        cv.target(x, y - 8, w, bottom - y + 8, () => { this.probePage = (page + 1) % pages; this.kick(); }, 'probe', 0, true);
    }

    /**
     * The slot watch's lines (0.29.1): left, every one of the KOMBI's slots now (its status, and each content in it,
     * shown or parked); right, the changes before, newest first, each slot that changed with what it had and what it
     * had then. On the car: switch it on, start a theme in P (BMW's black gear box shows), shift to D (it goes), and
     * photograph the cluster and these lines; the same with the parking brake or Auto Hold.
     */
    watchLines(cv, x, y, w, lines) {
        const log = this.hud.slotLog || [], F = { font: M, literal: true }, LH = WATCH_LH, n = lines - 1;
        cv.fillRect(x, y - 8, w, 1, C.faint);
        const hm = (t) => { const d = new Date(t); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, '0')).join(':'); };
        // one slot line: [slot, "[status]  content shown, content parked"]
        const short = (l) => {
            const m = /^slot (0x[0-9a-f]+) status (\d+):?(.*)$/i.exec(l);
            if (!m) return [l, ''];
            const rows = m[3].split(',').map((r) => /(0x[0-9a-f]+) class (\d+) map (\d+)/i.exec(r)).filter(Boolean)
                .map((r) => r[1].replace(/^0x/, '') + ' ' + ({ 1: 'shown', 2: 'shown', 3: 'parked' }[r[3]] || 'off ' + r[3]));
            return [m[1], '[' + m[2] + '] ' + (rows.join(', ') || 'empty')];
        };
        const table = (e) => { const t = new Map(); e.lines.forEach((l) => { const [k, v] = short(l); t.set(k, v); }); return t; };
        if (!log.length) { cv.text('Waiting for cluster-render\'s slot table...', x, y + 18, 18, C.dim, F); return; }
        // left: every slot now
        const cw = Math.floor(w * 0.42), last = log[log.length - 1], now = [...table(last)];
        cv.text(hm(last.t) + '  now:', x, y + 18, 18, C.accSoft, F);
        const fits = now.length > n ? n - 1 : n;
        now.slice(0, fits).forEach(([k, v], i) => cv.text(fit(cv, k + ' ' + v, 17, cw - 16, M), x + 12, y + 18 + (i + 1) * LH, 17, C.text, F));
        if (now.length > n) cv.text('+' + (now.length - fits) + ' more', x + 12, y + 18 + n * LH, 15, C.dim, F);
        // right: the changes, newest first: the slot, what it had, what it has then
        const rx = x + cw + 12, rw = w - cw - 12, out = [];
        for (let k = log.length - 1; k > 0 && out.length < n; k--) {
            const a = table(log[k - 1]), b = table(log[k]), keys = [...new Set([...a.keys(), ...b.keys()])];
            keys.filter((s) => a.get(s) !== b.get(s)).forEach((s) => out.push(hm(log[k].t) + '  ' + s + ' ' + (a.get(s) || 'none') + '  >  ' + (b.get(s) || 'none')));
        }
        cv.text('changes (newest first):', rx, y + 18, 18, C.accSoft, F);
        if (!out.length) cv.text('none yet', rx + 12, y + 18 + LH, 17, C.dim, F);
        out.slice(0, n).forEach((l, i) => cv.text(fit(cv, l, 16, rw - 12, M), rx + 12, y + 18 + (i + 1) * LH, 16, C.text, F));
    }

    /**
     * Customise (0.41.0): the theme as big as the page takes, as it will look with the picks being tried (customPreview:
     * its pieces laid over the base). Every part that can change is live at once: small arrows on its edges (up and down
     * for the left block and the big number, left and right for the bottom middle), a swipe that starts on it in that
     * direction, or a tap on it (the next pick). The new pick fades in, sliding from the side it came from. Beside it: Apply (every pick to the cluster at once), Reset, Back.
     */
    customise(cv, bottom) {
        const v = this.custom, c = CUSTOM[v], prev = customPreview(v), now = Date.now();
        const colW = 330, gy = 48;
        let ph = bottom - gy - 10, pw = Math.round(ph * 8 / 3);
        if (pw > R - L - colW - 24) { pw = R - L - colW - 24; ph = Math.round(pw * 3 / 8); }
        const gx = L + 6;
        this.cParts = [];
        let moving = false;
        cv.roundRect(gx - 2, gy - 2, pw + 4, ph + 4, 18, '#000000');
        if (prev) {
            const k = pw / prev.base.w;
            cv.image(prev.base.id, gx, gy, pw, ph);
            Object.keys(prev.keys).forEach((key) => {
                const r = prev.keys[key], x = gx + Math.round(r.x * k), y = gy + Math.round(r.y * k), w = Math.round(r.w * k), h = Math.round(r.h * k);
                const pick = (p) => r.opts[p] || r.opts.none;
                const an = this.cAnim && this.cAnim[key], age = an ? now - an.t : Infinity;
                const o = pick(this.draft[key]);
                if (an && age < PART_MS && pick(an.from)) {
                    // the old pick under, the new one fading in from the side it came from
                    moving = true;
                    const e = 1 - Math.pow(1 - age / PART_MS, 3), off = Math.round((1 - e) * PART_SLIDE) * an.d, ax = partAxis(key);
                    cv.image(pick(an.from).id, x, y, w, h);
                    cv.clip(x, y, w, h);
                    if (cv.alpha) cv.alpha(e);
                    if (o) cv.image(o.id, x + (ax === 'x' ? off : 0), y + (ax === 'y' ? off : 0), w, h);
                    if (cv.alpha) cv.alpha(1);
                    cv.noclip();
                } else if (o) cv.image(o.id, x, y, w, h);
            });
            // the parts: a quiet frame, small arrows, taps and swipes
            Object.keys(prev.keys).forEach((key) => {
                if (!(key in this.draft)) return;
                const r = prev.keys[key], x = gx + Math.round(r.x * k) - 6, y = gy + Math.round(r.y * k) - 6, w = Math.round(r.w * k) + 12, h = Math.round(r.h * k) + 12;
                const changed = this.draft[key] !== this.get(key), ax = partAxis(key);
                this.cParts.push({ key, x, y, w, h, axis: ax });
                cv.strokeRoundRect(x, y, w, h, 12, 1, changed ? A(C.acc, 0.75) : A('#ffffff', 0.16));
                const col = A('#ffffff', 0.5);
                if (ax === 'y') {
                    smallChevron(cv, x + w / 2, y - 12, -1, col); smallChevron(cv, x + w / 2, y + h + 12, 1, col);
                    cv.target(x + w / 2 - 44, y - 34, 88, 32, () => this.stepDraft(key, -1), 'cup:' + key, 12, true);
                    cv.target(x + w / 2 - 44, y + h + 2, 88, 32, () => this.stepDraft(key, 1), 'cdown:' + key, 12, true);
                } else {
                    smallArrow(cv, x - 14, y + h / 2, -1, col); smallArrow(cv, x + w + 14, y + h / 2, 1, col);
                    cv.target(x - 40, y + h / 2 - 30, 38, 60, () => this.stepDraft(key, -1), 'cprev:' + key, 12, true);
                    cv.target(x + w + 2, y + h / 2 - 30, 38, 60, () => this.stepDraft(key, 1), 'cnext:' + key, 12, true);
                }
                cv.target(x, y, w, h, () => this.stepDraft(key, 1), 'cpart:' + key, 12, true);
            });
        } else this.picture(cv, v, 'hero', gx, gy, pw, ph, 18);
        if (moving) setTimeout(() => this.kick(), 16);
        cv.strokeRoundRect(gx - 2, gy - 2, pw + 4, ph + 4, 18, 1, A('#ffffff', 0.14));
        // beside it: the name, what to do, Apply, Reset, Back
        const ch = this.draftChanges(), cx = gx + pw + 20, cw = R - cx, ap = this.applied ? now - this.applied : Infinity;
        cv.roundRect(cx, gy - 2, cw, ph + 4, 18, A(C.panel, 0.92));
        cv.strokeRoundRect(cx, gy - 2, cw, ph + 4, 18, 1, C.faint);
        cv.text('Customise', cx + 22, gy + 38, 30, C.text, { font: B, literal: true });
        cv.text(this.name(v), cx + 22, gy + 66, 20, C.dim, { font: B, literal: true });
        const hint = ch.length ? ['A preview: the cluster', 'changes when you Apply.'] : ['Swipe a part, or tap', 'it or its arrows.'];
        hint.forEach((l, i) => cv.text(l, cx + 22, gy + 104 + i * 24, 18, ch.length ? C.accSoft : C.dim, { font: M, literal: true }));
        const bw = cw - 44, bx = cx + 22, by = gy + ph - 2 - 22 - 50 - 12 - 50 - 12 - 58;
        if (ch.length) {
            cv.roundRect(bx, by, bw, 58, 29, C.acc);
            cv.text('Apply', bx + bw / 2, by + 38, 25, '#ffffff', { font: B, align: 'center', literal: true });
            cv.target(bx, by, bw, 58, () => this.applyDraft(), 'capply', 29);
        } else {
            cv.roundRect(bx, by, bw, 58, 29, ap < 1600 ? A(C.ok, 0.22) : A('#ffffff', 0.06));
            cv.text(ap < 1600 ? 'Applied' : 'Nothing to apply', bx + bw / 2, by + 37, 21, ap < 1600 ? C.ok : C.dim, { font: B, align: 'center', literal: true });
        }
        const ry = by + 58 + 12;
        cv.roundRect(bx, ry, bw, 50, 25, A('#ffffff', 0.10));
        cv.text('Reset', bx + bw / 2, ry + 33, 20, ch.length ? C.soft : C.dim, { font: B, align: 'center', literal: true });
        cv.target(bx, ry, bw, 50, () => this.openCustom(v), 'creset', 25);
        cv.roundRect(bx, ry + 62, bw, 50, 25, A('#ffffff', 0.10));
        cv.text(ch.length ? 'Back, not applied' : 'Back', bx + bw / 2, ry + 95, 20, C.soft, { font: B, align: 'center', literal: true });
        cv.target(bx, ry + 62, bw, 50, () => { this.custom = null; this.draft = null; this.kick(); }, 'customBack', 25);
    }

    /** one setting: label and line under it on the left, a switch or - value + on the right */
    row(cv, x, y, w, h, row) {
        const [k, label, sub, badge, bc] = row, it = this.item(k), mid = y + h / 2;
        cv.fillRect(x, y, w, 1, C.faint);
        let tx = x;
        if (badge) {
            const s = Math.min(60, h - 18);
            cv.roundRect(x, mid - s / 2, s, s, 14, A(bc, 0.18));
            cv.text(badge, x + s / 2, mid + 7, 18, bc, { font: B, align: 'center', literal: true });
            tx = x + s + 22;
        }
        cv.text(label, tx, sub ? mid + 1 : mid + 9, 25, C.text, { font: B, literal: true });
        if (sub) cv.text(sub, tx, mid + 25, 17, C.dim, { font: M, literal: true });
        if (it.type === 'bool') {
            toggle(cv, x + w - 76, mid - 20, this.get(k) === true, 76, 40);
            cv.target(x, y + 4, w, h - 8, () => this.set(k, !(this.get(k) === true)), 'set:' + k, 12);
            return;
        }
        const sw = 320, sh = Math.min(58, h - 16), sx = x + w - sw, sy = mid - sh / 2, v = this.valueText(k);
        cv.roundRect(sx, sy, sw, sh, sh / 2, A('#ffffff', 0.07));
        cv.strokeRoundRect(sx, sy, sw, sh, sh / 2, 1, A('#ffffff', 0.12));
        cv.text('−', sx + 42, mid + 11, 34, C.text, { font: B, align: 'center', literal: true });
        cv.text('+', sx + sw - 42, mid + 11, 34, C.text, { font: B, align: 'center', literal: true });
        // a long value steps the font down (to 20) before it is cut short
        let fs = 26;
        while (fs > 20 && cv.textWidth(v, fs, { font: B, literal: true }) > sw - 170) fs -= 2;
        cv.text(fit(cv, v, fs, sw - 170, B), sx + sw / 2, mid + 9 - Math.round((26 - fs) / 3), fs, v === 'Off' ? C.dim : C.acc, { font: B, align: 'center', literal: true });
        cv.target(sx, sy, 84, sh, () => this.step(k, -1), 'dec:' + k, sh / 2);
        cv.target(sx + sw - 84, sy, 84, sh, () => this.step(k, 1), 'inc:' + k, sh / 2);
    }

    /** a theme's picture in a rounded box; BMW's own (or a missing picture): words on black */
    picture(cv, v, size, x, y, w, h, r) {
        r = r || 18;
        const p = size === 'hero' ? hero(v) : pic(v, size);
        cv.roundRect(x, y, w, h, r, '#000000');
        if (p) cv.image(p.id, x, y, w, h);
        else if (h > 60 && x >= L && x + w <= R) cv.text(v === 'off' ? 'BMW\'s own cluster' : this.name(v), x + w / 2, y + h / 2 + 8, Math.min(30, h / 6), '#59606b', { font: M, align: 'center', literal: true });
    }
}

/* ---------- pieces ---------- */
function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fit(cv, s, size, w, font) {
    if (cv.textWidth(s, size, { font, literal: true }) <= w) return s;
    while (s.length > 1 && cv.textWidth(s + '…', size, { font, literal: true }) > w) s = s.slice(0, -1);
    return s + '…';
}
function glass(cv, x, y, w, h, sel) {
    cv.roundRect(x, y, w, h, 14, sel ? A(C.acc, 0.12) : C.glass);
    cv.strokeRoundRect(x, y, w, h, 14, sel ? 2 : 1, sel ? C.acc : C.faint);
}
function toggle(cv, x, y, on, w, h) {
    w = w || 58; h = h || 30;
    cv.roundRect(x, y, w, h, h / 2, on ? C.acc : A('#ffffff', 0.18));
    cv.circle(on ? x + w - h / 2 : x + h / 2, y + h / 2, h / 2 - 4, '#ffffff');
}
function pill(cv, xr, y, s, c) {
    const w = cv.textWidth(s, 17, { font: B, spacing: 2, literal: true }) + 56;
    cv.roundRect(xr - w, y, w, 40, 20, A('#000000', 0.66));
    cv.circle(xr - w + 22, y + 20, 5, c);
    cv.text(s, xr - w + 36, y + 26, 17, c, { font: B, spacing: 2, literal: true });
}
/** small, quiet arrows on Customise's parts: up (d -1) or down (d 1); left (d -1) or right (d 1) */
function smallChevron(cv, x, y, d, c) {
    cv.line(x - 11, y - 5 * d, x, y + 5 * d, 2.5, c);
    cv.line(x, y + 5 * d, x + 11, y - 5 * d, 2.5, c);
}
function smallArrow(cv, x, y, d, c) {
    cv.line(x - 5 * d, y - 11, x + 5 * d, y, 2.5, c);
    cv.line(x + 5 * d, y, x - 5 * d, y + 11, 2.5, c);
}
/** a plain chevron at the screen's edge, pointing d (-1 left, 1 right) */
function arrow(cv, x, y, d) {
    cv.line(x - 9 * d, y - 22, x + 9 * d, y, 4, A('#ffffff', 0.85));
    cv.line(x + 9 * d, y, x - 9 * d, y + 22, 4, A('#ffffff', 0.85));
}
module.exports = Page;
