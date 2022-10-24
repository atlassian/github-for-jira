import { Router } from "express";
import { DBMigrationUp } from "./db-migration-up";
import { DBMigrationDown } from "./db-migration-down";

export const DBMigrationsRouter = Router();
DBMigrationsRouter.post("/up", DBMigrationUp);
DBMigrationsRouter.post("/down", DBMigrationDown);

