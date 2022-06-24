
export default class EncryptedSession {


	constructor(cryptorClient, unsecureSessionObjectRef) {
		this.unsecureSessionObjectRef = unsecureSessionObjectRef;
		this.decryptedSession = await cryptorClient.decrypt(unsecureSessionObjectRef.encryptedData);
	}

	async put(key, value: string) {
		this.decryptedSession[key] = value;
		this.unsecureSessionObjectRef.encryptedData = await this.cryporClient.encrypt(JSON.stringify(this.decryptedSession));
	}

	get(key): string {
		return this.decryptedSession[key];
	}
}
