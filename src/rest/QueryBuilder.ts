export class QueryBuilder {
	private static buildIndustryFilter(datasetId: string, industry: string): any {
		return {
			IS: {
				[`${datasetId}_industry`]: industry,
			},
		};
	}

	private static buildRoleFilter(datasetId: string, role: string): any {
		return {
			IS: {
				[`${datasetId}_jobId`]: role,
			},
		};
	}

	private static buildCompanyFilter(datasetId: string, company: string): any {
		return {
			IS: {
				[`${datasetId}_company`]: company,
			},
		};
	}

	public static getIndustriesQuery(datasetId: string): any {
		return {
			WHERE: {},
			OPTIONS: {
				COLUMNS: [`${datasetId}_industry`],
			},
			TRANSFORMATIONS: {
				GROUP: [`${datasetId}_industry`],
				APPLY: [],
			},
		};
	}

	public static getRolesQuery(datasetId: string, industry: string): any {
		return {
			WHERE: this.buildIndustryFilter(datasetId, industry),
			OPTIONS: {
				COLUMNS: [`${datasetId}_jobId`, `${datasetId}_role`],
			},
			TRANSFORMATIONS: {
				GROUP: [`${datasetId}_jobId`, `${datasetId}_role`],
				APPLY: [],
			},
		};
	}

	public static getRoleTrendQuery(datasetId: string, industry: string, jobId: string): any {
		return {
			WHERE: {
				AND: [
					this.buildIndustryFilter(datasetId, industry),
					this.buildRoleFilter(datasetId, jobId),
				],
			},
			OPTIONS: {
				COLUMNS: [`${datasetId}_year`, "totalApplicants", "totalRejections", "totalOpenings"],
				ORDER: `${datasetId}_year`,
			},
			TRANSFORMATIONS: {
				GROUP: [`${datasetId}_year`],
				APPLY: [
					{ totalApplicants: { SUM: `${datasetId}_applicants` } },
					{ totalRejections: { SUM: `${datasetId}_rejections` } },
					{ totalOpenings: { SUM: `${datasetId}_openings` } },
				],
			},
		};
	}

	public static formatTrendData(result: any[], datasetId: string): any[] {
		return result.map((item: any) => {
			const year = item[`${datasetId}_year`];
			const applicants = item.totalApplicants || 0;
			const rejections = item.totalRejections || 0;
			const openings = item.totalOpenings || 0;
			const total = applicants + rejections;
			const acceptanceRate = total > 0 ? parseFloat(((openings / applicants) * 100).toFixed(2)) : 0;

			return {
				year,
				applicants,
				rejections,
				openings,
				acceptanceRate,
				total: applicants + rejections + openings,
			};
		});
	}

	public static getCompaniesQuery(datasetId: string, industry: string): any {
		return {
			WHERE: this.buildIndustryFilter(datasetId, industry),
			OPTIONS: {
				COLUMNS: [`${datasetId}_company`, "avgSalary", "listingCount"],
			},
			TRANSFORMATIONS: {
				GROUP: [`${datasetId}_company`],
				APPLY: [
					{ avgSalary: { AVG: `${datasetId}_salary` } },
					{ listingCount: { COUNT: `${datasetId}_uuid` } },
				],
			},
		};
	}

	public static formatCompanyData(result: any[], datasetId: string): any[] {
		return result
			.map((item: any) => ({
				company: item[`${datasetId}_company`],
				avgSalary: parseFloat((item.avgSalary || 0).toFixed(2)),
				listingCount: item.listingCount || 0,
			}))
			.filter((c: any) => c.company && c.company.trim() !== "")
			.sort((a: any, b: any) => b.avgSalary - a.avgSalary);
	}

	public static formatCompanyList(result: any[], datasetId: string): string[] {
		return result
			.map((item: any) => item[`${datasetId}_company`])
			.filter((name: string) => name && name.trim() !== "")
			.sort();
	}

	public static getCompanyListingsQuery(datasetId: string, company: string): any {
		return {
			WHERE: this.buildCompanyFilter(datasetId, company),
			OPTIONS: {
				COLUMNS: [
					`${datasetId}_jobId`,
					`${datasetId}_role`,
					`${datasetId}_industry`,
					`${datasetId}_year`,
					"avgSalary",
				],
			},
			TRANSFORMATIONS: {
				GROUP: [`${datasetId}_jobId`, `${datasetId}_role`, `${datasetId}_industry`, `${datasetId}_year`],
				APPLY: [{ avgSalary: { AVG: `${datasetId}_salary` } }],
			},
		};
	}

	public static formatCompanyListings(result: any[], datasetId: string): any[] {
		return result.map((item: any) => ({
			jobId: item[`${datasetId}_jobId`],
			role: item[`${datasetId}_role`],
			industry: item[`${datasetId}_industry`],
			year: item[`${datasetId}_year`],
			avgSalary: parseFloat((item.avgSalary || 0).toFixed(2)),
		}));
	}

	// ─── Insight 1: Salary Benchmarking ──────────────────────────────────────
	// Given a role name, show avg salary per company — useful for pay comparison

	public static getSalaryBenchmarkQuery(datasetId: string, role: string): any {
		return {
			WHERE: { IS: { [`${datasetId}_role`]: role } },
			OPTIONS: {
				COLUMNS: [`${datasetId}_company`, `${datasetId}_industry`, "avgSalary"],
			},
			TRANSFORMATIONS: {
				GROUP: [`${datasetId}_company`, `${datasetId}_industry`],
				APPLY: [{ avgSalary: { AVG: `${datasetId}_salary` } }],
			},
		};
	}

	public static formatSalaryBenchmark(result: any[], datasetId: string): any[] {
		return result
			.map((item: any) => ({
				company: item[`${datasetId}_company`] as string,
				industry: item[`${datasetId}_industry`] as string,
				avgSalary: parseFloat((item.avgSalary || 0).toFixed(1)),
			}))
			.filter((c) => c.company?.trim() && c.avgSalary > 0)
			.sort((a, b) => b.avgSalary - a.avgSalary);
	}

	// ─── Insight 2 & 3: Competition / Opportunities ───────────────────────────
	// Per company in an industry: avg salary + acceptance rate (openings/applicants)

	public static getCompetitionQuery(datasetId: string, industry: string): any {
		return {
			WHERE: { IS: { [`${datasetId}_industry`]: industry } },
			OPTIONS: {
				COLUMNS: [`${datasetId}_company`, "avgSalary", "totalOpenings", "totalApplicants"],
			},
			TRANSFORMATIONS: {
				GROUP: [`${datasetId}_company`],
				APPLY: [
					{ avgSalary: { AVG: `${datasetId}_salary` } },
					{ totalOpenings: { SUM: `${datasetId}_openings` } },
					{ totalApplicants: { SUM: `${datasetId}_applicants` } },
				],
			},
		};
	}

	public static formatCompetitionData(result: any[], datasetId: string): any[] {
		return result
			.map((item: any) => {
				const company = item[`${datasetId}_company`] as string;
				const avgSalary = parseFloat((item.avgSalary || 0).toFixed(1));
				const openings = item.totalOpenings || 0;
				const applicants = item.totalApplicants || 0;
				const acceptanceRate =
					applicants > 0 ? parseFloat(((openings / applicants) * 100).toFixed(2)) : 0;
				return { company, avgSalary, openings, applicants, acceptanceRate };
			})
			.filter((c) => c.company?.trim() && c.applicants > 0)
			.sort((a, b) => b.acceptanceRate - a.acceptanceRate);
	}
}
