// netlify/functions/cron-ping.ts
import type { Handler } from "@netlify/functions";

export const handler: Handler = async () => {
  // Netlify prod URL (fallback: deploy preview URL)
  const base =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    "https://perdexa.com";

  const secret = process.env.CRON_SECRET!;
  const url = `${base}/api/cron/subscription-sweeper?secret=${encodeURIComponent(
    secret
  )}`;

  try {
    const res = await fetch(url, { method: "GET", headers: { "User-Agent": "netlify-cron" } });
    const text = await res.text();
    return {
      statusCode: 200,
      body: `OK ${res.status}: ${text}`,
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: `ERR: ${err?.message || err}`,
    };
  }
};
