"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

const noopSubscribe = () => () => {};

/**
 * Avoids a hydration mismatch: the server has no access to localStorage, so
 * it always renders the default ("light") segment selected; this reports
 * `false` for that same first client render, then `true` right after, so the
 * real saved value only appears once client and server have agreed once.
 */
function useHasMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Light/dark switch for the Settings page. Persisted via next-themes to
 * localStorage (`ci.theme` - see theme-provider.tsx) and applied instantly
 * by toggling `.dark` on `<html>` (see globals.css `@custom-variant dark`).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-1 rounded-lg border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "btn-press inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--desk-panel)] text-[var(--desk-text)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                : "text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
