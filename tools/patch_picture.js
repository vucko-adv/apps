'use strict';
/**
 * patch_picture.js - a picture (hud/pictures/<name>.json, straight RGBA) as ETC2 with exact patches (Zeiger 0.52.0).
 *
 * ETC2 is a quarter of the bytes, but fine light lines on a darker ground (a dial's ticks, numerals, batons) come out
 * stepped and haloed (tried on Concours in 0.50.9). Here the picture is compressed whole, decoded again, and cut in
 * tiles of T x T px; a tile where any pixel's colour or alpha moved more than the tolerance keeps its exact RGBA
 * pixels in a patch atlas. The cluster draws it with shaders.js TEXPATCH: the compressed picture, and in a patched
 * tile the atlas's pixels. So the picture is exact where the eye would see the compression and compressed elsewhere.
 *
 *   node tools/patch_picture.js <app> <picture name> [--tile 4] [--tol 8] [--from file] [--dry]
 *
 * The picture's JSON keeps its fields (author, copyright, px, py, w, h) and gets format etc2rgba, z (the blocks), tw and th
 * (the texture's size: w and h made multiples of 4, see-through on the right and the bottom) and
 * "patch": { t, iw, ih, aw, ah, n, iz, az }: the index (iw x ih RGBA, one texel a tile, R + 256 G = the tile's slot in
 * the atlas + 1, 0 = none) and the atlas (aw x ah RGBA, the patched tiles in slot order, row by row), both deflated.
 * A cluster-render that refuses ETC2 gets the picture decoded with the patches laid back (shared/pictures.js rgbaOf).
 * Run it after the theme's build and the watermark; --from gives the RGBA to start from (a picture already done is
 * left alone without it). --dry prints the sizes only.
 */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const etc2 = require('../shared/etc2');

const argv = process.argv.slice(2), opt = { tile: '4', tol: '8' }, pos = [];
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry') opt.dry = true;
    else if (/^--(tile|tol|from)$/.test(argv[i])) opt[argv[i].slice(2)] = argv[++i];
    else pos.push(argv[i]);
}
const [app, name] = pos;
if (!app || !name) { console.error('usage: node tools/patch_picture.js <app> <picture name> [--tile 4] [--tol 8] [--from file] [--dry]'); process.exit(2); }
const T = Number(opt.tile), TOL = Number(opt.tol);
if (!(T === 4 || T === 8 || T === 16)) throw new Error('--tile: 4, 8 or 16');

const file = path.join(__dirname, '..', 'apps', app, 'hud', 'pictures', name + '.json');
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const src = opt.from ? JSON.parse(fs.readFileSync(opt.from, 'utf8')) : p;
if (src.format) { console.log(name + ': already ' + src.format + (opt.from ? '' : ' (give --from with its RGBA to do it again)')); process.exit(0); }
const VW = src.w, VH = src.h, raw = zlib.inflateSync(Buffer.from(src.z, 'base64'));
if (raw.length !== VW * VH * 4) throw new Error(name + ': not ' + VW + 'x' + VH + ' RGBA');
// ETC2 is 4x4 blocks: a side that isn't a multiple of 4 is padded see-through on the right and the bottom; the
// picture keeps its w and h, the texture's are tw and th (the padding is never drawn)
const W = Math.ceil(VW / 4) * 4, H = Math.ceil(VH / 4) * 4;
let rgba = raw;
if (W !== VW || H !== VH) { rgba = Buffer.alloc(W * H * 4, 0); for (let y = 0; y < VH; y++) raw.copy(rgba, y * W * 4, y * VW * 4, (y + 1) * VW * 4); }

const blocks = etc2.encode(rgba, W, H, 'etc2rgba'), back = etc2.decode(blocks, W, H, 'etc2rgba');
const iw = Math.ceil(W / T), ih = Math.ceil(H / T), slots = [];
const index = Buffer.alloc(iw * ih * 4, 0);
// a pixel's error as seen over the ground: the alpha's, and the colour's weighted by how opaque it is
const err = (o) => {
    const a = Math.max(rgba[o + 3], back[o + 3]);
    return Math.max(Math.abs(rgba[o + 3] - back[o + 3]),
        Math.round(Math.max(Math.abs(rgba[o] - back[o]), Math.abs(rgba[o + 1] - back[o + 1]), Math.abs(rgba[o + 2] - back[o + 2])) * a / 255));
};
let worstLeft = 0;
for (let ty = 0; ty < ih; ty++) for (let tx = 0; tx < iw; tx++) {
    let e = 0;
    for (let y = ty * T; y < Math.min(H, ty * T + T); y++) for (let x = tx * T; x < Math.min(W, tx * T + T); x++) e = Math.max(e, err((y * W + x) * 4));
    if (e > TOL) {
        if (slots.length >= 65534) throw new Error('too many patched tiles');
        slots.push([tx, ty]);
        const s = slots.length, o = (ty * iw + tx) * 4;
        index[o] = s & 255; index[o + 1] = s >> 8; index[o + 3] = 255;
    } else worstLeft = Math.max(worstLeft, e);
}
// the atlas: as square as fits in 2048 px wide
const cols = Math.max(1, Math.min(Math.floor(2048 / T), Math.ceil(Math.sqrt(slots.length || 1)))), rows = Math.max(1, Math.ceil(slots.length / cols));
const aw = cols * T, ah = rows * T, atlas = Buffer.alloc(aw * ah * 4, 0);
slots.forEach(([tx, ty], i) => {
    const ax = (i % cols) * T, ay = Math.floor(i / cols) * T;
    for (let y = 0; y < T; y++) {
        const sy = ty * T + y;
        if (sy >= H) break;
        const sx = tx * T, n = Math.min(T, W - sx);
        rgba.copy(atlas, ((ay + y) * aw + ax) * 4, (sy * W + sx) * 4, (sy * W + sx + n) * 4);
    }
});
if (ah > 2048 || aw * ah * 4 > 1920 * 720 * 4) throw new Error('the atlas, ' + aw + 'x' + ah + ', is over an asset\'s limits: a bigger --tol or a smaller --tile');

const kb = (b) => Math.round(b / 1024) + ' KB';
const before = VW * VH * 4, after = blocks.length + index.length + atlas.length;
console.log(name + ': ' + VW + 'x' + VH + ', tile ' + T + ', tolerance ' + TOL + ': ' + slots.length + ' of ' + iw * ih + ' tiles exact (' +
    Math.round(100 * slots.length / (iw * ih)) + ' %), largest error left ' + worstLeft + '; upload ' + kb(before) + ' -> ' + kb(after) +
    ' (ETC2 ' + kb(blocks.length) + ', index ' + kb(index.length) + ', atlas ' + aw + 'x' + ah + ' ' + kb(atlas.length) + '); pixel memory ' +
    kb(before * 2) + ' -> ' + kb(blocks.length + 2 * (index.length + atlas.length)));
if (opt.dry) process.exit(0);
const out = Object.assign({}, p, { w: VW, h: VH, tw: W, th: H, format: 'etc2rgba', z: zlib.deflateSync(blocks, { level: 9 }).toString('base64'),
    patch: { t: T, iw, ih, aw, ah, n: slots.length, iz: zlib.deflateSync(index, { level: 9 }).toString('base64'),
        az: zlib.deflateSync(atlas, { level: 9 }).toString('base64') } });
// nothing patched: a plain compressed picture (shaders.js TEXPIC, no index or atlas to send)
if (!slots.length) delete out.patch;
fs.writeFileSync(file, JSON.stringify(out));
console.log('wrote ' + path.relative(process.cwd(), file));
