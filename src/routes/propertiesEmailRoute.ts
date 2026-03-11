import { Hono } from "hono";
import { sendPropertyEmail } from "../controllers/properties.js";

const propertiesEmailRoute = new Hono();

propertiesEmailRoute.post("/", async (c) => {
  try {
    await sendPropertyEmail(await c.req.json());
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default propertiesEmailRoute;
