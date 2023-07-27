
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const RestErrorHandler = (err, req, res, _) => {
	if (req.url.includes("/rest")) {
		res.status(err.status || 500).send(err.message);
	}
};

export default RestErrorHandler;


