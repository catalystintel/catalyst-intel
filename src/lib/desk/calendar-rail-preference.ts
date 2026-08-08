/**
 * Persisted desk preference: Economic Calendar right-rail visibility.
 * Default is visible; `"0"` means the user hid it.
 */
export const CALENDAR_RAIL_VISIBLE_KEY = "ci.desk.calendarRailVisible";

/** Same-tab signal — `storage` only fires across tabs. */
export const CALENDAR_RAIL_CHANGE_EVENT = "ci.desk.calendarRail";

export function readCalendarRailVisible(): boolean {
  try {
    return window.localStorage.getItem(CALENDAR_RAIL_VISIBLE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeCalendarRailVisible(visible: boolean): void {
  try {
    window.localStorage.setItem(CALENDAR_RAIL_VISIBLE_KEY, visible ? "1" : "0");
    window.dispatchEvent(new Event(CALENDAR_RAIL_CHANGE_EVENT));
  } catch {
    /* ignore quota / private mode */
  }
}

export function subscribeCalendarRailVisible(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CALENDAR_RAIL_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CALENDAR_RAIL_CHANGE_EVENT, onChange);
  };
}
