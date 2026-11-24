'use strict';
/**
 * Bench: a stand-in for cluster-render on the Mac, for the apps that draw through it.
 *
 *   node bench/server.js [app_id]   then open http://localhost:8078
 *
 * app_id: idrive_hud_widgets (the default, the 800x480 HUD) or cluster_themes (the 1920x720 cluster).
 * The page draws the target the app's app.json config.target names.
 * The service's limits are modelled: 8 layers per connection (BENCH_LAYER_CAP=8; off by default), 32 across every
 * connection and 16 MiB of pixel memory with each image counted twice (both always on; see bench/README.md).
 *
 * - Listens on a Unix socket speaking cluster-render protocol v1 (the framing
 *   and ops the vendored client sends: u32 LE length, u8 type 'J'/'F'/'M').
 * - Builds the app with the kit (kit/tools/build.py, the build the Store runs on the car),
 *   then runs the built dist/ in the kit's stubbed head unit (bench/run-app.js), pointed at
 *   that socket. The center-screen settings go through the stub's RHMI components.
 * - Streams every layer, pixel push and uniform to a browser page that draws
 *   app's target. Effect layers run the app's real GLSL shader in
 *   WebGL. Layers stack by class, then z, as cluster-render orders them.
 * - Rebuilds and restarts the app when a file under its apps/<id>/, shared/ or kit/ changes. A layout
 *   saved into bench/.data/<id>/layouts/ (the data-folder override) is left to the app's own
 *   fs.watch, so that path gets tested too.
 * - Flags protocol mistakes (bad sizes, unknown refs, ops before hello) in
 *   the log instead of silently drawing something.
 *
 * Bench only, never shipped to the car. No dependencies beyond Node.
 * The app runs on Node 8.16.2 (the car's version) from .cache/node8 when it's
 * there; BENCH_NODE=/path/to/node overrides.
 */
const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const path = require('path');
const etc2 = require('../shared/etc2');   // ETC2 assets, decoded for the page (Zeiger 0.38.0)
const { fork, execFileSync } = require('child_process');
// What the driver sees of each target (hood curve, BMW's gear box and belt light, the HUD window):
// one source of truth, shared with the app's layout check. The page gets it in the 'hello' event.
const visible = require('../shared/visible');

const PORT = Number(process.env.BENCH_PORT) || 8078;
// BENCH_LAYER_CAP: the car seems to draw only an app's first 8 layers (photos, Nov 5 2026).
// 0 = unlimited. Layers past the cap get state 'waiting' and are not drawn. POST /cap sets it live.
let layerCap = Math.max(0, Number(process.env.BENCH_LAYER_CAP) || 0);
// The service's other limits, always on (CompositorLimits): since cluster-render 0.4.2 (Nov 7 2026) 64 layers a client
// connection and 96 across every connection (BENCH_TOTAL_LAYERS / BENCH_CLIENT_LAYERS: 32 / 0 model an older one), and 16 MiB of
// pixel memory for every image together, each image counted twice (Compositor::add_image), refused with the
// service's own words "the service's pixel memory is full". BENCH_PIXEL_MIB overrides the 16 (0 = unlimited).
const TOTAL_LAYERS = Number(process.env.BENCH_TOTAL_LAYERS) || 96;
const CLIENT_LAYERS = process.env.BENCH_CLIENT_LAYERS === undefined ? 64 : Number(process.env.BENCH_CLIENT_LAYERS) || 0;   // 0: none
const PIXEL_BYTES = (process.env.BENCH_PIXEL_MIB === undefined ? 16 : Math.max(0, Number(process.env.BENCH_PIXEL_MIB) || 0)) * 1024 * 1024;
// the service's accounting: an image or asset costs its bytes twice (compositor.cpp: the pixels and a rectangle scratch)
// an ETC2 asset counts its blocks once (l.cost), as cluster-render does
function pixelBytes() { let n = 0; layers.forEach((l) => { if (l.cost) n += l.cost; else if (l.image) n += l.iw * l.ih * (l.bpp || 4) * 2; }); return n; }
function layerCount() { let n = 0; layers.forEach((l) => { if (l.kind !== 'asset' && l.kind !== 'font') n++; }); return n; }

/*
 * Text layers (cluster-render 0.8.11, PROTOCOL.md "Text"): the bench lays the string out as the service does (the font
 * scaled to size, each glyph's top-left on whole pixels, spacing between characters, aligned by whole pixels, a
 * character the font lacks advancing by its space) and draws the glyphs from the font's R8 atlas into the layer's own
 * RGBA pixels, which the page shows as an image. Nothing goes through the upload queue: on the car a change is the
 * string alone.
 */
