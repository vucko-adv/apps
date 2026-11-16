'use strict';
/**
 * Sound Test (vucko-adv, Nov 16 2026): can an app on the head unit play sound through the car's speakers, and how?
 * The first step toward an engine sound app. Nothing is changed on the head unit: the page looks (Probe) and plays
 * short, quiet test sounds only when a button is pressed.
 *
 *   Probe       who the app runs as, the sound cards (/proc/asound), /dev/snd and who may open it, the players on the
 *               head unit (aplay, paplay, pactl, gst-launch-1.0, ...), PulseAudio's socket, ALSA's own config and
 *               "aplay -L" (the PCM names BMW's audio set-up has). Written whole to probe.txt in the app's data folder
 *               and to the log; the main lines on the page.
 *   Device      the ALSA device aplay plays to: default, then each name "aplay -L" gave (a tap goes to the next).
 *   Tone        1 s of 440 Hz, quiet (a fifth of full scale), faded in and out, through aplay to that device.
 *   Engine      3 s of a made-up four-cylinder going from 1000 to 5000 rpm (its firing note and a few harmonics),
 *               the kind of sound an engine sound app would make.
 *   paplay, gst the tone through PulseAudio's player or GStreamer instead, if the head unit has them.
 * Each play shows the command, how it ended (exit code, the first line it complained with) and how long it took.
 * Plain Node 8 (the head unit's 8.16.2).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const mgu = require('./kit/mgu');
const G = require('./kit/gauges');

const W = 1600, H = 520;
const B = 'zsb', M = 'zsm';
const C = { bg: '#050608', text: '#ffffff', soft: '#c9ced8', dim: '#9aa3b2', faint: '#ffffff17', acc: '#ff6a1f', ok: '#3ddc84', bad: '#ff5a4f', warn: '#ffb020' };
const A = G.withAlpha;
const RATE = 48000;
const BIN_DIRS = ['/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/bin', '/opt/bin'];
const PLAYERS = ['aplay', 'paplay', 'pactl', 'pacat', 'pw-play', 'gst-launch-1.0', 'speaker-test', 'amixer', 'arecord'];

/** A mono 16-bit WAV of the samples (-1..1). */
function wav(samples) {
    const n = samples.length, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(RATE, 24);
    b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
    return b;
}
/** fade in and out over ms at both ends */
function fade(s, ms) {
    const k = Math.round(RATE * ms / 1000);
    for (let i = 0; i < k && i < s.length; i++) { const g = i / k; s[i] *= g; s[s.length - 1 - i] *= g; }
    return s;
}
function tone() {
    const s = new Float32Array(RATE);
    for (let i = 0; i < s.length; i++) s[i] = 0.2 * Math.sin(2 * Math.PI * 440 * i / RATE);
    return fade(s, 30);
}
/** a four-cylinder from 1000 to 5000 rpm in 3 s: the firing note (2 per turn) and its harmonics, some roughness */
function engine() {
    const n = RATE * 3, s = new Float32Array(n);
    let ph = 0, seed = 1;
    const H = [[0.5, 0.25], [1, 1], [2, 0.5], [3, 0.3], [4, 0.18], [6, 0.08]];
    for (let i = 0; i < n; i++) {
        const t = i / n, rpm = 1000 + 4000 * t, f = rpm / 60 * 2;
        ph += 2 * Math.PI * f / RATE;
        let v = 0;
        H.forEach(([k, a]) => { v += a * Math.sin(k * ph); });
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        v += 0.15 * (seed / 0x7fffffff - 0.5) * (0.6 + Math.sin(ph) * 0.4);
        s[i] = 0.12 * v;
    }
    return fade(s, 60);
}

class SoundTest {
    constructor(ctx) {
        this.ctx = ctx; this.log = ctx.log;
        this.lines = [['Press Probe to see what the head unit has for sound.', C.dim]];
        this.devices = ['default']; this.dev = 0;
        this.last = null;          // { what, cmd, status, color }
        this.busy = false;
        this.dir = ctx.dataDir || os.tmpdir();
        this.files = {};
    }

