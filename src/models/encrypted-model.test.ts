import { DataTypes, Sequelize } from "sequelize";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";
import { EncryptedModel } from "./encrypted-model";

jest.mock("../util/encryption-client", () => {
	return {
		EncryptionClient: {
			GITHUB_SERVER_APP_SECRET: "secret-key-name",
			encrypt: jest.fn(),
			decrypt: jest.fn()
		}
	};
});

class Dummy extends EncryptedModel {
	id: number;
	name: string;
	a: string;
	b: string;

	getEncryptionSecretKey() {
		return EncryptionSecretKeyEnum.GITHUB_SERVER_APP;
	}

	async getEncryptContext(): Promise<Record<string, string | number>> {
		return { name: this.name };
	}

	getSecretFields() {
		return  ["a", "b"] as const;
	}

}

Dummy.init({
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false
	},
	name: {
		type: DataTypes.STRING,
		allowNull: false
	},
	a: {
		type: DataTypes.STRING,
		allowNull: false
	},
	b: {
		type: DataTypes.STRING,
		allowNull: false
	}
}, {
	hooks: {
		beforeSave: async (app, opts) => {
			await app.encryptChangedSecretFields(opts.fields);
		},

		beforeBulkCreate: async (apps, opts) => {
			for (const app of apps) {
				await app.encryptChangedSecretFields(opts.fields);
			}
		}
	},
	sequelize: new Sequelize("sqlite::memory:", {
		dialect: "postgres"
	})
});

const newId = () => {
	return Math.floor(Math.random() * 1000000);
};

describe("Encrypted model", () => {
	beforeEach(() => {
		EncryptionClient.encrypt = jest.fn(() => "foo") as any;
		EncryptionClient.decrypt = jest.fn(() => "bar") as any;
	});
	it("should encrypt successfully", async () => {
		await Dummy.sync();
		const id = newId();
		const dummy = Dummy.build({ id, name: "test", a: "aaa1", b: "bbb1" });
		await dummy.save();
		expect(EncryptionClient.encrypt).toHaveBeenNthCalledWith(1, "secret-key-name", "aaa1", { "name": "test" }, undefined);
		expect(EncryptionClient.encrypt).toHaveBeenNthCalledWith(2, "secret-key-name", "bbb1", { "name": "test" }, undefined);
	});
	it("should decypt successfully", async () => {
		await Dummy.sync();
		const id = newId();
		Dummy.create({ id, name: "test", a: "aaa1", b: "bbb1" });
		const dummy = await Dummy.findOne({ where: { name: "test" } });
		await dummy.decrypt("a");
		await dummy.decrypt("b");
		expect(EncryptionClient.decrypt).toHaveBeenNthCalledWith(1, "foo", { "name": "test" }, undefined);
		expect(EncryptionClient.decrypt).toHaveBeenNthCalledWith(2, "foo", { "name": "test" }, undefined);
	});
});
