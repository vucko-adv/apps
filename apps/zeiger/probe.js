'use strict';
/**
 * probe.js - Zeiger 0.46.0, a test: can an app read the cruise control and the speed limit? (0.48.0: live, below)
 *
 * The head unit's SOME/IP catalog (/etc/oap/someip/someip-interfaces.json on iDrive 7: { interfaces: { "<id>": {...} } })
 * names every interface an app may ask for in app.json "signals", with its fields and their structs. This looks through
 * it for the cruise control (cruise, tempomat, FGR, ACC, DCC, limiter) and the speed limit (speed limit, SLI, SLA, VZE,
 * traffic sign, KAFAS) and lists what it finds: the interface and where in it, on the page (About, "Look for cruise and
 * speed limit") and in the log. Nothing is subscribed to and nothing is sent to the car: the names come first; the
 * next build asks for the fields found and shows their values while driving.
 *
 *   const r = probe.search(catalogObject)  -> { interfaces, hits: [{ iface, at, words }], byIface: Map(iface -> [at]) }
 *   probe.run(log, dataDir, done)          -> reads the catalog, done(result or { error })
 */
const fs = require('fs');
const path = require('path');

// ZEIGER_PROBE_CATALOG: another catalog file, for the emulator and the bench
const PATHS = [process.env.ZEIGER_PROBE_CATALOG, '/etc/oap/someip/someip-interfaces.json'].filter(Boolean);

