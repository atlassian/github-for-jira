import { Router } from "express";
import { GithubManifestCompleteGet } from "~/src/routes/github/manifest/github-manifest-complete-get";

export const GithubManifestRouter = Router();

GithubManifestRouter.route("/:uuid/complete")
	.get(GithubManifestCompleteGet);