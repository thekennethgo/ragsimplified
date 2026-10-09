import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import OfficeRoom from "./OfficeRoom";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const queue = () => ({ register: vi.fn(() => vi.fn()), emit: vi.fn(), clear: vi.fn() });

test("loads the room SVG, resets the scenes and registers them with the queue", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(new Response('<svg role="img" aria-label="A room"><g id="x"></g></svg>')),
    ),
  );
  const set = { reset: vi.fn(), scenes: {}, holds: {} };
  const build = vi.fn(() => set);
  const q = queue();
  const { container } = render(
    <OfficeRoom src="/office/test.svg" label="A test room" build={build} queue={q} />,
  );

  await waitFor(() => expect(q.register).toHaveBeenCalledWith(set));
  expect(fetch).toHaveBeenCalledWith("/office/test.svg");
  expect(build).toHaveBeenCalledWith(container.querySelector("svg"));
  expect(set.reset).toHaveBeenCalled();
  // the art is hidden from assistive technology; the label is read instead
  expect(screen.getByText("A test room")).toBeInTheDocument();
  expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
});

test("unregisters the scenes when it unmounts", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response("<svg></svg>"))),
  );
  const unregister = vi.fn();
  const q = { register: vi.fn(() => unregister), emit: vi.fn(), clear: vi.fn() };
  const { unmount } = render(
    <OfficeRoom
      src="/office/test.svg"
      label="x"
      build={() => ({ reset: vi.fn(), scenes: {}, holds: {} })}
      queue={q}
    />,
  );
  await waitFor(() => expect(q.register).toHaveBeenCalled());
  unmount();
  expect(unregister).toHaveBeenCalled();
});

test("the page still renders when the art cannot be loaded", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("offline"))),
  );
  const q = queue();
  render(<OfficeRoom src="/office/test.svg" label="A test room" build={vi.fn()} queue={q} />);
  expect(screen.getByText("A test room")).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 10));
  expect(q.register).not.toHaveBeenCalled();
});
