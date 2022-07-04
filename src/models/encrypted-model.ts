import { Model } from "sequelize";
import { EncryptionClient, CryptorSecretKey } from "../util/encryption-client";
import Logger from "bunyan";

export abstract class EncryptedModel<TModel extends EncryptedModel<TModel, TSecretField>, TSecretField extends keyof TModel> extends Model {

	abstract getEncryptContext(field: TSecretField): Promise<Record<string, string | number>>;
	abstract getCryptorKeyAlias(): CryptorSecretKey;
	abstract getAllSecretFields(): TSecretField[];

	async decrypt(field: TSecretField, logger?: Logger) {
		const ctx = await this.getEncryptContext(field);
		return await EncryptionClient.decrypt(this.getDataValue(field as any), ctx, logger);
	}

	protected async encrypt(field: TSecretField, logger?: Logger) {
		const ctx = await this.getEncryptContext(field);
		return await EncryptionClient.encrypt(this.getCryptorKeyAlias(), this.getDataValue(field as any), ctx, logger);
	}

	async encryptChangedSecretFields(app: TModel, fieldsChanged: (keyof TModel)[], logger?: Logger) {
		for (const f of this.getAllSecretFields()) {
			if (fieldsChanged?.includes(f)) {
				const encrypted = await app.encrypt(f, logger);
				app.setDataValue(f, encrypted as any);
			}
		}
	}

}
