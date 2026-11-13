'use strict';
/**
 * widget.js - Zeiger's home-screen widget (app.json "startWidget"; the kit's ctx.widget, kit/runtime/mgu.js): the
 * theme the cluster shows now. The big widget: ZEIGER, that theme's picture (the one the page's gallery shows,
 * hud/previews), its name and, while the theme changes with the drive mode, the mode; the small widget shows no
 * picture, only the layout's text lines, the same words. Drawn again when the theme or the mode changes, else the
 * same picture every REDRAW_MS (in case the HMI dropped it). BMW's Drive Recorder widget layout, as the kit's Live
 * Data uses (checked on a G05): the HMI scales the 384 x 256 picture up, crops a little of every edge and fades
 * them (startWidget.safe, kept clear here).
 */
const zlib = require('zlib');
const data = require('./hud_data');
const { Canvas } = require('./kit/canvas');

const REDRAW_MS = 30000;
const DIM = [150, 158, 170], FRAME = [58, 64, 74], WHITE = [242, 244, 247];

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

class ZeigerWidget {
    constructor(ctx, hud) {
        this.ctx = ctx; this.hud = hud;
        this.pics = Object.create(null);     // theme -> its shrunk picture (or null: none)
        this.cv = null; this.key = null;     // the big widget's picture, and what it shows
        this.sent = Object.create(null);     // spawnId -> { key, at }: the last picture handed to the kit
        this.cells = Object.create(null);    // spawnId -> { cell: value }: the text cells written
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
        // placed, resized or shown again: write everything anew
        w.onChange((why) => { if (why !== 'hidden') { this.sent = Object.create(null); this.cells = Object.create(null); } });
    }

    /** What the widget says now: { name ('off' or a layout), title, mode } */
    state() {
        const h = this.hud, name = h.activeName && h.activeName !== 'off' ? h.activeName : 'off';
        let title = '', mode = '';
        if (name !== 'off') { try { title = (data.json('layouts/' + name + '.json') || {}).name || name; } catch (e) { title = name; } }
        try {
            if (h.setting('byMode') === true) { const m = h._token('modeShort'); mode = m ? m + ' · by drive mode' : 'by drive mode'; }
        } catch (e) { mode = ''; }
        return { name, title, mode };
    }

    draw(inst) {
        const s = this.state(), key = s.name + '|' + s.title + '|' + s.mode, now = Date.now();
        this._text(inst, s);
        if (!inst.big) return null;
        const last = this.sent[inst.spawnId];
        if (last && last.key === key && now - last.at < REDRAW_MS) return null;
        if (this.key !== key) { this.cv = this.render(s); this.key = key; }
        this.sent[inst.spawnId] = { key, at: now };
        return this.cv;
    }

    /** The small widget's lines (the big one leaves them empty: its picture says it) */
    _text(inst, s) {
        const small = !inst.big, cells = {
            Title: small ? 'Zeiger' : '',
            TextRecordings: small ? (s.name === 'off' ? 'Off · BMW\'s own cluster' : s.title) : '',
            TextCam: small ? s.mode : '',
            TimeElapsed: '', TimeRemaining: '',
        };
        const prev = this.cells[inst.spawnId] || (this.cells[inst.spawnId] = {});
        Object.keys(cells).forEach((k) => {
            if (prev[k] === cells[k]) return;
            prev[k] = cells[k];
            this.ctx.widget.set(inst.spawnId, k, cells[k], 'Text');
        });
    }

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

    /** The big widget's picture for state s (a kit Canvas) */
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
}

module.exports = ZeigerWidget;
