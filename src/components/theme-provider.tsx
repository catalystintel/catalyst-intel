"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Wraps next-themes so `<html>` gets/loses the `.dark` class (see globals.css
 * `@custom-variant dark`) based on the user's saved preference. next-themes
 * injects a tiny blocking script before hydration that reads localStorage and
 * sets the class synchronously, so there's no flash of the wrong theme.
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

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
