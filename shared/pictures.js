'use strict';
/**
 * pictures.js - the pictures a layout shows as they are (the "picture" and "needle" widgets in hud.js): a
 * theme's face drawn in a design tool, a needle cut from it. hud/pictures/<name>.json, packed with the rest of
 * hud/ by the build: { w, h, z } (z = base64 of the zlib-deflated straight RGBA rows, as hud/previews), a needle
 * also { px, py }: its pivot in the picture, the needle pointing straight up (12 o'clock).
 * Made by cluster-design/speed_meter/theme_assets.html (next to the repo) from the artwork.
 *
 *   get(name) -> { w, h, px, py, rgba } or null when there is none (or it is damaged)
 * Since Zeiger 0.38.0 a picture may be ETC2-compressed ({ w, h, format: 'etc2rgba' | 'etc2rgb', z }: z the deflated
 * blocks, etc2.js): get() then gives { w, h, format, etc } (the blocks, sent to cluster-render as a compressed asset),
 * and rgbaOf(name) its pixels decoded (for a cluster-render that refuses compressed textures, or a sheet).
 */
const zlib = require('zlib');
const data = require('./hud_data');
const etc2 = require('./etc2');
const ETC = { etc2rgba: 1, etc2rgb: 0.5 };

const cache = new Map();

function get(name) {
    if (cache.has(name)) return cache.get(name);
    let out = null;
    try {
        const p = data.json('pictures/' + name + '.json') || {};
        if (p.z && p.w > 0 && p.h > 0) {
            const raw = zlib.inflateSync(Buffer.from(p.z, 'base64'));
            if (ETC[p.format]) { if (raw.length === p.w * p.h * ETC[p.format]) out = { w: p.w, h: p.h, px: p.px, py: p.py, format: p.format, etc: raw }; }
            else if (raw.length === p.w * p.h * 4) out = { w: p.w, h: p.h, px: p.px, py: p.py, rgba: raw };
        }
    } catch (e) { out = null; }
    cache.set(name, out);
    return out;
}

/** The picture with its RGBA pixels: a compressed one decoded (kept like the others), else get(name). */
function rgbaOf(name) {
    const p = get(name);
    if (!p || !p.etc) return p;
    const k = name + '#rgba';
    if (!cache.has(k)) {
        let out = null;
        try { out = { w: p.w, h: p.h, px: p.px, py: p.py, rgba: etc2.decode(p.etc, p.w, p.h, p.format) }; } catch (e) { out = null; }
        cache.set(k, out);
    }
    return cache.get(k);
}

/**
 * Forgets every decoded picture but these (the layout shown now; hud.js after each rebuild). A full-panel
 * background is 5.5 MB of pixels, so keeping every theme's ever shown held tens of MB for good; the others are
 * decoded again when a layout asks for them.
 */
function keepOnly(names) {
    const keep = Object.create(null);
    (names || []).forEach((n) => { keep[n] = true; keep[n + '#rgba'] = true; });
    Array.from(cache.keys()).forEach((k) => { if (!keep[k]) cache.delete(k); });
}

module.exports = { get, rgbaOf, keepOnly };
