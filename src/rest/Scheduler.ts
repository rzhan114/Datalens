import cron from "node-cron";
import { exec } from "child_process";
import path from "path";
import fs from "fs-extra";
import InsightFacade from "../controller/InsightFacade";
import { InsightDatasetKind } from "../controller/IInsightFacade";
import { queryResultCache } from "../middleware/queryCache";

const DATASET_ID = "jobs";
const SCRIPT_PATH = path.resolve(__dirname, "../../scripts/scrape_jobs.py");
const ZIP_PATH = path.resolve(__dirname, "../../data/jobs_market.zip");

async function runScraper(): Promise<void> {
	return new Promise((resolve, reject) => {
		console.log("[Scheduler] Starting scrape job...");
		exec(`python3 "${SCRIPT_PATH}" --source remoteok`, { timeout: 60000 }, (err, stdout, stderr) => {
			if (err) {
				reject(new Error(`Scraper failed: ${stderr || err.message}`));
			} else {
				console.log(stdout.trim());
				resolve();
			}
		});
	});
}

async function reloadDataset(facade: InsightFacade): Promise<void> {
	// Remove old dataset (ignore error if not found)
	try {
		await facade.removeDataset(DATASET_ID);
	} catch {
		// dataset didn't exist yet — fine
	}

	const zipBuffer = await fs.readFile(ZIP_PATH);
	const base64 = zipBuffer.toString("base64");
	const ids = await facade.addDataset(DATASET_ID, base64, InsightDatasetKind.Listings);
	queryResultCache.invalidate();
	console.log(`[Scheduler] Dataset reloaded. Active datasets: ${ids.join(", ")}`);
}

export async function runNow(facade: InsightFacade): Promise<void> {
	try {
		await runScraper();
		await reloadDataset(facade);
		console.log("[Scheduler] Initial scrape complete.");
	} catch (err) {
		console.error("[Scheduler] Initial scrape failed:", (err as Error).message);
	}
}

/**
 * Schedule a daily scrape at 03:00 AM server time.
 * Cron expression: "0 3 * * *"  →  minute=0, hour=3, every day
 */
export function startScheduler(facade: InsightFacade): void {
	cron.schedule("0 3 * * *", async () => {
		console.log("[Scheduler] Daily scrape triggered at", new Date().toISOString());
		try {
			await runScraper();
			await reloadDataset(facade);
		} catch (err) {
			console.error("[Scheduler] Daily scrape failed:", (err as Error).message);
		}
	});
	console.log("[Scheduler] Daily scrape scheduled at 03:00 AM.");
}