function parseFont(m, atlas) {
    const glyphs = new Map();
    for (const t of String(m.glyphs || '').trim().split(/\s+/)) {
        const mm = /^(\d+):(-?\d+),(-?\d+),(-?\d+),(-?\d+),(-?\d+),(-?\d+),(-?\d+)$/.exec(t);
        if (!mm) return 'glyph "' + t + '" is not code:x,y,w,h,left,top,advance';
        const g = mm.slice(2).map(Number), code = Number(mm[1]);
        if (glyphs.has(code)) return 'glyph ' + code + ' comes twice';
        if (g[0] < 0 || g[1] < 0 || g[2] < 0 || g[3] < 0 || g[0] + g[2] > atlas.iw || g[1] + g[3] > atlas.ih) return 'glyph ' + code + ': its box is outside the atlas';
        if (g[6] < 0 || g[6] > 2048) return 'glyph ' + code + ': advance out of range';
        glyphs.set(code, { x: g[0], y: g[1], w: g[2], h: g[3], left: g[4], top: g[5], advance: g[6] });
    }
    if (!glyphs.size || glyphs.size > 1024) return 'a font has 1 to 1024 glyphs';
    const kerning = new Map();
    for (const t of String(m.kerning || '').trim().split(/\s+/).filter(Boolean)) {
        const mm = /^(\d+),(\d+):(-?\d+)$/.exec(t);
        if (!mm) return 'kerning "' + t + '" is not first,second:amount';
        if (!glyphs.has(+mm[1]) || !glyphs.has(+mm[2])) return 'kerning ' + mm[1] + ',' + mm[2] + ': a glyph the font lacks';
        kerning.set(mm[1] + ',' + mm[2], +mm[3]);
    }
    return { glyphs, kerning };
}
function drawTextLayer(l) {
    const f = layers.get(l.fontKey), a = f ? layers.get(f.atlasKey) : null;
    l.image.fill(0);
    if (!f || !a) return;
    const size = l.size > 0 ? l.size : l.h, s = size / f.line, col = l.color;
    const chars = Array.from(l.text || '').map((c) => c.codePointAt(0)).slice(0, l.max);
    const space = f.glyphs.get(32);
    // the pen: each glyph's advance (or the space's for one the font lacks), kerning and spacing between characters
    const placed = [];
    let pen = 0, prev = -1;
    chars.forEach((code, i) => {
        const g = f.glyphs.get(code);
        if (i) { const k = f.kerning.get(prev + ',' + code); if (k && g) pen += k * s; pen += l.spacing || 0; }
        if (g) { placed.push({ g, x: pen }); pen += g.advance * s; } else if (space) pen += space.advance * s;
        prev = code;
    });
    const lead = l.align === 'right' ? Math.round(l.w - pen) : l.align === 'center' ? Math.round((l.w - pen) / 2) : 0;
    placed.forEach(({ g, x }) => {
        const gx = Math.round(lead + x + g.left * s), gy = Math.round(g.top * s), gw = Math.round(g.w * s), gh = Math.round(g.h * s);
        for (let y = 0; y < gh; y++) {
            const dy = gy + y;
            if (dy < 0 || dy >= l.ih) continue;
            const sy = g.y + Math.min(g.h - 1, Math.floor(y / s));
            for (let x2 = 0; x2 < gw; x2++) {
                const dx = gx + x2;
                if (dx < 0 || dx >= l.iw) continue;
                const v = a.image[sy * a.iw + g.x + Math.min(g.w - 1, Math.floor(x2 / s))] / 255 * col[3];
                if (!v) continue;
                const o = (dy * l.iw + dx) * 4, was = l.image[o + 3] / 255, out = v + was * (1 - v);
                for (let c = 0; c < 3; c++) l.image[o + c] = Math.round((col[c] * 255 * v + l.image[o + c] * was * (1 - v)) / (out || 1));
                l.image[o + 3] = Math.round(out * 255);
            }
        }
    });
}
// a text layer's pixels go to the page after the scene that has the layer (the page drops pixels of a layer it does
// not know yet: a string set once at creation never showed)
function sendTextPixels(l) { setTimeout(() => { if (layers.get(l.key) === l) sendPixels(l); }, 40); }
function textStyle(l, m) {
    if (m.align !== undefined) { if (['left', 'center', 'right'].indexOf(m.align) < 0) return 'align is left, center or right'; l.align = m.align; }
    if (m.spacing !== undefined) { if (!(Math.abs(+m.spacing) <= 1024)) return 'spacing is -1024 to 1024'; l.spacing = +m.spacing; }
    if (m.size !== undefined) { if (!(+m.size >= 0 && +m.size <= 2048)) return 'size is 0 to 2048'; l.size = +m.size; }
    if (m.color !== undefined) {
        const c = String(m.color).trim().split(/\s+/).map(Number);
        if (c.length !== 4 || c.some((v) => !(v >= 0 && v <= 1))) return 'color is "r g b a", each 0 to 1';
        l.color = c;
    }
    if (m.text !== undefined) {
        const t = String(m.text);
        if (Buffer.byteLength(t, 'utf8') > 1024) return 'text is at most 1024 bytes of UTF-8';
        l.text = t;
    }
    return '';
}
// BENCH_UPLOAD_KBPS (Zeiger 0.52.0): the car's upload budget to the cluster (cluster-render's pacer: 2000-5500 KB/s).
// Every image and asset write then waits its turn in one queue drained at that rate, an image layer stays 'waiting'
// until its first whole write is through (cluster-render 0.6.3: hidden until then), and the time from a layout's
// first write to the queue running dry is logged. 0 (the default): writes land at once, as before.
const UPLOAD_KBPS = Math.max(0, Number(process.env.BENCH_UPLOAD_KBPS) || 0);
const upq = { items: [], bytes: 0, timer: null, startedAt: 0, total: 0, per: {} };
function upload(bytes, fn, who, key, cap) {
    if (!UPLOAD_KBPS) return fn();
    if (!upq.items.length && !upq.timer) { upq.startedAt = Date.now(); upq.total = 0; upq.per = {}; }
    if (who) { const p = upq.per[who] || (upq.per[who] = [0, 0]); p[0] += bytes; p[1]++; }
    // cluster-render keeps one pixel buffer a layer and writes what is dirty in it when the budget allows
    // (layer.cpp): a write to a layer still waiting merges into its turn, up to the layer's whole size
    const q = key && upq.items.find((it) => it.key === key);
    if (q) { const add = Math.max(0, Math.min(bytes, (cap || Infinity) - q.bytes)); q.bytes += add; upq.total += add; q.fns.push(fn); return; }
    upq.items.push({ bytes, fns: [fn], key }); upq.total += bytes;
    if (!upq.timer) upq.timer = setTimeout(drainUploads, Math.max(1, Math.round(bytes / UPLOAD_KBPS)));
}
function drainUploads() {
    upq.timer = null;
    const it = upq.items.shift();
    if (!it) return;
    it.fns.forEach((fn) => { try { fn(); } catch (e) { log('error', 'upload: ' + e.stack); } });
    if (upq.items.length) { upq.timer = setTimeout(drainUploads, Math.max(1, Math.round(upq.items[0].bytes / UPLOAD_KBPS))); return; }
    const top = Object.keys(upq.per).sort((x, y) => upq.per[y][0] - upq.per[x][0]).slice(0, 4)
        .map((k) => k + ' ' + Math.round(upq.per[k][0] / 1024) + ' KB/' + upq.per[k][1]).join(', ');
    log('info', 'upload: ' + Math.round(upq.total / 1024) + ' KB through in ' + (Date.now() - upq.startedAt) + ' ms at ' + UPLOAD_KBPS + ' KB/s' + (top ? ' (most: ' + top + ')' : ''));
}
// BENCH_RENDERER=old: the hello of a cluster-render before 0.8.5 (no "curves": replacing an animation was costly)
// text 1 (cluster-render 0.8.11): fonts and text layers; BENCH_NO_TEXT=1 leaves it out (a 0.8.10 or older)
const HELLO_FLAGS = process.env.BENCH_RENDERER === 'old' ? {} : Object.assign({ curves: 1 }, process.env.BENCH_NO_TEXT ? {} : { text: 1 });
const TOTAL_ASSETS = 32, ASSETS_PER_CLIENT = 16;   // CompositorLimits assets / assets_per_client
const mib = (b) => (b / 1048576).toFixed(1) + ' MiB';
const SOCK = path.join(os.tmpdir(), 'hud-bench-' + process.pid + '.sock');
const ROOT = path.join(__dirname, '..');
const APP_ID = process.argv[2] || process.env.BENCH_APP || 'zeiger';
const APP_DIR = path.join(ROOT, 'apps', APP_ID);
if (!fs.existsSync(path.join(APP_DIR, 'app.json'))) { console.error('no app ' + APP_ID + ' under apps/'); process.exit(2); }
const DATA_DIR = path.join(__dirname, '.data', APP_ID);   // the app's data/ on the bench (settings.json, layouts/)
const STAGE = path.join(ROOT, 'dist', APP_ID);
const TARGETS = { hud: [800, 480], map: [1088, 480], panel: [1920, 720] };
const CLASSES = ['ambient', 'content', 'overlay', 'alert'];
const MAX_MSG = 5529664;
// The car runs Node 8.16.2, so run the app on that by default when it's in the drive cache.
const NODE8 = path.join(ROOT, '..', '..', '.cache', 'node8', 'node-v8.16.2-darwin-x64', 'bin', 'node');
const APP_NODE = process.env.BENCH_NODE || (fs.existsSync(NODE8) ? NODE8 : null);
/** The target the page draws: the app's config.target (read again on each restart). */
function appView() {
    try { const t = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'app.json'), 'utf8')).config.target; return TARGETS[t] ? t : 'hud'; } catch (e) { return 'hud'; }
}

