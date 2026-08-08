"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * Wraps next-themes so `<html>` gets/loses the `.dark` / `.light` class (see
 * globals.css) based on the user's saved preference. next-themes injects a
 * tiny blocking script before hydration that reads localStorage and sets the
 * class synchronously, so there's no flash of the wrong theme.
 *
 * React 19 flags that inline `<script>` during client render. The script still
 * runs correctly from SSR HTML; this is a known next-themes / React 19 false
 * positive (see pacocoursey/next-themes#387). Suppress only that warning so
 * the Next error overlay doesn't bury real desk failures.
 */
const SCRIPT_TAG_WARNING =
  /Encountered a script tag while rendering React component/i;

let patchedConsoleError = false;

function suppressNextThemesScriptWarning() {
  if (patchedConsoleError || process.env.NODE_ENV !== "development") return;
  if (typeof window === "undefined") return;
  patchedConsoleError = true;
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    const text =
      typeof first === "string"
        ? first
        : first instanceof Error
          ? first.message
          : "";
    if (SCRIPT_TAG_WARNING.test(text)) return;
    original.apply(console, args as Parameters<typeof console.error>);
  };
}

suppressNextThemesScriptWarning();

/** Marketing / auth surfaces — always dark; light theme is desk-only. */
export function isPreloginPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  if (pathname === "/about" || pathname.startsWith("/about/")) return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  return false;
}

type ThemeProviderProps = Omit<
  ComponentProps<typeof NextThemesProvider>,
  "forcedTheme"
>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname();
  const forceDark = isPreloginPath(pathname);

  return (
    <NextThemesProvider
      {...props}
      // Does not write localStorage — desk light preference is preserved.
      forcedTheme={forceDark ? "dark" : undefined}
    >
      {children}
    </NextThemesProvider>
  );
}
