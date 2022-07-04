import { Model } from "sequelize";
import { CryptorHttpClient, CryptorSecretKey  } from "../util/cryptor-http-client";
import Logger from 'bunyan';

export abstract class EncryptionModel<TSecretFields> extends Model{

	abstract getEncryptContext(field: TSecretFields): Promise<Record<string, string|number>>;
	abstract getCryptorKeyAlias(): CryptorSecretKey;

	async decrypt(field: TSecretFields , logger: Logger) {
		const ctx = await this.getEncryptContext(field);
		return await CryptorHttpClient.decrypt(this.getDataValue[field as any], ctx, logger);
	}

	async encrypt(field: TSecretFields , logger: Logger) {
		const ctx = await this.getEncryptContext(field);
		return await CryptorHttpClient.encrypt(this.getCryptorKeyAlias(), this.getDataValue[field as any], ctx, logger);
	}

}
