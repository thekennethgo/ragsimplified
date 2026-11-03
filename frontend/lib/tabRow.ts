/** Scroll a tab row sideways (never the page) so its selected tab is fully inside it. */
export function showSelectedTab(row: HTMLElement | null) {
  const tab = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (!row || !tab) return;
  const end = tab.offsetLeft + tab.offsetWidth;
  if (tab.offsetLeft < row.scrollLeft) row.scrollTo({ left: tab.offsetLeft, behavior: "instant" });
  else if (end > row.scrollLeft + row.clientWidth)
    row.scrollTo({ left: end - row.clientWidth, behavior: "instant" });
}
