/**
 * Cloudflare Worker Entry Point
 * 
 * Direct deployment for Cloudflare Workers:
 * - Handles HTTP requests via Hono (fetch)
 * - Handles Inbound Cloudflare Email Routing events (email handler)
 */

import { app } from './index.js';

export default {
  // 1. Standard Hono HTTP request handler
  fetch: app.fetch,

  // 2. Cloudflare Inbound Email Routing Handler
  async email(message: any, env: any, ctx: any) {
    try {
      const rawStream = await new Response(message.raw).text();
      const headers = Object.fromEntries(message.headers.entries());

      // Route through Hono app ingestion logic
      const response = await app.request('/api/emails/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CF-Worker-Secret': env.CF_EMAIL_WORKER_SECRET || 'cf_webhook_secret_key_housika_2026'
        },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          headers,
          rawMime: rawStream,
          spf: headers['received-spf'] || 'none',
          dkim: headers['dkim-signature'] ? 'pass' : 'none'
        })
      });

      if (!response.ok) {
        console.error(`Email ingestion failed with status: ${response.status}`);
      }
    } catch (err: any) {
      console.error(`Email worker error:`, err);
    }
  }
};
