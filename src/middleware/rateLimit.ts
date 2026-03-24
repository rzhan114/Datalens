import rateLimit from "express-rate-limit";

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX ?? "100", 10);

/**
 * Apply a sliding-window rate limit of RATE_LIMIT_MAX requests
 * per IP address per 15-minute window.
 * Exceeding the limit returns HTTP 429 with a standard error envelope.
 */
export const rateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: RATE_LIMIT_MAX,
	standardHeaders: true,
	legacyHeaders: false,
	handler: (_req, res) => {
		res.status(429).json({
			error: `Too many requests — limit is ${RATE_LIMIT_MAX} per 15 minutes`,
			code: "RATE_LIMITED",
		});
	},
});
