// Copies the web app into ./www so Capacitor can wrap it for the App Store and Google Play.
// Run:  node scripts/build-www.js
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'app.js', 'data.js', 'config.js', 'manifest.json', 'videos.json', 'privacy.html']) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of ['icons', 's', 'b']) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
console.log('Built www/ with', fs.readdirSync(out).length, 'items');
