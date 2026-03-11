// src/routes/adminRoute.ts
import { Hono } from "hono";
import { sendAdminNotification } from "../controllers/admin.js";

const adminRoute = new Hono();

adminRoute.post("/", async (c) => {
  try {
    const { to, recipientName, taskDetails } = await c.req.json();

    // Extract token from Authorization header
    const authHeader = c.req.header("authorization");
    if (!authHeader) {
      return c.json({ error: "Authorization header missing" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    await sendAdminNotification(token, to, recipientName, taskDetails);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default adminRoute;
