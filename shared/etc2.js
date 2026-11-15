'use strict';
/**
 * etc2.js (shared/) - an ETC2 encoder and decoder for cluster-render's compressed assets (Zeiger 0.38.0; written for this repo,
 * MIT). A 4x4 block a time, blocks in rows from the top, each block big-endian:
 *   etc2rgba (GL_COMPRESSED_RGBA8_ETC2_EAC): 16 bytes, the EAC alpha block, then the colour block; 1 byte a pixel
 *   etc2rgb  (GL_COMPRESSED_RGB8_ETC2): the colour block alone, 8 bytes; 0.5 byte a pixel, every pixel opaque
 * A colour block is ETC1's individual or differential mode (a differential block here never overflows by accident),
 * or ETC2's planar mode (three colours, the block a smooth plane between them: skies and soft gradients), whichever
 * is closer. Checked against SwiftShader's decoder (Chrome --use-angle=swiftshader, WEBGL_compressed_texture_etc). A
 * block whose pixels are all opaque gets a constant alpha block; else EAC is searched (every table, multipliers 1-15).
 *
 *   encode(rgba, w, h, format) -> Buffer      w and h multiples of 4; rgba straight RGBA rows
 *   decode(buf, w, h, format) -> Buffer       RGBA rows, for the bench and for checking an encode
 *   psnr(a, b) -> dB                          over RGB
 * No BigInt (the head unit's Node 8 has none): a block's 64 bits are read and written a bit at a time (getBits, setBits).
 */

/** n bits ending at bit hi (63 = the first byte's top bit) of the 8 bytes at b[o], as a number. */
function getBits(b, o, hi, n) {
    let v = 0;
    for (let i = hi; i > hi - n; i--) v = v * 2 + ((b[o + 7 - (i >> 3)] >> (i & 7)) & 1);
    return v;
}
/** The same bits set to val (they were 0). */
function setBits(b, o, hi, n, val) {
    for (let i = 0; i < n; i++) if (Math.floor(val / Math.pow(2, i)) & 1) { const bit = hi - n + 1 + i; b[o + 7 - (bit >> 3)] |= 1 << (bit & 7); }
}

const ETC1 = [[2, 8], [5, 17], [9, 29], [13, 42], [18, 60], [24, 80], [33, 106], [47, 183]];
// a modifier index (msb << 1 | lsb): 0 +a, 1 +b, 2 -a, 3 -b
const MOD = ETC1.map(([a, b]) => [a, b, -a, -b]);
const EAC = [
    [-3, -6, -9, -15, 2, 5, 8, 14], [-3, -7, -10, -13, 2, 6, 9, 12], [-2, -5, -8, -13, 1, 4, 7, 12],
    [-2, -4, -6, -13, 1, 3, 5, 12], [-3, -6, -8, -12, 2, 5, 7, 11], [-3, -7, -9, -11, 2, 6, 8, 10],
    [-4, -7, -8, -11, 3, 6, 7, 10], [-3, -5, -8, -11, 2, 4, 7, 10], [-2, -6, -8, -10, 1, 5, 7, 9],
    [-2, -5, -8, -10, 1, 4, 7, 9], [-2, -4, -8, -10, 1, 3, 7, 9], [-2, -5, -7, -10, 1, 4, 6, 9],
    [-3, -4, -7, -10, 2, 3, 6, 9], [-1, -2, -3, -10, 0, 1, 2, 9], [-4, -6, -8, -9, 3, 5, 7, 8],
    [-3, -5, -7, -9, 2, 4, 6, 8]];