    start() {
        this.loop = this.ctx.loop('MAIN', 4, () => this.render());
        this.render();
    }
    kick() { if (this.loop && this.loop.kick) this.loop.kick(); }

    /* ---------- looking ---------- */
    sh(cmd, args, ms) {
        return new Promise((resolve) => {
            const t0 = Date.now();
            let done = false;
            try {
                cp.execFile(cmd, args, { timeout: ms || 3000, maxBuffer: 256 * 1024 }, (err, out, errOut) => {
                    if (done) return; done = true;
                    resolve({ ok: !err, code: err ? (err.code !== undefined ? err.code : err.signal || 'error') : 0, out: String(out || ''), err: String(errOut || (err && err.message) || ''), ms: Date.now() - t0 });
                });
            } catch (e) { done = true; resolve({ ok: false, code: 'spawn', out: '', err: String(e && e.message || e), ms: 0 }); }
        });
    }
    read(p, max) { try { const s = fs.readFileSync(p, 'utf8'); return max ? s.slice(0, max) : s; } catch (e) { return null; } }
    which(name) {
        const dirs = BIN_DIRS.concat(String(process.env.PATH || '').split(':'));
        for (const d of dirs) { if (!d) continue; const p = path.join(d, name); try { fs.accessSync(p, fs.constants ? fs.constants.X_OK : 1); return p; } catch (e) { /* not here */ } }
        return null;
    }

