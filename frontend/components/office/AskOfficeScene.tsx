import { askGeometry, type Spot } from "./askGeometry";

/** Opacity of each prop that appears as the pipeline runs (0 hidden, 1 shown). */
export type SceneProps = {
  beamOpacity: number;
  rankOpacity: number;
  tossedOpacity: number;
  answerOpacity: number;
  clerk: Spot;
  clerkOpacity: number;
};

/**
 * The isometric Ask office, drawn from the design canvas. Characters are still
 * dashed placeholders; real art (Rive) replaces them in Phase 5.
 */
export function AskOfficeScene({
  beamOpacity,
  rankOpacity,
  tossedOpacity,
  answerOpacity,
  clerk,
  clerkOpacity,
}: SceneProps) {
  const geo = askGeometry();
  return (
      <svg viewBox="0 0 1280 600" width="100%" role="img" aria-label="A cut-away isometric office in warm lamp light. From left to right: a door, the Translator at a big wall of screens, the Scout holding a lantern up to two bookcases in the back corner with the Librarian between them, the Judge behind a tall bench under a Top 5 board, and the Storyteller at a typewriter. Character spots are empty placeholders." style={{ display: "block" }}>
      <rect x="0" y="0" width="1280" height="600" fill="#2B1F17"></rect>
      <path d={geo.slab.fx} fill="#4A3324"></path><path d={geo.slab.fy} fill="#3D2A1E"></path>
      <path d={geo.floor} fill="#8A5E3E"></path>
      <path d={geo.planks} stroke="#7A5134" strokeWidth="1.5" fill="none"></path>
      <path d={geo.light} fill="#F2C27E" opacity="0.16"></path>
      <path d={geo.rug} fill="#6E3B2A"></path>
      <path d={geo.rugIn} fill="none" stroke="#B9864F" strokeWidth="2" strokeDasharray="8 6"></path>
      <path d={geo.mat} fill="#5B4636"></path>
      <ellipse cx={geo.l1g.x} cy={geo.l1g.y} rx="120" ry="50" fill="#FFCF8A" opacity="0.16"></ellipse>
      <ellipse cx={geo.l2g.x} cy={geo.l2g.y} rx="110" ry="46" fill="#FFCF8A" opacity="0.16"></ellipse>

      <path d={geo.wallL} fill="#B48A62"></path><path d={geo.wallR} fill="#A27852"></path>
      <path d={geo.wainL} fill="#8F6747"></path><path d={geo.wainR} fill="#835C3E"></path>
      <path d={geo.rails} stroke="#C9A47C" strokeWidth="3" fill="none"></path>

      <path d={geo.doorFrame} fill="#5E3F28"></path>
      <path d={geo.door} fill="#8C5E3C"></path>
      <path d={geo.doorPanels} fill="none" stroke="#6E4A2F" strokeWidth="2"></path>
      <circle cx={geo.knob.x} cy={geo.knob.y} r="3.5" fill="#E1C27A"></circle>
      <path d={geo.doorSign} fill="#F1E7D2"></path>
      <text transform={geo.doorSignT} fontFamily="IBM Plex Sans, sans-serif" fontWeight="600" fontSize="8" letterSpacing="1" fill="#4A3426">STAFF</text>

      <path d={geo.winFrame} fill="#E1CBA8"></path><path d={geo.winGlass} fill="#E8A866"></path>
      <path d={geo.winBars} stroke="#E1CBA8" strokeWidth="3" fill="none"></path>
      <path d={geo.cork} fill="#A87A50"></path><path d={geo.corkFrame} stroke="#7E5638" strokeWidth="3" fill="none"></path>
      <text transform={geo.topT} fontFamily="IBM Plex Sans, sans-serif" fontWeight="600" fontSize="10" letterSpacing="2" fill="#F1E7D2">TOP 5</text>
      <g opacity={rankOpacity}>
      <path d={geo.rankCards} fill="#F1E7D2"></path>
      <path d={geo.rankFaded} fill="#F1E7D2" opacity="0.4"></path>
      <text transform={geo.r1T} fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#4A3426">1</text>
      <text transform={geo.r2T} fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#4A3426">2</text>
      <text transform={geo.r3T} fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#4A3426">3</text>
      <text transform={geo.r4T} fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#4A3426">4</text>
      <text transform={geo.r5T} fontFamily="IBM Plex Mono, monospace" fontSize="10" fill="#4A3426">5</text>
      </g>
      <ellipse cx={geo.clock.x} cy={geo.clock.y} rx="15" ry="17" fill="#EFE6D6" stroke="#6B5440" strokeWidth="2"></ellipse>
      <path d={geo.clockHands} stroke="#4A3426" strokeWidth="2" strokeLinecap="round" fill="none"></path>
      <path d={geo.sign} fill="#3A2A20"></path>
      <text transform={geo.signT} fontFamily="IBM Plex Sans, sans-serif" fontWeight="600" fontSize="11" letterSpacing="3" fill="#E9CFA4">LIBRARY</text>

      <path d={geo.caseA.fy} fill="#7E5638"></path><path d={geo.caseA.fx} fill="#8A6040"></path><path d={geo.caseA.top} fill="#9C6E48"></path>
      <path d={geo.caseB.fy} fill="#8A6040"></path><path d={geo.caseB.fx} fill="#7E5638"></path><path d={geo.caseB.top} fill="#9C6E48"></path>
      <path d={geo.caseIn} fill="#3E2A1E"></path>
      <path d={geo.books.b0} fill="#7D5A44"></path><path d={geo.books.b1} fill="#5E6E5A"></path><path d={geo.books.b2} fill="#A88458"></path><path d={geo.books.b3} fill="#6A5A72"></path><path d={geo.books.b4} fill="#9A6450"></path><path d={geo.books.b5} fill="#56677A"></path>
      <path d={geo.shelves} fill="#9C6E48"></path>

      <ellipse cx={geo.lb.x} cy={geo.lb.y} rx="26" ry="8" fill="#000000" opacity="0.18"></ellipse>
      <g fill="#FFFFFF" fillOpacity="0.22" stroke="#EADAC0" strokeWidth="2" strokeDasharray="5 4"><circle cx={geo.lb.x} cy={geo.lbHead} r="17"></circle><rect x={geo.lbBodyX} y={geo.lbBodyY} width="44" height="70" rx="20"></rect></g>
      <rect x={geo.lbTagX} y={geo.lbTagY} width="64" height="15" rx="2" fill="#3A2A20"></rect>
      <text x={geo.lb.x} y={geo.lbTextY} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight="600" fontSize="8" letterSpacing="0.6" fill="#EADAC0">LIBRARIAN</text>

      <g opacity={beamOpacity}>
      <path d={geo.beam} fill="#FFD98A" opacity="0.28"></path>
      <path d={geo.litMeaning} fill="none" stroke="#9FC4D9" strokeWidth="2.5"></path>
      <path d={geo.litWords} fill="none" stroke="#F2B25E" strokeWidth="2.5"></path>
      </g>

      <path d={geo.pot.fy} fill="#7A4D33"></path><path d={geo.pot.fx} fill="#6B432C"></path><path d={geo.pot.top} fill="#4A3324"></path>
      <ellipse cx={geo.plant.x} cy={geo.plant.y} rx="11" ry="30" fill="#5D6B41" transform={`rotate(-18 ${geo.plant.x} ${geo.plant.y})`}></ellipse>
      <ellipse cx={geo.plant.x} cy={geo.plant.y} rx="11" ry="32" fill="#6F7F4F" transform={`rotate(16 ${geo.plant.x} ${geo.plant.y})`}></ellipse>
      <path d={geo.cooler.fy} fill="#CDBEA6"></path><path d={geo.cooler.fx} fill="#C2B39A"></path><path d={geo.cooler.top} fill="#D9CBB4"></path>
      <path d={geo.bottle.fy} fill="#94B2B1"></path><path d={geo.bottle.fx} fill="#86A3A2"></path><path d={geo.bottle.top} fill="#A8C3C2"></path>

      <ellipse cx={geo.sc.x} cy={geo.sc.y} rx="30" ry="9" fill="#000000" opacity="0.18"></ellipse>
      <g fill="#FFFFFF" fillOpacity="0.22" stroke="#EADAC0" strokeWidth="2" strokeDasharray="5 4"><circle cx={geo.sc.x} cy={geo.scHead} r="17"></circle><rect x={geo.scBodyX} y={geo.scBodyY} width="44" height="70" rx="20"></rect></g>
      <circle cx={geo.lantern.x} cy={geo.lantern.y} r="16" fill="#FFD98A" opacity={beamOpacity}></circle>
      <path d={geo.lanternBox.fy} fill="#A88458"></path><path d={geo.lanternBox.fx} fill="#8C6D46"></path><path d={geo.lanternBox.top} fill="#5B4636"></path>
      <rect x={geo.scTagX} y={geo.scTagY} width="64" height="15" rx="2" fill="#3A2A20"></rect>
      <text x={geo.sc.x} y={geo.scTextY} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight="600" fontSize="8" letterSpacing="0.8" fill="#EADAC0">SCOUT</text>

      <path d={geo.tower.fy} fill="#332C27"></path><path d={geo.tower.fx} fill="#2C2622"></path><path d={geo.tower.top} fill="#3A332E"></path>
      <path d={geo.leds} fill="#9FD9A0"></path>
      <path d={geo.tdesk.fy} fill="#6E4A2F"></path><path d={geo.tdesk.fx} fill="#7E5536"></path><path d={geo.tdesk.top} fill="#9C6B45"></path>
      <path d={geo.bezel} fill="#2A2420"></path>
      <path d={geo.screen} fill="#233230"></path>
      <path d={geo.wStrong} fill="#F2C27E"></path>
      <path d={geo.wMid} fill="#C99A5E" opacity="0.8"></path>
      <path d={geo.wWeak} fill="#7A6A50" opacity="0.7"></path>
      <path d={geo.scrBars} fill="#8FD0B8"></path>
      <path d={geo.keyboard} fill="#3A302A"></path>
      <ellipse cx={geo.tr.x} cy={geo.tr.y} rx="30" ry="9" fill="#000000" opacity="0.18"></ellipse>
      <g fill="#FFFFFF" fillOpacity="0.22" stroke="#EADAC0" strokeWidth="2" strokeDasharray="5 4"><circle cx={geo.tr.x} cy={geo.trHead} r="17"></circle><rect x={geo.trBodyX} y={geo.trBodyY} width="44" height="70" rx="20"></rect></g>
      <rect x={geo.trTagX} y={geo.trTagY} width="64" height="15" rx="2" fill="#3A2A20"></rect>
      <text x={geo.tr.x} y={geo.trTextY} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight="600" fontSize="8" letterSpacing="0.4" fill="#EADAC0">TRANSLATOR</text>

      <ellipse cx={geo.jd.x} cy={geo.jd.y} rx="30" ry="9" fill="#000000" opacity="0.18"></ellipse>
      <g fill="#FFFFFF" fillOpacity="0.22" stroke="#EADAC0" strokeWidth="2" strokeDasharray="5 4"><circle cx={geo.jd.x} cy={geo.jdHead} r="17"></circle><rect x={geo.jdBodyX} y={geo.jdBodyY} width="44" height="70" rx="20"></rect></g>
      <path d={geo.bench.fy} fill="#6E4A2F"></path><path d={geo.bench.fx} fill="#5E3F28"></path><path d={geo.bench.top} fill="#8C5E3C"></path>
      <path d={geo.benchPanel} fill="#7E5536"></path>
      <path d={geo.gavel} fill="#3E2A1E"></path>
      <g opacity={rankOpacity}><path d={geo.keptStack.fy} fill="#D8CCB7"></path><path d={geo.keptStack.fx} fill="#CBBEA7"></path><path d={geo.keptStack.top} fill="#EFE6D6"></path></g>
      <path d={geo.tossed} fill="#EFE6D6" opacity={tossedOpacity}></path>
      <path d={geo.plate} fill="#3A2A20"></path>
      <text transform={geo.plateT} fontFamily="IBM Plex Sans, sans-serif" fontWeight="600" fontSize="9" letterSpacing="1.5" fill="#EADAC0">JUDGE</text>

      <ellipse cx={geo.st.x} cy={geo.st.y} rx="30" ry="9" fill="#000000" opacity="0.18"></ellipse>
      <g fill="#FFFFFF" fillOpacity="0.22" stroke="#EADAC0" strokeWidth="2" strokeDasharray="5 4"><circle cx={geo.st.x} cy={geo.stHead} r="17"></circle><rect x={geo.stBodyX} y={geo.stBodyY} width="44" height="70" rx="20"></rect></g>
      <path d={geo.sdesk.fy} fill="#6E4A2F"></path><path d={geo.sdesk.fx} fill="#7E5536"></path><path d={geo.sdesk.top} fill="#9C6B45"></path>
      <path d={geo.paper} fill="#F2EBDD"></path>
      <path d={geo.paperLines} fill="#B8AD98"></path>
      <path d={geo.typer.fy} fill="#2C2622"></path><path d={geo.typer.fx} fill="#24201C"></path><path d={geo.typer.top} fill="#3A332E"></path>
      <path d={geo.keys} fill="#5B4D42"></path>
      <g opacity={answerOpacity} fill="#7A5236"><circle cx={geo.b1.x} cy={geo.b1.y} r="3"></circle><circle cx={geo.b2.x} cy={geo.b2.y} r="3"></circle><circle cx={geo.b3.x} cy={geo.b3.y} r="3"></circle></g>
      <rect x={geo.stTagX} y={geo.stTagY} width="64" height="15" rx="2" fill="#3A2A20"></rect>
      <text x={geo.st.x} y={geo.stTextY} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight="600" fontSize="7.5" letterSpacing="0.3" fill="#EADAC0">STORYTELLER</text>

      <g opacity={clerkOpacity}>
      <ellipse cx={clerk.x} cy={clerk.y} rx="30" ry="9" fill="#000000" opacity="0.22"></ellipse>
      <g fill="#F2C27E" fillOpacity="0.3" stroke="#F2C27E" strokeWidth="2.5" strokeDasharray="5 4"><circle cx={clerk.x} cy={clerk.head} r="17"></circle><rect x={clerk.bodyX} y={clerk.bodyY} width="44" height="70" rx="20"></rect></g>
      <rect x={clerk.tagX} y={clerk.tagY} width="64" height="15" rx="2" fill="#F2C27E"></rect>
      <text x={clerk.x} y={clerk.textY} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontWeight="700" fontSize="8" letterSpacing="0.8" fill="#33261D">CLERK</text>
      </g>

      <path d={geo.cords} stroke="#1E1612" strokeWidth="1.5" fill="none"></path>
      <path d={geo.shades} fill="#C98F4A"></path>
      <path d={geo.bulbs} fill="#FFE2A8"></path>
      </svg>
  );
}
