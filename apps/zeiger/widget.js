'use strict';
/**
 * widget.js - Zeiger's home-screen widget (app.json "startWidget"; the kit's ctx.widget, kit/runtime/mgu.js). The
 * setting "Home-screen widget" picks what it shows:
 *
 *   mist     the weather in Mist's look (the default): Mist's photo (hud/pictures/mist_widget.json, baked by
 *            cluster-design/mist/widget_bg.html) with the place, the temperature now, the weather now in a word,
 *            today's high, low and chance of rain on the left, and the next three days on the right, in the cluster
 *            themes' own fonts (s_mid, s_small, s_icon), white and the theme's grey.
 *   sunrise  the same in the first Sunrise theme's look (the sunrise over mountains, before Dark Moon:
 *            hud/pictures/sunrise_widget.json, baked by cluster-design/sunrise/widget_bg.html), the text on its sky.
 *   theme    the theme the cluster shows now: ZEIGER, that theme's picture (the one the page's gallery shows,
 *            hud/previews), its name and, while the theme changes with the drive mode, the mode.
 *
 * weather.js fetches while a widget is placed and shows the weather (its "widget" want, apart from the themes').
 *
 * The small widget shows no picture, only the layout's text lines (the same words). Drawn again when what it shows
 * changes, else the same picture every REDRAW_MS (in case the HMI dropped it). BMW's Drive Recorder widget layout, as
 * the kit's Live Data uses (checked on a G05): the HMI scales the 384 x 256 picture up, crops a little of every edge
 * and fades them (startWidget.safe, kept clear here).
 */
const zlib = require('zlib');
const data = require('./hud_data');
const text = require('./hud_text');
const { Canvas } = require('./kit/canvas');

const REDRAW_MS = 30000;
const DIM = [150, 158, 170], FRAME = [58, 64, 74], WHITE = [242, 244, 247];
// the weather's looks: the background (hud/pictures) and the theme's colours (shared/hud_themes.js: fg, dim; rev.from
// for the rain; bar.mid for OFFLINE); shadow: how dark the soft shadow under the text is
const LOOKS = {
    mist: { bg: 'mist_widget', fg: [255, 255, 255], dim: [200, 208, 216], rain: [127, 212, 255], warn: [255, 154, 60], shadow: 0.55 },
    sunrise: { bg: 'sunrise_widget', fg: [255, 255, 255], dim: [196, 208, 220], rain: [127, 212, 255], warn: [255, 154, 60], shadow: 0.35 },
};

/** RGBA rows sw x sh shrunk to tw x th by averaging each target pixel's area (a clean picture, no stair steps) */
function shrink(px, sw, sh, tw, th) {
    const out = new Uint8Array(tw * th * 4), fx = sw / tw, fy = sh / th;
    for (let y = 0; y < th; y++) {
        const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
        for (let x = 0; x < tw; x++) {
            const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
            let r = 0, g = 0, b = 0, n = 0;
            for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * sw + xx) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; }
            const o = (y * tw + x) * 4;
            out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
        }
    }
    return out;
}

/** A coverage mask w x h scaled to tw x th, each target pixel the exact area average of what it covers (any factor
 *  below 1: the fonts are baked big, the widget's text is small) */
function scaleMask(m, w, h, tw, th) {
    const fx = w / tw, fy = h / th, row = new Float32Array(tw * h), out = Buffer.alloc(tw * th);
    for (let x = 0; x < tw; x++) {
        const a = x * fx, b = a + fx;
        for (let i = Math.floor(a); i < Math.min(w, Math.ceil(b)); i++) {
            const k = Math.min(b, i + 1) - Math.max(a, i);
            for (let y = 0; y < h; y++) row[y * tw + x] += m[y * w + i] * k;
        }
    }
    const col = new Float32Array(tw);
    for (let y = 0; y < th; y++) {
        col.fill(0);
        const a = y * fy, b = a + fy;
        for (let j = Math.floor(a); j < Math.min(h, Math.ceil(b)); j++) {
            const k = Math.min(b, j + 1) - Math.max(a, j);
            for (let x = 0; x < tw; x++) col[x] += row[j * tw + x] * k;
        }
        for (let x = 0; x < tw; x++) out[y * tw + x] = Math.min(255, Math.round(col[x] / (fx * fy)));
    }
    return out;
}

