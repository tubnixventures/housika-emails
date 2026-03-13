// src/routes/adminRoute.ts
import { Hono } from "hono";
import { extractTokenFromRequest } from "../utils/auth.js";
import { sendAdminNotification } from "../controllers/admin.js";

const adminRoute = new Hono();

adminRoute.post("/", async (c) => {
  try {
    const { to, recipientName, taskDetails } = await c.req.json();

    const token = extractTokenFromRequest(c);
    if (!token) {
      return c.json({ error: "Authorization token missing" }, 401);
    }

    await sendAdminNotification(token, to, recipientName, taskDetails);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default adminRoute;
