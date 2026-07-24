"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";

/** Result of a profile update, surfaced inline in the form. */
export type UpdateProfileState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const DISPLAY_NAME_MAX = 60;

// Empty input is allowed and means "reset to the Google name".
const displayNameSchema = z
  .string()
  .max(DISPLAY_NAME_MAX, `Keep it under ${DISPLAY_NAME_MAX} characters.`)
  .transform((value) => value.trim());

/**
 * Updates the current user's display-name override.
 *
 * @param _prev - Previous form state (unused; required by `useActionState`).
 * @param formData - Submitted form data containing `displayName`.
 * @returns The new form state describing success or the validation error.
 * @throws Never - auth and validation failures are returned as error state.
 */
export async function updateDisplayName(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const user = await getCurrentAppUser();
  if (!user) {
    return { status: "error", message: "Your session expired. Sign in again." };
  }

  const parsed = displayNameSchema.safeParse(formData.get("displayName") ?? "");
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid display name.",
    };
  }

  const nextName: string | null = parsed.data.length === 0 ? null : parsed.data;

  await db
    .update(users)
    .set({ displayName: nextName })
    .where(eq(users.id, user.id))
    .run();

  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return {
    status: "success",
    message: nextName ? "Display name updated." : "Reset to your Google name.",
  };
}