/** A soft copy of a mask (box blur of radius r, twice: about a gaussian), for the text's shadow */
function soften(m, w, h, r) {
    let a = Float32Array.from(m), b = new Float32Array(a.length);
    const n = 2 * r + 1;
    for (let p = 0; p < 2; p++) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            let s = 0;
            for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) s += a[y * w + xx]; }
            b[y * w + x] = s / n;
        }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            let s = 0;
            for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) s += b[yy * w + x]; }
            a[y * w + x] = s / n;
        }
    }
    return a;
}

/** The theme fonts' letters for a place's name: capitals, accents dropped (Čačak -> CACAK), anything else left out */
function plain(s, font) {
    let t = String(s || '').toUpperCase().replace(/Đ/g, 'D').replace(/Ł/g, 'L').replace(/Ø/g, 'O').replace(/Æ/g, 'AE').replace(/ß/g, 'SS');
    try { t = t.normalize('NFD'); } catch (e) { /* an old ICU: as it is */ }
    const g = text.loadFont(font).metrics.glyphs;
    return t.split('').filter((ch) => g[ch]).join('').replace(/\s+/g, ' ').trim();
}

/** A place's name for the widget's text cells, which take ASCII only (Čačak -> Cacak) */
function ascii(s) {
    let t = String(s || '').replace(/Đ/g, 'D').replace(/đ/g, 'd').replace(/Ł/g, 'L').replace(/ł/g, 'l').replace(/ß/g, 'ss');
    try { t = t.normalize('NFD'); } catch (e) { /* an old ICU: as it is */ }
    return t.replace(/[^\x20-\x7e]/g, '').trim();
}

class ZeigerWidget {
    constructor(ctx, hud) {
        this.ctx = ctx; this.hud = hud;
        this.pics = Object.create(null);     // theme -> its shrunk picture (or null: none)
        this.cv = null; this.key = null;     // the big widget's picture, and what it shows
        this.sent = Object.create(null);     // spawnId -> { key, at }: the last picture handed to the kit
        this.cells = Object.create(null);    // spawnId -> { cell: value }: the text cells written
        this.bg = Object.create(null);       // a look's background -> RGBA (W x H), or null: none
        const sw = ctx.spec.startWidget || {};
        [this.W, this.H] = sw.size || [384, 256];
        const safe = sw.safe || [0.09, 0.1];
        this.box = { x: Math.round(this.W * safe[0]), y: Math.round(this.H * safe[1]) };
        this.box.w = this.W - 2 * this.box.x; this.box.h = this.H - 2 * this.box.y;
    }

    start() {
        const w = this.ctx.widget;
        if (!w) return;
        w.loop(1, (inst) => this.draw(inst));
        // placed, resized or shown again: write everything anew; the last one taken away: no more weather
        w.onChange((why) => {
            if (why !== 'hidden') { this.sent = Object.create(null); this.cells = Object.create(null); }
            this._want();
        });
        this._want();
    }

    /** 'theme', or the weather's look: 'mist' or 'sunrise' (the setting) */
    shows() {
        let v = 'mist';
        try { v = this.hud.setting('widgetShows'); } catch (e) { v = 'mist'; }
        return v === 'theme' || LOOKS[v] ? v : 'mist';
    }

    // the weather is fetched while a widget is placed and shows it
    _want() {
        const wx = this.hud.wx, w = this.ctx.widget;
        if (wx) wx.want(!!w && w.instances().length > 0 && this.shows() !== 'theme', 'widget');
    }

    /** What the widget says now: { kind: 'theme', name ('off' or a layout), title, mode } or { kind: 'weather', ... } */
    state() {
        if (this.shows() !== 'theme') return this.weather(this.shows());
        const h = this.hud, name = h.activeName && h.activeName !== 'off' ? h.activeName : 'off';
        let title = '', mode = '';
        if (name !== 'off') { try { title = (data.json('layouts/' + name + '.json') || {}).name || name; } catch (e) { title = name; } }
        try {
            if (h.setting('byMode') === true) { const m = h._token('modeShort'); mode = m ? m + ' · by drive mode' : 'by drive mode'; }
        } catch (e) { mode = ''; }
        return { kind: 'theme', name, title, mode };
    }

    /** The weather to show: { kind: 'weather', look, city, us, now, days, net } (now: weather.js today() or null) */
    weather(look) {
        const wx = this.hud.wx;
        let us = false;
        try { us = this.hud.setting('units') === 'us'; } catch (e) { us = false; }
        if (!wx) return { kind: 'weather', look, city: '', us, now: null, days: [], net: 'off' };
        return { kind: 'weather', look, city: wx.city(), us, now: wx.today(), days: wx.days(), net: wx.state };
    }