// error weights (green a little more, as the eye; blue not less, or smooth blue skies go patchy)
const WR = 2, WG = 3, WB = 2;
// the quantised colours tried round a half's mean: every channel one step either way (27)
const NEAR = [];
for (const r of [0, -1, 1]) for (const g of [0, -1, 1]) for (const b of [0, -1, 1]) NEAR.push([r, g, b]);
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const ext4 = (q) => (q << 4) | q, ext5 = (q) => (q << 3) | (q >> 2);
// a pixel's index in a block: k = x * 4 + y (columns first, as the index bits are)
// the two halves: flip 0 the left and right 2x4, flip 1 the top and bottom 4x2
const HALF = [0, 1].map((flip) => [0, 1].map((s) => {
    const out = [];
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) if ((flip ? y >> 1 : x >> 1) === s) out.push(x * 4 + y);
    return out;
}));

/** The best table and modifiers for these pixels round one base colour: { err, t, idx[] }. */
function fitHalf(px, ks, base) {
    let best = null;
    for (let t = 0; t < 8; t++) {
        const m = MOD[t];
        let err = 0;
        const idx = new Array(ks.length);
        for (let i = 0; i < ks.length && (!best || err < best.err); i++) {
            const o = ks[i] * 3, r = px[o], g = px[o + 1], b = px[o + 2];
            let be = Infinity, bi = 0;
            for (let j = 0; j < 4; j++) {
                const dr = clamp(base[0] + m[j]) - r, dg = clamp(base[1] + m[j]) - g, db = clamp(base[2] + m[j]) - b;
                const e = WR * dr * dr + WG * dg * dg + WB * db * db;
                if (e < be) { be = e; bi = j; }
            }
            err += be; idx[i] = bi;
        }
        if (!best || err < best.err) best = { err, t, idx };
    }
    return best;
}

/** The pixels' mean colour, and its quantised candidates (q: bits a channel) with their expansions. */
function mean(px, ks) {
    const s = [0, 0, 0];
    ks.forEach((k) => { s[0] += px[k * 3]; s[1] += px[k * 3 + 1]; s[2] += px[k * 3 + 2]; });
    return s.map((v) => v / ks.length);
}
function quant(c, bits) { const m = (1 << bits) - 1; return c.map((v) => Math.max(0, Math.min(m, Math.round(v * m / 255)))); }

/** One half's best fit over its quantised mean and the colours a step from it (NEAR). */
function bestHalf(px, ks, bits, around) {
    const m = (1 << bits) - 1, ext = bits === 4 ? ext4 : ext5;
    let best = null;
    for (const d of NEAR) {
        const q = around.map((v, c) => Math.max(0, Math.min(m, v + d[c])));
        const f = fitHalf(px, ks, q.map(ext));
        if (!best || f.err < best.err) best = Object.assign(f, { q });
    }
    return best;
}

const ext6 = (q) => (q << 2) | (q >> 4), ext7 = (q) => (q << 1) | (q >> 6);
const W3 = [WR, WG, WB], PBITS = [6, 7, 6];
/** A planar channel's value at x, y from its O, H, V (8-bit). */
const plane = (O, H, V, x, y) => clamp((x * (H - O) + y * (V - O) + 4 * O + 2) >> 2);

/** ETC2's planar mode for these pixels: per channel the least-squares O, H, V, quantised, a step either way tried. */
function planarFit(px) {
    // c(x, y) = O (1 - x/4 - y/4) + H x/4 + V y/4, solved by the normal equations
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], rhs = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let k = 0; k < 16; k++) {
        const x = k >> 2, y = k & 3, f = [1 - x / 4 - y / 4, x / 4, y / 4];
        for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) A[i][j] += f[i] * f[j]; for (let c = 0; c < 3; c++) rhs[c][i] += f[i] * px[k * 3 + c]; }
    }
    const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(A), q = [], err = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
        const sol = [0, 1, 2].map((i) => det(A.map((row, r) => row.map((v, j) => (j === i ? rhs[c][r] : v)))) / D);
        const bits = PBITS[c], m = (1 << bits) - 1, ext = bits === 7 ? ext7 : ext6;
        const q0 = sol.map((v) => Math.max(0, Math.min(m, Math.round(Math.max(0, Math.min(255, v)) * m / 255))));
        let best = null;
        for (const d of NEAR) {
            const qq = q0.map((v, i) => Math.max(0, Math.min(m, v + d[i]))), [O, H, V] = qq.map(ext);
            let e = 0;
            for (let k = 0; k < 16 && (!best || e < best.e); k++) { const dv = plane(O, H, V, k >> 2, k & 3) - px[k * 3 + c]; e += dv * dv; }
            if (!best || e < best.e) best = { e, qq };
        }
        q.push(best.qq); err[c] = best.e * W3[c];
    }
    return { err: err[0] + err[1] + err[2], q };    // q[channel] = [O, H, V]
}

