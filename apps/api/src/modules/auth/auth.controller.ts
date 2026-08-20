import type { FastifyReply, FastifyRequest } from "fastify";
import { isProd } from "../../config/env.js";
import { changePasswordSchema, loginSchema } from "./auth.schema.js";
import { authService } from "./auth.service.js";

const REFRESH_COOKIE = "ch_refresh";
const REFRESH_COOKIE_PATH = "/api/auth";

function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

export const authController = {
  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(request.server, body.email, body.password);
    setRefreshCookie(reply, result.refreshToken, result.refreshExpiresAt);
    return reply.send({ user: result.user, accessToken: result.accessToken });
  },

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const raw = request.cookies[REFRESH_COOKIE];
    if (!raw) return reply.code(401).send({ error: "Missing refresh token" });

    const result = await authService.refresh(request.server, raw);
    setRefreshCookie(reply, result.refreshToken, result.refreshExpiresAt);
    return reply.send({ user: result.user, accessToken: result.accessToken });
  },

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const raw = request.cookies[REFRESH_COOKIE];
    if (raw) await authService.logout(raw);
    reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    return reply.code(204).send();
  },

  async me(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ user: request.user });
  },

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const body = changePasswordSchema.parse(request.body);
    await authService.changePassword(request.user.sub, body.currentPassword, body.newPassword);
    return reply.code(204).send();
  },
};
