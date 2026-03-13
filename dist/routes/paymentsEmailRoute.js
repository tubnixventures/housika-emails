import { Hono } from "hono";
import { sendPaymentEmail } from "../controllers/payments.js";
const paymentsEmailRoute = new Hono();
paymentsEmailRoute.post("/", async (c) => {
    try {
        await sendPaymentEmail(await c.req.json());
        return c.json({ success: true });
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
export default paymentsEmailRoute;
