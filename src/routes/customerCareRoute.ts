// src/routes/customerCareRoute.ts
import { Hono } from "hono";
import { sendCustomerCareResponse } from "../controllers/customerCare.js";

const customerCareRoute = new Hono();

customerCareRoute.post("/", async (c) => {
  try {
    const { to, customerName, issueSummary, agentName } = await c.req.json();

    // Extract token from Authorization header
    const authHeader = c.req.header("authorization");
    if (!authHeader) {
      return c.json({ error: "Authorization header missing" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    await sendCustomerCareResponse(token, to, customerName, issueSummary, agentName);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default customerCareRoute;
