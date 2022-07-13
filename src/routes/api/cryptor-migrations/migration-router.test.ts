import express, { Application } from "express";
import bodyParser from "body-parser";
import { CryptorMigrationInstallationPost } from "./migration-router";
import { Installation } from "models/installation";
import { getLogger } from "config/logger";
import supertest from "supertest";
import { v4 as UUID } from "uuid";
import { getHashedKey } from "models/sequelize";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 10_000;

describe("Migrate Installations sharedSecret", () => {

	let app: Application;

	beforeEach(async () => {

		//setup apps and route
		app = express();
		app.use(bodyParser.json());
		app.use((req, _, next) => {req.log = getLogger("test"); next();});
		app.post("/migrate", CryptorMigrationInstallationPost);

		//setup db data
		await Installation.truncate();
		for (let i = 0; i < DEFAULT_BATCH_SIZE * 2; i++) {
			await Installation.install({
				host: "123",
				clientKey: UUID(),
				sharedSecret: "plain-text"
			});
		}
		await Installation.sequelize?.query(`update "Installations" set "encryptedSharedSecret" = NULL`);
	});

	describe("apply migration", () => {

		it("should successfully migrate sharedSecret to encryptedSharedSecret", async () => {
			await supertest(app)
				.post("/migrate")
				.send({ batchSize: 1 })
				.expect(200);
			const installations: Installation[] = await Installation.findAll();
			const migrated = installations.filter(inst => !!inst.encryptedSharedSecret);
			expect(migrated.length).toBe(1);
			expect(migrated[0].encryptedSharedSecret).toBe("encrypted:plain-text");
			expect(await migrated[0].decrypt("encryptedSharedSecret")).toBe("plain-text");
		});

		it("should only migrated records that encryptedSharedSecret is null", async () => {
			//Via beforeEach, DB now has 20 (DEFAULT_BATCH_SIZE * 2) records, all of which has NULL encryptedSharedSecret column
			const clientKey = UUID();
			//Doing bellow, db will have 21 records,
			//20 has encryptedSharedSecret NULL,
			//1 record with encryptedSharedSecret = "do_not_migrate_this"
			await Installation.install({
				host: "123",
				clientKey,
				sharedSecret: "plain-text"
			});
			await Installation.sequelize?.query(`update "Installations" set "encryptedSharedSecret" = 'do_not_migrate_this' where "clientKey" = '${getHashedKey(clientKey)}'`);
			//By calling the api three times, it should migrate 30 records at most
			await supertest(app).post("/migrate").expect(200);
			await supertest(app).post("/migrate").expect(200);
			await supertest(app).post("/migrate").expect(200);
			//now we can asserting that the 30 records should NOT migrate that new 1 records.
			const shouldNotMigrate = await Installation.findOne({ where: { clientKey: getHashedKey(clientKey) } });
			expect(shouldNotMigrate.encryptedSharedSecret).toBe("do_not_migrate_this");
		});

	});

	describe("Params validation", () => {

		it("should use provided batchsize if valid", async () => {
			await supertest(app)
				.post("/migrate")
				.send({ batchSize: 2 })
				.expect(200);
			const installations: Installation[] = await Installation.findAll();
			const migratedCount = installations.filter(inst => !!inst.encryptedSharedSecret).length;
			expect(migratedCount).toBe(2);
		});

		it("should use default batchsize if missing", async () => {
			await supertest(app)
				.post("/migrate")
				.expect(200);
			const installations: Installation[] = await Installation.findAll();
			const migratedCount = installations.filter(inst => !!inst.encryptedSharedSecret).length;
			expect(migratedCount).toBe(10);
		});

		it("should use default batchsize if out of bound -- bellow zero", async () => {
			await supertest(app)
				.post("/migrate")
				.send({ batchsize: -1 })
				.expect(200);
			const installations: Installation[] = await Installation.findAll();
			const migratedCount = installations.filter(inst => !!inst.encryptedSharedSecret).length;
			expect(migratedCount).toBe(10);
		});

		it("should use default batchsize if out of bound -- above max", async () => {
			await supertest(app)
				.post("/migrate")
				.send({ batchsize: MAX_BATCH_SIZE + 1 })
				.expect(200);
			const installations: Installation[] = await Installation.findAll();
			const migratedCount = installations.filter(inst => !!inst.encryptedSharedSecret).length;
			expect(migratedCount).toBe(10);
		});

		it("should use default batchsize if not a number", async () => {
			await supertest(app)
				.post("/migrate")
				.send({ batchsize: "whatever" })
				.expect(200);
			const installations: Installation[] = await Installation.findAll();
			const migratedCount = installations.filter(inst => !!inst.encryptedSharedSecret).length;
			expect(migratedCount).toBe(10);
		});
	});

});
