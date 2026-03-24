import JSZip from "jszip";
import { InsightError } from "./IInsightFacade";
import { Listing } from "./InsightFacade";
import { IDatasetHelper } from "./IDatasetHelper";

export class SectionHelper implements IDatasetHelper<Listing> {
	public async extract(zipBuffer: Buffer): Promise<Listing[]> {
		const listings: Listing[] = [];
		try {
			const zip = await JSZip.loadAsync(zipBuffer);
			const promises: Promise<void>[] = [];

			for (const filename of Object.keys(zip.files)) {
				const file = zip.files[filename];
				if (
					!file.dir &&
					filename.startsWith("listings/") &&
					!filename.includes(".DS_Store") &&
					!filename.includes("._")
				) {
					const p = file.async("text").then((text) => {
						const json = JSON.parse(text);
						if (Array.isArray(json.result)) {
							for (const s of json.result) {
								listings.push(this.parseListing(s));
							}
						}
					});
					promises.push(p);
				}
			}

			await Promise.all(promises);
		} catch {
			throw new InsightError("Failed to parse zip content");
		}
		return listings;
	}

	private parseListing(raw: any): Listing {
		return {
			uuid: String(raw.id),
			jobId: String(raw.JobId),
			role: String(raw.Role),
			company: String(raw.Company),
			industry: String(raw.Industry),
			year: Number(raw.Year) || 0,
			salary: Number(raw.Salary) || 0,
			applicants: Number(raw.Applicants) || 0,
			rejections: Number(raw.Rejections) || 0,
			openings: Number(raw.Openings) || 0,
		};
	}
}
