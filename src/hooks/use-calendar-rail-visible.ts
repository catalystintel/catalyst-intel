"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  readCalendarRailVisible,
  subscribeCalendarRailVisible,
  writeCalendarRailVisible,
} from "@/lib/desk/calendar-rail-preference";

/**
 * Economic Calendar rail visibility, hydrated from localStorage without a
 * flash of the wrong state (server snapshot = visible default).
 */
export function useCalendarRailVisible() {
  const visible = useSyncExternalStore(
    subscribeCalendarRailVisible,
    readCalendarRailVisible,
    () => true,
  );

  const setVisible = useCallback((next: boolean) => {
    writeCalendarRailVisible(next);
  }, []);

  return { visible, setVisible } as const;
}
