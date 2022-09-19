import { Router } from "express";
import { DBMigrationUp } from "./db-migrationn-up";

export const DBMigrationsRouter = Router();
DBMigrationsRouter.post("/up", DBMigrationUp);

