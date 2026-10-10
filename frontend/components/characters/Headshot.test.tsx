import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import Headshot from "./Headshot";

afterEach(() => {
  cleanup();
  document.body.querySelectorAll("[data-room]").forEach((n) => n.remove());
});

function addRoom() {
  const room = document.createElement("div");
  room.setAttribute("data-room", "/office/x.svg");
  room.innerHTML = '<svg><g id="ch-flip"><circle id="inner"/></g></svg>';
  document.body.appendChild(room);
}

test("clones the character from the room art, with no ids", () => {
  addRoom();
  const { container } = render(<Headshot room="/office/x.svg" part="ch" name="Chopper" />);
  const svg = container.querySelector("svg")!;
  expect(svg.querySelector("circle")).not.toBeNull();
  expect(svg.querySelectorAll("[id]")).toHaveLength(0);
  expect(document.querySelectorAll("#inner")).toHaveLength(1);
});

test("shows the initial until the room is ready, then clones", () => {
  const { container, getByText } = render(
    <Headshot room="/office/x.svg" part="ch" name="Chopper" />,
  );
  expect(getByText("C")).toBeInTheDocument();
  expect(container.querySelector("circle")).toBeNull();
  addRoom();
  act(() => {
    window.dispatchEvent(new CustomEvent("office-ready", { detail: "/office/x.svg" }));
  });
  expect(container.querySelector("circle")).not.toBeNull();
});
