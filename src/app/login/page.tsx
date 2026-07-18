import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import { signInWithGoogle } from "./actions";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.08 3.56-5.14 3.56-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.92l-3.86-2.98c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.14 7.14 0 0 1 0-4.58V6.62H1.27a11.99 11.99 0 0 0 0 10.76l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.27 6.62l4 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const { error, message, next } = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>
            Access your Catalyst Intel dashboard. Signing in creates your account
            automatically on first use - no password, ever.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!configured ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">Supabase Auth is not configured</p>
              <p className="mt-1 text-destructive/90">
                Put your real project URL and anon key in{" "}
                <code className="text-xs">.env.local</code>, enable Google under
                Authentication → Providers, add{" "}
                <code className="text-xs">http://localhost:3000/auth/callback</code>{" "}
                to Redirect URLs, then restart the dev server.
              </p>
            </div>
          ) : null}

          <form action={signInWithGoogle} className="flex flex-col gap-4">
            <input type="hidden" name="next" value={next ?? "/dashboard"} />
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              variant="outline"
              className="w-full gap-2"
              disabled={!configured}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
