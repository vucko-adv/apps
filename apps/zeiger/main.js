'use strict';
/**
 * Zeiger: redraws the iDrive 7 instrument cluster (the 1920x720 "panel" target) through cluster-render.
 *
 * The center screen is the app's own page (page.js, a canvas screen): the themes as a gallery, which
 * drive mode shows which, and the settings. Each choice is saved in the app's data/settings.json
 * by the kit; the shared engine (hud.js) listens and redraws at once. It keeps running after the page is
 * closed (OAP apps stay up in the background), so the page is only needed for changes. Since 0.26.0 the
 * kit's own settings list is no longer offered: every setting Zeiger's themes use is on the page.
 */
const mgu = require('./kit/mgu');
const HudApp = require('./hud');
const Page = require('./page');
const Weather = require('./weather');
const ZeigerWidget = require('./widget');

mgu.run({
    start(ctx) {
        let hud;
        try {
            hud = new HudApp(ctx);
        } catch (e) {
            // nothing drawn, but stay up: an exit here would count as a crash on the car
            ctx.log.error('Cluster failed to start: ' + (e && e.stack || e));
            return;
        }
        // today's weather for Dark Moon, Underpass and Mist, and the next days for the home-screen widget (fetched only
        // while such a theme shows or the widget shows the weather; weather.js)
        hud.wx = new Weather(ctx.dataDir, ctx.log);
        hud.wx.onChange(() => hud._status());
        hud.start();
        // the page on the centre screen: the themes as a gallery, and the settings (page.js)
        new Page(ctx, hud).start();
        // the home-screen widget: the weather in Mist's or Sunrise's look, or the theme the cluster shows now (widget.js)
        if (ctx.widget) { try { new ZeigerWidget(ctx, hud).start(); } catch (e) { ctx.log.warn('widget: ' + (e && e.message || e)); } }
        process.on('exit', () => { try { hud.wx.stop(); hud.stop(); } catch (e) { /* exiting anyway */ } });
    },
});