    draw(inst) {
        this._want();
        const s = this.state(), key = JSON.stringify(s), now = Date.now();
        this._text(inst, s);
        if (!inst.big) return null;
        const last = this.sent[inst.spawnId];
        if (last && last.key === key && now - last.at < REDRAW_MS) return null;
        if (this.key !== key) { this.cv = s.kind === 'weather' ? this.renderWeather(s) : this.render(s); this.key = key; }
        this.sent[inst.spawnId] = { key, at: now };
        return this.cv;
    }

    /** The small widget's lines (the big one leaves them empty: its picture says it). ASCII only (the kit's widgetText). */
    _text(inst, s) {
        const small = !inst.big, l = small ? this._lines(s) : ['', '', '', ''];
        const cells = { Title: l[0], TextRecordings: l[1], TextCam: l[2], TimeElapsed: l[3], TimeRemaining: '' };
        const prev = this.cells[inst.spawnId] || (this.cells[inst.spawnId] = {});
        Object.keys(cells).forEach((k) => {
            if (prev[k] === cells[k]) return;
            prev[k] = cells[k];
            this.ctx.widget.set(inst.spawnId, k, cells[k], 'Text');
        });
    }

    _lines(s) {
        if (s.kind === 'theme') return ['Zeiger', s.name === 'off' ? 'Off, BMW\'s own cluster' : s.title, s.mode.replace(' · ', ', '), ''];
        const t = s.now, deg = (v) => this._deg(v, s.us), u = s.us ? ' F' : ' C';
        const cap = (w) => String(w || '').toLowerCase().replace(/^./, (c) => c.toUpperCase());
        const title = ascii(s.city) || 'Weather';
        if (!t) return [title, s.net === 'offline' ? 'No internet' : s.net === 'error' ? 'No forecast' : 'Loading...', '', ''];
        const next = s.days.slice(1, 4).map((d) => cap(d.wd) + ' ' + deg(d.hi) + '/' + deg(d.lo)).join('   ');
        return [title, deg(t.now) + u + ', ' + cap(t.nowWord), 'H ' + deg(t.hi) + '  L ' + deg(t.lo) + (typeof t.rain === 'number' ? '  Rain ' + Math.round(t.rain) + '%' : ''), next];
    }

    _deg(v, us) { return typeof v === 'number' && isFinite(v) ? String(Math.round(us ? v * 9 / 5 + 32 : v)) : '--'; }

    /** That theme's picture, shrunk to w wide (its own proportions), or null */
    _picture(name, w) {
        const k = name + ':' + w;
        if (this.pics[k] !== undefined) return this.pics[k];
        let out = null;
        try {
            const p = (data.json('previews/' + name + '.json') || {}).big;
            if (p && p.z) {
                const px = zlib.inflateSync(Buffer.from(p.z, 'base64'));
                const h = Math.round(w * p.h / p.w);
                if (px.length === p.w * p.h * 4) out = { w, h, d: shrink(px, p.w, p.h, w, h) };
            }
        } catch (e) { out = null; }
        this.pics[k] = out;
        return out;
    }

    /** The big widget's picture for the theme state s (a kit Canvas) */
    render(s) {
        const W = this.W, b = this.box, cx = W / 2, cv = new Canvas(W, this.H).clear([0, 0, 0, 255]);
        cv.text('ZEIGER', cx, b.y + 18, 15, DIM, { font: 'bold', align: 'center', literal: true, spacing: 3 });
        if (s.name === 'off') {
            cv.text('Off', cx, b.y + b.h / 2 + 6, 30, WHITE, { font: 'bold', align: 'center', literal: true });
            cv.text('BMW\'s own cluster', cx, b.y + b.h / 2 + 34, 16, DIM, { align: 'center', literal: true });
            return cv;
        }
        const pic = this._picture(s.name, b.w), py = b.y + 30;
        if (pic) {
            cv.drawImage(pic.d, pic.w, pic.h, b.x, py, pic.w, pic.h);
            cv.strokeRoundRect(b.x - 1, py - 1, pic.w + 2, pic.h + 2, 3, 1, FRAME);
        }
        const ty = py + (pic ? pic.h : 100) + 30;
        cv.text(s.title, cx, ty, 22, WHITE, { font: 'bold', align: 'center', literal: true });
        if (s.mode) cv.text(s.mode, cx, ty + 22, 14, DIM, { align: 'center', literal: true });
        return cv;
    }

    /* ---------------- the weather, in Mist's look ---------------- */

