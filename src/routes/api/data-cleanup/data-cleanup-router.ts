import { Router } from "express";
import { RepoSyncStateCleanUpOrphanDataPost } from "./cleanup-reposyncstates";
import { DataTableCopyPost } from "./data-table-copy";

export const DataCleanupRouter = Router();
DataCleanupRouter.delete("/repo-sync-states", RepoSyncStateCleanUpOrphanDataPost);
DataCleanupRouter.post("/copy-data-table", DataTableCopyPost);


