import { Router } from "express";
import { RepoSyncStateCleanUpOrphanDataPost } from "./cleanup-reposyncstates";

export const DataCleanupRouter = Router();
DataCleanupRouter.delete("/repo-sync-states", RepoSyncStateCleanUpOrphanDataPost);