    /** A look's background (RGBA), or null */
    _background(name) {
        if (this.bg[name] !== undefined) return this.bg[name];
        let out = null;
        try {
            const p = data.json('pictures/' + name + '.json') || {};
            if (p.z) {
                const px = zlib.inflateSync(Buffer.from(p.z, 'base64'));
                if (px.length === p.w * p.h * 4) out = { w: p.w, h: p.h, d: new Uint8Array(px.buffer, px.byteOffset, px.length) };
            }
        } catch (e) { out = null; }
        this.bg[name] = out;
        return out;
    }

    /**
     * Text in a theme font at `size` px (the font is baked bigger and shrunk here), coloured c, with a soft dark
     * shadow so it reads on the bright mist. x: the left edge (align 'right': the right edge); y: the baseline, or
     * the top with opts.top. opts.spacing: px between letters at the widget's size. Returns the width drawn.
     */
    _write(cv, str, font, size, x, y, c, opts) {
        opts = opts || {};
        str = String(str);
        if (!str) return 0;
        const f = text.loadFont(font), m = f.metrics, k = size / m.size, sp = (opts.spacing || 0) / k;
        const bw = Math.ceil(text.measure(str, font, sp)) + 2, bh = m.cellHeight;
        const tw = Math.max(1, Math.round(bw * k)), th = Math.max(1, Math.round(bh * k));
        const cov = scaleMask(text.mask(bw, bh, str, { font, spacing: sp, x: 1 }), bw, bh, tw, th);
        const left = Math.round(opts.align === 'right' ? x - tw : opts.align === 'center' ? x - tw / 2 : x);
        const top = Math.round(opts.top ? y : y - m.baseline * k);
        if (opts.shadow !== false) {
            const r = Math.max(1, Math.round(size / 12)), pad = 2 * r, sw = tw + 2 * pad, sh = th + 2 * pad;
            const big = Buffer.alloc(sw * sh);
            for (let yy = 0; yy < th; yy++) cov.copy(big, (yy + pad) * sw + pad, yy * tw, yy * tw + tw);
            const soft = soften(big, sw, sh, r), d = new Uint8Array(sw * sh * 4), sa = opts.shadow || 0.55;
            for (let i = 0; i < soft.length; i++) d[i * 4 + 3] = Math.min(255, Math.round(soft[i] * sa * 1.6));
            cv.blit({ w: sw, h: sh, d }, left - pad, top - pad + 1);
        }
        const d = new Uint8Array(tw * th * 4);
        for (let i = 0; i < cov.length; i++) { const o = i * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = cov[i]; }
        cv.blit({ w: tw, h: th, d }, left, top);
        return tw;
    }

    _width(str, font, size, spacing) {
        const f = text.loadFont(font), k = size / f.metrics.size;
        return Math.round((text.measure(String(str), font, (spacing || 0) / k) + 2) * k);
    }

