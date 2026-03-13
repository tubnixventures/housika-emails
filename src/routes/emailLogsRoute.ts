// src/routes/emailLogsRoute.ts
import { Hono } from "hono";
import { extractTokenFromRequest } from "../utils/auth.js";
import { listEmailLogs } from "../controllers/emailLogs.js";

const emailLogsRoute = new Hono();

emailLogsRoute.get("/", async (c) => {
  try {
    const pageParam = c.req.query("page");
    const perPageParam = c.req.query("perPage") || c.req.query("per_page");
    const senderRole = c.req.query("senderRole") || c.req.query("sender_role");
    const recipientEmail = c.req.query("recipientEmail") || c.req.query("recipient_email");

    const page = pageParam ? parseInt(pageParam, 10) : undefined;
    const perPage = perPageParam ? parseInt(perPageParam, 10) : undefined;

    const token = extractTokenFromRequest(c);
    if (!token) {
      return c.json({ error: "Authorization token missing" }, 401);
    }

    const logs = await listEmailLogs(token, { page, perPage, senderRole, recipientEmail });
    return c.json(logs);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default emailLogsRoute;
