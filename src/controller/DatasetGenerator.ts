// DatasetFactory.ts
import { InsightDatasetKind } from "./IInsightFacade";
import { SectionHelper } from "./SectionHelper";
import { RoomHelper } from "./RoomHelper";

export class DatasetGenerator {
	public static createHelper(kind: InsightDatasetKind): any {
		switch (kind) {
			case InsightDatasetKind.Listings:
				return new SectionHelper();
			case InsightDatasetKind.Offices:
				return new RoomHelper();
			default:
				throw new Error("Unknown dataset kind");
		}
	}
}
