/**
 * Prettier config. Formatting options are intentionally left at Prettier's
 * defaults (they already match this codebase's existing style) - only the
 * Tailwind class-sorting plugin is configured.
 *
 * @type {import("prettier").Config}
 */
const config = {
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./src/app/globals.css",
  tailwindFunctions: ["cn", "cva"],
};

export default config;
