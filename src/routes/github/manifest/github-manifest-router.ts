import { Router } from "express";
import { GithubManifestCompleteGet } from "~/src/routes/github/manifest/github-manifest-complete-get";
import { GithubManifestGet } from "routes/github/manifest/github-manifest-get";

export const GithubManifestRouter = Router();

GithubManifestRouter.route("/complete/:uuid")
	.get(GithubManifestCompleteGet);

GithubManifestRouter.route("/:uuid")
	.get(GithubManifestGet);