/* ---------- browser side: Server-Sent Events out, small POSTs in ---------- */

const clients = new Set();
const logLines = [];
function send(obj, only) {
    const line = 'data: ' + JSON.stringify(obj) + '\n\n';
    (only ? [only] : Array.from(clients)).forEach((res) => res.write(line));
}
function log(level, text) {
    const entry = { t: 'log', level, text: new Date().toTimeString().slice(0, 8) + '  ' + text };
    logLines.push(entry);
    if (logLines.length > 400) logLines.shift();
    send(entry);
    (level === 'error' ? console.error : console.log)(entry.text);
}

/* ---------- the fake cluster-render ---------- */

const layers = new Map();   // key "conn:ref" -> layer
let textWrites = 0;          // text layer strings received (cluster-render 0.8.11)
let nextConn = 1;

/** The visibility warnings for one layer's rect on its target (the same check layouts.js runs per widget). */
function layerWarnings(l) {
    return visible.check([{ id: '#' + l.ref, x: l.x, y: l.y, w: l.w, h: l.h }], l.target === 'panel' ? 'panel' : 'hud')
        .map((w) => w.replace(/^#\d+: /, ''));
}
function overCap() { return Array.from(layers.values()).filter((l) => l.state === 'waiting').length; }
function sceneMeta() {
    return Array.from(layers.values()).filter((l) => l.kind !== 'font').map((l) => ({
        key: l.key, conn: l.conn, ref: l.ref, app: l.app, kind: l.kind, target: l.target,
        class: l.class, z: l.z, x: l.x, y: l.y, w: l.w, h: l.h, visible: l.visible, opacity: l.opacity,
        sx: l.sx, sy: l.sy, px: l.px, py: l.py, rotate: l.rotate,
        exclusive: l.exclusive, iw: l.iw, ih: l.ih, fs: l.fs, time: l.time, uniforms: l.uniforms, binds: l.binds, format: l.format,
        state: l.state, reason: l.reason, warnings: l.kind === 'asset' ? [] : layerWarnings(l),
        // animations (PROTOCOL.md "Animations"): each with how long it has played, so the page plays it on from there
        anims: l.anims ? Object.keys(l.anims).map((n) => { const a = l.anims[n]; return { anim: +n, property: a.property, name: a.name, keys: a.keys, loop: a.loop, interp: a.interp, age: Date.now() - a.t0 }; }) : [],
    }));
}
function helloMsg() {
    return { t: 'hello', targets: TARGETS, view: appView(), app: APP_ID, cap: layerCap, pixelCap: PIXEL_BYTES,
        geometry: { HOOD: visible.HOOD, BLACK_BOX: visible.BLACK_BOX, BELT: visible.BELT, HUD_WINDOW: visible.HUD_WINDOW, HUD_BMW: visible.HUD_BMW } };
}
let sceneTimer = null;
function sceneChanged() {
    if (sceneTimer) return;
    sceneTimer = setTimeout(() => { sceneTimer = null; send({ t: 'scene', layers: sceneMeta(), pixels: pixelBytes() }); }, 16);
}
/* Pixels never travel on the event stream: a 'px' notice names a rect of an image layer and the page fetches its
 * bytes from GET /px (binary, the layer's current pixels). Base64 on the stream choked the page once the engine
 * packed text into 1 MB sheets (Nov 5 2026). */
function sendPixels(l, only) {
    if (!l.image) return;
    sendRect(l, 0, 0, l.iw, l.ih, only);
}
function sendRect(l, x, y, w, h, only) {
    send({ t: 'px', key: l.key, iw: l.iw, ih: l.ih, x, y, w, h }, only);
}
/** GET /px?key=&x=&y=&w=&h=: that rect of the layer's image, raw RGBA rows. */
function pixelRect(q) {
    const l = layers.get(q.key);
    const x = Number(q.x), y = Number(q.y), w = Number(q.w), h = Number(q.h);
    if (!l || !l.image || !(w > 0 && h > 0 && x >= 0 && y >= 0 && x + w <= l.iw && y + h <= l.ih)) return null;
    if (l.bpp === 1) {
        // an R8 asset: the page gets it as RGBA, the byte in R (what a shader's .r reads) and A, grey in G and B
        const out = Buffer.alloc(w * h * 4);
        for (let r = 0; r < h; r++) {
            for (let i = 0; i < w; i++) {
                const v = l.image[(y + r) * l.iw + x + i], o = (r * w + i) * 4;
                out[o] = v; out[o + 1] = v; out[o + 2] = v; out[o + 3] = v;
            }
        }
        return out;
    }
    if (x === 0 && w === l.iw) return l.image.slice(y * l.iw * 4, (y + h) * l.iw * 4);
    const out = Buffer.alloc(w * h * 4);
    for (let r = 0; r < h; r++) l.image.copy(out, r * w * 4, ((y + r) * l.iw + x) * 4, ((y + r) * l.iw + x + w) * 4);
    return out;
}

function writeEv(sock, obj) {
    const body = Buffer.from(JSON.stringify(obj), 'utf8');
    const m = Buffer.alloc(5 + body.length);
    m.writeUInt32LE(body.length + 1, 0);
    m[4] = 0x4a;
    body.copy(m, 5);
    sock.write(m);
}

const renderServer = net.createServer((sock) => {
    const conn = nextConn++;
    const st = { conn, app: '?', hello: false, buf: Buffer.alloc(0) };
    const bad = (why) => { log('error', 'protocol [' + st.app + ']: ' + why); };
    const refuse = (op, ref, reason) => { bad(op + ' ref ' + ref + ': ' + reason); writeEv(sock, { ev: 'error', op, ref, reason }); };

    sock.on('data', (d) => {
        st.buf = st.buf.length ? Buffer.concat([st.buf, d]) : d;
        let off = 0;
        while (st.buf.length - off >= 5) {
            const len = st.buf.readUInt32LE(off);
            if (len < 1 || len > MAX_MSG) { bad('message length ' + len + ' out of range, closing'); sock.destroy(); return; }
            if (st.buf.length - off < 4 + len) break;
            const type = st.buf[off + 4];
            const body = st.buf.slice(off + 5, off + 4 + len);
            off += 4 + len;
            try { handle(type, body); } catch (e) { bad('handler threw: ' + e.stack); }
        }
        st.buf = st.buf.slice(off);
    });
    sock.on('error', () => {});
    sock.on('close', () => {
        let n = 0;
        layers.forEach((l, k) => { if (l.conn === conn) { layers.delete(k); n++; } });
        log('info', 'renderer: ' + st.app + ' disconnected, dropped its ' + n + ' layer(s)');
        sceneChanged();
    });

    function handle(type, body) {
        if (type === 0x4a) return onJson(body);
        if (!st.hello) return bad('binary message before hello');
        if (type === 0x46) return onFrame(body);
        if (type === 0x4d) return bad('mesh geometry received; the bench does not draw meshes');
        bad('unknown message type 0x' + type.toString(16));
    }

    function onJson(body) {
        let m;
        try { m = JSON.parse(body.toString('utf8')); } catch (e) { return bad('JSON message does not parse: ' + e.message); }
        if (m.op === 'hello') {
            st.hello = true;
            st.app = m.app || '?';
            if (m.proto !== 1) bad('hello proto ' + m.proto + ', service speaks 1');
            log('info', 'renderer: hello from ' + st.app + ' (proto ' + m.proto + ')');
            writeEv(sock, Object.assign({ ev: 'hello', backend: 'bench', targets: Object.keys(TARGETS).join(',') }, HELLO_FLAGS));
            return;
        }
        if (!st.hello) return bad(m.op + ' before hello');
        const key = conn + ':' + m.ref;
        const l = layers.get(key);
        switch (m.op) {
            case 'layer': {
                if (!TARGETS[m.target]) return refuse('layer', m.ref, 'unknown target ' + m.target);
                if (m.class && CLASSES.indexOf(m.class) < 0) return refuse('layer', m.ref, 'unknown class ' + m.class);
                if (m.z !== undefined && (m.z < -1000 || m.z > 1000)) return refuse('layer', m.ref, 'z out of -1000..1000');
                const [tw, th] = TARGETS[m.target];
                if (layerCount() >= TOTAL_LAYERS) return refuse('layer', m.ref, 'too many layers');
                if (CLIENT_LAYERS) { let mine = 0; layers.forEach((o) => { if (o.conn === conn && o.kind !== 'asset') mine++; }); if (mine >= CLIENT_LAYERS) return refuse('layer', m.ref, 'too many layers'); }
                if (m.kind === 'image' && PIXEL_BYTES && m.iw > 0 && m.ih > 0 && pixelBytes() + m.iw * m.ih * 8 > PIXEL_BYTES) {
                    return refuse('layer', m.ref, "the service's pixel memory is full");
                }
                const nl = {
                    key, conn, ref: m.ref, app: st.app, kind: m.kind, target: m.target,
                    class: m.class || 'content', z: m.z || 0, x: m.x || 0, y: m.y || 0, w: m.w || 0, h: m.h || 0,
                    visible: m.visible === undefined ? 1 : m.visible, opacity: m.opacity === undefined ? 1 : m.opacity,
                    exclusive: m.exclusive || 0, uniforms: {}, state: 'shown', reason: '',
                };
                // scale / rotation about the pivot (PROTOCOL.md: sx, sy default 1; px, py default the rect's centre)
                ['sx', 'sy', 'px', 'py', 'rotate'].forEach((k) => { if (m[k] !== undefined) nl[k] = m[k]; });
                // The layer cap: count this connection's live layers that got a slot; past the cap, the
                // layer is registered (so set/uniform/frames on it stay valid) but waits and is not drawn.
                if (layerCap > 0) {
                    let shown = 0, live = 0;
                    layers.forEach((o) => { if (o.conn === conn && o.kind !== 'asset') { live++; if (o.state === 'shown') shown++; } });
                    if (shown >= layerCap) {
                        nl.state = 'waiting'; nl.reason = 'bench: over the layer cap of ' + layerCap;
                        log('warn', 'layer ' + m.ref + ' (' + m.kind + ' ' + nl.x + ',' + nl.y + ' ' + nl.w + 'x' + nl.h + ') is live layer #' + (live + 1) + ' on this connection: over the layer cap of ' + layerCap + ', not drawn');
                    }
                }
                if (nl.x + nl.w > tw || nl.y + nl.h > th || nl.x < 0 || nl.y < 0) {
                    log('warn', 'layer ' + m.ref + ' (' + nl.x + ',' + nl.y + ' ' + nl.w + 'x' + nl.h + ') runs off the ' + tw + 'x' + th + ' ' + m.target + ' target');
                }
                if (nl.exclusive) log('warn', 'layer ' + m.ref + ' is exclusive: it hides everything under it (CarPlay/AA map too)');
                if (m.kind === 'image') {
                    nl.iw = m.iw; nl.ih = m.ih; nl.bpp = 4;
                    if (!(m.iw > 0 && m.ih > 0 && m.iw <= 1920 && m.ih <= 720)) return refuse('layer', m.ref, 'image iw/ih out of range');
                    nl.image = Buffer.alloc(m.iw * m.ih * 4);
                    if (UPLOAD_KBPS && nl.state === 'shown') { nl.state = 'waiting'; nl.reason = 'bench: first write on its way'; nl.firstWrite = true; }
                } else if (m.kind === 'text') {
                    if (!HELLO_FLAGS.text) return refuse('layer', m.ref, 'unknown layer kind text');
                    const f = layers.get(conn + ':' + m.font);
                    if (!f || f.kind !== 'font') return refuse('layer', m.ref, 'no such font ' + m.font);
                    if (f.target !== m.target) return refuse('layer', m.ref, "the font's atlas is on another target");
                    const max = m.max === undefined ? 64 : +m.max;
                    if (!(Number.isInteger(max) && max >= 1 && max <= 256)) return refuse('layer', m.ref, 'max is 1 to 256');
                    if (!(nl.w > 0 && nl.h > 0)) return refuse('layer', m.ref, 'a text layer needs a rect');
                    Object.assign(nl, { fontKey: f.key, max, align: 'left', spacing: 0, size: 0, color: [1, 1, 1, 1], text: '', iw: nl.w, ih: nl.h, bpp: 4, cost: max * 76 * 2 });
                    nl.image = Buffer.alloc(nl.w * nl.h * 4);
                    const why = textStyle(nl, Object.assign({}, m, { text: undefined }));
                    if (why) return refuse('layer', m.ref, why);
                    if (m.text !== undefined && textStyle(nl, { text: m.text })) writeEv(sock, { ev: 'error', op: 'text', ref: m.ref, reason: 'text is at most 1024 bytes of UTF-8' });
                    drawTextLayer(nl);
                } else if (m.kind === 'effect') {
                    if (!m.fs) return refuse('layer', m.ref, 'effect without fs');
                    // the renderer fills u_mvp, u_mv, u_m, u_v, u_p itself as mat4s (PROTOCOL.md "Shaders"): declared as
                    // anything else, RAMSES refuses the effect on the car, though WebGL here would take it (Zeiger 0.38.1)
                    const reserved = /uniform\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+(u_mvp|u_mv|u_m|u_v|u_p)\s*;/.exec(m.fs);
                    if (reserved && reserved[1] !== 'mat4') return refuse('layer', m.ref, 'effect did not compile: ' + reserved[2] + ' is the renderer\'s mat4, declared ' + reserved[1]);
                    nl.fs = m.fs; nl.time = !!m.time; nl.binds = {};
                } else {
                    log('warn', 'layer ' + m.ref + ': kind ' + m.kind + ' is not drawn by the bench');
                }
                layers.set(key, nl);
                if (nl.kind === 'text') sendTextPixels(nl);   // its visibility warnings (hood, gear box, belt light, HUD window) ride along in sceneMeta()
                if (nl.state === 'waiting') writeEv(sock, { ev: 'layer', ref: m.ref, state: 'waiting', reason: nl.reason });
                else writeEv(sock, { ev: 'layer', ref: m.ref, state: 'shown' });
                sceneChanged();
                return;
            }
            case 'asset': {
                // PROTOCOL.md "asset": an R8 or RGBA8 texture, not drawn, not a layer; effect layers sample it through "bind".
                // The service's limits: 32 assets, 16 per client, 1..2048 a side, within one frame message; pixel memory twice its bytes.
                if (!TARGETS[m.target]) return refuse('asset', m.ref, 'unknown target ' + m.target);
                const format = m.format || 'rgba8', etcB = format === 'etc2rgba' ? 1 : format === 'etc2rgb' ? 0.5 : 0;
                const bpp = format === 'r8' ? 1 : format === 'rgba8' || etcB ? 4 : 0;
                if (!bpp) return refuse('asset', m.ref, 'unknown asset format ' + format);
                // ETC2 (cluster-render 0.5.8): w and h multiples of 4, the blocks sent whole once; the bench decodes them
                // (shared/etc2.js) so its page draws the asset as RGBA
                // BENCH_NO_ETC2=1: a cluster-render older than 0.5.8, which doesn't know these formats
                if (etcB && process.env.BENCH_NO_ETC2) return refuse('asset', m.ref, 'unknown asset format ' + format);
                if (etcB && (m.w % 4 || m.h % 4)) return refuse('asset', m.ref, 'an ' + format + " asset's sides must be multiples of 4");
                if (!(m.w > 0 && m.h > 0 && m.w <= 2048 && m.h <= 2048 && m.w * m.h * bpp + 64 <= 1920 * 720 * 4 + 64)) return refuse('asset', m.ref, 'asset size out of range');
                let all = 0, mine = 0;
                layers.forEach((o) => { if (o.kind === 'asset') { all++; if (o.conn === conn) mine++; } });
                if (all >= TOTAL_ASSETS || mine >= ASSETS_PER_CLIENT) return refuse('asset', m.ref, 'too many assets');
                if (PIXEL_BYTES && pixelBytes() + (etcB ? m.w * m.h * etcB : m.w * m.h * bpp * 2) > PIXEL_BYTES) return refuse('asset', m.ref, "the service's pixel memory is full");
                layers.set(key, {
                    key, conn, ref: m.ref, app: st.app, kind: 'asset', target: m.target, format, bpp, class: '-', z: 0,
                    x: 0, y: 0, w: m.w, h: m.h, iw: m.w, ih: m.h, visible: 0, opacity: 1, exclusive: 0, uniforms: {},
                    image: Buffer.alloc(m.w * m.h * bpp), state: 'shown', reason: '',
                    etc: etcB ? format : null, etcBytes: etcB ? m.w * m.h * etcB : 0, cost: etcB ? m.w * m.h * etcB : 0, etcSent: false,
                });
                log('info', 'asset ' + m.ref + ': ' + format + ' ' + m.w + 'x' + m.h + ' (' + mib(etcB ? m.w * m.h * etcB : m.w * m.h * bpp * 2) + ' of pixel memory)');
                writeEv(sock, { ev: 'layer', ref: m.ref, state: 'shown' });
                sceneChanged();
                return;
            }
            case 'font': {
                if (!HELLO_FLAGS.text) return bad('op "font" not handled by the bench');
                const a = layers.get(conn + ':' + m.asset);
                if (!a || a.kind !== 'asset' || a.format !== 'r8') return refuse('font', m.ref, "a font's atlas is an r8 asset");
                if (!(m.line >= 1 && m.line <= 2048)) return refuse('font', m.ref, 'line is 1 to 2048');
                let mine = 0;
                layers.forEach((o) => { if (o.kind === 'font' && o.conn === conn) mine++; });
                if (mine >= 8) return refuse('font', m.ref, 'a client has at most 8 fonts');
                const t = parseFont(m, a);
                if (typeof t === 'string') return refuse('font', m.ref, t);
                layers.set(key, { key, conn, ref: m.ref, app: st.app, kind: 'font', target: a.target, atlasKey: a.key, line: +m.line,
                    glyphs: t.glyphs, kerning: t.kerning, class: '-', z: 0, x: 0, y: 0, w: 0, h: 0, visible: 0, opacity: 1, exclusive: 0, uniforms: {}, state: 'shown', reason: '' });
                a.fontOf = key;
                log('info', 'font ' + m.ref + ': ' + t.glyphs.size + ' glyphs from asset ' + m.asset + ', line ' + m.line);
                return;
            }
            case 'text': {
                if (!l || l.kind !== 'text') return refuse('text', m.ref, 'no such text layer');
                const why = textStyle(l, m);
                if (why) return refuse('text', m.ref, why);
                drawTextLayer(l);
                sendTextPixels(l);
                textWrites++;
                return;
            }
            case 'bind': {
                if (!l) return refuse('bind', m.ref, 'no such layer');
                if (l.kind !== 'effect') return refuse('bind', m.ref, 'bind on a ' + l.kind + ' layer');
                const a = layers.get(conn + ':' + m.asset);
                if (!a || a.kind !== 'asset') return refuse('bind', m.ref, 'no such asset ' + m.asset);
                if (a.target !== l.target) return refuse('bind', m.ref, 'the asset is on another target');
                l.binds[m.sampler] = a.key;
                sceneChanged();
                return;
            }
            case 'set': {
                if (!l) return refuse('set', m.ref, 'no such layer');
                ['class', 'z', 'x', 'y', 'w', 'h', 'visible', 'exclusive', 'opacity', 'sx', 'sy', 'px', 'py', 'rotate'].forEach((k) => { if (m[k] !== undefined) l[k] = m[k]; });
                if (l.kind === 'text' && (l.w !== l.iw || l.h !== l.ih)) { l.iw = l.w; l.ih = l.h; l.image = Buffer.alloc(l.w * l.h * 4); drawTextLayer(l); sendTextPixels(l); }
                sceneChanged();
                return;
            }
            case 'drop': {
                if (!l) return refuse('drop', m.ref, 'no such layer');
                if (l.kind === 'font') {
                    let used = false;
                    layers.forEach((o) => { if (o.kind === 'text' && o.fontKey === key) used = true; });
                    if (used) return refuse('drop', m.ref, 'font in use');
                    const a = layers.get(l.atlasKey); if (a) delete a.fontOf;
                }
                if (l.kind === 'asset' && l.fontOf && layers.has(l.fontOf)) return refuse('drop', m.ref, 'asset in use: a font draws from it');
                if (l.kind === 'asset') {
                    let used = false;
                    layers.forEach((o) => { if (o.binds && Object.keys(o.binds).some((s) => o.binds[s] === key)) used = true; });
                    if (used) return refuse('drop', m.ref, 'asset in use');
                }
                layers.delete(key);
                sceneChanged();
                return;
            }
            case 'uniform': {
                if (!l) return refuse('uniform', m.ref, 'no such layer');
                if (l.kind !== 'effect') return refuse('uniform', m.ref, 'uniform on a ' + l.kind + ' layer');
                const v = String(m.v).trim().split(/\s+/).map(Number);
                if (v.some((n) => !isFinite(n))) return refuse('uniform', m.ref, 'non-numeric value "' + m.v + '"');
                // PROTOCOL.md "Uniforms": without type, 1-4 numbers; with type, whole elements, up to 1024
                // numbers (an array uniform). Both the numbers and the type reach the page.
                const WIDTH = { float: 1, vec2: 2, vec3: 3, vec4: 4, mat4: 16 };
                if (m.type !== undefined) {
                    if (!WIDTH[m.type]) return refuse('uniform', m.ref, 'unknown uniform type "' + m.type + '"');
                    if (v.length > 1024 || v.length % WIDTH[m.type]) return refuse('uniform', m.ref, 'uniform ' + m.name + ': ' + v.length + ' numbers is not whole ' + m.type + 's (or over 1024)');
                } else if (v.length > 4) return refuse('uniform', m.ref, 'uniform ' + m.name + ': ' + v.length + ' numbers without a type (max 4)');
                l.uniforms[m.name] = { v, type: m.type || null };
                sceneChanged();
                return;
            }
            case 'animate': {
                // PROTOCOL.md "Animations": played by the renderer (here the page) by itself; the same number
                // again replaces it, starting over; at most 16 a layer. Image and effect layers: rotate, translate,
                // scale, uniform (meshes are not drawn here)
                if (!l) return refuse('animate', m.ref, 'no such layer');
                if (['rotate', 'translate', 'scale', 'uniform'].indexOf(m.property) < 0) return refuse('animate', m.ref, 'unknown property "' + m.property + '"');
                const keys = String(m.keys || '').trim().split(/\s+/).map((k) => { const p = k.split(':'); return [Number(p[0])].concat(String(p[1] || '').split(',').map(Number)); });
                if (!keys.length || keys.length > 256 || keys.some((k) => k.some((n) => !isFinite(n)))) return refuse('animate', m.ref, 'bad keys "' + m.keys + '"');
                l.anims = l.anims || {};
                if (!l.anims[m.anim] && Object.keys(l.anims).length >= 16) return refuse('animate', m.ref, 'a layer plays at most 16 animations');
                l.anims[m.anim] = { property: m.property, name: m.name, keys, loop: !!m.loop, interp: m.interp === 'step' ? 'step' : 'linear', t0: Date.now() };
                sceneChanged();
                return;
            }
            case 'stop': {
                if (!l) return refuse('stop', m.ref, 'no such layer');
                if (l.anims) delete l.anims[m.anim];
                sceneChanged();
                return;
            }
            case 'status':
                const conns = new Set(Array.from(layers.values()).map((l) => l.conn)).size;
                const assets = layers.size - layerCount();
                writeEv(sock, { ev: 'status', text: 'bench: ' + layerCount() + ' layers' + (assets ? ' and ' + assets + ' asset' + (assets > 1 ? 's' : '') : '') + ' on ' + conns + ' connection(s), layer cap ' + (layerCap || 'off') + ', ' + overCap() + ' over it, pixel memory ' + mib(pixelBytes()) + ' of ' + (PIXEL_BYTES ? mib(PIXEL_BYTES) : 'unlimited') });
                return;
            default:
                bad('op "' + m.op + '" not handled by the bench');
        }
    }

    function onFrame(body) {
        if (body.length < 14) return bad('frame message too short');
        if (!UPLOAD_KBPS) return applyFrame(body);
        const ref = body.readUInt32LE(0);
        upload(body.length, () => {
            const l = layers.get(conn + ':' + ref);
            if (!l) return;
            applyFrame(body);
            if (l.firstWrite && l.sentWhole) {
                l.firstWrite = false; l.state = 'shown'; l.reason = '';
                writeEv(sock, { ev: 'layer', ref, state: 'shown' });
                sceneChanged();
            }
        }, (() => { const l = layers.get(conn + ':' + ref); return conn + ':' + ref + (l ? ' ' + l.kind + ' ' + l.x + ',' + l.y + ' ' + l.w + 'x' + l.h : ''); })(),
        conn + ':' + ref, (() => { const l = layers.get(conn + ':' + ref); return l && l.image ? l.image.length : 0; })());
    }

    function applyFrame(body) {
        const ref = body.readUInt32LE(0);
        const n = body.readUInt16LE(12);
        const l = layers.get(conn + ':' + ref);
        if (!l) return bad('frame for unknown ref ' + ref);
        if (l.kind !== 'image' && l.kind !== 'asset') return bad('frame for a ' + l.kind + ' layer (ref ' + ref + ')');
        const head = 14 + n * 8, bpp = l.bpp || 4;
        const px = body.slice(head);
        if (l.etc) {
            // an ETC2 asset: no rects, the blocks whole, once
            if (n !== 0) return refuse('frame', ref, 'an ' + l.etc + ' asset takes no rects');
            if (l.etcSent) return refuse('frame', ref, 'an ' + l.etc + ' asset is sent once');
            if (px.length !== l.etcBytes) return bad('whole frame for ' + l.etc + ' asset ' + ref + ' is ' + px.length + ' bytes, it needs ' + l.etcBytes);
            try { etc2.decode(px, l.iw, l.ih, l.etc).copy(l.image); } catch (e) { return refuse('frame', ref, 'not ' + l.etc + ': ' + e.message); }
            l.etcSent = true;
            l.sentWhole = true;
            sendPixels(l);
            return;
        }
        if (n === 0) {
            if (px.length !== l.image.length) return bad('whole frame for ref ' + ref + ' is ' + px.length + ' bytes, layer needs ' + l.image.length);
            px.copy(l.image);
        } else {
            let o = 0;
            const rects = [];
            for (let i = 0; i < n; i++) {
                const x = body.readUInt16LE(14 + i * 8), y = body.readUInt16LE(16 + i * 8);
                const w = body.readUInt16LE(18 + i * 8), h = body.readUInt16LE(20 + i * 8);
                if (x + w > l.iw || y + h > l.ih) return bad('dirty rect off the image on ref ' + ref);
                for (let r = 0; r < h; r++) { px.copy(l.image, ((y + r) * l.iw + x) * bpp, o, o + w * bpp); o += w * bpp; }
                rects.push([x, y, w, h]);
            }
            if (o !== px.length) return bad('dirty rects for ref ' + ref + ' carry ' + px.length + ' bytes, expected ' + o);
            if (l.sentWhole) { rects.forEach((r) => sendRect(l, r[0], r[1], r[2], r[3])); return; }
        }
        l.sentWhole = true;
        sendPixels(l);
        // a font's atlas came in after its text layers drew (the upload queue): they draw again (the car's cluster
        // samples the atlas every frame)
        if (l.fontOf) layers.forEach((t) => { if (t.kind === 'text' && t.fontKey === l.fontOf) { drawTextLayer(t); sendTextPixels(t); } });
    }
});

/* ---------- the app child ---------- */

let child = null;
let signals = { t: 'signals', mode: 'demo', values: {} };
let drive = { t: 'drive', value: null };   // the drive mode buttons (FES actualValueModeDrivingExperience), null = car hasn't said
let restartTimer = null;
let stopping = false;

function build() {
    // The kit's build needs an oap-sdk folder; on the Mac that is a stub (see bench/README.md).
    const sdk = path.join(ROOT, 'oap-sdk');
    if (!fs.existsSync(path.join(sdk, 'index.js'))) {
        fs.mkdirSync(sdk, { recursive: true });
        fs.writeFileSync(path.join(sdk, 'index.js'), "'use strict';\n// BENCH_STUB: stands in for BMW's oap-sdk so kit/tools/build.py runs on the Mac. Never ship this.\nthrow new Error('BENCH_STUB oap-sdk');\n");
        fs.writeFileSync(path.join(sdk, 'package.json'), JSON.stringify({ name: 'oap-sdk', version: '0.0.0-bench-stub', main: 'index.js' }) + '\n');
    }
    try {
        const out = execFileSync('python3', [path.join(ROOT, 'kit', 'tools', 'build.py'), APP_ID], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        String(out).split('\n').filter(Boolean).forEach((ln) => log('info', 'build: ' + ln.trim()));
        return true;
    } catch (e) {
        log('error', 'build failed: ' + String(e.stderr || e.message).trim());
        return false;
    }
}

function startApp() {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* there */ }
    send(helloMsg());
    if (!build()) { send({ t: 'app', state: 'stopped' }); return; }
    const opts = { cwd: DATA_DIR, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: Object.assign({}, process.env, { HUD_CLUSTER_SOCKET: SOCK }) };
    if (APP_NODE) opts.execPath = APP_NODE;
    child = fork(path.join(__dirname, 'run-app.js'), [STAGE, DATA_DIR], opts);
    const c = child;
    if (drive.value !== null) c.send(drive);
    const pipe = (stream, level) => {
        let rest = '';
        stream.on('data', (d) => {
            const lines = (rest + d).split('\n');
            rest = lines.pop();
            lines.forEach((ln) => ln && log(/WARN|Error|error/.test(ln) ? 'warn' : level, 'app: ' + ln));
        });
    };
    pipe(c.stdout, 'info');
    pipe(c.stderr, 'warn');
    c.on('message', (m) => {
        if (m && m.t === 'settings') lastSettings = m;
        if (m && m.t === 'status') { lastStatus = m; log('info', 'center screen status: ' + m.s); }
        if (m && (m.t === 'values' || m.t === 'settings' || m.t === 'status')) send(m);
    });
    c.on('exit', (code, sig) => {
        if (c !== child) return;
        child = null;
        send({ t: 'app', state: 'stopped' });
        if (!stopping) log('error', 'app exited (code ' + code + (sig ? ', ' + sig : '') + '); fix and save to restart');
    });
    c.send(signals);
    send({ t: 'app', state: 'running' });
    log('info', 'app started on ' + (APP_NODE ? APP_NODE.replace(/^.*\/(node-v[^/]+)\/.*$/, '$1') : 'node ' + process.version + ' (not the car\'s Node 8)'));
}

function restartApp(why) {
    log('info', 'restarting app: ' + why);
    if (child) {
        const old = child;
        child = null;
        stopping = true;
        old.once('exit', () => { stopping = false; startApp(); });
        old.kill('SIGTERM');
        setTimeout(() => { try { old.kill('SIGKILL'); } catch (e) { /* gone */ } }, 1500);
    } else startApp();
}

[APP_DIR, path.join(ROOT, 'shared'), path.join(ROOT, 'kit')].forEach((dir) => fs.watch(dir, { recursive: true }, (ev, file) => {
    if (!file || /(^|\/)\./.test(file) || /__pycache__/.test(file)) return;
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => restartApp(path.basename(dir) + '/' + file + ' changed'), 300);
}));
let lastSettings = null;
let lastStatus = null;

/* ---------- HTTP ---------- */

function body(req) {
    return new Promise((resolve) => {
        let s = '';
        req.on('data', (d) => { s += d; if (s.length > 1e5) req.destroy(); });
        req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch (e) { resolve({}); } });
    });
}