// a name's words: camelCase, PascalCase, ACRONYMS, snake_case and dots split ("statusACCSpeedLimit" -> status acc speed limit)
const words = (s) => (String(s).match(/[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|\d+/g) || []).map((w) => w.toLowerCase());
// words that alone say cruise control or speed limit; and pairs that do together
const ALONE = ['cruise', 'tempomat', 'fgr', 'acc', 'dcc', 'limiter', 'sli', 'sla', 'vze', 'kafas', 'speedlimit'];
const PAIRS = [['speed', 'limit'], ['traffic', 'sign'], ['road', 'sign'], ['sign', 'recognition'], ['set', 'speed'],
    ['desired', 'speed'], ['target', 'speed'], ['legal', 'speed'], ['speed', 'control'], ['distance', 'control']];
// ACC also starts "acceleration" / "accelerator" / "access" / "account": only the word itself counts
function match(name) {
    const w = words(name);
    if (!w.length) return null;
    const lower = String(name).toLowerCase();
    const hit = ALONE.filter((a) => w.indexOf(a) >= 0 || (a === 'speedlimit' && lower.indexOf('speedlimit') >= 0));
    PAIRS.forEach(([a, b]) => { if (w.indexOf(a) >= 0 && w.indexOf(b) >= 0) hit.push(a + ' ' + b); });
    return hit.length ? hit : null;
}

/** Every key and string value in the catalog that names cruise control or a speed limit, by interface. */
function search(db) {
    const ifs = (db && db.interfaces) || {}, ids = Array.isArray(ifs) ? ifs.map((x, i) => (x && (x.id || x.name)) || String(i)) : Object.keys(ifs);
    const hits = [], seen = new Set();
    const add = (iface, at, w) => { const k = iface + ' ' + at; if (seen.has(k)) return; seen.add(k); hits.push({ iface, at, words: w }); };
    ids.forEach((id, i) => {
        const root = Array.isArray(ifs) ? ifs[i] : ifs[id];
        const own = match(id.split('.').pop());
        if (own) add(id, '(the interface)', own);
        let n = 0;
        const walk = (o, at, depth) => {
            if (o === null || typeof o !== 'object' || depth > 14 || ++n > 200000) return;
            Object.keys(o).forEach((k) => {
                const v = o[k], here = Array.isArray(o) ? at : (at ? at + '.' + k : k);
                if (!Array.isArray(o)) { const m = match(k); if (m) add(id, here, m); }
                if (typeof v === 'string') { const m = match(v); if (m && /^[A-Za-z_][\w.]*$/.test(v)) add(id, (here ? here + ' = ' : '') + v, m); }
                else walk(v, here, depth + 1);
            });
        };
        walk(root, '', 0);
    });
    const byIface = new Map();
    hits.forEach((h) => { if (!byIface.has(h.iface)) byIface.set(h.iface, []); byIface.get(h.iface).push(h.at); });
    // the driver-assistance and guidance interfaces by name, in case their fields are named otherwise
    const assist = ids.filter((id) => /assist|adas|driver|kafas|camera|guidance|horizon|cruise|speed/i.test(id.split('.').slice(-2).join('.')));
    return { interfaces: ids.length, hits, byIface, assist };
}

/** The page's lines: an interface, then where in it (cut to the shortest that still tells them apart). */
function lines(r) {
    if (!r) return ['Looking...'];
    if (r.error) return ['Could not read the catalog: ' + r.error];
    const out = [r.interfaces + ' interfaces in the catalog, ' + r.byIface.size + ' name cruise control or a speed limit:'];
    if (!r.byIface.size) out.push('none: no interface names them (the next test would read them by diagnostics)');
    r.byIface.forEach((ats, iface) => {
        out.push(iface);
        ats.forEach((a) => out.push('    ' + a));
    });
    if (r.assist && r.assist.length) {
        out.push('Driver assistance, guidance and speed interfaces (' + r.assist.length + '):');
        r.assist.forEach((id) => out.push('    ' + id));
    }
    return out;
}

/* ---------------- 0.48.0: read live, while the test is on ---------------- */

// What the 0.46.0 probe found on a G20 (Nov 17 2026), only the names it showed in full. Fields ("s" in app.json) and
// events (app.json "_broadcasts") are both subscribed to by name; every one is "_optional" in app.json.
const LIVE = [
    { iface: 'de.bmw.dass.TrafficSignRecognition', names: ['TrafficSignRecognition'] },
    { iface: 'de.bmw.dass.driverassistanceapplications.TrafficSignDisplayControl', names: ['displaySpeedLimitAndNoPassingRestriction'] },
    { iface: 'de.bmw.infotainment.navigation.externalize.adasng.CCP', names: ['effectiveSpeedLimit', 'speedLimitUnit', 'variableSpeedLimitSign'] },
    { iface: 'de.bmw.infotainment.fasus.FASuS', names: ['statusNextSpeedLimitRecognition', 'statusSLITextMessage'] },
    { iface: 'de.bmw.environmentalmodel.SignRecognitionFrontCamera', names: ['TrafficSignRecognitionFrontCamera'] },
    { iface: 'de.bmw.dass.HMIControlAD', names: ['controlSpeedLock'] },
];
// where the cruise control's state and set speed should be (their names didn't say so): every field listed
const SHOW_ALL = ['de.bmw.dass.driverassistanceapplications.StatusDisplayXADAndSpeed', 'de.bmw.dass.StatusDriverAssistanceFunctions'];
const HISTORY = 4;

/** An interface's instance ids in the catalog entry (instance / instances / instanceIds: a string, list or map) */
function instancesOf(entry) {
    const out = [];
    const take = (v) => {
        if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
        else if (Array.isArray(v)) v.forEach((x) => (x && typeof x === 'object' ? take(x.name || x.id || x.instanceId || x.instance) : take(x)));
        else if (v && typeof v === 'object') Object.keys(v).forEach((k) => out.push(k));
    };
    Object.keys(entry || {}).forEach((k) => { if (/^instances?(ids?)?$/i.test(k)) take(entry[k]); });
    return out.filter((v, i) => v && v !== '*' && out.indexOf(v) === i);
}

/** A catalog entry by id (interfaces as a map or a list) */
function entryOf(db, id) {
    const ifs = (db && db.interfaces) || {};
    return Array.isArray(ifs) ? ifs.find((x) => x && (x.id === id || x.name === id)) : ifs[id];
}

/** A value as short "key=value" pairs (the last key of each path), at most max */
function pairs(v, max) {
    const out = [];
    const walk = (x, k) => {
        if (out.length >= max) return;
        if (x === null || x === undefined) out.push(k + '=-');
        else if (typeof x !== 'object') out.push((k ? k + '=' : '') + (typeof x === 'number' && !Number.isInteger(x) ? x.toFixed(2) : String(x)));
        else if (Buffer.isBuffer(x)) out.push(k + '=<' + x.length + ' bytes>');
        else if (Array.isArray(x)) { if (!x.length) out.push(k + '=[]'); x.forEach((y, i) => walk(y, k + '[' + i + ']')); }
        else Object.keys(x).forEach((kk) => walk(x[kk], kk));
    };
    walk(v, '');
    return out;
}

/**
 * Subscribe to LIVE (signals: ctx.signals; db: the catalog, for the instance ids). onUpdate() on every value.
 * Returns { items: [{ iface, name, inst, res, error, n, at, value, seen: [{ at, text }] }], stop() }.
 */
function live(signals, db, log, onUpdate) {
    const items = [], subs = [];
    let stopped = false, logged = 0;
    LIVE.forEach((s) => s.names.forEach((name) => items.push({ iface: s.iface, name, inst: null, res: null, error: null, n: 0, at: 0, value: undefined, seen: [] })));
    const got = (it, v) => {
        if (stopped) return;
        it.value = v; it.n++; it.at = Date.now();
        const text = pairs(v, 40).join('  ');
        if (!it.seen.length || it.seen[it.seen.length - 1].text !== text) {
            it.seen.push({ at: it.at, text });
            if (it.seen.length > HISTORY) it.seen.shift();
            if (log && logged++ < 400) log.info('probe live: ' + it.iface + '.' + it.name + ' = ' + text.slice(0, 600));
        }
        onUpdate();
    };
    (async () => {
        for (const s of LIVE) {
            const mine = items.filter((it) => it.iface === s.iface), found = instancesOf(entryOf(db, s.iface));
            const insts = found.length ? found.slice(0, 3) : ['1'];
            for (const inst of insts) {
                if (stopped) return;
                const handlers = {};
                mine.forEach((it) => { handlers[it.name] = (v) => got(it, v); });
                let res;
                try { res = await signals.watch(s.iface, inst, handlers, log); } catch (e) { res = { error: String(e && e.message || e) }; }
                mine.forEach((it) => { it.inst = inst; it.res = res; it.error = res && res.error; it.guess = !found.length; it.keys = Object.keys(entryOf(db, s.iface) || {}); });
                if (log) log.info('probe live: ' + s.iface + ' instance ' + inst + (found.length ? '' : ' (none in the catalog)') + ': ' + (res && res.error ? res.error : 'subscribed'));
                if (res && !res.error) { subs.push(res); break; }
            }
            onUpdate();
        }
    })();
    return {
        items,
        stop() { stopped = true; subs.forEach((r) => { try { r.shutdown(); } catch (e) { /* gone */ } }); },
    };
}

/** Every field, event and method of an interface (with what an event or method carries), for SHOW_ALL */
function every(db, id) {
    const e = entryOf(db, id);
    if (!e) return ['    not in this car\'s catalog'];
    const out = [];
    const names = (o) => { const n = []; const w = (x, d) => { if (!x || typeof x !== 'object' || d > 6) return; Object.keys(x).forEach((k) => { if (k === 'name' && typeof x[k] === 'string') n.push(x[k]); else w(x[k], d + 1); }); }; w(o, 0); return n; };
    Object.keys(e).forEach((sec) => {
        const v = e[sec];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            Object.keys(v).forEach((k) => {
                const inner = names(v[k]).filter((n) => n !== k);
                out.push('    ' + sec + '.' + k + (inner.length ? ': ' + inner.join(', ') : ''));
            });
        } else out.push('    ' + sec + ' = ' + (Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join(', ') : String(v)).slice(0, 200));
    });
    return out;
}

