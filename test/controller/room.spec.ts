import {
	IInsightFacade,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError,
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";
import { clearDisk, getContentFromArchives, loadTestQuery } from "../TestUtil";

import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

export interface ITestQuery {
	title?: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

describe("InsightFacadeRoomsQuery", function () {
	let facade: IInsightFacade;
	//room
	let roomsZip: string;

	before(async function () {
		// This block runs once and loads the datasets.
		await clearDisk();

		roomsZip = await getContentFromArchives("campus.zip");
	});

	describe("PerformQuery", function () {
		/**
		 * Loads the TestQuery specified in the test name and asserts the behaviour of performQuery.
		 *
		 * Note: the 'this' parameter is automatically set by Mocha and contains information about the test.
		 */
		async function checkQuery(this: Mocha.Context): Promise<void> {
			if (!this.test) {
				throw new Error(
					"Invalid call to checkQuery." +
						"Usage: 'checkQuery' must be passed as the second parameter of Mocha's it(..) function." +
						"Do not invoke the function directly."
				);
			}
			// Destructuring assignment to reduce property accesses
			const { input, expected, errorExpected } = await loadTestQuery(this.test.title);
			let result: InsightResult[] = []; // dummy value before being reassigned
			try {
				result = await facade.performQuery(input);
			} catch (err) {
				if (!errorExpected) {
					expect.fail(`performQuery threw unexpected error: ${err}`);
				}
				// TODO: replace this failing assertion with your assertions. You will need to reason about the code in this function
				// to determine what to put here :)
				//return expect.fail("Write your assertion(s) here.");
				if (expected === "ResultTooLargeError") {
					expect(err).to.be.instanceOf(ResultTooLargeError);
				} else if (expected === "NotFoundError") {
					expect(err).to.be.instanceOf(NotFoundError);
				} else {
					expect(err).to.be.instanceOf(InsightError);
				}
				return;
			}
			if (errorExpected) {
				expect.fail(`performQuery resolved when it should have rejected with ${expected}`);
			}
			// TODO: replace this failing assertion with your assertions. You will need to reason about the code in this function
			// to determine what to put here :)
			//return expect.fail("Write your assertion(s) here.");

			expect(result).to.deep.equal(expected);
		}

		before(async function () {
			facade = new InsightFacade();
			//sections = await getContentFromArchives("simple8.zip");

			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises: Promise<string[]>[] = [
				//facade.addDataset("sections", sections, InsightDatasetKind.Sections),
				facade.addDataset("rooms", roomsZip, InsightDatasetKind.Rooms),
				//facade.addDataset("sections", sections, InsightDatasetKind.Sections),
			];

			try {
				await Promise.all(loadDatasetPromises);
			} catch (err) {
				throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
			}
		});

		after(async function () {
			await clearDisk();
		});

		/* for room query*/
		it("[valid/room.json] SELECT rooms fields with simple WHERE", checkQuery);
		it("[valid/validroom.json] validroom", checkQuery);
		it("[valid/room_cols.json] room cols", checkQuery);

		it("[valid/apply_not_in_cols.json] valid apply not in columns", checkQuery);
		it("[valid/apply_empty.json] valid empty apply", checkQuery);
		it("[valid/group.json] valid group apply", checkQuery);
		it("[valid/empty_apply.json] valid empty apply order UP", checkQuery);
		it("[valid/multi_keys.json] valid order multiple keys", checkQuery);
		it("[valid/sort.json] valid room max and min", checkQuery);
		it("[valid/apply_rules.json] valid two apply rules", checkQuery);

		it("[invalid/c2/invalid_apply_token_value.json] invalid apply token value", checkQuery);
		it("[invalid/c2/duplicate_apply_key.json] invalid duplicate apply key", checkQuery);
		it("[invalid/c2/invalid_empty_group.json] empty group", checkQuery);
		it("[invalid/c2/missing_apply.json] invalid missing apply", checkQuery);
		it("[invalid/c2/missing_group.json] invalid missing group", checkQuery);
		it("[invalid/c2/missing_order_dir.json] missing order dir", checkQuery);
		it("[invalid/c2/invalid_order_keys.json] order keys not an array", checkQuery);
		it("[invalid/c2/transform_op.json] invalid transformation operator", checkQuery);
		it("[invalid/c2/missing_order_keys.json] missing order keys", checkQuery);
		it("[invalid/c2/apply_value.json] apply value", checkQuery);
	});
});
