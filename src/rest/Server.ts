import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import InsightFacade from "../controller/InsightFacade";
import { InsightDatasetKind, NotFoundError } from "../controller/IInsightFacade";
import { QueryBuilder } from "./QueryBuilder";
import { requireAuth, issueToken } from "../middleware/auth";
import { rateLimiter } from "../middleware/rateLimit";
import { errorHandler } from "../middleware/errorHandler";
import { queryResultCache, buildCacheKey } from "../middleware/queryCache";
import { startScheduler, runNow } from "./Scheduler";

export default class Server {
	private readonly port: number;
	private readonly app: Express;
	private readonly facade: InsightFacade;
	private server: ReturnType<Express["listen"]> | undefined;
	private readonly startTime: number;

	constructor(port: number) {
		this.port = port;
		this.app = express();
		this.facade = new InsightFacade();
		this.startTime = Date.now();

		this.registerMiddleware();
		this.registerRoutes();
		// Must be last — catch-all error handler
		this.app.use(errorHandler);
	}

	// ─── Middleware ─────────────────────────────────────────────────────────────

	private registerMiddleware(): void {
		this.app.use(morgan("dev"));
		this.app.use(cors());
		this.app.use(express.json());
		this.app.use(express.raw({ type: "application/*", limit: "10mb" }));
		this.app.use(rateLimiter);
		this.app.use(requireAuth);
	}

	// ─── Routes ─────────────────────────────────────────────────────────────────

	private registerRoutes(): void {
		// Auth (public)
		this.app.post("/auth/token", issueToken);

		// Health (public)
		this.app.get("/health", (_req: Request, res: Response) => {
			res.status(200).json({
				status: "ok",
				uptime: Math.floor((Date.now() - this.startTime) / 1000),
				timestamp: new Date().toISOString(),
			});
		});

		// Dataset management
		this.app.put("/api/v1/dataset/:id", (req, res, next) => this.addDataset(req, res, next));
		this.app.delete("/api/v1/dataset/:id", (req, res, next) => this.removeDataset(req, res, next));
		this.app.get("/api/v1/datasets", (req, res, next) => this.listDatasets(req, res, next));

		// Query
		this.app.post("/api/v1/query", (req, res, next) => this.query(req, res, next));

		// Analytics
		this.app.get("/api/v1/analytics/:id/industries", (req, res, next) => this.getIndustries(req, res, next));
		this.app.get("/api/v1/analytics/:id/roles/:industry", (req, res, next) => this.getRoles(req, res, next));
		this.app.get("/api/v1/analytics/:id/trend/:industry/:jobId", (req, res, next) =>
			this.getRoleTrend(req, res, next),
		);
		this.app.get("/api/v1/analytics/:id/companies/:industry", (req, res, next) =>
			this.getCompanies(req, res, next),
		);
		this.app.get("/api/v1/analytics/:id/company/:name", (req, res, next) =>
			this.getCompanyListings(req, res, next),
		);
		this.app.get("/api/v1/analytics/:id/salary-benchmark/:role", (req, res, next) =>
			this.getSalaryBenchmark(req, res, next),
		);
		this.app.get("/api/v1/analytics/:id/competition/:industry", (req, res, next) =>
			this.getCompetition(req, res, next),
		);
	}

	// ─── Dataset Handlers ───────────────────────────────────────────────────────

