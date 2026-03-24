import { expect } from "chai";
import InsightFacade from "../../src/controller/InsightFacade";
import { IInsightFacade, InsightDatasetKind, InsightError, NotFoundError } from "../../src/controller/IInsightFacade";
import { clearDisk, getContentFromArchives } from "../TestUtil";

describe("InsightFacade: Rooms", function () {
	let facade: IInsightFacade;
	let roomsZip: string;
	let index: string;
	let rooms: string;
	let sections: string;

	before(async function () {
		await clearDisk();
		roomsZip = await getContentFromArchives("campus.zip");
		index = await getContentFromArchives("index.zip");
		rooms = await getContentFromArchives("rooms.zip");
		sections = await getContentFromArchives("pair.zip");
	});

	beforeEach(async function () {
		await clearDisk();
		facade = new InsightFacade();
	});

	//

	describe("AddDataset - Rooms", function () {
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

	describe("RemoveDataset - Rooms", function () {
		it("should successfully remove an existing dataset", async function () {
			await facade.addDataset("rooms", roomsZip, InsightDatasetKind.Rooms);
			const id = await facade.removeDataset("rooms");
			expect(id).to.equal("rooms");

			const list = await facade.listDatasets();
			expect(list).to.be.empty;
		});

		it("should reject when removing non-existent dataset", async function () {
			await expect(facade.removeDataset("rooms")).to.be.rejectedWith(NotFoundError);
		});

		it("should reject invalid id format (underscore, empty)", async function () {
			await expect(facade.removeDataset("rooms_")).to.be.rejectedWith(InsightError);
			await expect(facade.removeDataset(" ")).to.be.rejectedWith(InsightError);
		});
	});
});
