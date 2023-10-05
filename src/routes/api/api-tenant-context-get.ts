import { Request, Response } from "express";
import axios from "axios";


/**
 * Makes a call to the TCS sidecar to get tenant state
 */
// const TENANT_CONTEXT_SIDECAR_BASE_URL = "http://tcs-sidecar:24143"; // TODO SET AS ENV VAR
const TENANT_CONTEXT_SIDECAR_BASE_URL = "http://tcs-sidecar:24143"; // TODO SET AS ENV VAR
// const TENANT_CONTEXT_SIDECAR_BASE_URL = "127.0.0.1:24143"; // TODO SET AS ENV VAR
// const TENANT_CONTEXT_SIDECAR_BASE_URL = "http://tcs-sidecar:24143/"; // TODO SET AS ENV VAR
export const ApiTenantContextGet = async (req: Request, res: Response): Promise<void> => {


	// if (!data) {
	// 	res.status(400)
	// 		.json({
	// 			message: "Please provide XXXXXXXX"
	// 		});
	// 	return;
	// }

	try {

		// https://tenant-context-service-useast.prod.atl-paas.net/entity/cloud/146563c5-090c-4c85-bb98-9979ad9bf3c0.abuse
		// const tcsResponse = await axios.get(`https://tenant-context-service-useast.prod.atl-paas.net/entity/cloud/zxventures.atlassian.net.tps`);
		const tcsResponse = await axios.get(`${TENANT_CONTEXT_SIDECAR_BASE_URL}/entity/cloud/joshkayjira.jira-dev.com.cloudid`);
		req.log.info("JK_TCS tcsResponse");
		req.log.info(tcsResponse);
		req.log.info(tcsResponse.data);
		res.json({ data: tcsResponse.data
		});
	} catch (err: unknown) {
		req.log.info("error");
		req.log.info(err);
		res.json({
			error: err
		});
	}
};
//
// atlas asap curl --aud tenant-context-service \
//   https://tenant-context-service-useast.prod.atl-paas.net/entity/cloud/zxventures.atlassian.net.tps
