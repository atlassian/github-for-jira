/**
 * Mimicks APIs from https://developer.atlassian.com/platform/cryptor/integration/integrating-sidecar/#rest-api
 */

const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
app.get("/healthcheck", (_, res)=>{
	res.send({ok: true});
});
app.post("/cryptor/encrypt/*", (req, res) => {
	if (req.headers["x-cryptor-client"] !== process.env.CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE) {
		res.status(403).send("Wrong challenge");
		return;
	}
	const plainText = req.body.plainText;
	if (!plainText) {
		res.status(400).send("Missing plainText in body");
		return;
	}
	const ret = {
		cipherText: `encrypted:${plainText}`,
		originPlainText: plainText
	};
	console.log('-- cyrptor mock encrypt', {ret});
	res.status(200).json(ret);
});
app.post("/cryptor/decrypt", (req, res) => {
	if (req.headers["x-cryptor-client"] !== process.env.CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE) {
		res.status(403).send("Wrong challenge");
		return;
	}
	const cipherText = req.body.cipherText;
	if (!cipherText) {
		res.status(400).send("Missing cipherText in body");
		return;
	}
	if (!cipherText.startsWith("encrypted:")) {
		res.status(400).end("Cipher text should startsWith 'encrypted:' in this mock cryptor");
		return;
	}
	const ret = {
		plainText: cipherText.substring("encrypted:".length),
		originCipherText: cipherText
	};
	console.log('-- cyrptor mock decrypt', {ret});
	res.status(200).json(ret);
});

app.listen(26272, () => {
	console.log(`Cryptor mock app running on 26272`);
});
