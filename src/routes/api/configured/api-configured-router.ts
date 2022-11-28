import { Router } from "express";
import { ApiConfiguredGet } from "routes/api/configured/api-configured-get";
import { ApiConfiguredPost } from "routes/api/configured/api-configured-post";

export const ApiConfiguredRouter = Router({ mergeParams: true });

ApiConfiguredRouter.get("/:installationId", ApiConfiguredGet);
ApiConfiguredRouter.post("/", ApiConfiguredPost);

// atlas slauth curl -a github-for-jira -g micros-sv--github-for-jira-dl-admins -- \
// -v https://jkay-tunnel.public.atlastunnel.com/api/configuraconfiguredtion/31342166

// atlas slauth curl -a github-for-jira -g micros-sv--github-for-jira-dl-admins -- \
// -v https://jkay-tunnel.public.atlastunnel.com/api/configured \
// -H "Content-Type: application/json" \
// -d '{"installationIds": [31342166]}'

