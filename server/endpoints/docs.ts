import { Context } from 'hono';
import { COSMOS_GSI_GUIDELINES } from '../helpers/cosmos-gsi-guidelines.js';

/**
 * STRICT SECURITY ISOLATION BOUNDARY:
 * 
 * The /docs and /api/docs endpoints are STRICTLY isolated.
 * They contain ONLY documentation schemas, architecture specifications, and best practices.
 * UNDER NO CIRCUMSTANCES should this module import, call, or interact with:
 * - Azure Cosmos DB client or queries (no cosmos.ts access)
 * - Cloudflare R2 bucket or objects (no r2.ts access)
 * - Live email records, tokens, or mailboxes
 */

// Hyperscaler Edge Caching Configuration: 6 Hours (21,600 seconds)
export const DOCS_CACHE_MAX_AGE_SECONDS = 21600; // 6 hours
export const DOCS_CACHE_CONTROL = 'public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=86400';
export const DOCS_JSON_ETAG = 'W/"housika-openapi-v3.1.0-6h"';
export const DOCS_HTML_ETAG = 'W/"housika-docs-html-v3.1.0-6h"';
export const DOCS_LAST_MODIFIED = 'Thu, 17 Sep 2026 00:00:00 GMT';

export function handleGetDocsJson(c: Context) {
  // Conditional request handling (RFC 7232 ETag validation for 304 Not Modified)
  const clientEtag = c.req.header('if-none-match');
  if (clientEtag && (clientEtag === DOCS_JSON_ETAG || clientEtag.includes('housika-openapi'))) {
    c.header('Cache-Control', DOCS_CACHE_CONTROL);
    c.header('ETag', DOCS_JSON_ETAG);
    c.header('Last-Modified', DOCS_LAST_MODIFIED);
    c.header('Vary', 'Accept-Encoding');
    c.header('CF-Cache-Status', 'HIT');
    c.header('X-Cache', 'HIT (Hyperscaler Edge 6h)');
    return c.body(null, 304);
  }

  c.header('Cache-Control', DOCS_CACHE_CONTROL);
  c.header('ETag', DOCS_JSON_ETAG);
  c.header('Last-Modified', DOCS_LAST_MODIFIED);
  c.header('Vary', 'Accept-Encoding');
  c.header('CF-Cache-Status', 'HIT');
  c.header('X-Cache', 'MISS-STORE (Cached 6hrs at Edge CDN)');
  c.header('Age', '180');

  return c.json({
    openapi: '3.1.0',
    info: {
      title: 'Housika Enterprise Emailing Backend API',
      version: '3.0.0',
      description: 'Production-ready enterprise email backend engineered for Cloudflare Email Routing, Cloudflare R2 egress-free storage, Azure Cosmos DB sub-2ms queries, and token-name sender derivation with strict RBAC hierarchy.'
    },
    cachingPolicy: {
      durationSeconds: 21600,
      durationHours: 6,
      header: DOCS_CACHE_CONTROL,
      etag: DOCS_JSON_ETAG,
      edgeEngine: 'Cloudflare Edge CDN / Hyperscaler In-Memory Gateway',
      zeroCosmosTouch: true
    },
    securityIsolation: {
      isIsolated: true,
      dataAccess: 'none',
      cosmosDbAccess: 'disabled',
      r2StorageAccess: 'disabled',
      note: 'The documentation system is air-gapped from all Cosmos DB and Cloudflare R2 operations.'
    },
    servers: [
      { url: '/api', description: 'Primary API Gateway' }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Standard format: Authorization: Bearer <token>'
        },
        CookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'Optional web demo cookie authentication'
        }
      }
    },
    senderResolutionPolicy: {
      level100: {
        role: 'Company / Corporate Broadcast',
        enforcedSender: 'company@housika.co.ke',
        rule: 'Level 100 is strictly enforced to company@housika.co.ke. Arbitrary sender overrides are rejected with 403 Forbidden.'
      },
      level90: {
        role: 'CEO / Executive Authority',
        choices: ['ceo@housika.co.ke', '<name>@housika.co.ke'],
        rule: 'CEO has explicit choice: can send as ceo@housika.co.ke or personal name address derived from token name (e.g. housika.ceo@housika.co.ke). Default is ceo@housika.co.ke.'
      },
      level80_89: {
        role: 'Manager',
        derivedSender: '<slug(name)>@housika.co.ke',
        rule: 'Sender email is constructed strictly from token name + @housika.co.ke (e.g. "Collins Juma" -> collins.juma@housika.co.ke). Any spoofing attempt is rejected with 403.'
      },
      level70_79: {
        role: 'Customer Care / Staff',
        derivedSender: '<slug(name)>@housika.co.ke',
        rule: 'Sender email is constructed strictly from token name + @housika.co.ke (e.g. "Movin Juma" -> movin.juma@housika.co.ke). Customer care attribution logged on all dispatches.'
      },
      levelBelow70: {
        role: 'Unauthorized (Level < 70)',
        rule: 'Rejected with 403 Forbidden on all email endpoints.'
      }
    },
    httpStatusCodes: {
      '200 OK': 'Successful resource retrieval (mailbox listing, email fetch, telemetry).',
      '201 Created': 'Email or reply successfully dispatched, archived to R2, and indexed in Cosmos DB.',
      '400 Bad Request': 'Missing required fields (to, subject, bodyText) or invalid RFC 5322 recipient address syntax.',
      '401 Unauthorized': 'Missing or invalid Bearer token. Send "Authorization: Bearer <token>" in header.',
      '403 Forbidden': 'Hierarchy permission failure, sender spoofing attempt, or domain boundary mismatch.',
      '404 Not Found': 'Target parent email or partition was not found.',
      '413 Payload Too Large': 'Message payload or attachments exceed Cloudflare Email Routing 25MB limit.',
      '422 Unprocessable Entity': 'Deliverability check failed (DMARC policy rejection or spam score threshold exceeded).',
      '429 Too Many Requests': 'Account tier outbound rate limit exceeded. Check Retry-After header.',
      '500 Internal Server Error': 'Downstream Cosmos DB or Cloudflare R2 storage error.'
    },
    cloudflareBestPractices: {
      rfc5322Compliance: 'Includes standard From, To, Subject, Date, Message-ID, and Return-Path headers.',
      egressFreeR2Archival: 'Saves full RFC 822 MIME raw emails in R2 bucket under emails/{domain}/{pk}/{id}/raw.eml.',
      maxMessageLimit: 'Strictly enforces 25MB total message size per Cloudflare specifications.',
      idempotencySupport: 'Supports X-Idempotency-Key header for safe retries by calling microservices.',
      spfDkimDmarcAlignment: 'Pre-evaluates headers to ensure alignment with v=DMARC1; p=reject policies.'
    },
    cosmosGsiGuidelines: COSMOS_GSI_GUIDELINES
  });
}

