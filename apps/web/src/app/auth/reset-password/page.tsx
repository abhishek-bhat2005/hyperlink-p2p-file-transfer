"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/lib/services/auth-service";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      router.replace("/dashboard");
    } catch {
      setError("The reset link is invalid or expired. Please request a new one.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background-dark text-white flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md border border-subtle bg-surface p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="mt-2 text-sm text-gray-400">Use at least eight characters.</p>
        </div>
        <label className="block text-sm">
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full bg-background-dark border border-subtle px-4 py-3"
            required
          />
        </label>
        <label className="block text-sm">
          Confirm password
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-2 w-full bg-background-dark border border-subtle px-4 py-3"
            required
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={loading} className="w-full bg-primary text-black font-bold py-3 disabled:opacity-50">
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </main>
  );
}
