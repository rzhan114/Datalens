import { expect } from "chai";
import request from "supertest";
import Server from "../../src/rest/Server";
import { clearDisk, getContentFromArchives } from "../TestUtil";

describe("Server API Integration Tests (backend)", () => {
	let server: Server;
	let app: any;
	let base64: string;

	before(async () => {
		await clearDisk();
		server = new Server(1220);
		await server.start();
		app = (server as any).express;
		base64 = await getContentFromArchives("csCourse.zip");
	});

	after(async () => {
		await server.stop();
	});

	//get help from Ghatgpt
	// Test PUT /api/dataset/:id
	it("PUT /api/dataset/:id should add dataset successfully", async () => {
		const res = await request(app)
			.put("/api/dataset/courses")
			.set("Content-Type", "application/x-zip-compressed")
			.send(Buffer.from(base64, "base64"))
			.expect(200);

		expect(res.body).to.have.property("result");
		expect(res.body.result).to.include("courses");
	});

	//Test GET /api/datasets
	it("GET /api/datasets should list datasets", async () => {
		const res = await request(app).get("/api/datasets").expect(200);

		expect(res.body).to.have.property("result");
		expect(res.body.result).to.be.an("array");

		res.body.result.find((d: any) => d.id === "courses");
	});

	//Test DELETE /api/dataset/:id
	it("DELETE /api/dataset/:id should remove dataset successfully", async () => {
		const res = await request(app).delete("/api/dataset/courses").expect(200);

		expect(res.body).to.have.property("result");
		expect(res.body.result).to.equal("courses");

		const listRes = await request(app).get("/api/datasets").expect(200);

		const ids = listRes.body.result.map((d: any) => d.id);
		expect(ids).to.not.include("courses");
	});

	// Re-add dataset for subsequent tests
	it("PUT /api/dataset/:id should re-add dataset for query tests", async () => {
		const res = await request(app)
			.put("/api/dataset/courses")
			.set("Content-Type", "application/x-zip-compressed")
			.send(Buffer.from(base64, "base64"))
			.expect(200);

		expect(res.body).to.have.property("result");
		expect(res.body.result).to.include("courses");
	});

	it("GET /api/departments/:id should return list of departments", async () => {
		const res = await request(app).get("/api/departments/courses").expect(200);

		expect(res.body).to.have.property("result");
		expect(res.body.result).to.be.an("array");

		if (res.body.result.length > 0) {
			expect(res.body.result[0]).to.be.a("string");
		}
	});

	it("GET /api/courses/:id/:dept should return list of courses in department", async () => {
		const deptRes = await request(app).get("/api/departments/courses").expect(200);
		const departments = deptRes.body.result;

		if (departments.length === 0) {
			return;
		}

		const dept = departments[0];
		const res = await request(app).get(`/api/courses/courses/${dept}`).expect(200);

		expect(res.body).to.have.property("result");
		expect(res.body.result).to.be.an("array");

		if (res.body.result.length > 0) {
			expect(res.body.result[0]).to.have.property("id");
			expect(res.body.result[0]).to.have.property("title");
		}
	});

	it("GET /api/course-trend/:id/:dept/:courseId should return pass/fail trend for a course", async () => {
		const deptRes = await request(app).get("/api/departments/courses").expect(200);
		const departments = deptRes.body.result;

		if (departments.length === 0) {
			return;
		}

		const dept = departments[0];
		const coursesRes = await request(app).get(`/api/courses/courses/${dept}`).expect(200);
		const courses = coursesRes.body.result;

		if (courses.length === 0) {
			return;
		}

		const courseId = courses[0].id;
		const res = await request(app).get(`/api/course-trend/courses/${dept}/${courseId}`).expect(200);

		expect(res.body).to.have.property("result");
		expect(res.body.result).to.be.an("array");

		if (res.body.result.length > 0) {
			const trendData = res.body.result[0];
			expect(trendData).to.have.property("year");
			expect(trendData).to.have.property("pass");
			expect(trendData).to.have.property("fail");
			expect(trendData).to.have.property("audit");
			expect(trendData).to.have.property("passRate");
			expect(trendData).to.have.property("total");
			expect(trendData.year).to.be.a("number");
			expect(trendData.pass).to.be.a("number");
			expect(trendData.fail).to.be.a("number");
			expect(trendData.passRate).to.be.a("number");
		}
	});

	it("GET /api/course-instructors/:id/:dept/:courseId should return instructors with grades for a course", async () => {
		const deptRes = await request(app).get("/api/departments/courses").expect(200);
		const departments = deptRes.body.result;

		if (departments.length === 0) {
			return;
		}

		const dept = departments[0];
		const coursesRes = await request(app).get(`/api/courses/courses/${dept}`).expect(200);
		const courses = coursesRes.body.result;

		if (courses.length === 0) {
			return;
		}

		const courseId = courses[0].id;
		const res = await request(app).get(`/api/course-instructors/courses/${dept}/${courseId}`).expect(200);

		expect(res.body).to.have.property("result");
		expect(res.body.result).to.be.an("array");

		if (res.body.result.length > 0) {
			const instructor = res.body.result[0];
			expect(instructor).to.have.property("instructor");
			expect(instructor).to.have.property("avgGrade");
			expect(instructor).to.have.property("sectionCount");
			expect(instructor.avgGrade).to.be.a("number");
			expect(instructor.sectionCount).to.be.a("number");
		}
	});

	it("GET /api/instructors/:id/:dept should return list of unique instructors in department", async () => {
		const deptRes = await request(app).get("/api/departments/courses").expect(200);
		const departments = deptRes.body.result;

		if (departments.length === 0) {
			return;
		}

		const dept = departments[0];
		const res = await request(app).get(`/api/instructors/courses/${dept}`).expect(200);

		expect(res.body).to.have.property("result");
		expect(res.body.result).to.be.an("array");

		if (res.body.result.length > 0) {
			expect(res.body.result[0]).to.be.a("string");
		}

		const uniqueInstructors = [...new Set(res.body.result)];
		expect(res.body.result).to.have.lengthOf(uniqueInstructors.length);
	});

	it("GET /api/instructors/:id/:dept should fail for non-existent dataset", async () => {
		const res = await request(app).get("/api/instructors/nonexistent/cpsc").expect(400);

		expect(res.body).to.have.property("error");
	});

	it("GET /api/instructor-courses/:datasetId/:instructorName should return courses taught by instructor", async () => {
		const deptRes = await request(app).get("/api/departments/courses").expect(200);
		const departments = deptRes.body.result;

		if (departments.length === 0) {
			return;
		}

		const dept = departments[0];
		const instructorsRes = await request(app).get(`/api/instructors/courses/${dept}`).expect(200);
		const instructors = instructorsRes.body.result;

		if (instructors.length === 0) {
			return;
		}

		const instructorName = instructors[0];
		const res = await request(app)
			.get(`/api/instructor-courses/courses/${encodeURIComponent(instructorName)}`)
			.expect(200);

		expect(res.body).to.have.property("result");
		expect(res.body.result).to.be.an("array");

		if (res.body.result.length > 0) {
			const course = res.body.result[0];
			expect(course).to.have.property("id");
			expect(course).to.have.property("title");
			expect(course).to.have.property("dept");
			expect(course).to.have.property("year");
			expect(course).to.have.property("avg");
		}
	});

	it("GET /api/instructor-courses/:datasetId/:instructorName should fail for non-existent dataset", async () => {
		const res = await request(app).get("/api/instructor-courses/nonexistent/smith").expect(400);

		expect(res.body).to.have.property("error");
	});
});
