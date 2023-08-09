import { getUserContext } from "./context";
import { getJiraJWT } from "../utils";
import Api from "../api";

jest.mock("../utils");
jest.mock("../api");


describe("getUserContext", () => {
	it("should pass jwt token correctly", async () => {

		const claim = {
			sub: "12345",
			iss: "some-key"
		};
		const token = `{}.${btoa(JSON.stringify(claim))}.{}`;
		jest.mocked(getJiraJWT).mockResolvedValue(token);

		jest.mocked(Api).app.getJiraCloudId = (() => Promise.resolve({
			data: {
				cloudId: "cloud-99999"
			}
		})) as any;;


		expect(await getUserContext()).toEqual({
			accountId: "12345",
			clientKey: "some-key",
			tenantId: "cloud-99999"
		});
	});
});