/** A planar block's 8 bytes: the colours in their bit places, and the bits between them set so that the red and the
 *  green field don't overflow while the blue one does (which is what makes it planar). */
function planarPack(q, out, o) {
    const [RO, RH, RV] = q[0], [GO, GH, GV] = q[1], [BO, BH, BV] = q[2];
    for (let i = 0; i < 8; i++) out[o + i] = 0;
    const put = (val, hi, n) => setBits(out, o, hi, n, val & ((1 << n) - 1));
    put(RO, 62, 6); put(GO >> 6, 56, 1); put(GO & 63, 54, 6); put(BO >> 5, 48, 1); put((BO >> 3) & 3, 44, 2); put(BO & 7, 41, 3);
    put(RH >> 1, 38, 5); put(RH & 1, 32, 1); put(GH, 31, 7); put(BH, 24, 6); put(RV, 18, 6); put(GV, 12, 7); put(BV, 5, 6);
    put(1, 33, 1);                                                                   // the differential bit
    const sgn3 = (b) => ((b & 7) ^ 4) - 4;
    // red: the field is bit 63 and RO's top four bits; its delta RO's last two and GO's top bit
    if ((RO >> 2) + sgn3(((RO & 3) << 1) | (GO >> 6)) < 0) put(1, 63, 1);
    // green: bit 55 and GO's bits 5-2; its delta GO's last two and BO's top bit
    if (((GO & 63) >> 2) + sgn3(((GO & 3) << 1) | (BO >> 5)) < 0) put(1, 55, 1);
    // blue overflows: bits 47-45 and 42 chosen by BO's bits 4-3 (vb) and 2-1 (db)
    const vb = (BO >> 3) & 3, db = (BO >> 1) & 3;
    if (vb + db >= 4) put(7, 47, 3); else put(1, 42, 1);
}

/** One colour block (8 bytes at out[o]) for 16 pixels px (RGB, k = x * 4 + y). */
function colourBlock(px, out, o) {
    const pl = planarFit(px);
    let best = null;
    for (let flip = 0; flip < 2; flip++) {
        const [k1, k2] = HALF[flip], m1 = mean(px, k1), m2 = mean(px, k2);
        // individual: 4 bits a channel each
        const i1 = bestHalf(px, k1, 4, quant(m1, 4)), i2 = bestHalf(px, k2, 4, quant(m2, 4));
        if (!best || i1.err + i2.err < best.err) best = { err: i1.err + i2.err, flip, diff: 0, a: i1, b: i2 };
        // differential: 5 bits, the second within -4..3 of the first
        const d1 = bestHalf(px, k1, 5, quant(m1, 5));
        let q2 = quant(m2, 5).map((v, c) => Math.max(d1.q[c] - 4, Math.min(d1.q[c] + 3, v)));
        let d2 = null;
        for (const d of NEAR) {
            const q = q2.map((v, c) => Math.max(0, Math.min(31, Math.max(d1.q[c] - 4, Math.min(d1.q[c] + 3, v + d[c])))));
            const f = fitHalf(px, k2, q.map(ext5));
            if (!d2 || f.err < d2.err) d2 = Object.assign(f, { q });
        }
        if (d1.err + d2.err < best.err) best = { err: d1.err + d2.err, flip, diff: 1, a: d1, b: d2 };
    }
    if (pl.err < best.err) { planarPack(pl.q, out, o); return pl.err; }
    const { flip, diff, a, b } = best;
    if (diff) {
        for (let c = 0; c < 3; c++) out[o + c] = (a.q[c] << 3) | ((b.q[c] - a.q[c]) & 7);
    } else {
        for (let c = 0; c < 3; c++) out[o + c] = (a.q[c] << 4) | b.q[c];
    }
    out[o + 3] = (a.t << 5) | (b.t << 2) | (diff << 1) | flip;
    let msb = 0, lsb = 0;
    const [k1, k2] = HALF[flip];
    k1.forEach((k, i) => { msb |= (a.idx[i] >> 1) << k; lsb |= (a.idx[i] & 1) << k; });
    k2.forEach((k, i) => { msb |= (b.idx[i] >> 1) << k; lsb |= (b.idx[i] & 1) << k; });
    out[o + 4] = (msb >> 8) & 255; out[o + 5] = msb & 255; out[o + 6] = (lsb >> 8) & 255; out[o + 7] = lsb & 255;
    return best.err;
}

