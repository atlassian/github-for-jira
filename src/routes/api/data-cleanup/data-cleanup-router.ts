import { Router } from "express";
import { RepoSyncStateCleanUpOrphanDataPost } from "./cleanup-reposyncstates";
import { SubscriptionJiraClientKeyRestorePost } from "./subscription-client-key-restore";

export const DataCleanupRouter = Router();
DataCleanupRouter.delete("/repo-sync-states", RepoSyncStateCleanUpOrphanDataPost);
DataCleanupRouter.post("/restore-subscription-client-key", SubscriptionJiraClientKeyRestorePost);


