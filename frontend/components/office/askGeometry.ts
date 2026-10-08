/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Isometric geometry for the Ask office scene, ported from the design canvas
 * (docs/design/upload-page/project/AskAlt.dc.html). Every value is an SVG path or point.
 */
type Pt = { x: number; y: number };
export type Spot = Pt & { head: number; bodyX: number; bodyY: number; tagX: number; tagY: number; textY: number };
export type Geo = Record<string, any>;

let cached: Geo | null = null;

export function askGeometry(): Geo {
  if (cached) return cached;
  const P = (x: number, y: number, z: number): [number, number] => [640 + 0.8 * (x - y), 210 + 0.4 * (x + y) - 0.8 * z];
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const pts = (a: number[][]) => a.map((q) => { const p = P(q[0], q[1], q[2]); return r1(p[0]) + ' ' + r1(p[1]); });
  const poly = (a: number[][]) => 'M' + pts(a).join('L') + 'Z';
  const line = (a: number[][]) => 'M' + pts(a).join('L');
  const xy = (x: number, y: number, z: number): Pt => { const p = P(x, y, z); return { x: r1(p[0]), y: r1(p[1]) }; };
  const box = (x: number, y: number, z: number, w: number, d: number, h: number) => ({
    top: poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]),
    fy: poly([[x, y + d, z + h], [x + w, y + d, z + h], [x + w, y + d, z], [x, y + d, z]]),
    fx: poly([[x + w, y, z + h], [x + w, y + d, z + h], [x + w, y + d, z], [x + w, y, z]])
  });
  const all = (b: { top: string; fy: string; fx: string }) => b.top + ' ' + b.fy + ' ' + b.fx;
  const qy = (y: number, x0: number, x1: number, z0: number, z1: number) => poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);
  const qx = (x: number, y0: number, y1: number, z0: number, z1: number) => poly([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]);
  const qz = (z: number, x0: number, x1: number, y0: number, y1: number) => poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]);
  const onX = (p: Pt) => 'matrix(1 0.5 0 1 ' + p.x + ' ' + p.y + ')';
  const onY = (p: Pt) => 'matrix(1 -0.5 0 1 ' + p.x + ' ' + p.y + ')';
  let gs = 23;
  const gr = () => { gs = (gs * 9301 + 49297) % 233280; return gs / 233280; };
  const g: Geo = {};
  const spot = (x: number, y: number): Spot => {
    const b = xy(x, y, 0);
    return { x: b.x, y: b.y, head: r1(b.y - 88), bodyX: r1(b.x - 22), bodyY: r1(b.y - 70), tagX: r1(b.x - 32), tagY: r1(b.y + 6), textY: r1(b.y + 16) };
  };
  const person = (key: string, x: number, y: number) => {
    const s = spot(x, y);
    g[key] = { x: s.x, y: s.y };
    g[key + 'Head'] = s.head;
    g[key + 'BodyX'] = s.bodyX;
    g[key + 'BodyY'] = s.bodyY;
    g[key + 'TagX'] = s.tagX;
    g[key + 'TagY'] = s.tagY;
    g[key + 'TextY'] = s.textY;
  };

  g.floor = qz(0, 0, 700, 0, 600);
  g.slab = box(0, 0, -24, 700, 600, 24);
  let pl = '';
  for (let y = 40; y < 600; y += 40) pl += line([[0, y, 0], [700, y, 0]]);
  g.planks = pl;
  g.light = poly([[330, 0, 0], [520, 0, 0], [590, 200, 0], [400, 200, 0]]);
  g.rug = qz(0.5, 360, 520, 220, 380);
  g.rugIn = qz(0.6, 375, 505, 235, 365);
  g.mat = qz(0.5, 0, 46, 500, 580);
  g.l1g = xy(435, 305, 0);
  g.l2g = xy(595, 192, 0);
  g.wallL = qx(0, 0, 600, 0, 260);
  g.wallR = qy(0, 0, 700, 0, 260);
  g.wainL = qx(0.2, 0, 600, 0, 70);
  g.wainR = qy(0.2, 0, 700, 0, 70);
  g.rails = line([[0.3, 600, 70], [0.3, 0.3, 70], [700, 0.3, 70]]);

  g.doorFrame = qx(0.4, 494, 586, 0, 152);
  g.door = qx(0.6, 502, 578, 0, 144);
  g.doorPanels = qx(0.7, 510, 570, 82, 134) + ' ' + qx(0.7, 510, 570, 12, 72);
  g.knob = xy(0.9, 566, 70);
  g.doorSign = qx(0.5, 516, 564, 160, 176);
  g.doorSignT = onY(xy(0.6, 558, 164));

  g.winFrame = qy(0.5, 330, 520, 110, 210);
  g.winGlass = qy(0.6, 338, 512, 116, 204);
  g.winBars = line([[425, 0.7, 116], [425, 0.7, 204]]) + line([[338, 0.7, 160], [512, 0.7, 160]]);

  g.cork = qy(0.5, 170, 310, 150, 232);
  g.corkFrame = line([[170, 0.6, 150], [310, 0.6, 150], [310, 0.6, 232], [170, 0.6, 232], [170, 0.6, 150]]);
  g.topT = onX(xy(178, 0.7, 218));
  let rc = '';
  for (let i = 0; i < 5; i++) {
    const x0 = 178 + i * 26;
    rc += qy(0.6, x0, x0 + 20, 184, 208) + ' ';
    g['r' + (i + 1) + 'T'] = onX(xy(x0 + 7, 0.7, 191));
  }
  g.rankCards = rc;
  let rf = '';
  for (let i = 0; i < 6; i++) { const x0 = 176 + i * 22; rf += qy(0.6, x0, x0 + 16, 158 + (i % 2) * 4, 174 + (i % 2) * 4) + ' '; }
  g.rankFaded = rf;

  g.clock = xy(0.5, 250, 205);
  g.clockHands = 'M' + g.clock.x + ' ' + g.clock.y + 'L' + g.clock.x + ' ' + r1(g.clock.y - 11) + 'M' + g.clock.x + ' ' + g.clock.y + 'L' + r1(g.clock.x + 7) + ' ' + r1(g.clock.y + 4);
  g.sign = qy(0.5, 60, 160, 228, 250);
  g.signT = onX(xy(72, 0.6, 233));

  g.caseA = box(0, 60, 0, 40, 100, 220);
  g.caseB = box(60, 0, 0, 100, 40, 220);
  g.caseIn = qx(40.2, 66, 154, 4, 214) + ' ' + qy(40.2, 66, 154, 4, 214);
  const books: Record<string, string> = { b0: '', b1: '', b2: '', b3: '', b4: '', b5: '' };
  let shelves = '';
  [8, 62, 114, 166].forEach((zb) => {
    shelves += qx(40.4, 66, 154, zb - 4, zb) + ' ' + qy(40.4, 66, 154, zb - 4, zb) + ' ';
    let by = 68;
    while (by < 146) {
      const w = 5 + gr() * 4;
      if (by + w > 152) break;
      books['b' + Math.floor(gr() * 6)] += qx(40.3, by, by + w, zb, zb + 30 + gr() * 14) + ' ';
      by += w + 0.6;
    }
    let bx = 68;
    while (bx < 146) {
      const w = 5 + gr() * 4;
      if (bx + w > 152) break;
      books['b' + Math.floor(gr() * 6)] += qy(40.3, bx, bx + w, zb, zb + 30 + gr() * 14) + ' ';
      bx += w + 0.6;
    }
  });
  g.books = books;
  g.shelves = shelves;
  person('lb', 55, 55);

  person('sc', 150, 190);
  g.lanternBox = box(164, 176, 45, 8, 8, 12);
  g.lantern = xy(168, 180, 51);
  g.beam = poly([[168, 180, 51], [40, 150, 8], [40, 150, 125], [40, 70, 125], [40, 70, 8]]);
  g.litMeaning = qx(40.7, 74, 82, 8, 44) + ' ' + qx(40.7, 100, 107, 62, 98) + ' ' + qx(40.7, 126, 134, 8, 46);
  g.litWords = qx(40.7, 88, 95, 62, 100) + ' ' + qx(40.7, 140, 148, 8, 42);

  g.pot = box(290, 8, 0, 22, 22, 24);
  g.plant = xy(301, 19, 56);
  g.cooler = box(650, 20, 0, 30, 30, 72);
  g.bottle = box(654, 24, 72, 22, 22, 36);

  person('tr', 100, 400);
  g.tower = box(16, 290, 0, 26, 26, 110);
  let leds = '';
  for (let i = 0; i < 6; i++) leds += qx(42.4, 296, 300, 90 - i * 11, 93 - i * 11) + ' ';
  g.leds = leds;
  g.tdesk = box(10, 320, 0, 60, 140, 60);
  g.bezel = qx(44, 326, 454, 62, 172);
  g.screen = qx(44.5, 330, 450, 66, 168);
  g.wStrong = '';
  g.wMid = '';
  g.wWeak = '';
  const wordRow = (list: [number, string][], z0: number, z1: number) => {
    let y = 446;
    list.forEach((w) => { const q = qx(45, y - w[0], y, z0, z1); if (w[1] === 's') g.wStrong += q + ' '; else if (w[1] === 'm') g.wMid += q + ' '; else g.wWeak += q + ' '; y -= w[0] + 3; });
  };
  wordRow([[10, 'w'], [8, 'w'], [8, 'w'], [9, 's'], [12, 'm']], 142, 154);
  wordRow([[16, 'w'], [20, 'm'], [18, 's'], [12, 'm']], 122, 134);
  let sb = '';
  for (let i = 0; i < 24; i++) { const y = 446 - i * 4.6; sb += qx(45, y - 2.6, y, 76, 76 + 6 + gr() * 28) + ' '; }
  g.scrBars = sb;
  g.keyboard = qz(60.5, 50, 64, 360, 416);

  person('jd', 420, 250);
  g.bench = box(385, 280, 0, 100, 50, 90);
  g.benchPanel = qy(330.3, 395, 475, 12, 78);
  g.gavel = all(box(450, 292, 90, 22, 4, 4)) + ' ' + all(box(468, 288, 90, 8, 12, 8));
  g.keptStack = box(398, 292, 90, 18, 13, 6);
  g.tossed = qz(0.7, 500, 514, 320, 330) + ' ' + qz(0.7, 518, 530, 346, 358) + ' ' + qz(0.7, 492, 504, 362, 372) + ' ' + qz(0.7, 528, 540, 316, 326);
  g.plate = qy(330.4, 408, 462, 58, 72);
  g.plateT = onX(xy(413, 330.5, 61));

  person('st', 580, 140);
  g.sdesk = box(545, 170, 0, 100, 45, 58);
  g.paper = qy(180, 577, 603, 67, 100);
  let pls = '';
  for (let k = 0; k < 5; k++) pls += qy(180.3, 581, 581 + 12 + gr() * 6, 94 - k * 5.5, 95.6 - k * 5.5) + ' ';
  g.paperLines = pls;
  g.typer = box(567, 176, 58, 46, 26, 9);
  let ks = '';
  for (let i = 0; i < 6; i++) ks += qz(67.3, 573 + i * 6, 577 + i * 6, 184, 188) + ' ' + qz(67.3, 573 + i * 6, 577 + i * 6, 191, 195) + ' ';
  g.keys = ks;
  g.b1 = xy(600, 180.5, 92);
  g.b2 = xy(597, 180.5, 81);
  g.b3 = xy(601, 180.5, 75);

  g.spots = { door: spot(40, 540), translator: spot(175, 400), scout: spot(210, 200), judge: spot(520, 280), storyteller: spot(660, 150) };

  const l1 = xy(435, 305, 262);
  const l2 = xy(595, 192, 250);
  const shade = (p: Pt) => 'M' + r1(p.x - 16) + ' ' + p.y + 'L' + r1(p.x + 16) + ' ' + p.y + 'L' + r1(p.x + 8) + ' ' + r1(p.y - 12) + 'L' + r1(p.x - 8) + ' ' + r1(p.y - 12) + 'Z';
  const bulb = (p: Pt) => 'M' + r1(p.x - 7) + ' ' + p.y + 'A7 4 0 0 0 ' + r1(p.x + 7) + ' ' + p.y + 'Z';
  g.cords = 'M' + l1.x + ' 0L' + l1.x + ' ' + r1(l1.y - 12) + 'M' + l2.x + ' 0L' + l2.x + ' ' + r1(l2.y - 12);
  g.shades = shade(l1) + ' ' + shade(l2);
  g.bulbs = bulb(l1) + ' ' + bulb(l2);
  cached = g;
  return g;
}
