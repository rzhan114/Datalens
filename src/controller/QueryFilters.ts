import { InsightError } from "./IInsightFacade";
import { Listing, Office } from "./InsightFacade";

export interface QueryFilter {
	validate(filterQuery: any): boolean;
	apply(course: Listing | Office, filterQuery: any, context: FilterContext): boolean;
}

export interface FilterContext {
	datasetId: string;
	applyFilter: (course: Listing | Office, query: any) => boolean;
}

export class AndFilter implements QueryFilter {
	public validate(filterQuery: any): boolean {
		return (
			Array.isArray(filterQuery) &&
			filterQuery.length > 0 &&
			filterQuery.every(
				(filter: any) => filter !== null && typeof filter === "object" && Object.keys(filter).length === 1
			)
		);
	}

	public apply(course: Listing | Office, filterQuery: any[], context: FilterContext): boolean {
		if (!this.validate(filterQuery)) {
			throw new InsightError("invalid AND");
		}
		return filterQuery.every((filter: any) => context.applyFilter(course, filter));
	}
}

export class OrFilter implements QueryFilter {
	public validate(filterQuery: any): boolean {
		return (
			Array.isArray(filterQuery) &&
			filterQuery.length > 0 &&
			filterQuery.every(
				(filter: any) => filter !== null && typeof filter === "object" && Object.keys(filter).length === 1
			)
		);
	}

	public apply(course: Listing | Office, filterQuery: any[], context: FilterContext): boolean {
		if (!this.validate(filterQuery)) {
			throw new InsightError("invalid OR");
		}
		return filterQuery.some((filter: any) => context.applyFilter(course, filter));
	}
}

export class NotFilter implements QueryFilter {
	public validate(filterQuery: any): boolean {
		return filterQuery !== null && typeof filterQuery === "object" && Object.keys(filterQuery).length === 1;
	}

	public apply(course: Listing | Office, filterQuery: any, context: FilterContext): boolean {
		if (!this.validate(filterQuery)) {
			throw new InsightError("invalid NOT");
		}
		return !context.applyFilter(course, filterQuery);
	}
}

export class NumericComparisonFilter implements QueryFilter {
	private MComp = ["salary", "applicants", "rejections", "openings", "year", "lat", "lon", "headcount"];

	constructor(private operator: "GT" | "LT" | "EQ") {}

	public validate(filterQuery: any): boolean {
		if (filterQuery === null || filterQuery.constructor !== Object || Object.keys(filterQuery).length !== 1) {
			return false;
		}
		const key = Object.keys(filterQuery)[0];
		const value = Object.values(filterQuery)[0];

		if (key.split("_").length !== 2) {
			return false;
		}

		const field = key.split("_")[1];
		return this.MComp.includes(field) && typeof value === "number";
	}

	public apply(course: Listing | Office, filterQuery: any, context: FilterContext): boolean {
		if (!this.validate(filterQuery)) {
			throw new InsightError(`invalid ${this.operator}`);
		}

		const key = Object.keys(filterQuery)[0];
		const datasetId = key.split("_")[0];

		if (datasetId !== context.datasetId) {
			throw new InsightError("Query references multiple datasets");
		}

		const field = key.split("_")[1];
		const targetValue = Object.values(filterQuery)[0] as number;
		const courseValue = course[field as keyof (Listing | Office)] as number;

		switch (this.operator) {
			case "GT":
				return courseValue > targetValue;
			case "LT":
				return courseValue < targetValue;
			case "EQ":
				return courseValue === targetValue;
			default:
				return false;
		}
	}
}

export class StringComparisonFilter implements QueryFilter {
	private SComp = [
		"industry",
		"jobId",
		"company",
		"role",
		"uuid",
		"companyName",
		"companyCode",
		"address",
		"url",
		"officeId",
		"name",
		"type",
		"remote",
	];

	public validate(filterQuery: any): boolean {
		if (filterQuery === null || filterQuery.constructor !== Object || Object.keys(filterQuery).length !== 1) {
			return false;
		}

		const key = Object.keys(filterQuery)[0];
		const value = Object.values(filterQuery)[0];

		if (key.split("_").length !== 2) {
			return false;
		}

		const field = key.split("_")[1];
		if (!this.SComp.includes(field) || typeof value !== "string") {
			return false;
		}

		// Check for wildcard validation
		const s = String(value);
		if (s.length > 2 && s.slice(1, -1).includes("*")) {
			return false;
		}

		return true;
	}

	public apply(course: Listing | Office, filterQuery: any, context: FilterContext): boolean {
		if (!this.validate(filterQuery)) {
			throw new InsightError("invalid IS");
		}

		const key = Object.keys(filterQuery)[0];
		const datasetId = key.split("_")[0];

		if (datasetId !== context.datasetId) {
			throw new InsightError("Query references multiple datasets");
		}

		const field = key.split("_")[1];
		const pattern = Object.values(filterQuery)[0] as string;
		const courseValue = String(course[field as keyof (Listing | Office)]);

		return this.matchesWildcard(courseValue, pattern);
	}

	private matchesWildcard(value: string, pattern: string): boolean {
		const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
		return regex.test(value);
	}
}

export class FilterRegistry {
	private filters = new Map<string, QueryFilter>();

	constructor() {
		this.filters.set("AND", new AndFilter());
		this.filters.set("OR", new OrFilter());
		this.filters.set("NOT", new NotFilter());
		this.filters.set("GT", new NumericComparisonFilter("GT"));
		this.filters.set("LT", new NumericComparisonFilter("LT"));
		this.filters.set("EQ", new NumericComparisonFilter("EQ"));
		this.filters.set("IS", new StringComparisonFilter());
	}

	public getFilter(filterType: string): QueryFilter {
		const filter = this.filters.get(filterType);
		if (!filter) {
			throw new InsightError(`Unknown filter type: ${filterType}`);
		}
		return filter;
	}
}
