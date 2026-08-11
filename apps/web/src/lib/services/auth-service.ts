import { supabase } from "@/lib/supabase/client";
import { logger } from "@repo/utils";

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
    },
  });
  return { data, error };
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

/**
 * Sign in with magic link
 */
export async function signInWithMagicLink(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
    },
  });
  return { data, error };
}

/**
 * Reset password (send email with reset link)
 */
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
  });

  if (error) throw new Error(error.message ?? JSON.stringify(error));
  return { data, error };
}

/** Update the password for a user who arrived through a recovery email. */
export async function updatePassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message ?? JSON.stringify(error));
  return { data, error };
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // A visitor opening the login page normally has no session. Supabase
      // reports that as AuthSessionMissingError; it is not an application error
      // and must not trigger Next.js's development error overlay.
      if (
        error.name === "AuthSessionMissingError" ||
        error.message.toLowerCase().includes("auth session missing")
      ) {
        return null;
      }
      // Log the error but don't throw, allowing the app to treat the user as unauthenticated
      logger.error({ error: error.message }, "Supabase auth error in getCurrentUser");
      return null;
    }
    return user;
  } catch (err) {
    logger.error({ err }, "getCurrentUser unexpected error");
    return null;
  }
}
