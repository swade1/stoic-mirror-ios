import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = Deno.env.get("SITE_URL") ?? "https://stoicmirror.com";
const FROM = Deno.env.get("FROM_EMAIL") ?? "The Stoic Mirror <hello@stoicmirror.com>";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let email = "";
  try {
    email = String((await req.json()).email ?? "");
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.rpc("subscribe_email", { p_email: email });
  if (error) {
    return json({ error: error.message === "invalid_email" ? "invalid_email" : "server_error" },
      error.message === "invalid_email" ? 400 : 500);
  }

  const row = Array.isArray(data) ? data[0] : data;

  // Only email on a new or re-activated signup, so repeat submits can't be used to spam an address.
  if (row?.is_new && RESEND_API_KEY) {
    const unsubscribeUrl = `${SITE}/unsubscribe.html?token=${row.unsubscribe_token}`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [email.trim().toLowerCase()],
        subject: "Welcome to The Stoic Mirror",
        text:
          `Thank you for signing up.\n\nWe'll let you know when The Stoic Mirror is ready to download. We never share or sell your address.\n\n— The Stoic Mirror\n\nUnsubscribe anytime: ${unsubscribeUrl}\n`,
        html:
          `<div style="font-family:Georgia,serif;font-size:17px;line-height:1.6;color:#222;max-width:520px">` +
          `<p>Thank you for signing up.</p>` +
          `<p>We'll let you know when <strong>The Stoic Mirror</strong> is ready to download. We never share or sell your address.</p>` +
          `<p>— The Stoic Mirror</p>` +
          `<p style="font-size:13px;color:#777"><a href="${unsubscribeUrl}" style="color:#777">Unsubscribe</a> anytime.</p></div>`,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
      }),
    });
    if (!res.ok) console.error("resend failed", res.status, await res.text());
    else console.log("welcome email sent");
  } else if (row?.is_new) {
    console.warn("welcome email skipped: RESEND_API_KEY is not set");
  }

  // Same response whether or not the address was already subscribed.
  return json({ ok: true });
});
