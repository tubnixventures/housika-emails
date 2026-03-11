// src/routes/ceoRoute.ts
import { Hono } from "hono";
import { sendCeoMessage } from "../controllers/ceo.js";

const ceoRoute = new Hono();

ceoRoute.post("/", async (c) => {
  try {
    const { to, recipientName, message } = await c.req.json();

    // Extract token from Authorization header
    const authHeader = c.req.header("authorization");
    if (!authHeader) {
      return c.json({ error: "Authorization header missing" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    await sendCeoMessage(token, to, recipientName, message);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default ceoRoute;
