// src/routes/customerCareRoute.ts
import { Hono } from "hono";
import { extractTokenFromRequest } from "../utils/auth.js";
import { sendCustomerCareResponse } from "../controllers/customerCare.js";
const customerCareRoute = new Hono();
customerCareRoute.post("/", async (c) => {
    try {
        const { to, customerName, issueSummary, agentName } = await c.req.json();
        const token = extractTokenFromRequest(c);
        if (!token) {
            return c.json({ error: "Authorization token missing" }, 401);
        }
        await sendCustomerCareResponse(token, to, customerName, issueSummary, agentName);
        return c.json({ success: true });
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
export default customerCareRoute;
