/**
 * Prefer a fallback over blowing the Vercel Hobby function budget.
 * Resolves to `fallback` on timeout **or** rejection so a slow/failing
 * dependency cannot take down the whole RSC render.
 */
export async function withTimeBudget<T>(
  promise: Promise<T>,
  fallback: T,
  budgetMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then(
        (value) => value,
        () => fallback,
      ),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), budgetMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
