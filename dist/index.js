// src/index.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
// Import all feature routes
import ceoRoute from "./routes/ceoRoute.js";
import adminRoute from "./routes/adminRoute.js";
import customerCareRoute from "./routes/customerCareRoute.js";
import emailLogsRoute from "./routes/emailLogsRoute.js";
import noreplyRoute from "./routes/noreplyRoute.js";
import upgradeAccountRoute from "./routes/upgradeAccountRoute.js";
import bookingsEmailRoute from "./routes/bookingsEmailRoute.js";
import propertiesEmailRoute from "./routes/propertiesEmailRoute.js";
import paymentsEmailRoute from "./routes/paymentsEmailRoute.js";
import inquiryEmailRoute from "./routes/inquiryEmailRoute.js";
const app = new Hono();
// Global middleware: allow only localhost and housika.co.ke origins
app.use("*", cors({
    origin: (origin, c) => {
        if (!origin)
            return null;
        if (origin.startsWith("http://localhost") ||
            origin.startsWith("https://localhost") ||
            origin.endsWith("housika.co.ke")) {
            return origin;
        }
        return null; // reject other origins
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
}));
// Self-healing error handler
app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal server error. Please try again later." }, 500);
});
// Health check route
app.get("/", (c) => c.text("Housika Email Backend is running"));
// Mount all feature routes
app.route("/ceo", ceoRoute);
app.route("/admin", adminRoute);
app.route("/customer-care", customerCareRoute);
app.route("/emails", emailLogsRoute);
app.route("/noreply", noreplyRoute);
app.route("/upgrade-account", upgradeAccountRoute);
app.route("/bookings", bookingsEmailRoute);
app.route("/properties", propertiesEmailRoute);
app.route("/payments", paymentsEmailRoute);
app.route("/inquiry", inquiryEmailRoute);
// Start server
serve({
    fetch: app.fetch,
    port: 3000,
}, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
