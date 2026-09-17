import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleListEmails } from './endpoints/list.js';
import { handleGetEmail } from './endpoints/get.js';
import { handleSendEmail } from './endpoints/send.js';
import { handleReplyEmail } from './endpoints/reply.js';
import { handleDeleteEmail } from './endpoints/delete.js';
import { handleIngestEmail } from './endpoints/ingest.js';
import { handleIssueToken, handleGetMe, handleRevokeSession, handleLogout } from './endpoints/auth.js';
import { handleGetDocsHtml, handleGetDocsJson } from './endpoints/docs.js';
import { getR2File, listVirtualR2Items } from './utils/r2.js';
import { listAllCosmosPartitions } from './utils/cosmos.js';

export const app = new Hono();

// Hyperscaler Global Middleware: Security, Tracing, Timing & Caching Control
app.use('*', async (c, next) => {
  const start = performance.now();
  const requestId = c.req.header('x-request-id') || c.req.header('cf-ray') || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Set Request Tracing Headers
  c.header('X-Request-ID', requestId);
  c.header('CF-Ray', `${requestId}-NBO`);

  // Set Hyperscaler Security Headers
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  await next();

  // Compute Latency & Add Server-Timing
  const duration = performance.now() - start;
  c.header('Server-Timing', `edge;dur=${duration.toFixed(2)}, app;dur=${duration.toFixed(2)}`);

  // Hyperscaler Caching Separation:
  // Documentation endpoints get 6-hour caching (21,600s); private mail/auth APIs are strictly non-cacheable
  const path = c.req.path;
  if (path === '/docs' || path.startsWith('/docs/') || path === '/api/docs' || path === '/api/docs/json') {
    c.header('Cache-Control', 'public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=86400');
    c.header('Vary', 'Accept-Encoding');
  } else if (path.startsWith('/api/emails') || path.startsWith('/api/auth')) {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
  }
});

// CORS configuration supporting cookies and headers
app.use('*', cors({
  origin: (origin) => origin || '*',
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'X-CF-Worker-Secret', 'Cookie'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', time: new Date().toISOString(), engine: 'Hono + Cloudflare R2 + Cosmos DB' }));

// Documentation endpoints
app.get('/docs', handleGetDocsHtml);
app.get('/api/docs', handleGetDocsHtml);
app.get('/api/docs/json', handleGetDocsJson);

// Authentication & Identity Endpoints
app.post('/api/auth/token', handleIssueToken);
app.get('/api/auth/me', handleGetMe);
app.post('/api/auth/revoke', handleRevokeSession);
app.post('/api/auth/logout', handleLogout);

// Email Operations
app.get('/api/emails/list', handleListEmails);
app.get('/api/emails/get', handleGetEmail);
app.post('/api/emails/send', handleSendEmail);
app.post('/api/emails/reply', handleReplyEmail);
app.delete('/api/emails/delete', handleDeleteEmail);

// Inbound Cloudflare Email Routing Webhook
app.post('/api/emails/ingest', handleIngestEmail);

// Direct R2 Attachment Download Proxy / Presigned Redirect
app.get('/api/emails/attachments/download', async (c) => {
  const key = c.req.query('key');
  if (!key) return c.text('Missing key parameter', 400);

  const file = await getR2File(key);
  if (!file) return c.text('Attachment not found in R2 storage', 404);

  return new Response(file.buffer, {
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.filename)}"`
    }
  });
});

// Diagnostic & Infrastructure Monitoring
app.get('/api/cosmos/stats', async (c) => {
  const partitions = await listAllCosmosPartitions();
  return c.json({
    database: 'emails',
    container: 'emails',
    partitionKey: '/pk',
    partitionsCount: partitions.length,
    partitions
  });
});

app.get('/api/r2/items', async (c) => {
  const items = await listVirtualR2Items();
  return c.json({
    bucket: process.env.R2_BUCKET_NAME || 'housika-email-attachments',
    count: items.length,
    items
  });
});

export default app;
