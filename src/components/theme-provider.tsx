"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Wraps next-themes so `<html>` gets/loses the `.dark` class (see globals.css
 * `@custom-variant dark`) based on the user's saved preference. next-themes
 * injects a tiny blocking script before hydration that reads localStorage and
 * sets the class synchronously, so there's no flash of the wrong theme.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