    /**
     * The big widget's picture for the weather state s (a kit Canvas). One grid for both looks, every line on a
     * baseline the other side shares: the place (44); the temperature now (118) with its icon; the weather now in a
     * word (146); today's line (170: high, low, and the chance of rain in the rain's blue, as the cluster's wxLine);
     * on the right the next three days on 74 / 122 / 170, so the last day sits on today's line. All of it above
     * y 180, where Sunrise's horizon starts.
     */
    renderWeather(s) {
        const W = this.W, H = this.H, b = this.box, cv = new Canvas(W, H).clear([8, 10, 14, 255]);
        const lk = LOOKS[s.look] || LOOKS.mist, bg = this._background(lk.bg), sh = lk.shadow;
        if (bg) cv.drawImage(bg.d, bg.w, bg.h, 0, 0, W, H);
        const deg = (v) => this._deg(v, s.us) + '°';
        const L = b.x + 4, R = b.x + b.w - 2;              // the text's left and right edges
        const Y_PLACE = b.y + 18, Y_NOW = b.y + 92, Y_WORD = b.y + 120, Y_LINE = b.y + 144, ROW = 48;
        // the place, small and spaced, over everything (OFFLINE beside it while the forecast shown is a kept one)
        let place = plain(s.city, 's_small') || 'WEATHER';
        while (place.length > 3 && this._width(place, 's_small', 13, 2) > 190) place = place.slice(0, -1).trim();
        const pw = this._write(cv, place, 's_small', 13, L, Y_PLACE, lk.dim, { spacing: 2, shadow: sh });
        const t = s.now;
        if (t && (s.net === 'offline' || s.net === 'error')) this._write(cv, 'OFFLINE', 's_small', 11, L + pw + 10, Y_PLACE, lk.warn, { spacing: 1.5, shadow: sh });
        if (!t) {
            const what = s.net === 'offline' ? ['NO INTERNET', 'TURN ON THE STORE INTERNET UPLINK'] : s.net === 'error' ? ['NO FORECAST', 'TRYING AGAIN IN A FEW MINUTES'] : ['LOADING', 'THE FORECAST IS ON ITS WAY'];
            this._write(cv, what[0], 's_small', 22, L, Y_WORD - 14, lk.fg, { spacing: 2, shadow: sh });
            this._write(cv, what[1], 's_small', 12, L, Y_WORD + 10, lk.dim, { spacing: 1, shadow: sh });
            return cv;
        }
        // now: the temperature big, the weather's icon beside it, the word under them
        const tw = this._write(cv, deg(t.now), 's_mid', 74, L - 3, Y_NOW, lk.fg, { shadow: sh + 0.05 });
        if (t.nowIcon) this._write(cv, t.nowIcon, 's_icon', 50, L + tw + 6, b.y + 36, lk.fg, { top: true, shadow: sh + 0.05 });
        let word = t.nowWord || '';
        if (this._width(word, 's_small', 17, 2) > 180) word = word.split(' ').pop();
        this._write(cv, word, 's_small', 17, L, Y_WORD, lk.fg, { spacing: 2, shadow: sh });
        // the next three days: the day, its icon, the high (white) and the low (grey), in columns laid out from the
        // right edge as wide as their widest entry
        const next = s.days.slice(1, 4), rowH = ROW, y0 = Y_LINE - 2 * ROW, GAP = 9, ICON = 26;
        const colW = (f) => Math.max.apply(null, next.map(f).concat([0]));
        const loW = colW((d) => this._width(deg(d.lo), 's_small', 15)), hiW = colW((d) => this._width(deg(d.hi), 's_small', 15));
        const icW = colW((d) => (d.icon ? this._width(d.icon, 's_icon', ICON) : 0));
        const hiR = R - loW - GAP, icC = hiR - hiW - GAP - icW / 2, dayX = icC - icW / 2 - GAP - colW((d) => this._width(d.wd, 's_small', 13, 1.5));
        // today's line: high, low, the chance of rain; shorter where it would reach the last day's name (°F, -15°)
        const rain = typeof t.rain === 'number' ? Math.round(t.rain) + '%' : '', room = (next.length ? dayX - 12 : R) - L;
        const forms = [[['H ' + deg(t.hi), 12], ['L ' + deg(t.lo), 14], rain ? 'RAIN ' + rain : ''], [['H ' + deg(t.hi), 8], ['L ' + deg(t.lo), 10], rain ? 'RAIN ' + rain : ''],
            [[deg(t.hi) + ' / ' + deg(t.lo), 10], ['', 0], rain ? 'RAIN ' + rain : ''], [[deg(t.hi) + ' / ' + deg(t.lo), 10], ['', 0], rain]];
        const wide = (f) => this._width(f[0][0], 's_small', 15, 1) + f[0][1] + (f[1][0] ? this._width(f[1][0], 's_small', 15, 1) + f[1][1] : 0) + (f[2] ? this._width(f[2], 's_small', 15, 1) : 0);
        const form = forms.filter((f) => wide(f) <= room)[0] || forms[forms.length - 1];
        let x = L + this._write(cv, form[0][0], 's_small', 15, L, Y_LINE, lk.dim, { spacing: 1, shadow: sh }) + form[0][1];
        if (form[1][0]) x += this._write(cv, form[1][0], 's_small', 15, x, Y_LINE, lk.dim, { spacing: 1, shadow: sh }) + form[1][1];
        if (form[2]) this._write(cv, form[2], 's_small', 15, x, Y_LINE, lk.rain, { spacing: 1, shadow: sh });
        next.forEach((d, i) => {
            const base = y0 + i * rowH;
            this._write(cv, d.wd, 's_small', 13, dayX, base, lk.dim, { spacing: 1.5, shadow: sh });
            if (d.icon) this._write(cv, d.icon, 's_icon', ICON, icC, base - 21, lk.fg, { top: true, align: 'center', shadow: sh });
            this._write(cv, deg(d.hi), 's_small', 15, hiR, base, lk.fg, { align: 'right', shadow: sh });
            this._write(cv, deg(d.lo), 's_small', 15, R, base, lk.dim, { align: 'right', shadow: sh });
        });
        return cv;
    }
}

module.exports = ZeigerWidget;
