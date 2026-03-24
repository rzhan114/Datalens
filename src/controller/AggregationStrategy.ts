import Decimal from "decimal.js";

export interface AggregationStrategy {
	apply(values: Array<string | number>): number;
}

export class MaxAggregation implements AggregationStrategy {
	public apply(values: Array<string | number>): number {
		const numValues = values.map((v) => Number(v));
		return Math.max(...numValues);
	}
}

export class MinAggregation implements AggregationStrategy {
	public apply(values: Array<string | number>): number {
		const numValues = values.map((v) => Number(v));
		return Math.min(...numValues);
	}
}

export class AvgAggregation implements AggregationStrategy {
	public apply(values: Array<string | number>): number {
		let total = new Decimal(0);
		for (const val of values) {
			total = total.add(new Decimal(val));
		}
		const avg = total.toNumber() / values.length;
		return Number(avg.toFixed(2));
	}
}

export class SumAggregation implements AggregationStrategy {
	public apply(values: Array<string | number>): number {
		const sum = values.reduce((acc: number, val) => acc + Number(val), 0);
		return Number(sum.toFixed(2));
	}
}

export class CountAggregation implements AggregationStrategy {
	public apply(values: Array<string | number>): number {
		const uniqueValues = new Set(values.map((v) => String(v)));
		return uniqueValues.size;
	}
}

export class AggregationRegistry {
	private strategies = new Map<string, AggregationStrategy>();

	constructor() {
		this.strategies.set("MAX", new MaxAggregation());
		this.strategies.set("MIN", new MinAggregation());
		this.strategies.set("AVG", new AvgAggregation());
		this.strategies.set("SUM", new SumAggregation());
		this.strategies.set("COUNT", new CountAggregation());
	}

	public getStrategy(operation: string): AggregationStrategy {
		const strategy = this.strategies.get(operation);
		if (!strategy) {
			throw new Error(`Unknown aggregation: ${operation}`);
		}
		return strategy;
	}
}
