"use client";

import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  FOUND_BY_COLOR,
  type MapOverlay,
  type MapPoint,
  type Point,
  keyOf,
} from "../../lib/map";
import { usePrivateTexts } from "../../lib/PrivateTexts";
import styles from "./VectorMap.module.css";

const NOTE =
  "Every card is a dot. Cards about similar things sit close together. This is a flat 2-D picture of 1,024-number fingerprints, so distances are only rough.";
const ASPECT = 1.6;
const ZOOM_STEP = 1.2;
const MAX_ZOOM = 25;
const QUESTION_COLOR = "#e2a72e";
const FOUND_COLOR = { vector: FOUND_BY_COLOR.vector, keyword: FOUND_BY_COLOR.keyword } as const;
const FOUND_LABEL = {
  vector: "meaning",
  keyword: "words",
  both: "both",
} as const;

const ICON = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  "aria-hidden": true,
} as const;

type View = { x: number; y: number; w: number; h: number };
type Hover = {
  left: number;
  top: number;
  title: string;
  heading: string;
  extra: string[];
};

export const PALETTE = ["#4e79a7","#f28e2b","#e15759","#76b7b2","#59a14f","#edc948","#b07aa1","#ff9da7","#9c755f","#86bcb6","#d37295","#8cd17d","#b6992d","#499894","#79706e","#d4a6c8","#a0cbe8","#fabfd2","#bab0ac","#f1ce63"];
const paletteColor = (index: number) => PALETTE[index % PALETTE.length];

