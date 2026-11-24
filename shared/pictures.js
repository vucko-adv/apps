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
// hud_data is the app's packed data, there only in a build: loaded at the first get(), so the theme tools can use parse()
let data = null;
const etc2 = require('./etc2');
const ETC = { etc2rgba: 1, etc2rgb: 0.5 };

const cache = new Map();

function get(name) {
    if (cache.has(name)) return cache.get(name);
    let out = null;
    try { data = data || require('./hud_data'); out = parse(data.json('pictures/' + name + '.json') || {}); } catch (e) { out = null; }
    cache.set(name, out);
    return out;
}

/** A picture file's JSON as get() gives it: { w, h, px, py, rgba } or, compressed, { w, h, tw, th, format, etc, patch }. */
function parse(p) {
    let out = null;
    {
        if (p.z && p.w > 0 && p.h > 0) {
            const raw = zlib.inflateSync(Buffer.from(p.z, 'base64'));
            // tw, th (0.52.0, tools/patch_picture.js): the texture's size, the picture's w and h made multiples of 4
            const tw = p.tw || p.w, th = p.th || p.h;
            if (ETC[p.format]) {
                if (raw.length === tw * th * ETC[p.format]) out = { w: p.w, h: p.h, tw, th, px: p.px, py: p.py, format: p.format, etc: raw };
                // its exact patches (0.52.0): the index (one RGBA texel a tile) and the atlas of patched tiles
                const q = p.patch;
                if (out && q && q.n > 0) {
                    const index = zlib.inflateSync(Buffer.from(q.iz, 'base64')), atlas = zlib.inflateSync(Buffer.from(q.az, 'base64'));
                    if (index.length !== q.iw * q.ih * 4 || atlas.length !== q.aw * q.ah * 4) out = null;
                    else out.patch = { t: q.t, iw: q.iw, ih: q.ih, aw: q.aw, ah: q.ah, n: q.n, index, atlas };
                }
            }
            else if (raw.length === p.w * p.h * 4) out = { w: p.w, h: p.h, px: p.px, py: p.py, rgba: raw };
        }
    }
    return out;
}

/** A picture file's JSON as RGBA (a compressed one decoded with its patches; the watermark tool's check). */
function decodeJson(o) {
    const p = parse(o);
    if (!p) throw new Error('not a picture');
    return p.etc ? unpatch(p) : p.rgba;
}

/** The picture with its RGBA pixels: a compressed one decoded (kept like the others), else get(name). */
function rgbaOf(name) {
    const p = get(name);
    if (!p || !p.etc) return p;
    const k = name + '#rgba';
    if (!cache.has(k)) {
        let out = null;
        try { out = { w: p.w, h: p.h, px: p.px, py: p.py, rgba: unpatch(p) }; } catch (e) { out = null; }
        cache.set(k, out);
    }
    return cache.get(k);
}

/** A compressed picture's RGBA: decoded, its patched tiles laid back exact, cut to its w x h. */
function unpatch(p) {
    const tw = p.tw || p.w, th = p.th || p.h, px = etc2.decode(p.etc, tw, th, p.format), q = p.patch;
    if (q) {
        const T = q.t, cols = q.aw / T;
        for (let ty = 0; ty < q.ih; ty++) for (let tx = 0; tx < q.iw; tx++) {
            const o = (ty * q.iw + tx) * 4, s = q.index[o] + 256 * q.index[o + 1];
            if (!s) continue;
            const ax = ((s - 1) % cols) * T, ay = Math.floor((s - 1) / cols) * T;
            for (let y = 0; y < T && ty * T + y < th; y++) {
                const n = Math.min(T, tw - tx * T);
                q.atlas.copy(px, ((ty * T + y) * tw + tx * T) * 4, ((ay + y) * q.aw + ax) * 4, ((ay + y) * q.aw + ax + n) * 4);
            }
        }
    }
    if (tw === p.w && th === p.h) return px;
    const out = Buffer.alloc(p.w * p.h * 4);
    for (let y = 0; y < p.h; y++) px.copy(out, y * p.w * 4, y * tw * 4, (y * tw + p.w) * 4);
    return out;
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

module.exports = { get, rgbaOf, keepOnly, decodeJson };
