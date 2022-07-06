import { Model } from "sequelize";
import { EncryptionClient, EncryptionSecretKeyEnum } from "utils/encryption-client";

type StringValues<Obj> = {
	[Prop in keyof Obj]: Obj[Prop] extends string ? Prop : never
};

export abstract class EncryptedModel extends Model {

	abstract getEncryptContext(field: (keyof StringValues<this>)): Promise<Record<string, string | number>>;

	abstract getEncryptionSecretKey(): EncryptionSecretKeyEnum;

	abstract getSecretFields(): readonly (keyof StringValues<this>)[];

	async decrypt(field: (keyof StringValues<this>)): Promise<string> {
		const value = this[field];
		if (typeof value !== "string") {
			throw new Error(`Cannot decrypt '${field}', it is not a string.`);
		}
		return await EncryptionClient.decrypt(value, await this.getEncryptContext(field));
	}

	protected async encrypt(field: (keyof StringValues<this>)): Promise<string> {
		const value = this[field];
		if (typeof value !== "string") {
			throw new Error(`Cannot encrypt '${field}', it is not a string.`);
		}
		return await EncryptionClient.encrypt(this.getEncryptionSecretKey(), value, await this.getEncryptContext(field));
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
