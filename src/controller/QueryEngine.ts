import { InsightError, InsightResult, ResultTooLargeError } from "../controller/IInsightFacade";
import { Listing, Dataset, Office } from "../controller/InsightFacade";
import { FilterRegistry, FilterContext } from "./QueryFilters";
import { TransformationEngine } from "./TransformationEngine";
import { QueryValidator } from "./QueryValidator";

const largeNum = 5000;

export class QueryEngine {
	private readonly dataset = new Map<string, Dataset>();
	private filterRegistry = new FilterRegistry();
	private transformationEngine = new TransformationEngine();
	private validator = new QueryValidator();

	constructor(dataset: any) {
		this.dataset = dataset;
	}

	private checkIfNull(query: any): void {
		if (query === null) {
			throw new InsightError("Query is null");
		}
	}

	private checkIfValidQuery(query: any): void {
		if (!this.validator.validQuery(query)) {
			throw new InsightError("invalid query");
		}
		if (!this.validator.validOptions(query.OPTIONS)) {
			throw new InsightError("invalid options");
		}

		if (query.TRANSFORMATIONS) {
			if (!this.validator.validColumnsWithTransformations(query.OPTIONS.COLUMNS, query.TRANSFORMATIONS)) {
				throw new InsightError("COLUMNS must only reference GROUP or APPLY keys");
			}
		} else {
			for (const col of query.OPTIONS.COLUMNS) {
				if (!col.includes("_")) {
					throw new InsightError("Column without underscore requires TRANSFORMATIONS");
				}
			}
		}

		const datasetID = this.validator.getDatasetID();
		if (this.dataset.get(datasetID) === undefined) {
			throw new InsightError("invalid dataset");
		}
	}

	public async performQuery(query: any): Promise<InsightResult[]> {
		this.validator.setDatasetID("");
		this.checkIfNull(query);

		try {
			query = JSON.parse(JSON.stringify(query));
		} catch (_error) {
			return Promise.reject(new InsightError("invalid json"));
		}

		this.checkIfValidQuery(query);

		const datasetID = this.validator.getDatasetID();
		const courseList: Array<Listing | Office> = this.dataset.get(datasetID)!.data;
		this.validateResultSize(query.WHERE, courseList, query.TRANSFORMATIONS);

		try {
			const filteredData = courseList.filter((course) => this.filterQuery(course, query.WHERE));
			return Promise.resolve(this.processQueryResults(filteredData, query));
		} catch (error) {
			return Promise.reject(error);
		}
	}

	private validateResultSize(where: any, courseList: Array<Listing | Office>, hasTransformations: boolean): void {
		if (Object.keys(where).length === 0 && courseList.length > largeNum && !hasTransformations) {
			throw new ResultTooLargeError("result too large");
		}
	}

	private processQueryResults(filteredData: Array<Listing | Office>, query: any): InsightResult[] {
		const columns = query.OPTIONS.COLUMNS;

		if (!query.TRANSFORMATIONS && filteredData.length > largeNum) {
			throw new ResultTooLargeError("result too large");
		}

		let results: InsightResult[];
		if (query.TRANSFORMATIONS) {
			results = this.transformationEngine.applyTransformations(filteredData, query.TRANSFORMATIONS);
			if (results.length > largeNum) {
				throw new ResultTooLargeError("result too large");
			}
			results = results.map((result) => this.filterResultColumns(result, columns));
		} else {
			results = filteredData.map((course) => this.transformQuery(course, columns));
		}

		if (query.OPTIONS.ORDER) {
			results = this.sortResults(results, query.OPTIONS.ORDER);
		}
		return results;
	}

	private filterQuery(course: Listing | Office, query: any): boolean {
		// base case
		if (Object.keys(query).length === 0) {
			return true;
		}

		const filterKeys = Object.keys(query);
		if (filterKeys.length !== 1) {
			throw new InsightError("Filter must have exactly one key");
		}

		const filterType = filterKeys[0];
		const filterQuery = query[filterType];

		// Get the appropriate filter strategy
		const filter = this.filterRegistry.getFilter(filterType);

		// Create context for recursive calls
		const context: FilterContext = {
			datasetId: this.validator.getDatasetID(),
			applyFilter: (data, subQuery: any) => this.filterQuery(data, subQuery),
		};

		// Apply the filter
		return filter.apply(course, filterQuery, context);
	}

	// transform the query to the format of the result
	private transformQuery(course: Listing | Office, coln: string[]): InsightResult {
		const entry: { [id: string]: string | number } = {};
		coln.forEach((c) => {
			const key = c.split("_")[1];
			entry[c] = course[key as keyof (Listing | Office)];
		});
		return entry;
	}

	// Filter result to only include keys specified in COLUMNS
	private filterResultColumns(result: InsightResult, columns: string[]): InsightResult {
		const filtered: InsightResult = {};
		for (const col of columns) {
			if (result[col] !== undefined) {
				filtered[col] = result[col];
			}
		}
		return filtered;
	}
	// order the query (legacy - for non-transformed data with simple ORDER)
	private orderQuery(D1: Listing | Office, D2: Listing | Office, orderKey: string): number {
		if (orderKey === "") {
			return 0;
		}
		const val1 = D1[orderKey as keyof (Listing | Office)];
		const val2 = D2[orderKey as keyof (Listing | Office)];
		if (val1 > val2) {
			return 1;
		} else if (val1 < val2) {
			return -1;
		} else {
			return 0;
		}
	}

	private sortResults(results: InsightResult[], order: any): InsightResult[] {
		if (typeof order === "string") {
			// Simple ORDER: sort by single key, ascending
			return results.sort((a, b) => {
				const val1 = a[order];
				const val2 = b[order];
				if (val1 > val2) {
					return 1;
				} else if (val1 < val2) {
					return -1;
				} else {
					return 0;
				}
			});
		} else {
			// Complex ORDER: sort by multiple keys with direction
			const direction = order.dir;
			const keys: string[] = order.keys;

			return results.sort((a, b) => {
				for (const key of keys) {
					const val1 = a[key];
					const val2 = b[key];

					if (val1 > val2) {
						return direction === "UP" ? 1 : -1;
					} else if (val1 < val2) {
						return direction === "UP" ? -1 : 1;
					}
					// If equal, continue to next key
				}
				return 0; // All keys are equal
			});
		}
	}
}
