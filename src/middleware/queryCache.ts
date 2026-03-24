import crypto from "crypto";

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

/**
 * A simple LRU (Least Recently Used) cache with TTL support.
 *
 * - Bounded capacity: when full, evicts the least-recently-used entry.
 * - TTL: entries expire after a configurable number of milliseconds.
 * - Used to cache query results keyed by SHA-256(JSON.stringify(query)).
 */
export class LRUCache<T> {
	private readonly capacity: number;
	private readonly ttlMs: number;
	private readonly map: Map<string, CacheEntry<T>>;

	constructor(capacity: number, ttlMs: number) {
		this.capacity = capacity;
		this.ttlMs = ttlMs;
		// Map insertion order = access order (we re-insert on get to move to end)
		this.map = new Map();
	}

	public get(key: string): T | undefined {
		const entry = this.map.get(key);
		if (!entry) {
			return undefined;
		}
		if (Date.now() > entry.expiresAt) {
			this.map.delete(key);
			return undefined;
		}
		// Move to end (most recently used)
		this.map.delete(key);
		this.map.set(key, entry);
		return entry.value;
	}

	public set(key: string, value: T): void {
		if (this.map.has(key)) {
			this.map.delete(key);
		} else if (this.map.size >= this.capacity) {
			// Evict least recently used (first key in insertion order)
			const lruKey = this.map.keys().next().value;
			if (lruKey !== undefined) {
				this.map.delete(lruKey);
			}
		}
		this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
	}

	public invalidate(): void {
		this.map.clear();
	}

	public size(): number {
		return this.map.size;
	}
}

const CACHE_MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE ?? "100", 10);
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const queryResultCache = new LRUCache<unknown[]>(CACHE_MAX_SIZE, CACHE_TTL_MS);

/**
 * Produce a stable cache key from a query object.
 * Uses SHA-256 of the canonically serialized JSON.
 */
export function buildCacheKey(query: unknown): string {
	const canonical = JSON.stringify(query);
	return crypto.createHash("sha256").update(canonical).digest("hex");
}
