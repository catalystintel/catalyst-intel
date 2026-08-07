/**
 * Shared Google OAuth options for Supabase signInWithOAuth.
 *
 * `prompt: "select_account"` forces Google's account chooser so a previously
 * used Google session cannot silently re-auth as the wrong address.
 */
export const GOOGLE_OAUTH_QUERY_PARAMS = {
  prompt: "select_account",
} as const;

export function googleOAuthOptions(redirectTo: string) {
  return {
    redirectTo,
    queryParams: { ...GOOGLE_OAUTH_QUERY_PARAMS },
  };
}
