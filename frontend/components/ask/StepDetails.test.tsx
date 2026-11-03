import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import StepDetails from "./StepDetails";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const props = {
  onTab: () => undefined,
  states: {},
  played: {},
  answer: null,
  revealed: false,
  answerText: "",
  citations: [],
  words: [],
  scout: null,
  judge: null,
  follow: false,
  privateSent: 0,
  sentPrompt: null,
};

test("selecting the last tab scrolls the tab row sideways to show it", () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}"))));
  const scrollTo = vi.fn();
  Element.prototype.scrollTo = scrollTo;
  // jsdom has no layout: a 200px row holding five 100px tabs.
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
    const tabs = [...(this.parentElement?.children ?? [])];
    return tabs.indexOf(this) * 100;
  });

  const { rerender } = render(<StepDetails {...props} tab="translator" />);
  expect(scrollTo).not.toHaveBeenCalled();
  rerender(<StepDetails {...props} tab="answer" />);
  expect(screen.getByRole("button", { name: "Answer" })).toHaveAttribute("aria-pressed", "true");
  expect(scrollTo).toHaveBeenCalledWith({ left: 300, behavior: "instant" });
});

test("during a second look the panel stays on the working Judge", () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}"))));
  const onTab = vi.fn();
  render(
    <StepDetails
      {...props}
      tab="judge"
      onTab={onTab}
      follow
      played={{ translator: "done", scout: "done", judge: "working" }}
    />,
  );
  expect(onTab).toHaveBeenCalledWith("judge");
  expect(onTab).not.toHaveBeenCalledWith("scout");
});
