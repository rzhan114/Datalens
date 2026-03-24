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

describe("InsightFacade", function () {
	let facade: IInsightFacade;

	// Declare datasets used in tests. You should add more datasets like this!
	let sections: string;
	let one: string;
	let cs: string;
	let empty: string;
	let noC: string;
	let noR: string;
	// let allBad: string;
	let bad: string;
	let non: string;
	//room
	let roomsZip: string;
	let index: string;
	let rooms: string;

	before(async function () {
		// This block runs once and loads the datasets.
		await clearDisk();
		sections = await getContentFromArchives("pair.zip");
		one = await getContentFromArchives("oneCourse.zip");
		empty = await getContentFromArchives("emptyCourse.zip");
		cs = await getContentFromArchives("csCourse.zip");
		noC = await getContentFromArchives("invalid_no_courses.zip");
		noR = await getContentFromArchives("invalid_no_result.zip");
		// allBad = await getContentFromArchives("invalid_all_bad_sections.zip");
		bad = await getContentFromArchives("invalid_bad_json.zip");
		non = await getContentFromArchives("nonCourse.zip");

		// Just in case there is anything hanging around from a previous run of the test suite
		roomsZip = await getContentFromArchives("campus.zip");
		index = await getContentFromArchives("index.zip");
		rooms = await getContentFromArchives("rooms.zip");
		sections = await getContentFromArchives("pair.zip");
	});

	describe("AddDatasetInV", function () {
		// let sections: string;
		// let facade: InsightFacade;
		// //goes into before because it acts like a constant and its state won't change between yesys
		// before(async function() {
		// 	sections = await getContentFromArchives("example.zip");
		// });
		//the facade may chnage state in different tests
		beforeEach(async function () {
			//because data stored in the disk and before each test we need to clear the disk
			await clearDisk();
			facade = new InsightFacade();
		});
		/*
		This part try to test the addData set with invlaid input
		*/
		//the ""
		it("should reject with an empty dataset id", async function () {
			// Read the "Free Mutant Walkthrough" in the spec for tips on how to get started!
			//getContentFromArchives help the whole zip file to the 64-base string

			try {
				await facade.addDataset("", one, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		//the " " white space
		it("should reject with  an empty dataset id", async function () {
			// Read the "Free Mutant Walkthrough" in the spec for tips on how to get started!
			//getContentFromArchives help the whole zip file to the 64-base string

			try {
				await facade.addDataset(" ", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});
		//the dupilate addition
		it("should reject if re-add a dataset with same ID", async function () {
			// Read the "Free Mutant Walkthrough" in the speyc for tips on how to get started!
			//getContentFromArchives help the whole zip file to the 64-base string
			const id = "section1";
			try {
				await facade.addDataset(id, sections, InsightDatasetKind.Sections);
				await facade.addDataset(id, sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.an.instanceOf(InsightError);
			}
		});
		//the "_"
		it("should reject the underscore id", async function () {
			try {
				await facade.addDataset("invalid_id", sections, InsightDatasetKind.Sections);
				expect.fail("There are problem in the error");
			} catch (error) {
				expect(error).to.be.instanceOf(InsightError);
			}
		});

		/*
		The invalid content

		empty = await getContentFromArchives("emptyCourse.zip");
		cs = await getContentFromArchives("csCourse.zip");
		noC = await getContentFromArchives("invalid_no_courses.zip");
		noR = await getContentFromArchives("invalid_no_result.zip");
		allBad = await getContentFromArchives("invalid_all_bad_sections.zip");
		bad = await getContentFromArchives("invalid_bad_json.zip");
		*/

		//the invalid dataset
		//1.constains no valid section(empty)
		it("should reject when dataset with empty section", async function () {
			try {
				// content is not base64
				await facade.addDataset("empty", empty, InsightDatasetKind.Sections);
				expect.fail("Expected addDataset to reject, but it resolved");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});
		//2. Not structured as a base64 string of a zip file.
		it("should reject when dataset content is not base64 string", async function () {
			try {
				// content is not base64
				await facade.addDataset("notBase64", "just a string", InsightDatasetKind.Sections);
				expect.fail("Expected addDataset to reject, but it resolved");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});
		//The invalid course

		//1. NOt JSON formatted file
		it("should reject when dataset is not jason formatted file", async function () {
			try {
				// content is not base64
				await facade.addDataset("bad", bad, InsightDatasetKind.Sections);
				expect.fail("Expected addDataset to reject, but it resolved");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});
		//2. NO valid sections.
		// it("should reject when dataset have no valid sections", async function () {
		// 	try {
		// 		// content is not base64
		// 		await facade.addDataset("allBad", allBad, InsightDatasetKind.Sections);
		// 		expect.fail("Expected addDataset to reject, but it resolved");
		// 	} catch (err) {
		// 		expect(err).to.be.instanceOf(InsightError);
		// 	}
		// });

		it("should reject when dataset have empty section", async function () {
			try {
				// content is not base64
				await facade.addDataset("non", non, InsightDatasetKind.Sections);
				expect.fail("Expected addDataset to reject, but it resolved");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});
		//3. Valid sections cannot be found within the result key
		it("should reject when sections cannot be found within the result key", async function () {
			try {
				// content is not base64
				await facade.addDataset("noR", noR, InsightDatasetKind.Sections);
				expect.fail("Expected addDataset to reject, but it resolved");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});
		//4.Not located in the folder called courses/ in the zip's root directory
		it("should reject if dataset not in the courses/ in the zip", async function () {
			try {
				// content is not base64
				await facade.addDataset("noC", noC, InsightDatasetKind.Sections);
				expect.fail("Expected addDataset to reject, but it resolved");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});
		//Invalid section
		//1. Not contains every field which can be used by a query
		it("should successfully add a valid rooms dataset", async function () {
			const result = await facade.addDataset("rooms", roomsZip, InsightDatasetKind.Rooms);
			expect(result).to.include("rooms");

			const list = await facade.listDatasets();
			expect(list).to.have.length(1);
			expect(list[0].id).to.equal("rooms");
			expect(list[0].kind).to.equal(InsightDatasetKind.Rooms);
			expect(list[0].numRows).to.be.greaterThan(0);
		});
		it("sucess with the code that add section and room", async function () {
			try {
				await facade.addDataset("index", index, InsightDatasetKind.Rooms);
				await facade.addDataset("section", sections, InsightDatasetKind.Sections);
				expect.fail("The error haven't thrown");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("reject with only index file", async function () {
			try {
				await facade.addDataset("index", index, InsightDatasetKind.Rooms);
				expect.fail("The error haven't thrown");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});
		it("reject with only campus-room information", async function () {
			try {
				await facade.addDataset("rooms", rooms, InsightDatasetKind.Rooms);
				expect.fail("The error haven't thrown.");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject invalid (empty) dataset content", async function () {
			try {
				await facade.addDataset("rooms", "just a string", InsightDatasetKind.Rooms);
				expect.fail("The data set haven't reject");
			} catch (error) {
				expect(error).to.be.instanceOf(InsightError);
			}
		});

		it("should reject when re-adding a dataset with same ID", async function () {
			await facade.addDataset("rooms", roomsZip, InsightDatasetKind.Rooms);
			await expect(facade.addDataset("rooms", roomsZip, InsightDatasetKind.Rooms)).to.be.rejectedWith(InsightError);
		});
	});

	describe("AddDatasetV", async function () {
		// let sections: string;
		// let facade: InsightFacade;
		// //goes into before because it acts like a constant and its state won't change between yesys
		// before(async function() {
		// 	sections = await getContentFromArchives("example.zip");
		// });
		//the facade may chnage state in different tests
		beforeEach(async function () {
			//because data stored in the disk and before each test we need to clear the disk
			await clearDisk();
			facade = new InsightFacade();
		});

		/*
		This part is only for the valid addition
		*/

		it("successfully pass the addDataset", async function () {
			const ids = await facade.addDataset("one", one, InsightDatasetKind.Sections);

			// test return value contains dataset id
			expect(ids).to.have.members(["one"]);

			// use listDatasets double check
			const d = await facade.listDatasets();
			expect(d).to.have.deep.members([
				{
					id: "one",
					kind: InsightDatasetKind.Sections,
					numRows: 41 /* number of vilad record */,
				},
			]);
		});
	});

	describe("RemoveDataset", function () {
		beforeEach(async function () {
			//because data stored in the disk and before each test we need to clear the disk
			await clearDisk();
			facade = new InsightFacade();
			//clear the disk after each test
		});
		/*
		This part just test the valid action of the system
		*/
		//test1-successfully removed the dataset
		it("successcfully remove one data set", async function () {
			await facade.addDataset("cs", cs, InsightDatasetKind.Sections);
			expect(await facade.removeDataset("cs")).to.equal("cs");
		});
		//test2-successfully removed two dataset
		it("successcfully remove more than one data set", async function () {
			await facade.addDataset("one", one, InsightDatasetKind.Sections);
			await facade.addDataset("cs", cs, InsightDatasetKind.Sections);
			expect(await facade.removeDataset("one")).to.equal("one");
			expect(await facade.removeDataset("cs")).to.equal("cs");
		});
		//test3-successfully removed the dataset and add it back
		it("successcfully remove one data set and re-add", async function () {
			await facade.addDataset("one", one, InsightDatasetKind.Sections);
			const name = await facade.removeDataset("one");
			expect(name).to.be.a("string").equal("one");
			await facade.addDataset("one", one, InsightDatasetKind.Sections);
			const result = await facade.listDatasets();
			expect(result).to.be.an("array").with.lengthOf(1);
			expect(result).to.deep.include.members([
				{
					id: "one",
					kind: InsightDatasetKind.Sections,
					numRows: 41 /* number of vilad record */,
				},
			]);
		});

		/*
		This part just test the invalid id during the removal action
		*/
		//test-1 the unexist id
		it("should reject the system because of the unexisting id", async function () {
			await facade.addDataset("one", one, InsightDatasetKind.Sections);
			try {
				await facade.removeDataset("on");
				expect.fail("Do not through the ecpected answer");
			} catch (error) {
				expect(error).to.be.instanceOf(NotFoundError);
			}
		});

		//test-2 the invalid id(ie. understore, whitespace)
		it("should reject the system because of the under_score id", async function () {
			// await facade.addDataset("o_n", one, InsightDatasetKind.Sections);
			try {
				await facade.removeDataset("on_");
				expect.fail("Do not through the ecpected answer");
			} catch (error) {
				expect(error).to.be.instanceOf(InsightError);
			}
		});

		//test-3 the invalid id(ie. understore, whitespace)
		it("should reject the system because of the only whitespace", async function () {
			// await facade.addDataset(" ", one, InsightDatasetKind.Sections);
			try {
				await facade.removeDataset(" ");
				expect.fail("Do not through the ecpected answer");
			} catch (error) {
				expect(error).to.be.instanceOf(InsightError);
			}
		});
	});

	describe("ListDatasets", function () {
		beforeEach(async function () {
			//because data stored in the disk and before each test we need to clear the disk
			await clearDisk();
			facade = new InsightFacade();
		});
		it("should an empty list id the system is empty", async function () {
			//call the listDatasets function
			try {
				const result = await facade.listDatasets();
				expect(result).to.be.an("array").that.is.empty;
			} catch (error) {
				expect.fail(`have problrm when list empty system, invalid error: ${error}`);
			}
		});

		it("should output a list of one the data set in the system", async function () {
			//call the listDatasets function
			await facade.addDataset("one", one, InsightDatasetKind.Sections);
			const result = await facade.listDatasets();
			expect(result).to.have.deep.members([
				{
					id: "one",
					kind: InsightDatasetKind.Sections,
					numRows: 41 /* number of vilad record */,
				},
			]);
			// } catch (error) {
			// 	expect.fail(`cannot correctly list all the datasets, invalid error: ${error}`);
			// }
		});

		it("should output a list of more than one data set in the system", async function () {
			//call the listDatasets function
			// try {
			await facade.addDataset("one", one, InsightDatasetKind.Sections);
			await facade.addDataset("cs", cs, InsightDatasetKind.Sections);
			const datasets = await facade.listDatasets();
			expect(datasets).to.be.an("array").with.lengthOf(2);
			expect(datasets).to.deep.includes.members([
				{
					id: "one",
					kind: InsightDatasetKind.Sections,
					numRows: 41 /* number of vilad record */,
				},
				{
					id: "cs",
					kind: InsightDatasetKind.Sections,
					numRows: 38 /* number of vilad record */,
				},
			]);
			// } catch (error) {
			// 	expect.fail(`cannot correctly list all the datasets, invalid error: ${error}`);
			// }
		});
	});

	// describe("PerformQuery", function () {
	// 	/**
	// 	 * Loads the TestQuery specified in the test name and asserts the behaviour of performQuery.
	// 	 *
	// 	 * Note: the 'this' parameter is automatically set by Mocha and contains information about the test.
	// 	 */
	// 	async function checkQuery(this: Mocha.Context): Promise<void> {
	// 		if (!this.test) {
	// 			throw new Error(
	// 				"Invalid call to checkQuery." +
	// 					"Usage: 'checkQuery' must be passed as the second parameter of Mocha's it(..) function." +
	// 					"Do not invoke the function directly."
	// 			);
	// 		}
	// 		// Destructuring assignment to reduce property accesses
	// 		const { input, expected, errorExpected } = await loadTestQuery(this.test.title);
	// 		let result: InsightResult[] = []; // dummy value before being reassigned
	// 		try {
	// 			result = await facade.performQuery(input);
	// 		} catch (err) {
	// 			if (!errorExpected) {
	// 				expect.fail(`performQuery threw unexpected error: ${err}`);
	// 			}
	// 			// TODO: replace this failing assertion with your assertions. You will need to reason about the code in this function
	// 			// to determine what to put here :)
	// 			return expect.fail("Write your assertion(s) here.");
	// 		}
	// 		if (errorExpected) {
	// 			expect.fail(`performQuery resolved when it should have rejected with ${expected}`);
	// 		}
	// 		// TODO: replace this failing assertion with your assertions. You will need to reason about the code in this function
	// 		// to determine what to put here :)
	// 		return expect.fail("Write your assertion(s) here.");
	// 	}

	// 	before(async function () {
	// 		facade = new InsightFacade();

	// 		// Add the datasets to InsightFacade once.
	// 		// Will *fail* if there is a problem reading ANY dataset.
	// 		const loadDatasetPromises: Promise<string[]>[] = [
	// 			facade.addDataset("sections", sections, InsightDatasetKind.Sections),
	// 		];

	// 		try {
	// 			await Promise.all(loadDatasetPromises);
	// 		} catch (err) {
	// 			throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
	// 		}
	// 	});

	// 	after(async function () {
	// 		await clearDisk();
	// 	});

	// 	// Examples demonstrating how to test performQuery using the JSON Test Queries.
	// 	// The relative path to the query file must be given in square brackets.
	// 	it("[valid/simple.json] SELECT dept, avg WHERE avg > 97", checkQuery);
	// 	it("[invalid/invalid.json] Query missing WHERE", checkQuery);
	// });

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
				//facade.addDataset("rooms", roomsZip, InsightDatasetKind.Rooms),
				facade.addDataset("sections", sections, InsightDatasetKind.Sections),
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
		it("[invalid/invalid.json] Query missing WHERE", checkQuery);
		it("[invalid/invalid-op-key.json] query op key invalid", checkQuery);
		it("[invalid/missing-op.json] query missing OPTIONS", checkQuery);
		it("[invalid/invalid-type-order.json] query type order invalid", checkQuery);
		it("[invalid/resultTooLarge.json] query result too large", checkQuery);

		it("[valid/is.json] SELECT dept WHERE dept IS aan*", checkQuery);
		it("[valid/LT.json] SELECT dept WHERE avg < 1", checkQuery);
		it("[valid/IS-error.json] SELECT dept WHERE dept IS c*", checkQuery);
		it("[valid/wildcard.json] SELECT dept WHERE avg > 94 AND dept IS cpsc*", checkQuery);
		it("[valid/or.json] SELECT dept WHERE avg > 99 OR dept IS aan*", checkQuery);
		it("[valid/eq.json] SELECT dept WHERE avg = 98", checkQuery);
		it("[invalid/asterisk-middle.json] SELECT dept WHERE dept IS ma*th", checkQuery);
		it("[invalid/asterisk-multiple.json] SELECT dept WHERE dept IS ***", checkQuery);
		it("[invalid/colprob.json] columns not array", checkQuery);
		it("[invalid/emptyand.json] empty and", checkQuery);
		it("[invalid/emptySC.json] empty SC", checkQuery);
		it("[invalid/emptyNEG.json] empty NEG", checkQuery);
		it("[invalid/emptyfilter.json] empty filter", checkQuery);
		it("[invalid/emptycol.json] empty col", checkQuery);
		it("[invalid/invalid-col-key.json] invalid op key", checkQuery);
		it("[invalid/invalid-col-name.json] invalid col name", checkQuery);
		it("[invalid/invalid-field-lc.json] invalid field lcomp", checkQuery);
		it("[invalid/invalid-field-mc.json] invalid mc", checkQuery);
		it("[invalid/invalid-field-sc.json] invalid sc", checkQuery);
		it("[invalid/invalid-field-and.json] invalid and", checkQuery);
		it("[invalid/invalid-filter-key.json] invalid or", checkQuery);
		it("[invalid/invalid-neg-field.json] invalid neg field", checkQuery);
		it("[invalid/invalid-mc-type.json] invalid mc type", checkQuery);
		it("[invalid/invalid-key-op.json] invalid key op", checkQuery);
		it("[invalid/invalid-mkey.json] invalid mkey", checkQuery);
		it("[invalid/emptyMC.json] empty MC", checkQuery);
		it("[invalid/emptyOP.json] empty OP", checkQuery);
		it("[invalid/emptyquery.json] empty query", checkQuery);
		it("[invalid/invalid-sc-fieldname.json] invalid sc fieldname", checkQuery);
		it("[invalid/invalid-sc-type.json] invalid sc type", checkQuery);
		it("[invalid/invalid-skey.json] invalid skey", checkQuery);
		it("[invalid/invalid-order-type.json] invalid order type", checkQuery);
		it("[invalid/mcomp-multiple-keys.json] mcomp multiple keys", checkQuery);
		it("[invalid/multipleMC.json] multiple MC", checkQuery);
		it("[invalid/multipleNEG.json] multiple NEG", checkQuery);
		it("[invalid/multipleSC.json] multiple SC", checkQuery);
		it("[invalid/mutiplekeywhere.json] multiple key where", checkQuery);
		it("[invalid/nonexistent-dataset.json] nonexistent dataset", checkQuery);
		it("[invalid/nonfilter.json] non filter", checkQuery);
		it("[invalid/nonnumber.json] non number", checkQuery);
		it("[invalid/notObjMc.json] not object MC", checkQuery);
		it("[invalid/notObjNEG.json] not object NEG", checkQuery);
		it("[invalid/notObjOp.json] not object OP", checkQuery);
		it("[invalid/notObjSC.json] not object SC", checkQuery);
		it("[invalid/ordernotincol.json] order not in columns", checkQuery);
		it("[invalid/query-col-not-in-dataset.json] query column not in dataset", checkQuery);
		it("[invalid/sc-not-object.json] sc not object", checkQuery);
		it("[invalid/AND-not-array.json] AND not array", checkQuery);
		it("[invalid/AND-zerokey.json] AND zero key", checkQuery);
		it("[invalid/nullwhere.json] empty where", checkQuery);
		it("[invalid/querynull.json] query null", checkQuery);
		it("[invalid/invalidfieldtype.json] invalid field type", checkQuery);
		it("[invalid/invalidjson.json] invalid json", checkQuery);
		it("[invalid/invalidtype.json] invalid type", checkQuery);
		it("[invalid/queryinvalidfield.json] query invalid field", checkQuery);
		it("[invalid/multiple-dataset.json] multiple dataset", checkQuery);
		it("[invalid/invalid-or.json] invalid or", checkQuery);
		it("[invalid/invalidJS.json] invalid json", checkQuery);
		it("[invalid/invalid-key-in-col.json] invalid key in col", checkQuery);
		it("[invalid/invalid-field-name-incol.json] invalid field name in col", checkQuery);
		it("[invalid/unknownfilter.json] unknown filter", checkQuery);
	});
});
