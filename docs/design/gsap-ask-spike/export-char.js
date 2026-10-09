// Flatten a canvas character .dc.html into an SVG group placed with its feet at (x, y).
// usage: node export-char.js <file> <id> <x> <y> '<props json>'
const fs = require('fs');
const [file, id, x, y, propsJson] = process.argv.slice(2);
const src = fs.readFileSync(file, 'utf8');
const svg = src.slice(src.indexOf('<svg'), src.indexOf('</svg>'));
const inner = svg.slice(svg.indexOf('>') + 1);
const code = src.slice(src.indexOf('class Component'), src.lastIndexOf('</script>'));
class DCLogic { constructor(props) { this.props = props; } }
const Component = new Function('DCLogic', code + '\nreturn Component;')(DCLogic);
const vals = new Component(JSON.parse(propsJson || '{}')).renderVals();
const out = inner
  .replace(/<animate(Transform|Motion)?\b[^>]*?(\/>|>\s*<\/animate(Transform|Motion)?>)/g, '')
  .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, p) => { const v = vals[p]; if (v === undefined) { console.error('unresolved', p); return ''; } return String(v); });
process.stdout.write(`  <g id="${id}" transform="translate(${x - 40} ${y - 116})">${out}</g>\n`);
