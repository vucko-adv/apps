'use strict';
/**
 * Today's weather for the cluster (Zeiger addition, the Dark Moon theme) and the next days for the home-screen widget: Open-Meteo's forecast (open-meteo.com, free,
 * no key; data CC BY 4.0) for roughly where the car is. The head unit gives apps no GPS position, so the place is
 * the one the internet connection's address belongs to (ipinfo.io: the phone's or the LTE stick's operator, often
 * its nearest big city), rounded to 0.1 degree (about 10 km) before it goes to Open-Meteo.
 *
 * Only through mgu-uplink (the Store's "Internet uplink"): app.json "internet": true puts "mguInternet" in the
 * package, the Store's deploy tool lets the app's uid out through the uplink, and while the uplink is online it
 * writes the lease (<data>/uplink.json, else /run/mgu-uplink/lease.json: { dns: [...] }). The unit's own resolver
 * doesn't reach the internet, so names go to the lease's DNS servers. On the head unit with no lease: offline, nothing
 * tried. Off the unit (the bench) the computer's own resolver; WX_PLACE="lat,lon" there skips the address lookup.
 *
 *   want(on, who)  fetch while anyone wants it: who 'layout' (the default: a layout with "wantsWeather") or 'widget'
 *                  (the home-screen widget); a forecast is checked every 30 min, the place every 6 h
 *   wants(who)     whether that one wants it now
 *   today()        { code, hi, lo, rain, now, isDay, icon, word, nowIcon, nowWord } in °C / %, or null (none for
 *                  today yet); icon / word are the day's, nowIcon / nowWord the weather right now
 *   days()         today and the next days (DAYS in all): [{ date, wd, code, hi, lo, rain, icon, word }]
 *   city()         the place's name, or ''
 *   info()         a short line for the status
 *
 * The last forecast and place are kept in <data>/weather.json, so a start without internet still has today's.
 * Node 8 (the car's): http(s).get, dns.Resolver, no fetch.
 */
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const http = require('http');
const https = require('https');
const url = require('url');

const FORECAST_MS = 30 * 60000;      // a forecast younger than this is kept
const PLACE_MS = 6 * 3600000;        // the place is looked up again after this (the car moves)
const RETRY_MS = 5 * 60000;          // after a failed fetch
const TICK_MS = 60000;
const TIMEOUT_MS = 15000;
const MAX_BODY = 256 * 1024;
const ON_UNIT = '/var/opt/';         // the data folder's start on the head unit
const DAYS = 4;                      // today and the next three (the widget's)
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// WMO weather codes (Open-Meteo's weather_code) -> the icon font's letter (s_icon: A sun, B moon, C sun and cloud,
// D cloud, E fog, F rain, G snow, H storm; I moon and cloud) and a word
function kind(code, isDay) {
    if (code === 0) return { icon: isDay === false ? 'B' : 'A', word: 'CLEAR' };
    if (code === 1) return { icon: isDay === false ? 'I' : 'C', word: 'MOSTLY CLEAR' };
    if (code === 2) return { icon: isDay === false ? 'I' : 'C', word: 'PARTLY CLOUDY' };
    if (code === 3) return { icon: 'D', word: 'CLOUDY' };
    if (code === 45 || code === 48) return { icon: 'E', word: 'FOG' };
    if (code >= 51 && code <= 57) return { icon: 'F', word: 'DRIZZLE' };
    if (code >= 61 && code <= 67) return { icon: 'F', word: 'RAIN' };
    if (code >= 80 && code <= 82) return { icon: 'F', word: 'SHOWERS' };
    if (code >= 71 && code <= 77) return { icon: 'G', word: 'SNOW' };
    if (code === 85 || code === 86) return { icon: 'G', word: 'SNOW SHOWERS' };
    if (code >= 95) return { icon: 'H', word: 'THUNDERSTORM' };
    return null;
}

const num = (v) => typeof v === 'number' && isFinite(v);

class Weather {
    constructor(dataDir, log) {
        this.dataDir = dataDir || '.';
        this.log = log;
        this.file = path.join(this.dataDir, 'weather.json');
        this.onUnit = String(this.dataDir).indexOf(ON_UNIT) === 0;
        this.wanted = false;         // anyone (this.who) wants it
        this.who = Object.create(null);
        this.timer = null;
        this.busy = false;
        this.nextTry = 0;
        this.plain = false;          // https refused (an old CA list): plain http for the rest of the run
        this.state = 'off';          // off | offline | fetching | ok | error
        this.why = '';
        this.place = null;           // { lat, lon, city, t }
        this.fc = null;              // { date, offset, code, hi, lo, rain, now, nowCode, isDay, days: [{ date, code, hi, lo, rain }], t }
        this.listeners = [];
        try {
            const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
            if (saved && saved.place && num(saved.place.lat) && num(saved.place.lon)) this.place = saved.place;
            if (saved && saved.fc && typeof saved.fc.date === 'string') this.fc = saved.fc;
        } catch (e) { /* none yet */ }
        const env = String(process.env.WX_PLACE || '').split(',').map(Number);
        this.fixedPlace = !this.onUnit && env.length === 2 && env.every(num) ? { lat: env[0], lon: env[1], city: 'WX_PLACE', t: Date.now() } : null;
    }

