// Flatten a canvas .dc.html room: run its DCLogic, fill {{holes}}, drop SMIL and refs.
// usage: node export-room.js <file.dc.html> '<props json>' > out.svg
const fs = require('fs');
const [file, propsJson] = process.argv.slice(2);
const src = fs.readFileSync(file, 'utf8');
const svg = src.slice(src.indexOf('<svg'), src.indexOf('</svg>') + 6);
const code = src.slice(src.indexOf('class Component'), src.lastIndexOf('</script>'));
class DCLogic { constructor(props) { this.props = props; } }
const Component = new Function('DCLogic', code + '\nreturn Component;')(DCLogic);
const vals = new Component(JSON.parse(propsJson || '{}')).renderVals();
const get = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), vals);
let out = svg
  .replace(/<animate(Transform|Motion)?\b[^>]*?(\/>|>\s*<\/animate(Transform|Motion)?>)/g, '')
  .replace(/\sref="\{\{[^}]+\}\}"/g, '')
  .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, p) => {
    const v = get(p);
    if (v === undefined || typeof v === 'function') { console.error('unresolved', p); return ''; }
    return String(v);
  });
out = out.replace(/<svg\b[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 600" width="1280" height="600">');
process.stdout.write(out);
console.error(JSON.stringify({ spots: vals.geo && vals.geo.spots, tr: vals.geo && vals.geo.tr, sc: vals.geo && vals.geo.sc, jd: vals.geo && vals.geo.jd, st: vals.geo && vals.geo.st }));
