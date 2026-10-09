export type Point = { x: number; y: number };

/** A walk target: the `spot-<name>` marker in the room SVG (feet position, room units). */
export function spot(root: Element, name: string): Point {
  const marker = root.querySelector(`#spot-${name}`);
  if (!marker) throw new Error(`Missing spot-${name} in the room SVG`);
  return { x: Number(marker.getAttribute("cx")), y: Number(marker.getAttribute("cy")) };
}

/** Characters are 80x120 boxes with their feet at (40, 116). */
export const at = (p: Point): Point => ({ x: p.x - 40, y: p.y - 116 });
