import { generateApiKey, hashApiKey } from "../../lib/password.js";
import { apiKeysRepository } from "./apiKeys.repository.js";
import type { CreateApiKeyInput } from "./apiKeys.schema.js";

export const apiKeysService = {
  list(userId: string) {
    return apiKeysRepository.listForUser(userId);
  },

  async create(userId: string, input: CreateApiKeyInput) {
    const { key, prefix } = generateApiKey();
    const record = await apiKeysRepository.create({
      userId,
      name: input.name,
      wordpressSiteId: input.wordpressSiteId,
      scopes: input.scopes,
      keyPrefix: prefix,
      keyHash: hashApiKey(key),
    });
    // The full key is only ever returned once, at creation time.
    return { id: record.id, name: record.name, key, keyPrefix: prefix };
  },

  revoke(userId: string, id: string) {
    return apiKeysRepository.revoke(id, userId);
  },
};
