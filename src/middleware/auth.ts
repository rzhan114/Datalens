import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "datalens-dev-secret";
const API_KEY = process.env.API_KEY ?? "datalens-dev-key";

/**
 * POST /auth/token
 * Exchange an API key for a signed JWT (expires in 24 h).
 */
export function issueToken(req: Request, res: Response): void {
	const { apiKey } = req.body as { apiKey?: string };
	if (!apiKey || apiKey !== API_KEY) {
		res.status(401).json({ error: "Invalid API key", code: "UNAUTHORIZED" });
		return;
	}
	const token = jwt.sign({ sub: "datalens-client" }, JWT_SECRET, { expiresIn: "24h" });
	res.status(200).json({ token });
}

/**
 * Middleware: verify Bearer JWT on every protected route.
 * Routes starting with /health or /auth are skipped.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
	const path = req.path;
	if (path === "/health" || path.startsWith("/auth")) {
		next();
		return;
	}

	const header = req.headers.authorization;
	if (!header?.startsWith("Bearer ")) {
		res.status(401).json({ error: "Missing or malformed Authorization header", code: "UNAUTHORIZED" });
		return;
	}

	const token = header.slice(7);
	try {
		jwt.verify(token, JWT_SECRET);
		next();
	} catch (_err) {
		res.status(401).json({ error: "Token is invalid or expired", code: "UNAUTHORIZED" });
	}
}
