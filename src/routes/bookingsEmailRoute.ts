import { Hono } from "hono";
import { sendBookingEmail } from "../controllers/bookings.js";

const bookingsEmailRoute = new Hono();

bookingsEmailRoute.post("/", async (c) => {
  try {
    await sendBookingEmail(await c.req.json());
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default bookingsEmailRoute;
