// src/utils/jwt.ts
import jwt, {} from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET ?? (() => {
    throw new Error("JWT_SECRET is not defined in environment variables");
})();
/**
 * Generate a JWT token with a typed payload.
 */
export function generateToken(payload, expiresIn = "15m") {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
/**
 * Verify a JWT token and return the typed payload.
 * Throws a descriptive error if verification fails.
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            throw new Error("Token has expired");
        }
        if (err instanceof jwt.JsonWebTokenError) {
            throw new Error("Invalid token");
        }
        throw new Error("Token verification failed");
    }
}
