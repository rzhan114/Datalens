import { InsightResult } from "./IInsightFacade";
import { Listing, Office } from "./InsightFacade";
import { AggregationRegistry } from "./AggregationStrategy";

export class TransformationEngine {
	private aggregationRegistry = new AggregationRegistry();

	public applyTransformations(data: Array<Listing | Office>, transformations: any): InsightResult[] {
		const groupKeys: string[] = transformations.GROUP;
		const applyRules: any[] = transformations.APPLY;

		// Step 1: Group the data by GROUP keys
		const groups = this.groupBy(data, groupKeys);

		// Step 2: Apply aggregations to each group
		const results: InsightResult[] = [];
		for (const [groupSignature, groupData] of groups.entries()) {
			const result: InsightResult = {};

			// Add GROUP keys to result
			const groupValues = JSON.parse(groupSignature);
			for (const key of groupKeys) {
				result[key] = groupValues[key];
			}

			// Apply aggregations
			for (const applyRule of applyRules) {
				const applyKey = Object.keys(applyRule)[0];
				const applyBody = applyRule[applyKey];
				const operation = Object.keys(applyBody)[0];
				const field = applyBody[operation];

				result[applyKey] = this.applyAggregation(groupData, operation, field);
			}

			results.push(result);
		}

		return results;
	}

	private groupBy(data: Array<Listing | Office>, groupKeys: string[]): Map<string, Array<Listing | Office>> {
		const groups = new Map<string, Array<Listing | Office>>();

		for (const item of data) {
			// Create a signature for this group
			const groupSignature: { [key: string]: string | number } = {};
			for (const key of groupKeys) {
				const field = key.split("_")[1];
				groupSignature[key] = item[field as keyof (Listing | Office)];
			}

			// Use JSON string as map key
			const signatureKey = JSON.stringify(groupSignature);

			// Add item to the appropriate group
			if (!groups.has(signatureKey)) {
				groups.set(signatureKey, []);
			}
			groups.get(signatureKey)!.push(item);
		}

		return groups;
	}

	private applyAggregation(group: Array<Listing | Office>, operation: string, fieldKey: string): number {
		const field = fieldKey.split("_")[1];

		// Extract values from the group
		const values: Array<string | number> = group.map((item) => item[field as keyof (Listing | Office)]);

		// Get the appropriate aggregation strategy and apply it
		const strategy = this.aggregationRegistry.getStrategy(operation);
		return strategy.apply(values);
	}
}
