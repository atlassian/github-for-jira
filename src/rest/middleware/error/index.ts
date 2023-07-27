
const RestErrorHandler = (err, req, res, next) => {
	if (req.url.includes("/rest")) {
		res.status(err.status || 500).send(err.message);
	} else {
		next(err);
	}
};

export default RestErrorHandler;


