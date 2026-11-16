'use strict';
/**
 * probe.js - Zeiger 0.46.0, a test: can an app read the cruise control and the speed limit?
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

function run(log, dataDir, done) {
    const tryAt = (i) => {
        if (i >= PATHS.length) { done({ error: 'not found at ' + PATHS.join(', ') }); return; }
        fs.readFile(PATHS[i], 'utf8', (err, text) => {
            if (err) { if (i + 1 < PATHS.length) tryAt(i + 1); else done({ error: err.code === 'EACCES' ? 'no permission to read ' + PATHS[i] : String(err.message || err) }); return; }
            let r;
            try { r = search(JSON.parse(text)); } catch (e) { done({ error: 'unreadable: ' + e.message }); return; }
            r.file = PATHS[i];
            const all = lines(r);
            if (log) { log.info('probe: ' + PATHS[i] + ' (' + Math.round(text.length / 1024) + ' KiB)'); all.forEach((l) => log.info('probe: ' + l)); }
            // the whole list, for a USB stick or the logs page: data/probe.txt
            try { if (dataDir) fs.writeFileSync(path.join(dataDir, 'probe.txt'), all.join('\n') + '\n'); } catch (e) { /* read-only: the log has it */ }
            done(r);
        });
    };
    tryAt(0);
}

module.exports = { search, lines, run, match, words };