    /** cb() when today's forecast changes. */
    onChange(cb) { this.listeners.push(cb); }

    want(on, who) {
        who = who || 'layout';
        if (on) this.who[who] = true; else delete this.who[who];
        on = Object.keys(this.who).length > 0;
        if (on === this.wanted) return;
        this.wanted = on;
        clearInterval(this.timer); this.timer = null;
        if (!on) { this.state = 'off'; return; }
        this.timer = setInterval(() => this._tick(), TICK_MS);
        this._tick();
    }

    wants(who) { return this.who[who || 'layout'] === true; }

    stop() { this.who = Object.create(null); this.want(false); }

    /** Today's forecast (°C, %), or null: none yet, or the kept one is from another day. */
    today() {
        const f = this.fc;
        if (!f || f.date !== this._dateAt(f.offset)) return null;
        const k = kind(f.code, f.isDay), n = num(f.nowCode) ? kind(f.nowCode, f.isDay) : null;
        return { code: f.code, hi: f.hi, lo: f.lo, rain: f.rain, now: f.now, isDay: f.isDay, icon: k ? k.icon : '', word: k ? k.word : '',
            nowIcon: n ? n.icon : k ? k.icon : '', nowWord: n ? n.word : k ? k.word : '' };
    }

    /** Today and the next days, from today on (a kept forecast's past days left out); [] when there is none for today. */
    days() {
        const t = this.today();
        if (!t) return [];
        const from = this.fc.date, list = Array.isArray(this.fc.days) && this.fc.days.length ? this.fc.days : [{ date: from, code: t.code, hi: t.hi, lo: t.lo, rain: t.rain }];
        return list.filter((d) => d && typeof d.date === 'string' && d.date >= from).slice(0, DAYS).map((d) => {
            const k = kind(d.code, true), wd = new Date(d.date + 'T12:00:00Z').getUTCDay();
            return { date: d.date, wd: WEEKDAYS[wd] || '', code: d.code, hi: d.hi, lo: d.lo, rain: d.rain, icon: k ? k.icon : '', word: k ? k.word : '' };
        });
    }

    city() {
        const p = this.fixedPlace ? null : this.place;     // WX_PLACE (the bench) has no name
        return p && p.city ? String(p.city) : '';
    }

    info() {
        const t = this.today();
        const age = this.fc ? Math.round((Date.now() - this.fc.t) / 60000) : null;
        const have = t ? Math.round(t.hi) + '°/' + Math.round(t.lo) + '° ' + t.word.toLowerCase() + (this.place && this.place.city ? ' (' + this.place.city + ')' : '') + ', ' + age + ' min old' : 'nothing for today yet';
        if (this.state === 'offline') return have + '; no internet (needs the Store\'s Internet uplink, online)';
        if (this.state === 'error') return have + '; last try failed: ' + this.why;
        return have;
    }

    // the date (YYYY-MM-DD) where the forecast is, from its UTC offset (s); the unit's clock is UTC
    _dateAt(offset) { return new Date(Date.now() + (num(offset) ? offset : 0) * 1000).toISOString().slice(0, 10); }

    _lease() {
        const files = [path.join(this.dataDir, 'uplink.json'), '/run/mgu-uplink/lease.json'];
        for (let i = 0; i < files.length; i++) {
            try {
                const l = JSON.parse(fs.readFileSync(files[i], 'utf8'));
                if (l && Array.isArray(l.dns) && l.dns.length) return l;
            } catch (e) { /* not there: offline, or not on the unit */ }
        }
        return null;
    }

    _tick() {
        if (!this.wanted || this.busy || Date.now() < this.nextTry) return;
        const lease = this._lease();
        if (!lease && this.onUnit) { this.state = 'offline'; return; }
        const fresh = this.fc && Array.isArray(this.fc.days) && Date.now() - this.fc.t < FORECAST_MS && this.today();
        const place = this.fixedPlace || (this.place && Date.now() - this.place.t < PLACE_MS ? this.place : null);
        if (fresh && place) { this.state = 'ok'; return; }
        this.busy = true;
        this.state = 'fetching';
        const lookup = lease ? this._resolver(lease.dns) : undefined;
        const done = (err) => {
            this.busy = false;
            if (err) {
                this.state = 'error';
                this.why = String(err && err.message || err).slice(0, 120);
                this.nextTry = Date.now() + RETRY_MS;
                this.log.warn('weather: ' + this.why);
            } else this.state = 'ok';
        };
        const forecast = (p) => this._forecast(p, lookup, (err) => done(err));
        if (place) return forecast(place);
        this._place(lookup, (err, p) => (err ? done(err) : forecast(p)));
    }

