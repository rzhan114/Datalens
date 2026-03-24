import { Request, Response, NextFunction } from "express";
import { InsightError, NotFoundError, ResultTooLargeError } from "../controller/IInsightFacade";

/**
 * Maps domain error types to HTTP status codes and machine-readable error codes.
 */
function resolveError(err: unknown): { status: number; code: string; message: string } {
	if (err instanceof ResultTooLargeError) {
		return { status: 413, code: "RESULT_TOO_LARGE", message: err.message ?? "Query result exceeds 5000 rows" };
	}
	if (err instanceof NotFoundError) {
		return { status: 404, code: "NOT_FOUND", message: err.message ?? "Dataset not found" };
	}
	if (err instanceof InsightError) {
		return { status: 400, code: "INVALID_QUERY", message: err.message ?? "Invalid request" };
	}
	if (err instanceof Error) {
		return { status: 500, code: "INTERNAL_ERROR", message: err.message };
	}
	return { status: 500, code: "INTERNAL_ERROR", message: "An unexpected error occurred" };
}

/**
 * Express catch-all error handler.
 * Must be registered AFTER all routes (4-argument signature is required by Express).
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
	const { status, code, message } = resolveError(err);
	res.status(status).json({ error: message, code });
}
