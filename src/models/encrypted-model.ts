import { Model } from "sequelize";
import { EncryptionClient, EncryptionContext, EncryptionSecretKeyEnum } from "utils/encryption-client";

type StringValues<Obj> = {
	[Prop in keyof Obj]: Obj[Prop] extends string ? Prop : never
}[keyof Obj];

export abstract class EncryptedModel<C extends Model, K extends keyof Pick<C, StringValues<C>>> extends Model {

	abstract getEncryptContext(field: K): Promise<Record<string, string | number>>;

	abstract getEncryptionSecretKey(): EncryptionSecretKeyEnum;

	abstract getSecretFields(): readonly K[];

	async decrypt(value: string, context?: EncryptionContext): Promise<string> {
		return await EncryptionClient.decrypt(value, context);
	}

	protected async encrypt(value: string, context?: EncryptionContext): Promise<string> {
		return await EncryptionClient.encrypt(this.getEncryptionSecretKey(), value, context);
	}

	async encryptChangedSecretFields(fieldsChanged: string[] = []): Promise<void> {
		await Promise.all(fieldsChanged
			.filter(f => this.getSecretFields().includes(f as K))
			.map(async (field) => {
				const context = await this.getEncryptContext(field as K);
				this[field] = await this.encrypt(this[field], context);
			}));
	}
}