    // a dns.lookup stand-in that asks the uplink's DNS servers (Node 8's net.connect and Node 20's both call it)
    _resolver(servers) {
        const r = new dns.Resolver();
        try { r.setServers(servers); } catch (e) { return undefined; }
        return (host, opts, cb) => {
            if (typeof opts === 'function') { cb = opts; opts = {}; }
            r.resolve4(host, (err, addrs) => {
                if (err || !addrs || !addrs.length) return cb(err || new Error('no address for ' + host));
                if (opts && opts.all) return cb(null, addrs.map((a) => ({ address: a, family: 4 })));
                cb(null, addrs[0], 4);
            });
        };
    }

    _get(link, lookup, cb) {
        if (this.plain) link = link.replace(/^https:/, 'http:');
        const u = new url.URL(link);     // url.URL: Node 7 and later, so the car's 8 too
        const opts = { protocol: u.protocol, hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, timeout: TIMEOUT_MS,
            headers: { 'User-Agent': 'zeiger-cluster', Accept: 'application/json' } };
        if (lookup) opts.lookup = lookup;
        let finished = false;
        const end = (err, v) => { if (!finished) { finished = true; cb(err, v); } };
        const req = (u.protocol === 'https:' ? https : http).get(opts, (res) => {
            const parts = []; let size = 0;
            res.on('data', (d) => { size += d.length; if (size > MAX_BODY) { req.abort(); end(new Error('answer too big')); } else parts.push(d); });
            res.on('end', () => {
                if (res.statusCode !== 200) return end(new Error(u.hostname + ' answered ' + res.statusCode));
                try { end(null, JSON.parse(Buffer.concat(parts).toString('utf8'))); } catch (e) { end(new Error(u.hostname + ': not JSON')); }
            });
            res.on('error', (e) => end(e));
        });
        req.setTimeout(TIMEOUT_MS, () => { req.abort(); end(new Error(u.hostname + ' timed out')); });
        req.on('error', (e) => {
            // an old Node's CA list without the site's root: the weather is public, so plain http from now on
            if (!this.plain && u.protocol === 'https:' && /CERT|SIGNATURE|ISSUER/.test(String(e && e.code))) {
                this.plain = true;
                this.log.warn('weather: https refused (' + e.code + '), using http');
                return this._get(link, lookup, (err, v) => end(err, v));
            }
            end(e);
        });
    }

    _place(lookup, cb) {
        this._get('https://ipinfo.io/json', lookup, (err, j) => {
            if (err) return cb(err);
            const ll = String(j && j.loc || '').split(',').map(Number);
            if (ll.length !== 2 || !ll.every(num)) return cb(new Error('ipinfo.io gave no place'));
            this.place = { lat: Math.round(ll[0] * 10) / 10, lon: Math.round(ll[1] * 10) / 10, city: String(j.city || '').slice(0, 40), t: Date.now() };
            this.log.info('weather: place ' + this.place.lat + ', ' + this.place.lon + (this.place.city ? ' (' + this.place.city + ')' : ''));
            this._save();
            cb(null, this.place);
        });
    }

    _forecast(p, lookup, cb) {
        const q = 'latitude=' + p.lat.toFixed(1) + '&longitude=' + p.lon.toFixed(1) +
            '&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
            '&timezone=auto&forecast_days=' + DAYS;
        this._get('https://api.open-meteo.com/v1/forecast?' + q, lookup, (err, j) => {
            if (err) return cb(err);
            const d = j && j.daily, c = j && j.current;
            const at = (k, i) => (d && Array.isArray(d[k]) ? d[k][i] : null), first = (k) => at(k, 0);
            if (!d || typeof first('time') !== 'string' || !num(first('temperature_2m_max'))) return cb(new Error('open-meteo.com: no forecast in the answer'));
            const before = JSON.stringify([this.today(), this.days()]), days = [];
            for (let i = 0; i < DAYS && typeof at('time', i) === 'string' && num(at('temperature_2m_max', i)); i++) {
                days.push({ date: at('time', i), code: at('weather_code', i), hi: at('temperature_2m_max', i), lo: at('temperature_2m_min', i),
                    rain: num(at('precipitation_probability_max', i)) ? at('precipitation_probability_max', i) : null });
            }
            this.fc = {
                date: first('time'), offset: num(j.utc_offset_seconds) ? j.utc_offset_seconds : 0,
                code: first('weather_code'), hi: first('temperature_2m_max'), lo: first('temperature_2m_min'),
                rain: num(first('precipitation_probability_max')) ? first('precipitation_probability_max') : null,
                now: c && num(c.temperature_2m) ? c.temperature_2m : null, nowCode: c && num(c.weather_code) ? c.weather_code : null,
                isDay: c ? c.is_day !== 0 : null, days, t: Date.now(),
            };
            this._save();
            if (JSON.stringify([this.today(), this.days()]) !== before) this.listeners.forEach((f) => { try { f(); } catch (e) { /* the listener's own */ } });
            cb(null);
        });
    }

    _save() {
        try { fs.writeFileSync(this.file, JSON.stringify({ place: this.place, fc: this.fc })); } catch (e) { /* read-only: kept in memory */ }
    }
}

Weather.kind = kind;
Weather.DAYS = DAYS;
module.exports = Weather;