	private async addDataset(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const id = req.params.id;
			const kindParam = (req.query.kind as string) ?? "listings";
			const kind = kindParam === "offices" ? InsightDatasetKind.Offices : InsightDatasetKind.Listings;
			const content = req.body.toString("base64");
			const result = await this.facade.addDataset(id, content, kind);
			// Invalidate cache whenever the dataset collection changes
			queryResultCache.invalidate();
			res.status(200).json({ result });
		} catch (err) {
			next(err);
		}
	}

	private async removeDataset(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const id = req.params.id;
			const result = await this.facade.removeDataset(id);
			queryResultCache.invalidate();
			res.status(200).json({ result });
		} catch (err) {
			if (err instanceof NotFoundError) {
				res.status(404).json({ error: err.message, code: "NOT_FOUND" });
			} else {
				next(err);
			}
		}
	}

	private async listDatasets(_req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const result = await this.facade.listDatasets();
			res.status(200).json({ result });
		} catch (err) {
			next(err);
		}
	}

	// ─── Query Handler (with LRU cache) ─────────────────────────────────────────

	private async query(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const queryBody = req.body;
			const cacheKey = buildCacheKey(queryBody);

			const cached = queryResultCache.get(cacheKey);
			if (cached) {
				res.status(200).json({ result: cached, cached: true });
				return;
			}

			const result = await this.facade.performQuery(queryBody);
			queryResultCache.set(cacheKey, result);
			res.status(200).json({ result });
		} catch (err) {
			next(err);
		}
	}

	// ─── Analytics Handlers ──────────────────────────────────────────────────────

	private async getIndustries(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const queryBody = QueryBuilder.getIndustriesQuery(id);
			const rows = await this.facade.performQuery(queryBody);
			const industries = rows
				.map((item: Record<string, string | number>) => item[`${id}_industry`] as string)
				.filter((industry) => industry?.trim() !== "")
				.sort();
			res.status(200).json({ result: industries });
		} catch (err) {
			next(err);
		}
	}

	private async getRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id, industry } = req.params;
			const queryBody = QueryBuilder.getRolesQuery(id, industry);
			const rows = await this.facade.performQuery(queryBody);
			const roles = rows
				.map((item: Record<string, string | number>) => ({
					jobId: item[`${id}_jobId`] as string,
					role: item[`${id}_role`] as string,
				}))
				.filter((r) => r.jobId && r.role)
				.sort((a, b) => a.role.localeCompare(b.role));
			res.status(200).json({ result: roles });
		} catch (err) {
			next(err);
		}
	}

	private async getRoleTrend(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id, industry, jobId } = req.params;
			const queryBody = QueryBuilder.getRoleTrendQuery(id, industry, jobId);
			const rows = await this.facade.performQuery(queryBody);
			res.status(200).json({ result: QueryBuilder.formatTrendData(rows, id) });
		} catch (err) {
			next(err);
		}
	}

	private async getCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id, industry } = req.params;
			const queryBody = QueryBuilder.getCompaniesQuery(id, industry);
			const rows = await this.facade.performQuery(queryBody);
			res.status(200).json({ result: QueryBuilder.formatCompanyData(rows, id) });
		} catch (err) {
			next(err);
		}
	}

	private async getCompanyListings(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id, name } = req.params;
			const queryBody = QueryBuilder.getCompanyListingsQuery(id, name);
			const rows = await this.facade.performQuery(queryBody);
			res.status(200).json({ result: QueryBuilder.formatCompanyListings(rows, id) });
		} catch (err) {
			next(err);
		}
	}

	private async getSalaryBenchmark(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id, role } = req.params;
			const queryBody = QueryBuilder.getSalaryBenchmarkQuery(id, role);
			const rows = await this.facade.performQuery(queryBody);
			res.status(200).json({ result: QueryBuilder.formatSalaryBenchmark(rows, id) });
		} catch (err) {
			next(err);
		}
	}

	private async getCompetition(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id, industry } = req.params;
			const queryBody = QueryBuilder.getCompetitionQuery(id, industry);
			const rows = await this.facade.performQuery(queryBody);
			res.status(200).json({ result: QueryBuilder.formatCompetitionData(rows, id) });
		} catch (err) {
			next(err);
		}
	}

	// ─── Lifecycle ───────────────────────────────────────────────────────────────

	public async start(): Promise<void> {
		return new Promise((resolve) => {
			this.server = this.app.listen(this.port, () => {
				console.log(`DataLens server running on port ${this.port}`);

				// Auto-scrape disabled — uncomment to re-enable
				// startScheduler(this.facade);
				// this.facade.listDatasets().then((datasets) => {
				// 	if (!datasets.some((d) => d.id === "jobs")) {
				// 		runNow(this.facade);
				// 	}
				// });

				resolve();
			});
		});
	}

	public async stop(): Promise<void> {
		return new Promise((resolve) => {
			if (this.server) {
				this.server.close(() => resolve());
			} else {
				resolve();
			}
		});
	}
}
