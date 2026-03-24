import JSZip from "jszip";
import http from "http";
import { Company, Office } from "./InsightFacade";
import { InsightError } from "./IInsightFacade";
import parse5 from "parse5";
import { IDatasetHelper } from "./IDatasetHelper";

export class RoomHelper implements IDatasetHelper<Office> {
	private static GEO_API = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team103/";
	private static ERROR_STATUS = 400;
	private geoCache = new Map<string, { lat: number; lon: number }>();

	public async extract(zipBuffer: Buffer): Promise<Office[]> {
		try {
			const zip = await JSZip.loadAsync(zipBuffer);
			const indexDoc = await this.loadAndParseIndex(zip);
			const companies = this.parseIndex(indexDoc);

			if (companies.length === 0) {
				throw new InsightError("No companies found in index.htm");
			}

			const allOffices = await this.loadCompanyPages(zip, companies);
			const offices = allOffices.flat();

			if (offices.length === 0) {
				throw new InsightError("No valid offices found");
			}

			return offices;
		} catch {
			throw new InsightError("Failed to extract offices");
		}
	}

	private async loadAndParseIndex(zip: JSZip): Promise<any> {
		const indexFile = zip.file("index.htm");
		if (!indexFile) {
			throw new InsightError("index.htm not found in zip");
		}
		const indexHtml = await indexFile.async("text");
		return parse5.parse(indexHtml);
	}

	// BEGIN: Code generated with help from ChatGPT
	private async loadCompanyPages(zip: JSZip, companies: Company[]): Promise<Office[][]> {
		const companyPromises = companies.map(async (company) => {
			const filePath = company.href.replace("./", "");
			const file = zip.file(filePath);
			if (file === null) {
				return { company, offices: [] };
			}

			const html = await file.async("text");
			const doc = parse5.parse(html);
			const offices = this.parseCompanyPage(company, doc);
			return { company, offices };
		});

		const allCompanies = await Promise.all(companyPromises);

		const geoPromises = allCompanies.map(async ({ company, offices }) => {
			const geo = await this.getGeoLocation(company.address);
			if (geo.lat === 0 && geo.lon === 0) {
				return [];
			}
			for (const o of offices) {
				o.lat = geo.lat;
				o.lon = geo.lon;
			}
			return offices;
		});

		return await Promise.all(geoPromises);
	}

	private async getGeoLocation(address: string): Promise<{ lat: number; lon: number }> {
		const cached = this.geoCache.get(address);
		if (cached !== undefined) {
			return cached;
		}

		const url = RoomHelper.GEO_API + encodeURIComponent(address);

		return new Promise((resolve) => {
			http
				.get(url, (res) => {
					let data = "";
					res.setEncoding("utf8");

					res.on("data", (chunk) => {
						data += chunk;
					});

					res.on("end", () => {
						try {
							const json = JSON.parse(data);
							if (typeof json.lat === "number" && typeof json.lon === "number") {
								this.geoCache.set(address, { lat: json.lat, lon: json.lon });
								resolve({ lat: json.lat, lon: json.lon });
							} else {
								resolve({ lat: 0, lon: 0 });
							}
						} catch {
							resolve({ lat: 0, lon: 0 });
						}
					});
				})
				.on("error", () => {
					resolve({ lat: 0, lon: 0 });
				});
		});
	}
	// END: Code generated with help from ChatGPT

	private parseIndex(indexDoc: any): Company[] {
		const companies: Company[] = [];
		const visit = (node: any): void => {
			if (node.nodeName === "tr") {
				const company = this.extractCompanyRow(node);
				if (company) {
					companies.push(company);
				}
			}
			if (node.childNodes) {
				for (const c of node.childNodes) {
					visit(c);
				}
			}
		};
		visit(indexDoc);
		return companies;
	}

	// BEGIN: Code generated with help from ChatGPT
	private extractCompanyRow(nodeTr: any): Company | null {
		const tds = nodeTr.childNodes?.filter((td: any) => td.nodeName === "td") || [];
		let companyName = "";
		let companyCode = "";
		let href = "";
		let address = "";

		for (const td of tds) {
			const attrs = td.attrs?.find((att: any) => att.name === "class")?.value || "";
			if (attrs.includes("views-field-title")) {
				const a = td.childNodes?.find((at: any) => at.nodeName === "a");
				if (a) {
					href = a.attrs?.find((at: any) => at.name === "href")?.value || "";
					companyName = this.getText(a);
				}
			} else if (attrs.includes("views-field-field-building-code")) {
				companyCode = this.getText(td);
			} else if (attrs.includes("views-field-field-building-address")) {
				address = this.getText(td);
			}
		}

		if (!companyName || !companyCode || !address || !href) {
			return null;
		}
		return { companyName, companyCode, address, href };
	}
	// END: Code generated with help from ChatGPT

	private getText(node: any): string {
		return node.childNodes?.find((t: any) => t.nodeName === "#text")?.value.trim() || "";
	}

	private parseCompanyPage(company: Company, doc: any): Office[] {
		const offices: Office[] = [];
		const visit = (node: any): void => {
			if (node.nodeName === "tr") {
				const o = this.extractOfficeRow(company, node);
				if (o) {
					offices.push(o);
				}
			}
			if (node.childNodes) {
				for (const c of node.childNodes) {
					visit(c);
				}
			}
		};
		visit(doc);
		return offices;
	}

	private extractOfficeRow(company: Company, nodeTr: any): Office | null {
		const tds = nodeTr.childNodes?.filter((td: any) => td.nodeName === "td") || [];

		let officeId = "";
		let headcount = 0;
		let type = "";
		let remote = "";
		let url = "";

		for (const td of tds) {
			const cls = td.attrs?.find((att: any) => att.name === "class")?.value || "";

			if (cls.includes("views-field-field-room-number")) {
				({ number: officeId, href: url } = this.extractIdAndUrl(td));
			} else if (cls.includes("views-field-field-room-capacity")) {
				headcount = this.extractHeadcount(td);
			} else if (cls.includes("views-field-field-room-type")) {
				type = this.getText(td);
			} else if (cls.includes("views-field-field-room-furniture")) {
				remote = this.getText(td);
			}
		}

		if (!officeId) {
			return null;
		}

		return this.createOffice(company, officeId, headcount, type, remote, url);
	}

	private extractIdAndUrl(td: any): { number: string; href: string } {
		const node = td.childNodes?.find((n: any) => n.nodeName === "a");
		if (!node) {
			return { number: "", href: "" };
		}
		const href = node.attrs?.find((att: any) => att.name === "href")?.value || "";
		const number = this.getText(node);
		return { number, href };
	}

	private extractHeadcount(td: any): number {
		const text = this.getText(td);
		const count = Number(text);
		return isNaN(count) ? 0 : count;
	}

	private createOffice(
		company: Company,
		officeId: string,
		headcount: number,
		type: string,
		remote: string,
		url: string
	): Office {
		return {
			companyName: company.companyName,
			companyCode: company.companyCode,
			officeId,
			name: `${company.companyCode}_${officeId}`,
			address: company.address,
			lat: 0,
			lon: 0,
			headcount,
			type,
			remote,
			url,
		};
	}
}
