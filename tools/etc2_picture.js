'use strict';
/**
 * etc2_picture.js - turns a picture (hud/pictures/<name>.json, straight RGBA) into an ETC2-compressed one, in place
 * (Zeiger 0.38.0; shared/etc2.js, shared/pictures.js). Its other fields (author, copyright) stay. Run it after the
 * theme's build and the watermark; a picture already compressed is left as it is.
 *
 *   node tools/etc2_picture.js <app> <picture name> [etc2rgba | etc2rgb]
 *
 * etc2rgba (the default; 1 byte a pixel) is the format cluster-render has checked on an iDrive 7 cluster; etc2rgb
 * (0.5 byte, opaque) is not checked there yet. The quality in dB (PSNR over RGB) is printed.
 */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const etc2 = require('../shared/etc2');

const [app, name, format = 'etc2rgba'] = process.argv.slice(2);
if (!app || !name || !/^etc2rgba?$|^etc2rgb$/.test(format)) {
    console.error('usage: node tools/etc2_picture.js <app> <picture name> [etc2rgba | etc2rgb]');
    process.exit(2);
}
const file = path.join(__dirname, '..', 'apps', app, 'hud', 'pictures', name + '.json');
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
if (p.format) { console.log(name + ': already ' + p.format); process.exit(0); }
const rgba = zlib.inflateSync(Buffer.from(p.z, 'base64'));
if (rgba.length !== p.w * p.h * 4) throw new Error(name + ': not ' + p.w + 'x' + p.h + ' RGBA');
const t0 = Date.now(), blocks = etc2.encode(rgba, p.w, p.h, format), back = etc2.decode(blocks, p.w, p.h, format);
const out = Object.assign({}, p, { format, z: zlib.deflateSync(blocks, { level: 9 }).toString('base64') });
fs.writeFileSync(file, JSON.stringify(out));
console.log(name + ': ' + p.w + 'x' + p.h + ' ' + format + ', ' + blocks.length + ' bytes (RGBA ' + rgba.length + '), PSNR ' +
    etc2.psnr(rgba, back).toFixed(2) + ' dB, ' + (Date.now() - t0) + ' ms');
