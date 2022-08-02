import { Router } from "express";
import { GithubManifestCompleteGet } from "~/src/routes/github/manifest/github-manifest-complete-get";
import { GithubManifestGet } from "~/src/routes/github/manifest/github-manifest-get";

export const GithubManifestRouter = Router();

GithubManifestRouter.route("/")
	.get(GithubManifestGet);
GithubManifestRouter.route("/:uuid/complete")
	.get(GithubManifestCompleteGet);