    async probe() {
        if (this.busy) return;
        this.busy = true; this.lines = [['Probing...', C.dim]]; this.kick();
        const R = [], P = [];         // R: the whole report, P: the page's lines
        const add = (s, c) => { R.push(s); if (c) P.push([s, c]); };
        try {
            let uid = '?', gid = '?';
            try { uid = process.getuid(); gid = process.getgid(); } catch (e) { /* not on this OS */ }
            const id = await this.sh('id', []);
            add('runs as uid ' + uid + ' gid ' + gid + (id.ok ? '  (' + id.out.trim() + ')' : ''), C.soft);
            const cards = this.read('/proc/asound/cards');
            add('sound cards: ' + (cards === null ? 'no /proc/asound/cards' : cards.trim().split('\n').filter((l) => /^\s*\d/.test(l)).map((l) => l.trim()).join(' | ') || 'none'), cards ? C.text : C.bad);
            const pcms = this.read('/proc/asound/pcm');
            R.push('/proc/asound/pcm:\n' + (pcms || '(none)'));
            let snd = [];
            try { snd = fs.readdirSync('/dev/snd'); } catch (e) { snd = null; }
            if (snd === null) add('/dev/snd: missing or not readable', C.bad);
            else {
                const pcm = snd.filter((f) => /^pcmC\d+D\d+p$/.test(f));
                let can = 0;
                pcm.forEach((f) => { try { fs.accessSync('/dev/snd/' + f, (fs.constants ? fs.constants.W_OK : 2)); can++; } catch (e) { /* no */ } });
                const st = pcm[0] ? (() => { try { const s = fs.statSync('/dev/snd/' + pcm[0]); return ' (' + pcm[0] + ': owner ' + s.uid + ', group ' + s.gid + ', mode ' + (s.mode & 0o777).toString(8) + ')'; } catch (e) { return ''; } })() : '';
                add('/dev/snd: ' + snd.length + ' entries, ' + pcm.length + ' playback devices, ' + can + ' the app may open' + st, can ? C.ok : C.warn);
            }
            const found = PLAYERS.map((p) => [p, this.which(p)]);
            add('players: ' + (found.filter((f) => f[1]).map((f) => f[0]).join(', ') || 'none found'), found.some((f) => f[1]) ? C.text : C.bad);
            R.push(found.map((f) => f[0] + ': ' + (f[1] || '-')).join('\n'));
            const pulse = ['/run/pulse/native', '/var/run/pulse/native', '/tmp/pulse/native'].concat(process.env.XDG_RUNTIME_DIR ? [process.env.XDG_RUNTIME_DIR + '/pulse/native'] : []).filter((p) => fs.existsSync(p));
            add('PulseAudio socket: ' + (pulse.join(', ') || 'none') + (process.env.PULSE_SERVER ? ' (PULSE_SERVER ' + process.env.PULSE_SERVER + ')' : ''), pulse.length ? C.text : C.dim);
            const conf = this.read('/etc/asound.conf');
            const names = conf ? (conf.match(/^\s*pcm\.([\w-]+)/gm) || []).map((s) => s.replace(/^\s*pcm\./, '')) : [];
            add('/etc/asound.conf: ' + (conf === null ? 'none' : names.length + ' PCM names' + (names.length ? ': ' + names.slice(0, 12).join(', ') + (names.length > 12 ? ', ...' : '') : '')), conf ? C.text : C.dim);
            if (conf) R.push('--- /etc/asound.conf (first 8000 chars) ---\n' + conf.slice(0, 8000));
            if (this.which('aplay')) {
                const L = await this.sh('aplay', ['-L'], 4000);
                const devs = L.out.split('\n').filter((l) => l && !/^\s/.test(l)).map((l) => l.trim());
                this.devices = ['default'].concat(devs.filter((d) => d !== 'default' && d !== 'null'));
                this.dev = 0;
                add('aplay -L: ' + (L.ok ? devs.length + ' devices: ' + devs.slice(0, 10).join(', ') + (devs.length > 10 ? ', ...' : '') : 'failed: ' + L.err.split('\n')[0]), L.ok ? C.text : C.bad);
                R.push('--- aplay -L ---\n' + L.out + (L.err ? '\n' + L.err : ''));
                const l2 = await this.sh('aplay', ['-l'], 4000);
                R.push('--- aplay -l ---\n' + l2.out + (l2.err ? '\n' + l2.err : ''));
            }
            if (this.which('pactl')) {
                const s = await this.sh('pactl', ['list', 'short', 'sinks'], 4000);
                add('pactl sinks: ' + (s.ok ? s.out.trim().split('\n').map((l) => l.split('\t')[1]).filter(Boolean).join(', ') || 'none' : 'failed: ' + s.err.split('\n')[0]), s.ok ? C.text : C.warn);
                R.push('--- pactl list short sinks ---\n' + s.out + (s.err ? '\n' + s.err : ''));
            }
            const file = path.join(this.dir, 'probe.txt');
            try { fs.writeFileSync(file, R.join('\n') + '\n'); add('the whole report: ' + file, C.dim); } catch (e) { add('could not write ' + file + ': ' + e.message, C.warn); }
            this.log.info('sound probe:\n' + R.join('\n'));
        } catch (e) {
            add('probe failed: ' + (e && e.message || e), C.bad);
        }
        this.lines = P; this.busy = false; this.kick();
    }

    /* ---------- playing ---------- */
    file(kind) {
        if (this.files[kind]) return this.files[kind];
        const p = path.join(this.dir, 'test_' + kind + '.wav');
        fs.writeFileSync(p, wav(kind === 'engine' ? engine() : tone()));
        return (this.files[kind] = p);
    }
    async play(how, kind) {
        if (this.busy) return;
        this.busy = true;
        let cmd, args;
        try {
            const f = this.file(kind);
            if (how === 'aplay') { cmd = 'aplay'; args = ['-q', '-D', this.devices[this.dev], f]; }
            else if (how === 'paplay') { cmd = 'paplay'; args = [f]; }
            else { cmd = 'gst-launch-1.0'; args = ['-q', 'playbin', 'uri=file://' + f]; }
        } catch (e) {
            this.last = { what: kind, cmd: '-', status: 'could not write the sound file: ' + e.message, color: C.bad };
            this.busy = false; this.kick(); return;
        }
        const line = cmd + ' ' + args.join(' ');
        this.last = { what: kind, cmd: line, status: 'playing...', color: C.dim }; this.kick();
        const r = await this.sh(cmd, args, kind === 'engine' ? 8000 : 6000);
        const len = kind === 'engine' ? 3000 : 1000;
        this.last = {
            what: kind, cmd: line, color: r.ok ? C.ok : C.bad,
            status: r.ok ? 'ended fine after ' + r.ms + ' ms (the sound is ' + len + ' ms): did you hear it?'
                : 'failed (' + r.code + ') after ' + r.ms + ' ms: ' + (r.err.split('\n').filter(Boolean)[0] || 'no message'),
        };
        this.log.info('sound test: ' + line + ' -> ' + (r.ok ? 'ok' : r.code) + ' in ' + r.ms + ' ms ' + r.err.trim());
        this.busy = false; this.kick();
    }

