import { Hono } from "hono";
import { sendUpgradeAccountNotification } from "../controllers/upgrade.js";
const upgradeAccountRoute = new Hono();
upgradeAccountRoute.post("/", async (c) => {
    try {
        const { to, recipientName, currentRole, newRole } = await c.req.json();
        await sendUpgradeAccountNotification(to, recipientName, currentRole, newRole);
        return c.json({ success: true });
    }
    catch (err) {
        return c.json({ error: err.message }, 500);
    }
});
export default upgradeAccountRoute;