/** The page's live lines: each source and its value (and the values before it), then SHOW_ALL's fields */
function liveLines(L, db) {
    if (!L) return [];
    const now = Date.now(), ago = (t) => { const s = Math.round((now - t) / 1000); return s < 60 ? s + ' s ago' : Math.round(s / 60) + ' min ago'; };
    const hms = (t) => { const d = new Date(t); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, '0')).join(':'); };
    const chunk = (text, n) => { const out = []; let line = ''; text.split('  ').forEach((p) => { if (line && line.length + p.length + 2 > n) { out.push(line); line = ''; } line += (line ? '  ' : '') + p; }); if (line) out.push(line); return out; };
    const out = ['Live while this is on: drive past signs, cruise on and off, then look'];
    L.items.forEach((it) => {
        const state = it.n ? it.n + ' values, ' + ago(it.at) : it.error ? 'error' : it.res ? (it.res.available ? 'connected' : 'waiting') : 'starting';
        const short = it.iface.split('.').pop();
        out.push(state + ' · ' + short + (it.name !== short ? '.' + it.name : ''));
        if (it.error) out.push('    ' + it.error);
        // no instance in the catalog: '1' was a guess; what the entry has, for the next try
        if (it.guess && !it.n && it === L.items.find((x) => x.iface === it.iface)) out.push('    no instance listed, tried ' + it.inst + ' · it has: ' + (it.keys || []).join(', '));
        else if (it.error) out.push('    instance ' + it.inst);
        // 0.50.0: the camera's limit as the themes show it (5 km/h steps: 10 was a 50 sign)
        if (it.n && it.name === 'TrafficSignRecognition' && it.value) { const sp = it.value.presentClassLimitSpeed; out.push('    = ' + (sp > 0 && sp < 254 ? sp * 5 + ' km/h' : 'no sign') + ' (presentClassLimitSpeed ' + sp + ' x 5)'); }
        if (it.n) chunk(it.seen[it.seen.length - 1].text, 70).slice(0, 6).forEach((l) => out.push('    ' + l));
        it.seen.slice(0, -1).reverse().forEach((s) => out.push('    before, ' + hms(s.at) + ': ' + s.text.slice(0, 90)));
    });
    SHOW_ALL.forEach((id) => { out.push(id.split('.').pop() + ': every field (for the cruise control)'); every(db, id).forEach((l) => out.push(l)); });
    return out;
}

