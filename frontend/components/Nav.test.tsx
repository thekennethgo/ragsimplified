import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import Nav from "./Nav";

test("nav links to the Upload and Ask pages", () => {
  render(<Nav />);
  expect(screen.getByRole("link", { name: "Upload" })).toHaveAttribute("href", "/upload");
  expect(screen.getByRole("link", { name: "Ask" })).toHaveAttribute("href", "/ask");
});
