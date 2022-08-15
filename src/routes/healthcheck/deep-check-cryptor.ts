import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";

export const deepCheckCryptor = async () => {

	let encryptedText: string;

	encryptedText = await EncryptionClient.encrypt(EncryptionSecretKeyEnum.GITHUB_SERVER_APP, "healthcheck-test-github-server-app");
	await EncryptionClient.decrypt(encryptedText);

	encryptedText = await EncryptionClient.encrypt(EncryptionSecretKeyEnum.JIRA_INSTANCE_SECRETS, "healthcheck-test-jira-instance-secret");
	await EncryptionClient.decrypt(encryptedText);

};

