/** Mutable view of `process.env` for tests that stub `NODE_ENV` / other keys. */
export function mutableProcessEnv(): Record<string, string | undefined> {
  return process.env as unknown as Record<string, string | undefined>;
}
