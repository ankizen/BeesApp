import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { authRepository } from "./auth.repository.js";

export class AuthError extends Error {
  statusCode = 401;
  constructor(message = "Invalid credentials") {
    super(message);
  }
}

function signAccessToken(app: FastifyInstance, userId: string, role: string) {
  return app.jwt.sign({ sub: userId, role }, { expiresIn: env.JWT_ACCESS_TTL });
}

export const authService = {
  async login(app: FastifyInstance, email: string, password: string) {
    const user = await authRepository.findUserByEmail(email);
    if (!user || !user.isActive) throw new AuthError();

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new AuthError();

    const accessToken = signAccessToken(app, user.id, user.role);
    const refresh = await authRepository.issueRefreshToken(user.id, env.JWT_REFRESH_TTL_DAYS);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken: refresh.raw,
      refreshExpiresAt: refresh.expiresAt,
    };
  },

  async refresh(app: FastifyInstance, rawRefreshToken: string) {
    const existing = await authRepository.findValidRefreshToken(rawRefreshToken);
    if (!existing) throw new AuthError("Invalid or expired refresh token");

    const user = await authRepository.findUserById(existing.userId);
    if (!user || !user.isActive) throw new AuthError();

    // Rotate: revoke the used token, issue a fresh one. Limits replay window
    // if a refresh token is ever leaked.
    await authRepository.revokeRefreshToken(existing.id);
    const refresh = await authRepository.issueRefreshToken(user.id, env.JWT_REFRESH_TTL_DAYS);
    const accessToken = signAccessToken(app, user.id, user.role);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken: refresh.raw,
      refreshExpiresAt: refresh.expiresAt,
    };
  },

  async logout(rawRefreshToken: string) {
    const existing = await authRepository.findValidRefreshToken(rawRefreshToken);
    if (existing) await authRepository.revokeRefreshToken(existing.id);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new AuthError();
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new AuthError("Current password is incorrect");
    await authRepository.updatePassword(userId, await hashPassword(newPassword));
    await authRepository.revokeAllRefreshTokensForUser(userId);
  },
};
