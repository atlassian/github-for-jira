import { Installation } from "./installation";

describe("Installation", ()=>{
	beforeEach(async ()=>{
		Installation.truncate();
	});
	describe("Encryption and decryption with cryptor", ()=>{
		it("should auto encrypted the new safeSharedSecret column when install", async ()=>{
			await Installation.install({
				host: "whatever.abc",
				clientKey: "xxx-xxx-xxx",
				sharedSecret: "some-plain-shared-secret",
				safeSharedSecret: "some-plain-shared-secret"
			});
			const result = await Installation.sequelize?.query('select "safeSharedSecret" from "Installations"', { plain: true });
			expect(result).toEqual({
				safeSharedSecret: "encrypted:some-plain-shared-secret"
			});
		});
		it("can decrypted the new safeSharedSecret column successfully", async ()=>{
			await Installation.install({
				host: "whatever.abc",
				clientKey: "xxx-xxx-xxx",
				sharedSecret: "some-plain-shared-secret",
				safeSharedSecret: "some-plain-shared-secret"
			});
			const installation = await Installation.findOne();
			expect(installation.safeSharedSecret).toBe("encrypted:some-plain-shared-secret");
			expect(await installation.decrypt("safeSharedSecret")).toBe("some-plain-shared-secret");
		});
	});
});
