'use strict';
/**
 * pictures.js - the pictures a layout shows as they are (the "picture" and "needle" widgets in hud.js): a
 * theme's face drawn in a design tool, a needle cut from it. hud/pictures/<name>.json, packed with the rest of
 * hud/ by the build: { w, h, z } (z = base64 of the zlib-deflated straight RGBA rows, as hud/previews), a needle
 * also { px, py }: its pivot in the picture, the needle pointing straight up (12 o'clock).
 * Made by cluster-design/speed_meter/theme_assets.html (next to the repo) from the artwork.
 *
 *   get(name) -> { w, h, px, py, rgba } or null when there is none (or it is damaged)
 */
const zlib = require('zlib');
const data = require('./hud_data');

const cache = new Map();

function get(name) {
    if (cache.has(name)) return cache.get(name);
    let out = null;
    try {
        const p = data.json('pictures/' + name + '.json') || {};
        if (p.z && p.w > 0 && p.h > 0) {
            const rgba = zlib.inflateSync(Buffer.from(p.z, 'base64'));
            if (rgba.length === p.w * p.h * 4) out = { w: p.w, h: p.h, px: p.px, py: p.py, rgba };
        }
    } catch (e) { out = null; }
    cache.set(name, out);
    return out;
}

module.exports = { get };
