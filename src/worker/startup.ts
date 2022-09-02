import { probot } from "./app";
import { sqsQueues } from "../sqs/queues";
import { getLogger } from "config/logger";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";

const logger = getLogger("worker");

let running = false;

const CRYPTOR_CHECK_INTEVAL_IN_MS = 5000;
const CRYPTOR_CHECK_MAX_COUNT = 5;

export async function start() {
	if (running) {
		logger.debug("Worker instance already running, skipping.");
		return;
	}

	logger.info("Micros Lifecycle: Starting queue processing");

	running = true;

	let count = 0;
	const handle = setInterval(async ()=>{
		if (count++ >= CRYPTOR_CHECK_MAX_COUNT || await isCryptorSidecarReady()) {
			clearInterval(handle);
			sqsQueues.start();
		} else {
			logger.warn("Cryptor sidecar not reading so wait for next check time", { count });
		}
	}, CRYPTOR_CHECK_INTEVAL_IN_MS);
}

export async function stop() {
	if (!running) {
		logger.debug("Worker instance not running, skipping.");
		return;
	}
	logger.info("Micros Lifecycle: Stopping queue processing");
	// TODO: change this to `probot.close()` once we update probot to latest version
	probot.httpServer?.close();

	await sqsQueues.stop();

	running = false;
}

const isCryptorSidecarReady = async () => {
	try {
		logger.info("Checking ecnryptor sidecar to see whether it is ready...");
		const cipherText = await EncryptionClient.encrypt(EncryptionSecretKeyEnum.GITHUB_SERVER_APP, "test", {});
		const result = await EncryptionClient.decrypt(cipherText, {});
		logger.info("Cryptor sidecar is ready, got result back: " + result);
		return true;
	} catch (e) {
		logger.warn("Cryptor sidecar is not ready yet", e);
		return false;
	}
};