function run(log, dataDir, done) {
    const tryAt = (i) => {
        if (i >= PATHS.length) { done({ error: 'not found at ' + PATHS.join(', ') }); return; }
        fs.readFile(PATHS[i], 'utf8', (err, text) => {
            if (err) { if (i + 1 < PATHS.length) tryAt(i + 1); else done({ error: err.code === 'EACCES' ? 'no permission to read ' + PATHS[i] : String(err.message || err) }); return; }
            let r;
            let db;
            try { db = JSON.parse(text); r = search(db); } catch (e) { done({ error: 'unreadable: ' + e.message }); return; }
            r.file = PATHS[i]; r.db = db;
            // 0.48.0: the cruise candidates' fields, and the instances of what is read live, for the log and probe.txt
            const all = lines(r).concat(SHOW_ALL.map((id) => [id + ':'].concat(every(db, id))).reduce((a, b) => a.concat(b), []),
                LIVE.map((x) => x.iface + ' instances: ' + (instancesOf(entryOf(db, x.iface)).join(', ') || 'none listed')));
            if (log) { log.info('probe: ' + PATHS[i] + ' (' + Math.round(text.length / 1024) + ' KiB)'); all.forEach((l) => log.info('probe: ' + l)); }
            // the whole list, for a USB stick or the logs page: data/probe.txt
            try { if (dataDir) fs.writeFileSync(path.join(dataDir, 'probe.txt'), all.join('\n') + '\n'); } catch (e) { /* read-only: the log has it */ }
            done(r);
        });
    };
    tryAt(0);
}

module.exports = { search, lines, run, match, words, live, liveLines, instancesOf, pairs, every, LIVE, SHOW_ALL };
