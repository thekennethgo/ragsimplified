import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import Nav from "./Nav";

const pathname = vi.hoisted(() => vi.fn(() => "/"));
vi.mock("next/navigation", () => ({ usePathname: pathname }));

afterEach(() => {
  cleanup();
  pathname.mockReturnValue("/");
});

test("nav links to Home, Upload and Ask", () => {
  render(<Nav />);
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "Upload" })).toHaveAttribute("href", "/upload");
  expect(screen.getByRole("link", { name: "Ask" })).toHaveAttribute("href", "/ask");
});

test.each([
  ["/", "Home"],
  ["/upload", "Upload"],
  ["/ask", "Ask"],
])("on %s only %s is the current page", (path, current) => {
  pathname.mockReturnValue(path);
  render(<Nav />);
  for (const name of ["Home", "Upload", "Ask"]) {
    const link = screen.getByRole("link", { name });
    if (name === current) expect(link).toHaveAttribute("aria-current", "page");
    else expect(link).not.toHaveAttribute("aria-current");
  }
});
