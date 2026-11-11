import { createClient } from "npm:@supabase/supabase-js@2";
import {
  BURST_WINDOW_SECONDS,
  buildUserMessage,
  decideLimit,
  embeddingInput,
  parseCounsel,
  SYSTEM_PROMPT,
  validateConcern,
  type Passage,
} from "./counsel.ts";

// Secrets (set in the Supabase dashboard → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY, VOYAGE_API_KEY
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const VOYAGE_API_KEY = Deno.env.get("VOYAGE_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const fail = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  json({ error, ...extra }, status);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  if (!ANTHROPIC_API_KEY || !VOYAGE_API_KEY) {
    console.error("seek-counsel: missing ANTHROPIC_API_KEY or VOYAGE_API_KEY secret");
    return fail("not_configured", 500);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Who is asking? verify_jwt already rejects bad tokens; this resolves the id.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return fail("unauthorized", 401);
  const userId = auth.user.id;

  let concern: string | null = null;
  try {
    concern = validateConcern((await req.json()).concern);
  } catch {
    concern = null;
  }
  if (!concern) return fail("invalid_request", 400);

  // Rate limits, checked before any paid call so a refused request costs nothing.
  const now = Date.now();
  const since = (seconds: number) => new Date(now - seconds * 1000).toISOString();
  const countSince = async (iso: string) => {
    const { count, error } = await supabase
      .from("counsel_requests")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", iso);
    if (error) throw error;
    return count ?? 0;
  };

  try {
    const [lastMinute, lastDay] = await Promise.all([
      countSince(since(BURST_WINDOW_SECONDS)),
      countSince(since(24 * 60 * 60)),
    ]);
    const decision = decideLimit(lastMinute, lastDay);
    if (decision !== "ok") return fail("rate_limited", 429, { reason: decision });

    await supabase.from("counsel_requests").insert({ user_id: userId });

    const [{ data: profile }, { data: shown }] = await Promise.all([
      supabase.from("profiles").select("concerns").eq("id", userId).single(),
      supabase
        .from("entry_quotes")
        .select("passage_id")
        .eq("user_id", userId)
        .not("passage_id", "is", null),
    ]);
    const userConcerns: string[] = profile?.concerns ?? [];
    const excludeIds: string[] = [
      ...new Set((shown ?? []).map((r) => r.passage_id as string)),
    ];

    // 1. Embed the concern
    const embedRes = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "voyage-4",
        input: [embeddingInput(concern)],
        output_dimension: 1024,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!embedRes.ok) {
      console.error("voyage failed", embedRes.status, await embedRes.text());
      return fail("upstream", 502);
    }
    const embedding = (await embedRes.json()).data[0].embedding;

    // 2. Retrieve candidate passages
    const { data: passages, error: matchError } = await supabase.rpc(
      "match_stoic_passages",
      {
        query_embedding: embedding,
        match_count: 10,
        match_threshold: 0.1,
        exclude_ids: excludeIds,
        boost_concerns: userConcerns,
      },
    );
    if (matchError) {
      console.error("match_stoic_passages failed", matchError);
      return fail("upstream", 502);
    }
    if (!passages || passages.length === 0) return fail("no_passages", 404);

    // 3. Ask Claude to select and interpret
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildUserMessage(concern, passages as Passage[], userConcerns),
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!claudeRes.ok) {
      console.error("claude failed", claudeRes.status, await claudeRes.text());
      return fail("upstream", 502);
    }
    const content = (await claudeRes.json()).content?.find(
      (b: { type: string }) => b.type === "text",
    )?.text;
    if (!content) return fail("upstream", 502);

    return json(parseCounsel(content, passages as Passage[], userConcerns));
  } catch (err) {
    console.error("seek-counsel error", err);
    return fail("upstream", 502);
  }
});
