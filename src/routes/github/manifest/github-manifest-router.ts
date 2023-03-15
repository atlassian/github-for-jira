import { Router } from "express";
import { GithubManifestCompleteGet } from "~/src/routes/github/manifest/github-manifest-complete-get";

export const GithubManifestRouter = Router();

/**
 * TODO: Store the gheHost temporarily
 * The URL parameters here are still vulnerable as this route does not require any authentication
 */
GithubManifestRouter.route("/:uuid/:gheHost")
	.get(GithubManifestCompleteGet);