export interface IDatasetHelper<T> {
	extract(zipBuffer: Buffer): Promise<T[]>;
}
