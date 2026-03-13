import { Hono } from "hono";
import { sendInquiryAutoReply } from "../controllers/inquiry.js";
const inquiryEmailRoute = new Hono();
inquiryEmailRoute.post("/", async (c) => {
    try {
        const { to, recipientName, inquirySubject } = await c.req.json();
        await sendInquiryAutoReply(to, recipientName, inquirySubject);
        return c.json({ success: true });
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
export default inquiryEmailRoute;
