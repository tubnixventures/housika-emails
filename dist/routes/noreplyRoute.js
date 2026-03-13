import { Hono } from "hono";
import { sendOtpOrLink } from "../controllers/noreply.js";
const noreplyRoute = new Hono();
noreplyRoute.post("/", async (c) => {
    try {
        const { to, recipientName, otp, link, linkLabel } = await c.req.json();
        await sendOtpOrLink(to, recipientName, otp, link, linkLabel);
        return c.json({ success: true });
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
export default noreplyRoute;