/** One EAC alpha block (8 bytes at out[o]) for 16 alphas (k = x * 4 + y). */
function alphaBlock(al, out, o) {
    let lo = 255, hi = 0;
    for (let k = 0; k < 16; k++) { lo = Math.min(lo, al[k]); hi = Math.max(hi, al[k]); }
    let best = null;
    if (lo === hi) {
        // constant: the base itself with modifier 0 of table 13 ([-1, -2, -3, -10, 0, 1, 2, 9]), index 4
        best = { base: lo, mul: 1, t: 13, idx: new Array(16).fill(4) };
    } else {
        for (let t = 0; t < 16; t++) {
            const T = EAC[t], span = T[7] - T[3];
            for (let mul = 1; mul < 16; mul++) {
                const c = Math.round((lo + hi) / 2 - mul * (T[7] + T[3]) / 2);
                for (const base of [c - 1, c, c + 1]) {
                    if (base < 0 || base > 255) continue;
                    let err = 0; const idx = new Array(16);
                    for (let k = 0; k < 16 && (!best || err < best.err); k++) {
                        let be = Infinity, bi = 0;
                        for (let j = 0; j < 8; j++) { const d = clamp(base + T[j] * mul) - al[k]; if (d * d < be) { be = d * d; bi = j; } }
                        err += be; idx[k] = bi;
                    }
                    if (!best || err < best.err) best = { err, base, mul, t, idx };
                }
                if (mul * span > (hi - lo) * 2 + 32) break;
            }
        }
    }
    out[o] = best.base; out[o + 1] = (best.mul << 4) | best.t;
    // 16 indices of 3 bits, pixel k = x * 4 + y first, from the top bit (bits 47-0)
    for (let i = 2; i < 8; i++) out[o + i] = 0;
    for (let k = 0; k < 16; k++) setBits(out, o, 47 - 3 * k, 3, best.idx[k]);
}

function encode(rgba, w, h, format) {
    if (w % 4 || h % 4) throw new Error('etc2: ' + w + 'x' + h + ' is not in 4x4 blocks');
    const A = format !== 'etc2rgb', bs = A ? 16 : 8, out = Buffer.alloc((w / 4) * (h / 4) * bs);
    const px = new Uint8Array(48), al = new Uint8Array(16);
    let o = 0;
    for (let by = 0; by < h; by += 4) {
        for (let bx = 0; bx < w; bx += 4) {
            for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
                const s = ((by + y) * w + bx + x) * 4, k = x * 4 + y;
                px[k * 3] = rgba[s]; px[k * 3 + 1] = rgba[s + 1]; px[k * 3 + 2] = rgba[s + 2]; al[k] = A ? rgba[s + 3] : 255;
            }
            if (A) { alphaBlock(al, out, o); o += 8; }
            colourBlock(px, out, o); o += 8;
        }
    }
    return out;
}

