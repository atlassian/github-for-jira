/**
 * Mimicks APIs from https://developer.atlassian.com/platform/cryptor/integration/integrating-sidecar/#rest-api
 */

const http = require("http");
const crypto = require('crypto');

const algorithm = 'aes-256-ctr';
const secretKey = crypto.createHash('sha256').update(String("foo")).digest('base64').substr(0, 32);
const seed = crypto.randomBytes(16);

const encrypt = (plainText) => {
	const cipher = crypto.createCipheriv(algorithm, secretKey, seed);
	const encryptedBuffer = Buffer.concat([cipher.update(plainText), cipher.final()]);
	return encryptedBuffer.toString('hex');
};

const decrypt = (cipherText) => {
	const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(seed, 'hex'));
	const plainTextBuffer = Buffer.concat([decipher.update(Buffer.from(cipherText, 'hex')), decipher.final()]);
	return plainTextBuffer.toString();
};

function writeOKResponse(response, obj) {
	console.log("OK", obj);
	response.writeHead(200, {"Content-Type": "application/json"});
	response.write(JSON.stringify(obj));
	response.end();
}

function writeError(response, status, message) {
	console.log("Error", status, message);
	response.writeHead(status, {"Content-Type": "application/json"});
	response.write(JSON.stringify({
		error: message
	}));
	response.end();
}

http.createServer(function(request, response) {

	console.log(request.method, request.url, request.headers);
	let body = '';
	request.on('data', (chunk) => {
		body += chunk;
	});
	request.on('end', () => {
		console.log(body);
		try {
			if (request.url.indexOf("healthcheck") >= 0) {
				return writeOKResponse(response, {
					ok: true
				});
			}

			if (request.method !== 'POST') {
				return writeError(response, 405, "Method not allowed");
			}

			if (request.headers['content-type'].toLowerCase().indexOf("application/json") < 0) {
				return writeError(response, 415, "Unsupported media type");
			}

			if (request.headers['x-cryptor-client'].indexOf(process.env.CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE) < 0) {
				return writeError(response, 403, "Identification challenge failed, expected \"" +
					process.env.CRYPTOR_SIDECAR_CLIENT_IDENTIFICATION_CHALLENGE +
					"\", but was \"" + request.headers['x-cryptor-client']);
			}

			if (request.url.indexOf("encrypt") >= 0) {
				return writeOKResponse(response, {
					cipherText: encrypt(body)
				});
			}

			if (request.url.indexOf("decrypt") >= 0) {
				const decrypted = JSON.parse(decrypt(JSON.parse(body).cipherText));

				if (JSON.stringify(JSON.parse(body).encryptionContext) === JSON.stringify(decrypted.encryptionContext)) {
					return writeOKResponse(response,{
						plainText: decrypted.plainText
					});
				}

				return writeError(response, 403, "Wrong encryption context");
			}

			return writeError(response, 404, "Page not found");

		} catch (e) {

			console.error(e);
			return writeError(response, 500, "Internal server error");
		}

	});
}).listen(26272);

console.log("Running cryptor-sidecar mock at port 26727, CTRL + C to shutdown");
