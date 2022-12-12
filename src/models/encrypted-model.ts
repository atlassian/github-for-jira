import { Model } from "sequelize";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";
import { getLogger } from "config/logger";

type StringValues<Obj> = {
	[Prop in keyof Obj]: Obj[Prop] extends string ? Prop : never
};

const logger = getLogger("encryption-model");

export abstract class EncryptedModel extends Model {

	abstract getEncryptContext(field: (keyof StringValues<this>)): Promise<Record<string, string | number>>;

	abstract getEncryptionSecretKey(): EncryptionSecretKeyEnum;

	abstract getSecretFields(): readonly (keyof StringValues<this>)[];

	async decrypt(field: (keyof StringValues<this>)): Promise<string> {
		const value = this[field];
		if (typeof value !== "string") {
			//error TS2731: Implicit conversion of a 'symbol' to a 'string' will fail at runtime. Consider wrapping this expression in 'String(...)'.
			throw new Error(`Cannot decrypt '${String(field)}', it is not a string.`);
		}
		try {
			return await EncryptionClient.decrypt(value, await this.getEncryptContext(field));
		} catch (e) {
			logger.error(`Fail to decrypt field ${String(field)}`, { error: e });
			throw e;
		}
	}

	protected async encrypt(field: (keyof StringValues<this>)): Promise<string> {
		const value = this[field];
		if (typeof value !== "string") {
			//error TS2731: Implicit conversion of a 'symbol' to a 'string' will fail at runtime. Consider wrapping this expression in 'String(...)'.
			throw new Error(`Cannot encrypt '${String(field)}', it is not a string.`);
		}
		try {
			return await EncryptionClient.encrypt(this.getEncryptionSecretKey(), value, await this.getEncryptContext(field));
		} catch (e) {
			logger.error(`Fail to encrypt field ${String(field)}`, { error: e });
			throw e;
		}
	}

	async encryptChangedSecretFields(fieldsChanged: string[] = []): Promise<void> {
		const fieldsChangedTyped = fieldsChanged as (keyof StringValues<this>)[];
		await Promise.all(
			this.getSecretFields()
				.filter(f => fieldsChangedTyped.includes(f))
				.map(async (f) => {
					this[f] = await this.encrypt(f) as any;
				})
		);
	}
}
