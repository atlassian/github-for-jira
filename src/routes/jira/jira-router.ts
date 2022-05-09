import { Router } from "express";
import { JiraConfigurationRouter } from "./configuration/jira-configuration-router";
import { JiraSyncPost } from "./jira-sync-post";
import { JiraAtlassianConnectGet } from "./jira-atlassian-connect-get";
import { JiraEventsRouter } from "./events/jira-events-router";
import { JiraContextJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import axios from 'axios';

export const JiraRouter = Router();

const gheSpikeTest = async (req: any, res: any) => {
	try {
		const response = await axios.get(
			`http://github.internal.atlassian.com/login`,
			{
				responseType: "json"
			}
		);

		res.send({
			response: response.data,
			status: 200
		});
	} catch (e) {
		req.log.error("ERROR: ", e)
	}
};

JiraRouter.get("/atlassian-connect.json", JiraAtlassianConnectGet);
JiraRouter.use("/configuration", JiraConfigurationRouter);
JiraRouter.post("/sync", JiraContextJwtTokenMiddleware, JiraSyncPost);
JiraRouter.use("/events", JiraEventsRouter);

JiraRouter.post("/ghe/spike", gheSpikeTest);
