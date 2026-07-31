/**
 * Escape LIKE/GLOB metacharacters so user input is matched literally.
 * Pair with a SQL `ESCAPE '\'` clause when the driver requires it; Drizzle's
 * `like()` on libSQL treats `\` as the default escape in practice for `%`/`_`.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
