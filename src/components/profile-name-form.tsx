"use client";

import { useActionState } from "react";

import {
  updateDisplayName,
  type UpdateProfileState,
} from "@/app/(desk)/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ProfileNameFormProps {
  currentName: string | null;
}

const INITIAL_STATE: UpdateProfileState = { status: "idle" };

/**
 * Inline form for editing the display-name override. Empty submissions reset
 * to the Google name; feedback is shown without a full page reload.
 *
 * @param currentName - The user's currently resolved display name, if any.
 * @returns The editable display-name form.
 */
export function ProfileNameForm({ currentName }: ProfileNameFormProps) {
  const [state, formAction, pending] = useActionState(
    updateDisplayName,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label
        htmlFor="displayName"
        className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase"
      >
        Display name
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="displayName"
          name="displayName"
          defaultValue={currentName ?? ""}
          placeholder="How your name shows across Catalyst Intel"
          maxLength={60}
          className="h-9 max-w-sm"
        />
        <Button type="submit" disabled={pending} className="btn-press">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {state.status !== "idle" ? (
        <p
          className={cn(
            "text-xs",
            state.status === "success"
              ? "text-emerald-400"
              : "text-destructive",
          )}
        >
          {state.message}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Leave blank to use your Google name.
        </p>
      )}
    </form>
  );
}
