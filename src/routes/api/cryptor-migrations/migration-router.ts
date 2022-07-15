import { Router } from "express";
import { CryptorMigrationInstallationPost } from "./migration-installation";
import { CryptorMigrationInstallationVerificationPost } from "./migration-installation-verification";

export const CryptorMigrationRouter = Router();

CryptorMigrationRouter.post("/migrate-installation", CryptorMigrationInstallationPost);
CryptorMigrationRouter.post("/migrate-installation-verify", CryptorMigrationInstallationVerificationPost);

