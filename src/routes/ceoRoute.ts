// src/routes/ceoRoute.ts
import { Hono } from "hono";
import { extractTokenFromRequest } from "../utils/auth.js";
import { sendCeoMessage } from "../controllers/ceo.js";

const ceoRoute = new Hono();

ceoRoute.post("/", async (c) => {
  try {
    const { to, recipientName, message } = await c.req.json();

    const token = extractTokenFromRequest(c);
    if (!token) {
      return c.json({ error: "Authorization token missing" }, 401);
    }

    await sendCeoMessage(token, to, recipientName, message);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default ceoRoute;