function decodeColour(b, o, put) {
    const diff = (b[o + 3] >> 1) & 1, flip = b[o + 3] & 1, t1 = b[o + 3] >> 5, t2 = (b[o + 3] >> 2) & 7;
    if (diff) {
        const sgn3 = (v) => ((v & 7) ^ 4) - 4, f = (c) => (b[o + c] >> 3) + sgn3(b[o + c]);
        if (f(0) < 0 || f(0) > 31 || f(1) < 0 || f(1) > 31) throw new Error('etc2: a T or H block (not made here)');
        if (f(2) < 0 || f(2) > 31) {                  // planar
            const g = (hi, n) => getBits(b, o, hi, n);
            const RO = ext6(g(62, 6)), GO = ext7((g(56, 1) << 6) | g(54, 6)), BO = ext6((g(48, 1) << 5) | (g(44, 2) << 3) | g(41, 3));
            const RH = ext6((g(38, 5) << 1) | g(32, 1)), GH = ext7(g(31, 7)), BH = ext6(g(24, 6));
            const RV = ext6(g(18, 6)), GV = ext7(g(12, 7)), BV = ext6(g(5, 6));
            for (let k = 0; k < 16; k++) { const x = k >> 2, y = k & 3; put(x, y, plane(RO, RH, RV, x, y), plane(GO, GH, GV, x, y), plane(BO, BH, BV, x, y)); }
            return;
        }
    }
    let c1, c2;
    if (diff) {
        const q1 = [0, 1, 2].map((c) => b[o + c] >> 3), dq = [0, 1, 2].map((c) => ((b[o + c] & 7) ^ 4) - 4);
        c1 = q1.map(ext5); c2 = q1.map((v, c) => ext5(v + dq[c]));
    } else {
        c1 = [0, 1, 2].map((c) => ext4(b[o + c] >> 4)); c2 = [0, 1, 2].map((c) => ext4(b[o + c] & 15));
    }
    const msb = (b[o + 4] << 8) | b[o + 5], lsb = (b[o + 6] << 8) | b[o + 7];
    for (let k = 0; k < 16; k++) {
        const x = k >> 2, y = k & 3, second = (flip ? y >> 1 : x >> 1) === 1;
        const m = MOD[second ? t2 : t1][(((msb >> k) & 1) << 1) | ((lsb >> k) & 1)], c = second ? c2 : c1;
        put(x, y, clamp(c[0] + m), clamp(c[1] + m), clamp(c[2] + m));
    }
}

function decode(buf, w, h, format) {
    const A = format !== 'etc2rgb', out = Buffer.alloc(w * h * 4);
    let o = 0;
    for (let by = 0; by < h; by += 4) {
        for (let bx = 0; bx < w; bx += 4) {
            const al = new Array(16).fill(255);
            if (A) {
                const base = buf[o], mul = buf[o + 1] >> 4, T = EAC[buf[o + 1] & 15];
                for (let k = 0; k < 16; k++) al[k] = clamp(base + T[getBits(buf, o, 47 - 3 * k, 3)] * mul);
                o += 8;
            }
            decodeColour(buf, o, (x, y, r, g, b) => {
                const d = ((by + y) * w + bx + x) * 4;
                out[d] = r; out[d + 1] = g; out[d + 2] = b; out[d + 3] = al[x * 4 + y];
            });
            o += 8;
        }
    }
    return out;
}

function psnr(a, b) {
    let s = 0, n = 0;
    for (let i = 0; i < a.length; i += 4) for (let c = 0; c < 3; c++) { const d = a[i + c] - b[i + c]; s += d * d; n++; }
    return s ? 10 * Math.log10(255 * 255 / (s / n)) : Infinity;
}

module.exports = { encode, decode, psnr };