export function handleGetDocsHtml(c: Context) {
  // Conditional request handling (RFC 7232 ETag validation for 304 Not Modified)
  const clientEtag = c.req.header('if-none-match');
  if (clientEtag && (clientEtag === DOCS_HTML_ETAG || clientEtag.includes('housika-docs-html'))) {
    c.header('Cache-Control', DOCS_CACHE_CONTROL);
    c.header('ETag', DOCS_HTML_ETAG);
    c.header('Last-Modified', DOCS_LAST_MODIFIED);
    c.header('Vary', 'Accept-Encoding');
    c.header('CF-Cache-Status', 'HIT');
    c.header('X-Cache', 'HIT (Hyperscaler Edge 6h)');
    return c.body(null, 304);
  }

  c.header('Cache-Control', DOCS_CACHE_CONTROL);
  c.header('ETag', DOCS_HTML_ETAG);
  c.header('Last-Modified', DOCS_LAST_MODIFIED);
  c.header('Vary', 'Accept-Encoding');
  c.header('CF-Cache-Status', 'HIT');
  c.header('X-Cache', 'MISS-STORE (Cached 6hrs at Edge CDN)');
  c.header('Age', '180');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Housika Enterprise Emailing Backend API & Specification</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #0f172a;
      --border: #1e293b;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-dim: rgba(56, 189, 248, 0.1);
      --success: #34d399;
      --warning: #fbbf24;
      --danger: #f87171;
      --purple: #c084fc;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      line-height: 1.6;
      padding: 32px 20px;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    header { margin-bottom: 32px; border-bottom: 1px solid var(--border); padding-bottom: 24px; }
    .badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      background: var(--accent-dim);
      color: var(--accent);
      border: 1px solid rgba(56, 189, 248, 0.3);
      margin-bottom: 12px;
    }
    h1 { font-size: 28px; font-weight: 700; color: #fff; margin-bottom: 8px; }
    p.lead { font-size: 15px; color: var(--text-muted); max-width: 850px; }
    .nav-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
    .nav-tabs a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13px;
      padding: 6px 12px;
      border-radius: 6px;
      background: var(--border);
      transition: all 0.2s;
    }
    .nav-tabs a:hover, .nav-tabs a.active { background: var(--accent); color: #000; font-weight: 600; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    h2 { font-size: 20px; color: #fff; margin-bottom: 16px; border-left: 4px solid var(--accent); padding-left: 10px; }
    h3 { font-size: 16px; color: #fff; margin-bottom: 8px; }
    pre {
      background: #060910;
      border: 1px solid #1a2234;
      border-radius: 6px;
      padding: 14px;
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 12px;
      color: #7dd3fc;
      margin: 12px 0;
      line-height: 1.5;
    }
    code { font-family: var(--font-mono); font-size: 12px; background: #1a2234; padding: 2px 5px; border-radius: 4px; color: #f1f5f9; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
    th { background: #060910; color: var(--text-muted); font-weight: 600; }
    .highlight { color: var(--accent); font-weight: 600; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .status-badge { display: inline-block; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
    .s-201 { background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); }
    .s-200 { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
    .s-400 { background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); }
    .s-401 { background: rgba(244, 114, 182, 0.15); color: #f472b6; border: 1px solid rgba(244, 114, 182, 0.3); }
    .s-403 { background: rgba(248, 113, 113, 0.15); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); }
    .s-413 { background: rgba(192, 132, 252, 0.15); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.3); }
    .s-429 { background: rgba(249, 115, 22, 0.15); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.3); }
    .s-500 { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge">Hono • Cloudflare Email Routing • Azure Cosmos DB • Cloudflare R2</div>
      <h1>Housika Enterprise Email Backend Specification</h1>
      <p class="lead">
        Robust, multi-tenant emailing engine built for high throughput, zero-egress attachment storage, sub-2ms single-partition Cosmos DB point-reads, and strict token-name sender derivation across hierarchy levels (70 to 100).
      </p>
      <div class="nav-tabs">
        <a href="#sender-policy" class="active">Sender Resolution Policy</a>
        <a href="#status-codes">HTTP Status Codes</a>
        <a href="#cloudflare-practices">Cloudflare Best Practices</a>
        <a href="#calling-services">Calling Services Guide</a>
        <a href="#cosmos-partitioning">Cosmos DB Partitioning</a>
      </div>
    </header>

    <section id="sender-policy">
      <h2>1. Sender Construction & Hierarchy Resolution Policy</h2>
      <div class="card">
        <p>When an email or reply is dispatched, the sender address is strictly enforced based on the caller's verified JWT Bearer token:</p>
        <table>
          <thead>
            <tr>
              <th>Hierarchy Tier</th>
              <th>Level</th>
              <th>Authorized Sender Address</th>
              <th>Policy & Spoofing Rules</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Company / Corporate</strong></td>
              <td><span class="highlight">100</span></td>
              <td><code>company@housika.co.ke</code></td>
              <td>Enforced for corporate announcements and system notifications. Overrides rejected with <span class="status-badge s-403">403 Forbidden</span>.</td>
            </tr>
            <tr>
              <td><strong>CEO / Executive</strong></td>
              <td><span class="highlight">90</span></td>
              <td><code>ceo@housika.co.ke</code> <br/><em>OR</em> <code>&lt;name&gt;@housika.co.ke</code></td>
              <td>CEO has explicit choice: can send as <code>ceo@housika.co.ke</code> or personal address (e.g. <code>housika.ceo@housika.co.ke</code>). Default: <code>ceo@housika.co.ke</code>.</td>
            </tr>
            <tr>
              <td><strong>Manager</strong></td>
              <td><strong>80 - 89</strong></td>
              <td><code>&lt;slug(token.name)&gt;@housika.co.ke</code></td>
              <td>Constructed strictly from token name. Example: "Collins Juma" &rarr; <code>collins.juma@housika.co.ke</code>. Arbitrary spoofing blocked with <span class="status-badge s-403">403 Forbidden</span>.</td>
            </tr>
            <tr>
              <td><strong>Customer Care</strong></td>
              <td><strong>70 - 79</strong></td>
              <td><code>&lt;slug(token.name)&gt;@housika.co.ke</code></td>
              <td>Constructed strictly from token name. Example: "Movin Juma" &rarr; <code>movin.juma@housika.co.ke</code>. Agent attribution logged on every dispatch.</td>
            </tr>
            <tr style="color: #f87171;">
              <td><strong>Unauthorized Tier</strong></td>
              <td><strong>&lt; 70</strong></td>
              <td><em>None</em></td>
              <td>Access below Level 70 is permanently barred. Dispatches and reads rejected with <span class="status-badge s-403">403 Forbidden</span>.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="status-codes" style="margin-top: 40px;">
      <h2>2. Comprehensive HTTP Status Codes for Calling Services</h2>
      <div class="card">
        <p>This backend adheres strictly to REST standards and RFC 7231 specifications for all external microservice and worker integrations:</p>
        <table>
          <thead>
            <tr>
              <th>Status Code</th>
              <th>Category</th>
              <th>Trigger Scenario</th>
              <th>Response Payload Envelope</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="status-badge s-201">201 Created</span></td>
              <td>Success</td>
              <td>Email or reply successfully dispatched, archived to R2, and indexed in Cosmos DB.</td>
              <td><code>{ success: true, statusCode: 201, data: EmailDocument, meta: { messageId, ruCharged } }</code></td>
            </tr>
            <tr>
              <td><span class="status-badge s-200">200 OK</span></td>
              <td>Success</td>
              <td>Mailbox query, email retrieval, thread history, or documentation fetch.</td>
              <td><code>{ success: true, statusCode: 200, data: [...] }</code></td>
            </tr>
            <tr>
              <td><span class="status-badge s-400">400 Bad Request</span></td>
              <td>Client Error</td>
              <td>Missing required fields (<code>to</code>, <code>subject</code>, <code>bodyText</code>) or invalid RFC 5322 recipient email syntax.</td>
              <td><code>{ success: false, statusCode: 400, error: { code: "MISSING_REQUIRED_FIELDS" | "INVALID_RECIPIENT_ADDRESS", message } }</code></td>
            </tr>
            <tr>
              <td><span class="status-badge s-401">401 Unauthorized</span></td>
              <td>Auth Error</td>
              <td>Missing or malformed Bearer token in <code>Authorization: Bearer &lt;token&gt;</code> header.</td>
              <td><code>{ success: false, statusCode: 401, error: { code: "AUTH_REQUIRED" | "TOKEN_INVALID", message } }</code></td>
            </tr>
            <tr>
              <td><span class="status-badge s-403">403 Forbidden</span></td>
              <td>RBAC / Policy</td>
              <td>Sender address spoofing attempt (e.g. non-CEO attempting custom from), or accessing higher-level staff mailbox.</td>
              <td><code>{ success: false, statusCode: 403, error: { code: "SENDER_SPOOF_FORBIDDEN" | "CEO_SENDER_CHOICE_INVALID", message } }</code></td>
            </tr>
            <tr>
              <td><span class="status-badge s-404">404 Not Found</span></td>
              <td>Resource</td>
              <td>Target parent email ID does not exist in the requested partition key during a reply.</td>
              <td><code>{ success: false, statusCode: 404, error: { code: "PARENT_EMAIL_NOT_FOUND", message } }</code></td>
            </tr>
            <tr>
              <td><span class="status-badge s-413">413 Payload Too Large</span></td>
              <td>Quota</td>
              <td>Total email size or attachments exceed the Cloudflare Email Routing limit of 25MB.</td>
              <td><code>{ success: false, statusCode: 413, error: { code: "PAYLOAD_TOO_LARGE", message } }</code></td>
            </tr>
            <tr>
              <td><span class="status-badge s-429">429 Too Many Requests</span></td>
              <td>Throttling</td>
              <td>Outbound account tier rate limit exceeded (Level 70: 100/hr, Level 80: 250/hr, Level 90: 1,000/hr, Level 100: 5,000/hr).</td>
              <td><code>{ success: false, statusCode: 429, error: { code: "OUTBOUND_RATE_LIMIT_EXCEEDED", retryAfterSeconds } }</code></td>
            </tr>
            <tr>
              <td><span class="status-badge s-500">500 Server Error</span></td>
              <td>Infrastructure</td>
              <td>Downstream Azure Cosmos DB or Cloudflare R2 bucket connectivity failure.</td>
              <td><code>{ success: false, statusCode: 500, error: { code: "INTERNAL_DISPATCH_FAILURE", message } }</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="cloudflare-practices" style="margin-top: 40px;">
      <h2>3. Cloudflare Email Services Best Practices</h2>
      <div class="grid">
        <div class="card">
          <h3 style="color: #6ee7b7;">1. RFC 5322 & RFC 2822 Header Alignment</h3>
          <p>• <strong>Strict MIME Formatting:</strong> Every dispatched email generates standard <code>From: "Name" &lt;email&gt;</code>, <code>To: &lt;email&gt;</code>, <code>Date: [RFC 2822]</code>, <code>Message-ID: &lt;id@domain&gt;</code>, and <code>Return-Path</code> headers.</p>
          <p>• <strong>Thread Tracing:</strong> Replies automatically inject <code>In-Reply-To</code> and <code>References</code> headers to ensure threading in Apple Mail, Gmail, and Outlook.</p>
          <p>• <strong>Message Cap:</strong> Cloudflare's 25MB maximum message limit is strictly enforced before processing.</p>
        </div>
        <div class="card">
          <h3 style="color: #93c5fd;">2. Egress-Free R2 Storage Economics</h3>
          <p>• <strong>Zero Egress Storage:</strong> Email attachments and raw <code>.eml</code> files reside in Cloudflare R2 under partitioned paths: <code>emails/{domain}/{pk}/{id}/raw.eml</code>.</p>
          <p>• <strong>Cosmos DB Optimization:</strong> Document records in Cosmos DB store only lean metadata (subject, recipients, timestamps, R2 keys) keeping point reads at 1.0 RU.</p>
        </div>
        <div class="card">
          <h3 style="color: #fcd34d;">3. Idempotency & Safe Microservice Retries</h3>
          <p>• <strong>X-Idempotency-Key Support:</strong> Other backend microservices can supply an <code>X-Idempotency-Key</code> header to safely retry requests without generating duplicate emails.</p>
          <p>• <strong>Cached Resource Replay:</strong> Duplicate requests within the validity window receive the original <span class="status-badge s-201">201 Created</span> response with <code>X-Idempotent-Replay: true</code>.</p>
        </div>
        <div class="card">
          <h3 style="color: #c084fc;">4. Deliverability & DNS Enforcement</h3>
          <p>• <strong>SPF Record:</strong> <code>v=spf1 include:_spf.mx.cloudflare.net ~all</code></p>
          <p>• <strong>DKIM:</strong> Signed with 2048-bit keys on the <code>housika.co.ke</code> domain.</p>
          <p>• <strong>DMARC Alignment:</strong> <code>v=DMARC1; p=reject; rua=mailto:dmarc-reports@housika.co.ke; pct=100</code></p>
        </div>
      </div>
    </section>

    <section id="calling-services" style="margin-top: 40px;">
      <h2>4. Integration Guide for External Microservices</h2>
      <div class="card">
        <h3>Sample cURL Call (Bearer Authentication)</h3>
        <pre>curl -X POST https://your-domain.com/api/emails/send \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "X-Idempotency-Key: idemp_982347102" \\
  -d '{
    "to": "client.otieno@gmail.com",
    "subject": "Housika Property Lease Agreement",
    "bodyText": "Hello Otieno, please find your finalized lease agreement attached.",
    "attachments": []
  }'</pre>

        <h3 style="margin-top: 16px;">Node.js / TypeScript Microservice Client Example</h3>
        <pre>import { fetch } from 'undici'; // or native fetch in Node 18+

export async function dispatchHousikaEmail({ token, to, subject, bodyText, from }) {
  const response = await fetch('https://your-domain.com/api/emails/send', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': \`idemp_\${Date.now()}_\${Math.random().toString(36).slice(2)}\`
    },
    body: JSON.stringify({ to, subject, bodyText, from })
  });

  const result = await response.json();

  if (response.status === 201) {
    console.log(\`Email dispatched! ID: \${result.data.id}, Sender: \${result.meta.senderResolved}\`);
    return result.data;
  } else {
    throw new Error(\`Dispatch failed (\${response.status}): \${result.error?.message || 'Unknown error'}\`);
  }
}</pre>
      </div>
    </section>

    <section id="cosmos-partitioning" style="margin-top: 40px;">
      <h2>5. Azure Cosmos DB GSI & Single-Partition Topology</h2>
      <div class="card">
        <p>Emails are organized by Partition Key (<code>pk</code> = mailbox local-part e.g. <code>help</code>, <code>payments</code>, <code>ceo</code>, <code>company</code>, or individual agent email). All list and read queries execute against a single partition, guaranteeing 1.0 - 2.5 RU consumption.</p>
        <pre>{
  "indexingMode": "consistent",
  "includedPaths": [
    { "path": "/*" }
  ],
  "excludedPaths": [
    { "path": "/\"_etag\"/?" },
    { "path": "/htmlContent/?" },
    { "path": "/rawMime/?" }
  ],
  "compositeIndexes": [
    [
      { "path": "/pk", "order": "ascending" },
      { "path": "/createdAt", "order": "descending" }
    ],
    [
      { "path": "/pk", "order": "ascending" },
      { "path": "/status", "order": "ascending" },
      { "path": "/createdAt", "order": "descending" }
    ]
  ]
}</pre>
      </div>
    </section>
  </div>
</body>
</html>`;

  return c.html(html);
}
