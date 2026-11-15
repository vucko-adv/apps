'use strict';
/**
 * server-win.js - runs bench/server.js on Windows.
 *
 *   node bench/server-win.js zeiger      ->  http://localhost:8078
 *
 * server.js is written for the Mac: it builds with `python3` (on Windows usually the Microsoft Store
 * placeholder) and listens on a Unix socket file, which Node on Windows can't. This starts it with the build
 * run through `python` and the fake cluster-render socket as a named pipe (\\.\pipe\hud-bench-<pid>.sock);
 * the app's cluster_render_client.js connects to a pipe the same way. Nothing in server.js changes.
 *
 * The app runs on Node 8.16.2, the car's version, when it's unpacked at ../tools/node8 (next to this repo:
 * node-v8.16.2-win-x64 from nodejs.org/dist/v8.16.2/); BENCH_NODE=<path to node.exe> overrides.
 */
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const NODE8 = path.join(__dirname, '..', '..', 'tools', 'node8', 'node-v8.16.2-win-x64', 'node.exe');
if (!process.env.BENCH_NODE && fs.existsSync(NODE8)) process.env.BENCH_NODE = NODE8;

if (process.platform === 'win32') {
    const realExec = cp.execFileSync;
    cp.execFileSync = function (cmd, args, opts) {
        return realExec.call(this, cmd === 'python3' ? 'python' : cmd, args, opts);
    };
    const realTmp = os.tmpdir;
    let first = true;
    // server.js asks once, at load, for the folder of its socket
    os.tmpdir = function () { if (first) { first = false; return '\\\\.\\pipe'; } return realTmp.call(this); };
}
require('./server.js');