/** The outline of a 5-point star centred on (cx, cy), the first point straight up. */
function starPath(cx: number, cy: number, outer: number, inner: number) {
  const corners = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${cx + radius * Math.cos(angle)} ${cy + radius * Math.sin(angle)}`;
  });
  return `M ${corners.join(" L ")} Z`;
}

/** The box around the points, padded 6% and widened to the map's shape so zoom maths stay simple. */
function boundsOf(points: MapPoint[]): View {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => -p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let w = Math.max(maxX - minX, 1e-6) * 1.12;
  let h = Math.max(maxY - minY, 1e-6) * 1.12;
  if (w / h < ASPECT) w = h * ASPECT;
  else h = w / ASPECT;
  return { x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h };
}

/** The box around the question and the candidates' dots, padded 25% and widened to the map's shape. */
function fittedTo(pts: Point[], bounds: View): View {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => -p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let w = Math.max((maxX - minX) * 1.25, bounds.w / 6);
  let h = Math.max((maxY - minY) * 1.25, 1e-6);
  if (w / h < ASPECT) w = h * ASPECT;
  else h = w / ASPECT;
  w = Math.max(w, bounds.w / 6);
  h = w / ASPECT;
  return { x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h };
}

/**
 * Every card as a dot, from GET /map, with the visitor's own cards, the question and the Scout's
 * candidates on top. The wheel or the buttons zoom, dragging pans. The map plays no animation.
 * The `compact` variant (the Scout tab) starts zoomed onto the question and its candidates,
 * numbers them by rank and drops the note and the per-document legend. `focus` is the `keyOf`
 * key of a candidate to highlight.
 */
export default function VectorMap({
  points,
  error,
  overlay,
  variant = "full",
  focus = null,
}: {
  points: MapPoint[] | null;
  error: boolean;
  overlay?: MapOverlay;
  variant?: "full" | "compact";
  focus?: string | null;
}) {
  const { texts } = usePrivateTexts();
  const bounds = useMemo(() => (points && points.length ? boundsOf(points) : null), [points]);
  const fitted = useMemo(() => {
    if (!bounds || !points || variant !== "compact" || !overlay?.candidates?.length) return bounds;
    const where = new Map<string, Point>();
    for (const p of points) where.set(keyOf({ source: "library", ...p }), { x: p.x, y: p.y });
    for (const item of texts) {
      item.chunks.forEach((chunk, i) => {
        const point = item.points?.[i];
        if (point) {
          where.set(
            keyOf({
              source: "private",
              document_id: null,
              ...item,
              position: chunk.position,
            }),
            point,
          );
        }
      });
    }
    const spots = overlay.candidates.flatMap((c) => where.get(keyOf(c)) ?? []);
    if (overlay.question) spots.push(overlay.question);
    return spots.length ? fittedTo(spots, bounds) : bounds;
  }, [bounds, points, variant, overlay, texts]);
  const [view, setView] = useState<View | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const current = view ?? fitted;

  useEffect(() => setView(fitted), [fitted]);

  /** Zoom by `factor` (above 1 zooms out), keeping the spot at (fx, fy) in the frame fixed. */
  function zoom(factor: number, fx = 0.5, fy = 0.5) {
    if (!bounds) return;
    setView((now) => {
      const v = now ?? bounds;
      const w = Math.min(bounds.w, Math.max(bounds.w / MAX_ZOOM, v.w * factor));
      const h = w / ASPECT;
      return { x: v.x + (v.w - w) * fx, y: v.y + (v.h - h) * fy, w, h };
    });
  }

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const hasMap = bounds !== null;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomRef.current(
        event.deltaY < 0 ? 1 / ZOOM_STEP : ZOOM_STEP,
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height,
      );
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [hasMap]);

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    drag.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current = { x: event.clientX, y: event.clientY };
    if (!rect.width) return;
    setView((now) => {
      const v = now ?? bounds;
      if (!v) return now;
      return {
        ...v,
        x: v.x - (dx * v.w) / rect.width,
        y: v.y - (dy * v.w) / rect.width,
      };
    });
  }

  function onPointerUp() {
    drag.current = null;
    setDragging(false);
  }

  if (error) return <p className={styles.state}>The map is not available right now.</p>;
  if (points === null) return <p className={styles.state}>Loading the map…</p>;
  if (!current || points.length === 0) {
    return (
      <p className={styles.state}>
        No map yet: run <code>make seed</code>.
      </p>
    );
  }

  const titles = [...new Set(points.map((p) => p.title))].sort((a, b) => a.localeCompare(b));
  const colorOf = (title: string) => paletteColor(titles.indexOf(title));
  const candidates = overlay?.candidates ?? [];
  const question = overlay?.question;
  const foundBy = new Map(candidates.map((c) => [keyOf(c), c.found_by]));
  const dim = candidates.length > 0;
  const compact = variant === "compact";

  const privateDots = texts.flatMap((item) =>
    item.chunks.flatMap((chunk, i) => {
      const point = item.points?.[i];
      return point
        ? [
            {
              key: keyOf({
                source: "private",
                document_id: null,
                ...item,
                position: chunk.position,
              }),
              title: item.title,
              heading: chunk.heading,
              position: chunk.position,
              point,
            },
          ]
        : [];
    }),
  );

  const where = new Map<string, Point>();
  for (const p of points) {
    where.set(keyOf({ source: "library", ...p }), { x: p.x, y: p.y });
  }
  for (const d of privateDots) where.set(d.key, d.point);

  const r = 0.006 * current.w;
  const stroke = 0.002 * current.w;
  const dotOpacity = (key: string) => (dim && !foundBy.has(key) ? 0.35 : 1);

  function show(
    event: PointerEvent<SVGElement>,
    key: string,
    title: string,
    heading: string | null,
    position: number,
    mine: boolean,
  ) {
    const rect = wrapRef.current?.getBoundingClientRect();
    const found = foundBy.get(key);
    setHover({
      left: (event.clientX || 0) - (rect?.left ?? 0),
      top: (event.clientY || 0) - (rect?.top ?? 0),
      title,
      heading: heading ?? `Card ${position + 1}`,
      extra: [...(mine ? ["Your text"] : []), ...(found ? [`Found by ${FOUND_LABEL[found]}`] : [])],
    });
  }

  const ring = (key: string, p: Point, radius: number, color: string, width = 1.5) => (
    <circle
      key={key}
      cx={p.x}
      cy={-p.y}
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={stroke * width}
    />
  );

  return (
    <div className={`${styles.map} ${compact ? styles.compact : ""}`}>
      {!compact && <p className={styles.note}>{NOTE}</p>}
      <div className={styles.layout}>
        <div ref={wrapRef} className={styles.wrap}>
          <svg
            ref={svgRef}
            role="img"
            aria-label={`Vector map of ${points.length} cards`}
            viewBox={`${current.x} ${current.y} ${current.w} ${current.h}`}
            className={styles.svg}
            data-dragging={dragging || undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {points.map((p) => {
              const key = keyOf({ source: "library", ...p });
              return (
                <circle
                  key={p.chunk_id}
                  cx={p.x}
                  cy={-p.y}
                  r={r}
                  fill={colorOf(p.title)}
                  opacity={dotOpacity(key)}
                  data-key={key}
                  data-doc={p.document_id}
                  onPointerEnter={(e) => show(e, key, p.title, p.heading, p.position, false)}
                  onPointerLeave={() => setHover(null)}
                />
              );
            })}
            {privateDots.map((d) => (
              <rect
                key={d.key}
                x={d.point.x - r}
                y={-d.point.y - r}
                width={2 * r}
                height={2 * r}
                fill="var(--ink)"
                opacity={dotOpacity(d.key)}
                data-key={d.key}
                onPointerEnter={(e) => show(e, d.key, d.title, d.heading, d.position, true)}
                onPointerLeave={() => setHover(null)}
              />
            ))}
            {question &&
              candidates.map((c) => {
                const to = where.get(keyOf(c));
                return (
                  to && (
                    <line
                      key={`line:${keyOf(c)}`}
                      data-testid="candidate-line"
                      x1={question.x}
                      y1={-question.y}
                      x2={to.x}
                      y2={-to.y}
                      stroke={c.found_by === "keyword" ? FOUND_COLOR.keyword : FOUND_COLOR.vector}
                      strokeOpacity={0.45}
                      strokeWidth={stroke}
                    />
                  )
                );
              })}
            {candidates.map((c) => {
              const at = where.get(keyOf(c));
              if (!at) return null;
              const key = keyOf(c);
              const width = focus === key ? 2.5 : 1.5;
              const faded = focus !== null && focus !== key ? 0.4 : 1;
              return c.found_by === "both" ? (
                <g
                  key={`ring:${key}`}
                  data-testid="candidate-ring"
                  data-found="both"
                  opacity={faded}
                >
                  {ring("a", at, 2.2 * r, FOUND_COLOR.vector, width)}
                  {ring("b", at, 3.2 * r, FOUND_COLOR.keyword, width)}
                </g>
              ) : (
                <g
                  key={`ring:${key}`}
                  data-testid="candidate-ring"
                  data-found={c.found_by}
                  opacity={faded}
                >
                  {ring("a", at, 2.4 * r, FOUND_COLOR[c.found_by], width)}
                </g>
              );
            })}
            {compact &&
              candidates.map((c) => {
                const at = where.get(keyOf(c));
                return (
                  at && (
                    <text
                      key={`rank:${keyOf(c)}`}
                      data-testid="candidate-rank"
                      x={at.x + 3.6 * r}
                      y={-at.y}
                      dominantBaseline="central"
                      fontSize={2.6 * r}
                      fontWeight={600}
                      fill="var(--ink)"
                      stroke="#ffffff"
                      strokeWidth={0.6 * r}
                      paintOrder="stroke"
                      pointerEvents="none"
                    >
                      {c.rank}
                    </text>
                  )
                );
              })}
            {question && (
              <g data-testid="question-marker">
                <path
                  d={starPath(question.x, -question.y, 3.4 * r, 1.4 * r)}
                  fill={QUESTION_COLOR}
                  stroke="var(--ink)"
                  strokeWidth={stroke}
                />
              </g>
            )}
          </svg>
          <div className={styles.toolbar}>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in (or Ctrl + scroll)"
              onClick={() => zoom(1 / ZOOM_STEP)}
            >
              <svg {...ICON}>
                <path d="M8 3v10M3 8h10" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              onClick={() => zoom(ZOOM_STEP)}
            >
              <svg {...ICON}>
                <path d="M3 8h10" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Reset view"
              title="Reset view"
              onClick={() => setView(fitted)}
            >
              <svg {...ICON}>
                <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
              </svg>
            </button>
            {compact && (
              <button
                type="button"
                aria-label="Whole map"
                title="Whole map"
                onClick={() => setView(bounds)}
              >
                <svg {...ICON}>
                  <rect x="2.5" y="2.5" width="11" height="11" />
                </svg>
              </button>
            )}
          </div>
          {hover && (
            <div
              role="tooltip"
              className={styles.tip}
              style={{ left: `${hover.left}px`, top: `${hover.top}px` }}
            >
              <strong>{hover.title}</strong>
              <span>{hover.heading}</span>
              {hover.extra.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          )}
        </div>
        <ul className={styles.legend} aria-label="Map legend">
          {!compact &&
            titles.map((title) => (
              <li key={title}>
                <span className={styles.swatch} style={{ background: colorOf(title) }} />
                {title}
              </li>
            ))}
          {!compact && privateDots.length > 0 && (
            <li>
              <span className={`${styles.swatch} ${styles.square}`} />
              Your text
            </li>
          )}
          {question && (
            <li>
              <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">
                <path
                  d={starPath(0, 0, 6.5, 2.7)}
                  fill={QUESTION_COLOR}
                  stroke="var(--ink)"
                  strokeWidth={1}
                />
              </svg>
              Your question
            </li>
          )}
          {candidates.length > 0 &&
            (["vector", "keyword", "both"] as const).map((kind) => (
              <li key={kind}>
                <span
                  className={`${styles.swatch} ${styles.ring}`}
                  style={{
                    borderColor: kind === "keyword" ? FOUND_COLOR.keyword : FOUND_COLOR.vector,
                    boxShadow: kind === "both" ? `0 0 0 2px ${FOUND_COLOR.keyword}` : undefined,
                  }}
                />
                Found by {FOUND_LABEL[kind]}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