const web = http.createServer(async (req, res) => {
    const host = (req.headers.host || '').split(':')[0];
    if (host !== 'localhost' && host !== '127.0.0.1') { res.writeHead(403); return res.end(); }
    const url = req.url.split('?')[0];
    if (req.method === 'GET' && url === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        return fs.createReadStream(path.join(__dirname, 'page.html')).pipe(res);
    }
    if (req.method === 'GET' && url === '/px') {
        const q = {};
        (req.url.split('?')[1] || '').split('&').forEach((kv) => { const i = kv.indexOf('='); if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); });
        const px = pixelRect(q);
        if (!px) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' });
        return res.end(px);
    }
    if (req.method === 'GET' && url === '/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
        clients.add(res);
        req.on('close', () => clients.delete(res));
        send(helloMsg(), res);
        logLines.forEach((e) => send(e, res));
        send({ t: 'scene', layers: sceneMeta(), pixels: pixelBytes() }, res);
        layers.forEach((l) => sendPixels(l, res));
        if (lastSettings) send(lastSettings, res);
        if (lastStatus) send(lastStatus, res);
        send({ t: 'app', state: child ? 'running' : 'stopped' }, res);
        return;
    }
    if (req.method === 'POST' && url === '/signals') {
        const b = await body(req);
        signals = { t: 'signals', mode: b.mode === 'manual' ? 'manual' : 'demo', values: b.values || {} };
        if (child) child.send(signals);
        res.writeHead(204); return res.end();
    }
    if (req.method === 'POST' && url === '/drive') {
        const b = await body(req);
        drive = { t: 'drive', value: b.value === null || b.value === undefined ? null : b.value };
        if (child) child.send(drive);
        log('info', 'bench: drive mode ' + JSON.stringify(drive.value));
        res.writeHead(204); return res.end();
    }
    if (req.method === 'POST' && url === '/shift-test') {
        // the page's "Test the shift lights" button (hud.testShift)
        if (!child) { res.writeHead(409); return res.end('app not running'); }
        child.send({ t: 'shiftTest' });
        log('info', 'bench: shift-light test');
        res.writeHead(204); return res.end();
    }
    if (req.method === 'POST' && url === '/restart') {
        restartApp('restart button');
        res.writeHead(204); return res.end();
    }
    if (req.method === 'POST' && url === '/hang') {
        // the app's event loop blocked for { ms } (default 3000): what a hang on the head unit looks like (its socket
        // stays open, it sends nothing); the fail-safe should take its layers away
        const b = await body(req), ms = Math.min(30000, Math.max(100, Number(b.ms) || 3000));
        if (!child) { res.writeHead(409); return res.end('app not running'); }
        child.send({ t: 'hang', ms });
        log('info', 'bench: the app hangs for ' + ms + ' ms');
        res.writeHead(204); return res.end();
    }
    if (req.method === 'POST' && url === '/cap') {
        // The layer cap, set live from the page. The app restarts so it registers its layers again under the new cap.
        const b = await body(req);
        const n = Math.max(0, Math.floor(Number(b.cap) || 0));
        if (n !== layerCap) {
            layerCap = n;
            send(helloMsg());
            restartApp('layer cap set to ' + (n || 'unlimited') + ', the app registers its layers again');
        }
        res.writeHead(204); return res.end();
    }
    if (req.method === 'POST' && url === '/setting') {
        // Pressed on the stub's RHMI components, as the car's settings page sends it (run-app.js).
        const b = await body(req);
        if (!child) { res.writeHead(409); return res.end('app not running'); }
        child.send({ t: 'set', key: b.key, value: b.value });
        log('info', 'bench: setting ' + b.key + ' = ' + JSON.stringify(b.value));
        res.writeHead(204); return res.end();
    }
    res.writeHead(404); res.end();
});

try { fs.unlinkSync(SOCK); } catch (e) { /* not there */ }
renderServer.listen(SOCK, () => {
    web.listen(PORT, '127.0.0.1', () => {
        log('info', 'bench renderer on ' + SOCK);
        log('info', 'open http://localhost:' + PORT);
        if (layerCap) log('info', 'layer cap ' + layerCap + ' (BENCH_LAYER_CAP): layers past it get state waiting and are not drawn');
        log('info', 'the service\'s limits: ' + TOTAL_LAYERS + ' layers across every connection, pixel memory ' + (PIXEL_BYTES ? mib(PIXEL_BYTES) : 'unlimited') + ' (every image counted twice)');
        startApp();
    });
});
function shutdown() {
    stopping = true;
    if (child) child.kill('SIGTERM');
    try { fs.unlinkSync(SOCK); } catch (e) { /* gone */ }
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
