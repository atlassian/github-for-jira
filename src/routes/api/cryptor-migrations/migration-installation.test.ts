import express, { Application } from "express";
import bodyParser from "body-parser";
import { CryptorMigrationInstallationPost } from "./migration-installation";
import { Installation } from "models/installation";
import { getLogger } from "config/logger";
import supertest from "supertest";
import { v4 as UUID } from "uuid";
import { getHashedKey } from "models/sequelize";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 10_000;
const PRE_EXISTS_RECORDS = DEFAULT_BATCH_SIZE * 2;

describe("Migrate Installations sharedSecret", () => {

	let app: Application;

	beforeEach(async () => {

		//setup apps and route
		app = express();
		app.use(bodyParser.json());
		app.use((req, _, next) => {
			req.log = getLogger("test");
			req.addLogFields = jest.fn();
			next();
		});
		app.post("/migrate", CryptorMigrationInstallationPost);

		//setup db data
		await Installation.truncate();
		for (let i = 0; i < PRE_EXISTS_RECORDS; i++) {
			await Installation.install({
				host: "123",
				clientKey: UUID(),
				sharedSecret: "plain-text"
			});
		}
		await Installation.sequelize?.query(`update "Installations"
																				 set "encryptedSharedSecret" = NULL`);
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

		it("should only migrated records that provided id is greater than lastId", async () => {
			//Via beforeEach, DB now has 20 (DEFAULT_BATCH_SIZE * 2) records, all of which has NULL encryptedSharedSecret column
			const clientKey = UUID();
			//Doing bellow, db will have 21 records,
			//1 record with encryptedSharedSecret = "encrypted:plain-text"
			const newInst = await Installation.install({
				host: "123",
				clientKey,
				sharedSecret: "plain-text"
			});
			//now this 1 record with new encryptedSharedSecret = "encrypted:deprecated-plain-text"
			await Installation.sequelize!.query(`update "Installations"
																					 set "encryptedSharedSecret" = 'encrypted:deprecated-plain-text'
																					 where "clientKey" = '${getHashedKey(clientKey)}'`);
			//get the lastId of previous record
			//By calling the api with large batch size and lastId of the new record - 1
			await supertest(app).post("/migrate").send({ batchSize: 1000, lastId: newInst.id - 1 }).expect(200);
			//now we can asserting that the api should ONLY migrate that new record, with origin sharedSecret
			const shouldOnlyMigrate = await Installation.findOne({ where: { clientKey: getHashedKey(clientKey) } });
			expect(shouldOnlyMigrate.encryptedSharedSecret).toBe("encrypted:plain-text");
			//and assert previous records are NOT migrated, encryptedSharedSecret column is null
			const [rows]: [{ encryptedSharedSecret: string }[]] = await Installation.sequelize!.query(`select "encryptedSharedSecret"
																																																 from "Installations"
																																																 where "id" < ${newInst.id}`);
			expect(rows.length).toBe(PRE_EXISTS_RECORDS);
			expect(rows.every(r => r.encryptedSharedSecret === null)).toBe(true);
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
