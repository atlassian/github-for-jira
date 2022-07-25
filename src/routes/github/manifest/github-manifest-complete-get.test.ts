import { Installation } from "~/src/models/installation";
import { GithubManifestCompleteGet } from "~/src/routes/github/manifest/github-manifest-complete-get";
import { v4 as UUID } from "uuid";


const createGheNockPost = (url, status, response) => {
	gheApiNock
		.post(url)
		.reply(status, response);
};

describe("github-manifest-complete-get", () => {
	let req, res;
	const uuid = UUID();

	beforeEach(async () => {
		req = {
			params: {
				uuid
			},
			query: {
				code: "ABCDEFGH"
			},
			session: {
				temp: {
					gheHost: "https://github.mydomain.com"
				}
			}
		};
		res = {
			locals: {
				jiraHost: "http://jira.example.com"
			},
			json: jest.fn()
		};

	});

	it("Should throw error if Jira host not found", async () => {
		res = {
			locals: {
			}
		};
		await expect(GithubManifestCompleteGet(req, res))
			.rejects
			.toThrow("Jira Host not found");
	});

	it("Should throw error if GHE host not found", async () => {
		req = {
			params: {
				uuid: "12345"
			},
			session: {
				temp: {}
			}
		};
		await expect(GithubManifestCompleteGet(req, res))
			.rejects
			.toThrow("GitHub Enterprise Host not found");
	});

	it("should throw error if installation not found", async () => {
		createGheNockPost(`/app-manifests/${req.query.code}/conversions`, 200, {
			id: "100",
			name: "github-for-jira",
			client_id: "client_id_test",
			client_secret: "client_secret_test",
			webhook_secret: "webhook_secret_test",
			pem: "private_key_test"
		});
		await expect(GithubManifestCompleteGet(req, res))
			.rejects
			.toThrow("No Installation found ");
	});

	it("should complete app manifest flow", async () => {
		createGheNockPost(`/app-manifests/${req.query.code}/conversions`, 200, {
			id: "100",
			name: "github-for-jira",
			client_id: "client_id_test",
			client_secret: "client_secret_test",
			webhook_secret: "webhook_secret_test",
			pem: "private_key_test"
		});
		await Installation.install({
			host: res.locals.jiraHost,
			sharedSecret: "new-encrypted-shared-secret",
			clientKey: "client-key"
		});
		await GithubManifestCompleteGet(req, res);
		expect(res.json).toBeCalled();
	});

});