    /* ---------- drawing ---------- */
    render() {
        const cv = this.ctx.canvas(W, H), bottom = G.pageBottom(cv);
        cv.clear(C.bg);
        G.frame(cv, this.ctx.theme(), ['Sound test'], 0, [{ text: this.busy ? 'BUSY' : 'READY', color: this.busy ? C.warn : C.ok }]);
        if (!cv.chrome && cv.tabRects) cv.tabRects.forEach((r) => cv.target(r.x, r.y, r.w, r.h, () => {}, 'tab:' + r.i, 0));
        const x = 28;
        let y = 70;
        cv.text('Can an app play sound through the car\'s speakers? Nothing is changed: Probe only looks, the sounds are short and quiet.', x, y, 18, C.dim, { font: M, literal: true });
        y += 30;
        this.lines.slice(0, 9).forEach(([s, c]) => { cv.text(fit(cv, s, 19, W - 2 * x, M), x, y, 19, c, { font: M, literal: true }); y += 27; });
        // the last play
        const by = Math.max(y + 8, bottom - 150);
        if (this.last) {
            cv.text(fit(cv, this.last.cmd, 17, W - 2 * x, M), x, by - 34, 17, C.dim, { font: M, literal: true });
            cv.text(fit(cv, this.last.status, 20, W - 2 * x, B), x, by - 10, 20, this.last.color, { font: B, literal: true });
        }
        // the buttons
        const btn = (bx, w, label, fn, id, on) => {
            cv.roundRect(bx, by + 8, w, 54, 27, on ? C.acc : A('#ffffff', 0.10));
            cv.text(label, bx + w / 2, by + 43, 21, '#ffffff', { font: B, align: 'center', literal: true });
            cv.target(bx, by + 8, w, 54, fn, id, 27);
            return bx + w + 14;
        };
        let bx = x;
        bx = btn(bx, 150, 'Probe', () => this.probe(), 'probe', true);
        bx = btn(bx, 330, 'Device: ' + short(this.devices[this.dev]), () => { this.dev = (this.dev + 1) % this.devices.length; this.kick(); }, 'dev');
        bx = btn(bx, 150, 'Tone', () => this.play('aplay', 'tone'), 'tone', true);
        bx = btn(bx, 170, 'Engine', () => this.play('aplay', 'engine'), 'engine', true);
        bx = btn(bx, 190, 'Tone, paplay', () => this.play('paplay', 'tone'), 'paplay');
        btn(bx, 170, 'Tone, gst', () => this.play('gst', 'tone'), 'gst');
        cv.text('Tone and Engine play through aplay to the device shown; a tap on Device goes to the next one Probe found.', x, by + 92, 16, C.dim, { font: M, literal: true });
        return this.ctx.ui.image('MAIN_GFX', cv);
    }
}

function short(s) { s = String(s); return s.length > 18 ? s.slice(0, 17) + '…' : s; }
function fit(cv, s, size, w, font) {
    s = String(s);
    if (cv.textWidth(s, size, { font, literal: true }) <= w) return s;
    while (s.length > 1 && cv.textWidth(s + '…', size, { font, literal: true }) > w) s = s.slice(0, -1);
    return s + '…';
}

mgu.run({
    start(ctx) {
        new SoundTest(ctx).start();
    },
});
