import fs from "fs";
import path from "path";
import { getJiraUtil } from "./jira-client-util";

describe("Jira util", () => {
	const loadFixture = (name: string) => {
		const base = path.resolve(__dirname, "../../../test/fixtures/text", name);
		const source = fs
			.readFileSync(`${base}.source.md`)
			.toString("utf-8")
			.trim();
		const rendered = fs
			.readFileSync(`${base}.rendered.md`)
			.toString("utf-8")
			.trim();
		return { source, rendered };
	};

	describe("#addJiraIssueLinks", () => {
		let util;
		let jiraClient;

		beforeEach(() => {
			jiraClient = {
				baseURL: "http://example.com",
				issues: {
					get: jest.fn()
				}
			};

			util = getJiraUtil(jiraClient);
		});

		it("should handle multiple Jira references appropriately", () => {
			const { source, rendered } = loadFixture("multiple-links");

			const issues = [
				{
					key: "TEST-2019",
					fields: {
						summary: "First Issue"
					}
				},
				{
					key: "TEST-2020",
					fields: {
						summary: "Second Issue"
					}
				},
				{
					key: "TEST-2021",
					fields: {
						summary: "Third Issue"
					}
				}
			];

			const result = util.addJiraIssueLinks(source, issues);

			expect(result).toBe(rendered);
		});

		it("should linkify Jira references to valid issues", () => {
			const { source, rendered } = loadFixture("existing-reference-link");
			const issues = [
				{
					key: "TEST-2019",
					fields: {
						summary: "Example Issue"
					}
				}
			];

			const result = util.addJiraIssueLinks(source, issues);
			expect(result).toBe(rendered);
		});

		it("should not add reference links if already present", () => {
			const { source, rendered } = loadFixture("previously-referenced");
			const issues = [
				{
					key: "TEST-2019",
					fields: {
						summary: "Example Issue"
					}
				}
			];
			const result = util.addJiraIssueLinks(source, issues);
			expect(result).toBe(rendered);
		});

		it("should not add reference to existing markdown links", () => {
			const { source, rendered } = loadFixture("existing-markdown-links");
			const issues = [
				{
					key: "TEST-2019",
					fields: {
						summary: "Example Issue"
					}
				},
				{
					key: "TEST-2020",
					fields: {
						summary: "Another Example Issue"
					}
				}
			];

			const result = util.addJiraIssueLinks(source, issues);
			expect(result).toBe(rendered);
		});

		it("should not linkify Jira references to invalid issues", () => {
			const text = "Should not linkify [TEST-123] as a link";
			const issues = [];

			const result = util.addJiraIssueLinks(text, issues);

			expect(result).toBe("Should not linkify [TEST-123] as a link");
		});

		it("should linkify only Jira references to valid issues", () => {
			const { source, rendered } = loadFixture("valid-and-invalid-issues");
			const issues = [
				{
					key: "TEST-200",
					fields: {
						summary: "Another Example Issue"
					}
				}
			];

			const result = util.addJiraIssueLinks(source, issues);
			expect(result).toBe(rendered);
		});

		it("should only pull issue keys from reference links", () => {
			const { source, rendered } = loadFixture("find-existing-references");
			const issues = [
				{
					key: "TEST-2019",
					fields: {
						summary: "First Issue"
					}
				},
				{
					key: "TEST-2020",
					fields: {
						summary: "Second Issue"
					}
				},
				{
					key: "TEST-2021",
					fields: {
						summary: "Third Issue"
					}
				}
			];

			const result = util.addJiraIssueLinks(source, issues);
			expect(result).toBe(rendered);
		});

		it("should linkify for issue keys with alphanumeric values", () => {
			const { source, rendered } = loadFixture("issue-keys-with-alphanumeric-values");
			const issues = [
				{
					key: "KEY-2018",
					fields: {
						summary: "First Issue"
					}
				},
				{
					key: "A1-2019",
					fields: {
						summary: "Second Issue"
					}
				},
				{
					key: "A1B2-2020",
					fields: {
						summary: "Third Issue"
					}
				},
				{
					key: "A1B2C3-2021",
					fields: {
						summary: "Fourth Issue"
					}
				},
				{
					key: "TEST1-2021",
					fields: {
						summary: "Fifth Issue"
					}
				}
			];

			const result = util.addJiraIssueLinks(source, issues);
			expect(result).toBe(rendered);
		});
	});
});
