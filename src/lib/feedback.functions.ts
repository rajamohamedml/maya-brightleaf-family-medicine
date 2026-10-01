import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const feedbackSchema = z.object({
  kind: z.enum(["bug", "idea", "general"]),
  name: z
    .string()
    .trim()
    .max(60, "Please keep your name under 60 characters.")
    .transform((v) => (v ? v : null)),
  rating: z.number().int().min(1).max(5).nullable(),
  text: z.string().trim().min(1, "Please write your feedback.").max(1000, "Please keep it under 1,000 characters."),
});

export type FeedbackNote = {
  id: string;
  kind: "bug" | "idea" | "general";
  name: string | null;
  rating: number | null;
  message: string;
  created_at: string;
};

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((d) => feedbackSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("feedback")
      .insert({ kind: data.kind, name: data.name, rating: data.rating, message: data.text });
    if (error) throw new Error("We couldn't save your feedback. Please try again.");
    return { ok: true };
  });

/** Public feedback board for the demo: latest 50 notes, safe fields only. */
export const listFeedback = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("feedback")
    .select("id, kind, name, rating, message, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("We couldn't load feedback.");
  return (data ?? []) as FeedbackNote[];
});
