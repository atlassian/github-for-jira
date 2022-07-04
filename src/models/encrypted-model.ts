import { Model } from "sequelize";
import { EncryptionClient, CryptorSecretKey  } from "../util/encryption-client";
import Logger from 'bunyan';

export abstract class EncryptedModel<TSecretFields> extends Model{

	abstract getEncryptContext(field: TSecretFields): Promise<Record<string, string|number>>;
	abstract getCryptorKeyAlias(): CryptorSecretKey;

	async decrypt(field: TSecretFields , logger: Logger) {
		const ctx = await this.getEncryptContext(field);
		return await EncryptionClient.decrypt(this.getDataValue[field as any], ctx, logger);
	}

	async encrypt(field: TSecretFields , logger: Logger) {
		const ctx = await this.getEncryptContext(field);
		return await EncryptionClient.encrypt(this.getCryptorKeyAlias(), this.getDataValue[field as any], ctx, logger);
	}

}
