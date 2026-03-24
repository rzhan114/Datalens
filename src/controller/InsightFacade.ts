import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
} from "./IInsightFacade";
import { QueryEngine } from "./QueryEngine";
import fs from "fs-extra";
import path from "path";
import { Buffer } from "buffer";
import { RoomHelper } from "./RoomHelper";
import { SectionHelper } from "./SectionHelper";

import { DatasetGenerator } from "./DatasetGenerator";
// Job listing record — one entry per job posting
export interface Listing {
	uuid: string;
	jobId: string;
	role: string;
	company: string;
	industry: string;
	year: number;
	salary: number;
	applicants: number;
	rejections: number;
	openings: number;
	[key: string]: string | number;
}

// Company record used during HTML parsing of offices dataset
export interface Company {
	companyName: string;
	companyCode: string;
	address: string;
	href: string;
}

// Office location record — one entry per physical office
export interface Office {
	companyName: string;
	companyCode: string;
	officeId: string;
	name: string;
	address: string;
	lat: number;
	lon: number;
	headcount: number;
	type: string;
	remote: string;
	url: string;
	[key: string]: string | number;
}

export interface Dataset {
	id: string;
	kind: InsightDatasetKind;
	data: Listing[] | Office[];
}

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	private datasets = new Map<string, Dataset>();
	private roomHelper = new RoomHelper();
	private sectionHelper = new SectionHelper();
	private dataDir: string = "./data";
	private queryEngine!: QueryEngine;

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		await this.refreshDatasets();
		this.validateId(id);
		const zipBuffer = this.decodeZip(content);

		const helper = DatasetGenerator.createHelper(kind);
		const data = await helper.extract(zipBuffer);

		if (data.length === 0) {
			throw new InsightError("No valid records found in dataset");
		}

		const dataset: Dataset = { id, kind, data };
		this.datasets.set(id, dataset);

		await fs.ensureDir(this.dataDir);
		await fs.writeJSON(path.join(this.dataDir, `${id}.json`), dataset);

		return Array.from(this.datasets.keys());
	}

	private validateId(id: string): void {
		if (!id || id.trim() === "" || id.includes("_")) {
			throw new InsightError("Invalid dataset id");
		}
		if (this.datasets.has(id)) {
			throw new InsightError("invalid dataset");
		}
	}

	private decodeZip(content: string): Buffer {
		try {
			return Buffer.from(content, "base64");
		} catch {
			throw new InsightError("Invalid base64 content");
		}
	}

	public async removeDataset(id: string): Promise<string> {
		// TODO: Remove this once you implement the methods!
		// throw new Error(`InsightFacadeImpl::removeDataset() is unimplemented! - id=${id};`);
		if (!id || id.trim() === "" || id.includes("_")) {
			throw new InsightError("Invalid ID");
		}

		await this.refreshDatasets();

		if (!this.datasets.has(id)) {
			throw new NotFoundError("No dataset with this id");
		}

		const filePath = path.join(this.dataDir, `${id}.json`);
		// console.log("The name is", filePath);

		try {
			await fs.remove(filePath);
		} catch {
			throw new InsightError("There is no valid json file with given id");
		}

		this.datasets.delete(id);

		return id;
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		await this.refreshDatasets();
		this.queryEngine = new QueryEngine(this.datasets);
		return this.queryEngine.performQuery(query);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		// TODO: Remove this once you implement the methods!
		//throw new Error(`InsightFacadeImpl::listDatasets is unimplemented!`);
		await this.refreshDatasets();

		const result: InsightDataset[] = [];

		for (const dataset of this.datasets.values()) {
			result.push({
				id: dataset.id,
				kind: dataset.kind,
				numRows: dataset.data.length,
			});
		}

		return result;
	}
	private async refreshDatasets(): Promise<void> {
		try {
			await fs.ensureDir(this.dataDir);
			const files = await fs.readdir(this.dataDir);
			const jsonFiles = files.filter((file) => file.endsWith(".json"));
			const readPromises = jsonFiles.map(async (file) => fs.readJSON(path.join(this.dataDir, file)));

			const datasetsArray = await Promise.all(readPromises);
			this.datasets.clear();
			datasetsArray.forEach((dataset) => this.datasets.set(dataset.id, dataset));
		} catch {
			//ignore this error first
		}
	}
}
