'use strict';
/**
 * page.js - Zeiger's own page on the centre screen (written new for 0.24.0, Nov 15 2026; the design:
 * cluster-design/app_ui/mock.html ?v=c and ?v=c2 next to this repo).
 *
 * Two tabs in the header:
 *   Themes    a gallery: the theme being looked at big in the middle, its neighbours beside it, a dot per theme
 *             under it, and under that the drive modes (with "Change with the drive mode" on: which theme each one
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
    map_mist: 'The phone\'s map in the middle of Mist\'s photo',
    off: 'No theme: BMW\'s own cluster shows',
};

/* ---------- the settings, in groups ---------- */
const GROUPS = [
    { name: 'Cluster', about: 'How the themes show on the cluster.', rows: [
        ['startAnim', 'Start animation', 'when a theme first shows, never while moving'],
        ['weather', 'Today\'s weather', 'Dark Moon, Underpass, Mist · needs the internet uplink'],
        ['mapInTheme', 'The phone\'s map in Map Mist', 'through waze-on-cluster'],
        ['shiftX', 'Theme position', 'to the right of BMW\'s own cluster'],
        ['nightDim', 'Night colours', 'dimmer colours after sunset'],
    ] },
    { name: 'BMW\'s cluster', about: 'What BMW draws under and over the themes.', rows: [
        ['hideBoxes', 'Hide BMW\'s black boxes', 'test'],
        ['stripClear', 'Leave BMW\'s bottom strip clear', 'the theme only above it'],
    ] },
    { name: 'Warnings', about: 'Over its limit, the value flashes red on the cluster. Not during the start animation.', rows: [
        ['warnOil', 'Oil temperature', 'flashes from', 'OIL', '#ffb23e'],
        ['warnCoolant', 'Coolant temperature', 'flashes from', 'H₂O', '#59c7ff'],
        ['warnBoost', 'Boost', 'Apex, Vintage · flashes from', 'BAR', '#c58cff'],
    ] },
    { name: 'Shift point', about: 'Where Apex Sport\'s rev band flashes, and the shift light.', rows: [
        ['redline', 'Redline', 'where the shift light ends'],
        ['shiftBefore', 'Shift point', 'before the redline'],
        ['shiftFlash', 'Shift flash', 'Apex Sport: white, yellow, then red'],
        ['coldGuard', 'Cold-engine rev guard', 'an earlier shift point while the engine is cold'],
    ] },
    { name: 'Units and time', about: 'km/h and °C are drawn into the themes: keep the units metric.', rows: [
        ['units', 'Units', 'speed, temperatures, pressure'],
        ['clock', 'Clock', '12 or 24 hours'],
        ['timeZone', 'Time zone', 'the head unit\'s clock runs on UTC'],
        ['tankLitres', 'Fuel tank', 'for the fuel level, where the engine unit doesn\'t give it'],
    ] },
    { name: 'Home-screen widget', about: 'Hold a finger on an iDrive home-screen tile and pick Zeiger to place it.', rows: [
        ['widgetShows', 'Shows', 'the weather, or the theme the cluster shows'],
    ] },
    { name: 'About', about: null, rows: [
        ['demo', 'Demo data', 'made-up values while the car sends none'],
    ] },
];
const CREDITS = [
    'Zeiger by vucko-adv. Every theme is drawn by vucko-adv.',
    'Forked from bimmer-lab/apps (Cluster Themes), MIT.',
    'MGU App Kit by cauliflowermossgrape (MIT); cluster-render by Robert Nisipeanu (MPL 2.0).',
    'Fonts: Barlow, Michroma (SIL Open Font License). Details: NOTICE.',
];

