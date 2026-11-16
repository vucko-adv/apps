'use strict';
/**
 * etc2_picture.js - turns a picture (hud/pictures/<name>.json, straight RGBA) into an ETC2-compressed one, in place
 * (Zeiger 0.38.0; shared/etc2.js, shared/pictures.js). Its other fields (author, copyright) stay. Run it after the
 * theme's build and the watermark; a picture already compressed is left as it is (unless --from gives the RGBA).
 *
 *   node tools/etc2_picture.js <app> <picture name> [etc2rgba | etc2rgb] [--fade y0,y1[,max]] [--top y] [--from file]
 *
 * etc2rgba (the default; 1 byte a pixel) is the format cluster-render has checked on an iDrive 7 cluster; etc2rgb
 * (0.5 byte, opaque) is not checked there yet. The quality in dB (PSNR over RGB) is printed.
 *
 * --fade y0,y1[,max] (Zeiger 0.40.0): before compressing, the picture darkens toward black from panel row y0 to y1
 *   (smoothly, to max, 1 = black; 0.95 if not given), so a photo's bottom meets BMW's black strip and the small window
 *   left open over its gear letter (GEAR_LETTER, shared/hud.js) without an edge. --top: the picture's own top row on the
 *   panel (a picture lower down, as Sunrise's hills at 430). Only the colour darkens; the alpha stays.
 * --from file: the RGBA picture to start from (a picture file, e.g. the theme build's output or one out of git), so
 *   running it again never fades twice.
 */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const etc2 = require('../shared/etc2');

const argv = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--fade' || argv[i] === '--top' || argv[i] === '--from') opt[argv[i].slice(2)] = argv[++i];
    else pos.push(argv[i]);
}
const [app, name, format = 'etc2rgba'] = pos;
if (!app || !name || (format !== 'etc2rgba' && format !== 'etc2rgb')) {
    console.error('usage: node tools/etc2_picture.js <app> <picture name> [etc2rgba | etc2rgb] [--fade y0,y1[,max]] [--top y] [--from file]');
    process.exit(2);
}
const file = path.join(__dirname, '..', 'apps', app, 'hud', 'pictures', name + '.json');
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const src = opt.from ? JSON.parse(fs.readFileSync(opt.from, 'utf8')) : p;
if (src.format) { console.log(name + ': already ' + src.format + (opt.from ? '' : ' (give --from with its RGBA to do it again)')); process.exit(0); }
let rgba = zlib.inflateSync(Buffer.from(src.z, 'base64'));
if (rgba.length !== src.w * src.h * 4) throw new Error(name + ': not ' + src.w + 'x' + src.h + ' RGBA');
let note = '';
// ETC2 is 4x4 blocks: a height that isn't gets see-through rows on top (the layout's widget must then start that many
// rows higher and be that much taller: said below); a width that isn't is refused
if (src.w % 4) throw new Error(name + ': ' + src.w + ' px wide, not a multiple of 4');
const pad = (4 - src.h % 4) % 4;
if (pad) {
    rgba = Buffer.concat([Buffer.alloc(src.w * pad * 4, 0), rgba]);
    src.h += pad;
    if (opt.top !== undefined) opt.top = String(Number(opt.top) - pad);
    note += ', ' + pad + ' see-through row(s) added on top: move its widget up ' + pad + ' and make it ' + pad + ' taller';
}
if (opt.fade) {
    const [y0, y1, mx] = opt.fade.split(',').map(Number), top = Number(opt.top) || 0, max = isFinite(mx) ? mx : 0.95;
    if (!(y1 > y0)) throw new Error('--fade y0,y1: y1 must be below y0');
    for (let y = 0; y < src.h; y++) {
        const t = Math.max(0, Math.min(1, (top + y - y0) / (y1 - y0))), k = 1 - max * t * t * (3 - 2 * t);
        if (k >= 1) continue;
        for (let x = 0; x < src.w; x++) { const o = (y * src.w + x) * 4; rgba[o] = Math.round(rgba[o] * k); rgba[o + 1] = Math.round(rgba[o + 1] * k); rgba[o + 2] = Math.round(rgba[o + 2] * k); }
    }
    note += ', faded to black from row ' + y0 + ' to ' + y1 + ' (' + max + ')';
}
const t0 = Date.now(), blocks = etc2.encode(rgba, src.w, src.h, format), back = etc2.decode(blocks, src.w, src.h, format);
const out = Object.assign({}, p, { w: src.w, h: src.h, format, z: zlib.deflateSync(blocks, { level: 9 }).toString('base64') });
fs.writeFileSync(file, JSON.stringify(out));
console.log(name + ': ' + src.w + 'x' + src.h + ' ' + format + ', ' + blocks.length + ' bytes (RGBA ' + rgba.length + ')' + note + ', PSNR ' +
    etc2.psnr(rgba, back).toFixed(2) + ' dB, ' + (Date.now() - t0) + ' ms');
