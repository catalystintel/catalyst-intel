import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CALENDAR_RAIL_CHANGE_EVENT,
  CALENDAR_RAIL_VISIBLE_KEY,
  readCalendarRailVisible,
  writeCalendarRailVisible,
} from "@/lib/desk/calendar-rail-preference";

function installMemoryWindow() {
  const store = new Map<string, string>();
  const listeners = new Map<string, Set<EventListener>>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  const windowMock = {
    localStorage,
    addEventListener: (type: string, listener: EventListener) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent: (event: Event) => {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event);
      }
      return true;
    },
  };
  vi.stubGlobal("window", windowMock);
  return { localStorage, windowMock };
}

describe("calendar-rail-preference", () => {
  beforeEach(() => {
    installMemoryWindow();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to visible when unset", () => {
    expect(readCalendarRailVisible()).toBe(true);
  });

  it("treats stored 0 as hidden and 1 as visible", () => {
    window.localStorage.setItem(CALENDAR_RAIL_VISIBLE_KEY, "0");
    expect(readCalendarRailVisible()).toBe(false);
    window.localStorage.setItem(CALENDAR_RAIL_VISIBLE_KEY, "1");
    expect(readCalendarRailVisible()).toBe(true);
  });

  it("persists and dispatches a same-tab change event", () => {
    const spy = vi.fn();
    window.addEventListener(CALENDAR_RAIL_CHANGE_EVENT, spy);
    writeCalendarRailVisible(false);
    expect(window.localStorage.getItem(CALENDAR_RAIL_VISIBLE_KEY)).toBe("0");
    expect(readCalendarRailVisible()).toBe(false);
    writeCalendarRailVisible(true);
    expect(window.localStorage.getItem(CALENDAR_RAIL_VISIBLE_KEY)).toBe("1");
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
