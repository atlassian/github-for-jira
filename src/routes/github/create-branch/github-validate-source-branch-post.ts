import { Request, Response } from "express";

// Errors need to be returned as an array
export const GithubValidateSourceBranchPost = async (req: Request, res: Response): Promise<void> => {
	const { branchName } = req.body;

	if (!branchName) {
		res.status(400).json("WORKED AS");
		return;
	}

	if (branchName === "test") {
		res.status(400).json("WORKED AS");
		return;
	}

	res.status(200).json("WORKED AS");
};

