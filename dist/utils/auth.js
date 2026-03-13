// src/utils/auth.ts
export function extractTokenFromRequest(c) {
    // Prefer Authorization header (Bearer token)
    const authHeader = c.req.header("authorization");
    if (authHeader && typeof authHeader === "string") {
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (match) {
            return match[1];
        }
    }
    // Fallback to cookie named `token`.
    const cookieHeader = c.req.header("cookie");
    if (!cookieHeader || typeof cookieHeader !== "string")
        return null;
    const cookies = Object.fromEntries(cookieHeader
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((pair) => {
        const [name, ...rest] = pair.split("=");
        return [name, rest.join("=")];
    }));
    return cookies.token ?? cookies.authToken ?? null;
}