/* ---------- theme pictures (hud/previews/<layout>.json: big, small, hero) ---------- */
const IMG = 0x5a500000;              // our image ids ('ZP' + n), clear of the kit's own
const HERO = IMG;                    // one slot for the big picture: set again when another theme is looked at
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
let heroName = null, heroPic = null;
/** the big card's picture: 'hero' (1152 x 432) where there is one, else 'big'; one slot, so one in memory */
function hero(name) {
    if (name === heroName) return heroPic;
    heroName = name;
    const d = name === 'off' ? null : decode(name, 'hero') || decode(name, 'big');
    heroPic = d ? { id: HERO, w: d.w, h: d.h } : null;
    if (d) rec.setImage(HERO, d.w, d.h, d.px);
    return heroPic;
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
    }

    start() {
        const ctx = this.ctx;
        // the kit's header in Zeiger's orange
        Object.assign(ctx.theme(), { sel: C.acc, selText: '#ffffff', accent2: C.accSoft, bg: C.bg });
        if (ctx.onTab) ctx.onTab((i) => this.openTab(i));
        this.loop = ctx.loop('MAIN', 10, () => this.render());
        ctx.settings.onChange(() => this.kick());
        ctx.onLayout(() => this.kick());
        this.hud.onStatus(() => this.kick());
        this.render();
    }
    kick() { if (this.loop && this.loop.kick) this.loop.kick(); }
    openTab(i) { if (i === 0 || i === 1) { this.tab = i; this.kick(); } }

    /* ---------- settings ---------- */
    get(k) { return this.hud.setting(k); }
    set(k, v) { if (this.ctx.settings.get(k) !== v) this.ctx.settings.set(k, v); this.kick(); }
    item(k) { return this.ctx.settings.item(k) || {}; }
    optLabel(k, v) { const o = (this.item(k).options || []).find((x) => x[0] === v); return o ? o[1] : String(v); }
    /** the values a stepper goes through */
    steps(k) {
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
        this.set(k, list[Math.max(0, Math.min(list.length - 1, i + d))]);
    }
    us() { return this.get('units') === 'us'; }
    valueText(k) {
        const v = this.get(k), it = this.item(k);
        if (k === 'warnOil' || k === 'warnCoolant') return v ? (this.us() ? Math.round(v * 9 / 5 + 32) + ' °F' : v + ' °C') : 'Off';
        if (k === 'warnBoost') return v ? (this.us() ? Math.round(v * 14.5) + ' psi' : v.toFixed(1) + ' bar') : 'Off';
        if (k === 'shiftX') return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' px';
        if (k === 'redline') return num(v) + ' rpm';
        if (k === 'shiftBefore') return v ? num(v) + ' rpm' : 'At the redline';
        if (k === 'tankLitres') return v + ' L';
        if (k === 'timeZone') return tz.name(v);
        if (k === 'nightDim') return v === 'off' ? 'Off' : 'Auto';
        if (it.type === 'bool') return v ? 'On' : 'Off';
        return this.optLabel(k, v);
    }
    summary(g) {
        const on = (k) => this.get(k) === true;
        if (g.name === 'Cluster') return 'start animation ' + (on('startAnim') ? 'on' : 'off') + ' · position ' + this.valueText('shiftX');
        if (g.name === 'Warnings') {
            const s = [['warnOil', 'oil'], ['warnCoolant', 'coolant'], ['warnBoost', 'boost']].filter((x) => this.get(x[0])).map((x) => x[1] + ' ' + this.valueText(x[0]));
            return s.length ? s.join(' · ') : 'all off';
        }
        if (g.name === 'Shift point') return 'redline ' + this.valueText('redline') + ' · flash ' + (on('shiftFlash') ? 'on' : 'off');
        if (g.name === 'Units and time') return (this.us() ? 'mph' : 'km/h') + ' · ' + this.valueText('clock') + ' · ' + this.valueText('timeZone');
        if (g.name === 'Home-screen widget') return this.valueText('widgetShows');
        if (g.name === 'BMW\'s cluster') return 'black boxes ' + (on('hideBoxes') ? 'hidden' : 'shown') + ' · bottom strip ' + (on('stripClear') ? 'clear' : 'covered');
        return 'version ' + ((this.ctx.spec && this.ctx.spec.version) || '?') + ' · credits';
    }

    /* ---------- themes ---------- */
    looks() { return (this.item('inSport').options || []).map((o) => o[0]); }
    name(v) { return v === 'off' ? 'BMW\'s own' : this.optLabel('hudLayout', v); }
    shown() { return this.hud.activeName || this.hud._layoutName() || 'off'; }
    carMode() { const m = MODES.find((x) => x[2] === this.hud.driveMode); return m ? m[0] : null; }
    /** the setting the gallery's "Use" sets: a drive mode's own while the theme changes with it, else hudLayout */
    key() { return this.get('byMode') === true ? this.mode || this.carMode() || 'inComfort' : 'hudLayout'; }
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
            demo ? { text: 'DEMO DATA', color: C.warn } : null,
            { text: on ? 'CLUSTER ON' : 'CLUSTER OFF', color: on ? C.ok : C.dim },
        ]);
        // the header drawn on the page itself (not the kit's full-screen one): its tabs take taps here
        if (!cv.chrome && cv.tabRects) cv.tabRects.forEach((r) => cv.target(r.x, r.y, r.w, r.h, () => this.openTab(r.i), 'tab:' + r.i, 0));
        if (this.tab === 0) this.gallery(cv, bottom); else this.settings(cv, bottom);
        return this.ctx.ui.image('MAIN_GFX', cv);
    }

    gallery(cv, bottom) {
        const looks = this.looks(), key = this.key(), cur = this.get(key), shown = this.shown();
        if (this.atFor !== key || looks.indexOf(this.at) < 0) { this.at = looks.indexOf(cur) >= 0 ? cur : looks[0]; this.atFor = key; }
        const i = looks.indexOf(this.at), go = (d) => () => { this.at = looks[(i + d + looks.length) % looks.length]; this.kick(); };
        // the big card and its neighbours
        const ch = Math.min(440, bottom - 48 - 104), cw = Math.round(ch * 8 / 3), cx = (W - cw) / 2, cy = 48;
        const sh = Math.round(ch * 0.8), sw = Math.round(sh * 8 / 3), sy = cy + (ch - sh) / 2;
        const side = (v, x, d) => {
            cv.clip(L, sy, R - L, sh);
            this.picture(cv, v, 'big', x, sy, sw, sh);
            cv.roundRect(x, sy, sw, sh, 18, A(C.bg, 0.62));
            cv.noclip();
            cv.target(Math.max(L, x), sy, Math.min(R, x + sw) - Math.max(L, x), sh, go(d), 'side:' + d, 18);
        };
        side(looks[(i - 1 + looks.length) % looks.length], cx - 24 - sw, -1);
        side(looks[(i + 1) % looks.length], cx + cw + 24, 1);
        this.picture(cv, this.at, 'hero', cx, cy, cw, ch);
        cv.gradientRect(cx, cy + ch - 170, cw, 170, [[0, A('#000000', 0)], [0.5, A('#000000', 0.78)], [1, A('#000000', 0.94)]]);
        cv.strokeRoundRect(cx, cy, cw, ch, 22, 1, A('#ffffff', 0.12));
        cv.text(this.name(this.at), cx + 30, cy + ch - 56, 46, C.text, { font: B, literal: true });
        cv.text(ABOUT[this.at] || '', cx + 30, cy + ch - 22, 21, C.soft, { font: M, literal: true });
        if (this.at === shown) pill(cv, cx + cw - 22, cy + 20, 'ON THE CLUSTER', C.ok);
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
        arrow(cv, cx - 34, cy + ch / 2, -1); cv.target(cx - 68, cy + ch / 2 - 34, 68, 68, go(-1), 'prev', 34);
        arrow(cv, cx + cw + 34, cy + ch / 2, 1); cv.target(cx + cw, cy + ch / 2 - 34, 68, 68, go(1), 'next', 34);
        // a dot per theme
        const dw = looks.reduce((a, v) => a + (v === this.at ? 30 : 9) + 10, -10);
        let dx = (W - dw) / 2;
        looks.forEach((v) => { const w = v === this.at ? 30 : 9; cv.roundRect(dx, cy + ch + 13, w, 9, 4.5, v === this.at ? C.acc : A('#ffffff', 0.22)); dx += w + 10; });
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
        if (g.about) { cv.text(g.about, px + 32, py + 86, 19, C.dim, { font: M, literal: true }); y = py + 104; }
        const credits = g.name === 'About';
        const room = py + ph - 10 - y - (credits ? CREDITS.length * 28 + 24 : 0);
        const rh = Math.min(84, Math.floor(room / g.rows.length));
        g.rows.forEach((row, j) => this.row(cv, px + 32, y + j * rh, pw - 64, rh, row));
        if (credits) {
            const cy = y + g.rows.length * rh + 18;
            cv.fillRect(px + 32, cy - 8, pw - 64, 1, C.faint);
            CREDITS.forEach((s, j) => cv.text(s, px + 32, cy + 22 + j * 28, 18, j ? C.dim : C.soft, { font: M, literal: true }));
        }
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
        cv.text(fit(cv, v, 26, sw - 170, B), sx + sw / 2, mid + 9, 26, v === 'Off' ? C.dim : C.acc, { font: B, align: 'center', literal: true });
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
function arrow(cv, x, y, d) {
    cv.circle(x, y, 30, A('#000000', 0.72));
    cv.arc(x, y, 29, 30, 0, 360, A('#ffffff', 0.22));
    cv.line(x + 6 * d * -1 + 1 * d, y - 11, x + 6 * d, y, 3, '#ffffff');
    cv.line(x + 6 * d, y, x + 6 * d * -1 + 1 * d, y + 11, 3, '#ffffff');
}
module.exports = Page;
