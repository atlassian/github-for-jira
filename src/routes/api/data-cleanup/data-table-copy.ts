import { Request, Response } from "express";
import { getLogger } from "config/logger";
import { sequelize } from "models/sequelize";
import safeJsonStringify from "safe-json-stringify";

const log = getLogger("CopyTableData");

const getDataCopy = (src: string, dest: string) => {
	return `create table "${dest}" as select * from "${src}"`;
};

export const DataTableCopyPost = async (req: Request, res: Response): Promise<void> => {
	const src = req.query.src as string || undefined;
	const dest = req.query.dest as string || undefined;
	try {
		if (!src || !dest) throw new Error("src and dest must not be empty");
		const result = await sequelize.query(getDataCopy(src, dest));
		log.info({ result, src, dest }, "data copied");
		res.status(200).end("Done. Result: " + result);
	} catch (e) {
		log.error({ err: e, src, dest }, "Error copying data");
		res.status(500).end(safeJsonStringify(e));
	}
};
