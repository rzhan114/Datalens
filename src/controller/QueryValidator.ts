const MIN_QUERY_KEYS = 2;
const MAX_QUERY_KEYS = 3;

export class QueryValidator {
	private MComp = ["salary", "applicants", "rejections", "openings", "year", "lat", "lon", "headcount"];
	private SComp: string[] = [
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
	private datasetID: string = "";

	public getDatasetID(): string {
		return this.datasetID;
	}

	public setDatasetID(id: string): void {
		this.datasetID = id;
	}

	public validQuery(query: any): boolean {
		const numKeys = Object.keys(query).length;
		if (numKeys !== MIN_QUERY_KEYS && numKeys !== MAX_QUERY_KEYS) {
			return false;
		}

		if (
			query.WHERE === null ||
			query.WHERE === undefined ||
			typeof query.WHERE !== "object" ||
			Object.keys(query.WHERE).length > 1
		) {
			return false;
		}

		if (
			query.OPTIONS === null ||
			query.OPTIONS === undefined ||
			typeof query.OPTIONS !== "object" ||
			Object.keys(query.OPTIONS).length === 0 ||
			Object.keys(query.OPTIONS).length > 2
		) {
			return false;
		}

		if (query.TRANSFORMATIONS !== undefined) {
			if (!this.validTransformations(query.TRANSFORMATIONS)) {
				return false;
			}
		}
		return true;
	}

	public validOptions(query: any): boolean {
		const onlyAllowed = Object.keys(query).every((k) => k === "COLUMNS" || k === "ORDER");
		if (!onlyAllowed || !Array.isArray(query.COLUMNS) || query.COLUMNS.length === 0) {
			return false;
		}

		if (!this.validColumns(query.COLUMNS)) {
			return false;
		}

		return this.validOrderClause(query.ORDER, query.COLUMNS);
	}

	public validColumnsWithTransformations(columns: string[], transformations: any): boolean {
		const groupKeys = new Set(transformations.GROUP);
		const applyKeys = new Set(transformations.APPLY.map((rule: any) => Object.keys(rule)[0]));

		for (const col of columns) {
			if (!groupKeys.has(col) && !applyKeys.has(col)) {
				return false;
			}
		}

		return true;
	}

	private validTransformations(transformations: any): boolean {
		if (transformations === null || typeof transformations !== "object") {
			return false;
		}

		const keys = Object.keys(transformations);
		if (keys.length !== 2 || !keys.includes("GROUP") || !keys.includes("APPLY")) {
			return false;
		}

		return this.validGroupKeys(transformations.GROUP) && this.validApplyRules(transformations.APPLY);
	}

	private validGroupKeys(groupKeys: any): boolean {
		if (!Array.isArray(groupKeys) || groupKeys.length === 0) {
			return false;
		}

		for (const groupKey of groupKeys) {
			if (typeof groupKey !== "string" || groupKey.split("_").length !== 2) {
				return false;
			}

			const parts = groupKey.split("_");
			const datasetId = parts[0];
			const field = parts[1];

			if (this.datasetID === "") {
				this.datasetID = datasetId;
			} else if (datasetId !== this.datasetID) {
				return false;
			}

			if (!this.MComp.includes(field) && !this.SComp.includes(field)) {
				return false;
			}
		}
		return true;
	}

	private validApplyRules(applyRules: any): boolean {
		if (!Array.isArray(applyRules)) {
			return false;
		}

		const applyKeys = new Set<string>();
		for (const applyRule of applyRules) {
			if (!this.validApplyRule(applyRule)) {
				return false;
			}

			const applyKey = Object.keys(applyRule)[0];
			if (applyKeys.has(applyKey)) {
				return false;
			}
			applyKeys.add(applyKey);
		}
		return true;
	}

	private validApplyRule(applyRule: any): boolean {
		if (applyRule === null || typeof applyRule !== "object" || Object.keys(applyRule).length !== 1) {
			return false;
		}

		const applyKey = Object.keys(applyRule)[0];
		if (applyKey.includes("_")) {
			return false;
		}

		const applyBody = applyRule[applyKey];
		if (applyBody === null || typeof applyBody !== "object" || Object.keys(applyBody).length !== 1) {
			return false;
		}

		const operation = Object.keys(applyBody)[0];
		const field = applyBody[operation];

		return this.validOperation(operation, field);
	}

	private validOperation(operation: string, field: any): boolean {
		const validOperations = ["MAX", "MIN", "AVG", "SUM", "COUNT"];
		if (!validOperations.includes(operation)) {
			return false;
		}

		if (typeof field !== "string" || field.split("_").length !== 2) {
			return false;
		}

		const parts = field.split("_");
		if (parts[0] !== this.datasetID) {
			return false;
		}

		const fieldName = parts[1];
		if (["MAX", "MIN", "AVG", "SUM"].includes(operation)) {
			return this.MComp.includes(fieldName);
		}

		return this.MComp.includes(fieldName) || this.SComp.includes(fieldName);
	}

	private validColumns(columns: any[]): boolean {
		for (const col of columns) {
			if (typeof col !== "string") {
				return false;
			}

			if (col.includes("_")) {
				if (col.split("_").length !== 2) {
					return false;
				}

				if (this.datasetID === "") {
					this.datasetID = col.split("_")[0];
				} else if (col.split("_")[0] !== this.datasetID) {
					return false;
				}

				const field = col.split("_")[1];
				if (!this.MComp.includes(field) && !this.SComp.includes(field)) {
					return false;
				}
			}
		}
		return true;
	}

	private validOrderClause(order: any, columns: string[]): boolean {
		if (order === undefined) {
			return true;
		}

		if (typeof order === "string") {
			return columns.includes(order);
		}

		if (typeof order === "object" && order !== null) {
			return this.validOrderObject(order, columns);
		}

		return false;
	}

	private validOrderObject(order: any, columns: string[]): boolean {
		const orderKeys = Object.keys(order);
		if (orderKeys.length !== 2 || !orderKeys.includes("dir") || !orderKeys.includes("keys")) {
			return false;
		}

		if (order.dir !== "UP" && order.dir !== "DOWN") {
			return false;
		}

		if (!Array.isArray(order.keys) || order.keys.length === 0) {
			return false;
		}

		for (const key of order.keys) {
			if (typeof key !== "string" || !columns.includes(key)) {
				return false;
			}
		}

		return true;
	}
}
