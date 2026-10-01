import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Header } from "@/components/maya/Header";
import { Footer } from "@/components/maya/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { staffAccessQuery } from "@/lib/staff-access";

export const Route = createFileRoute("/clinic/login")({
  head: () => ({
    meta: [
      { title: "Staff sign in — Brightleaf" },
      { name: "description", content: "Sign in to the Brightleaf staff area." },
      { property: "og:title", content: "Staff sign in — Brightleaf" },
      { property: "og:description", content: "Sign in to the Brightleaf staff area." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      return setError("That email or password didn't work. Check them and try again.");
    }
    // Resolve the staff role before leaving, so /clinic renders its final state immediately.
    try {
      qc.removeQueries({ queryKey: staffAccessQuery.queryKey });
      await qc.fetchQuery(staffAccessQuery);
    } catch {
      /* the layout will retry the check */
    }
    navigate({ to: "/clinic", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
        <h1 className="text-2xl font-semibold">Staff sign in</h1>
        <p className="mt-1 text-muted-foreground">For Dr. Rahman and the front desk.</p>
        <form onSubmit={submit} className="surface-tile mt-6 space-y-4 rounded-xl border border-border p-5" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" className="min-h-11" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" className="min-h-11" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && (
            <p role="alert" className="popup-alert p-3 text-sm">
              {error}
            </p>
          )}
          <Button type="submit" className="min-h-11 w-full" disabled={busy || !email || !password}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Sign in
          </Button>
        </form>
        <button
          type="button"
          onClick={() => {
            setEmail("demo@brightleaf.health");
            setPassword("BrightleafDemo2026!");
            setError("");
          }}
          className="mt-4 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Click here for Judges demo login
        </button>
      </main>
      <Footer />
    </div>
  );
}
