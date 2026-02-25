import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { z } from "zod";
import prisma from "../prisma";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

const loginSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

const getAccessSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AuthServiceError(500, "JWT_SECRET is not configured");
  }
  return secret;
};

const getRefreshSecret = (): string => {
  return process.env.JWT_REFRESH_SECRET || getAccessSecret();
};

const signAccessToken = (user: {
  id: string;
  role: Role;
  tokenVersion: number;
}): string =>
  jwt.sign(
    { userId: user.id, role: user.role, tokenVersion: user.tokenVersion, type: "access" },
    getAccessSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

const signRefreshToken = (user: {
  id: string;
  role: Role;
  tokenVersion: number;
}): string =>
  jwt.sign(
    { userId: user.id, role: user.role, tokenVersion: user.tokenVersion, type: "refresh" },
    getRefreshSecret(),
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

const hashRefreshToken = (refreshToken: string): string =>
  crypto.createHash("sha256").update(refreshToken).digest("hex");

export class AuthServiceError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export type LoginInput = z.infer<typeof loginSchema>;

export const parseLoginInput = (input: unknown): LoginInput => loginSchema.parse(input);

export const loginUser = async (
  input: LoginInput,
  context?: { ip?: string; userAgent?: string }
) => {
  const normalizedEmail = input.email.trim().toLowerCase();
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new AuthServiceError(401, "Invalid credentials");
  }

  if (user.lockoutUntil && user.lockoutUntil > now) {
    throw new AuthServiceError(401, "Account is locked. Try again later.");
  }

  if (!user.isActive) {
    throw new AuthServiceError(401, "Invalid credentials");
  }

  if (!user.isVerified) {
    throw new AuthServiceError(403, "Please verify your email before logging in");
  }

  const passwordValid = await bcrypt.compare(input.password, user.password);
  if (!passwordValid) {
    const nextFailedCount = user.failedLoginAttempts + 1;
    const lockoutUntil =
      nextFailedCount >= MAX_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_DURATION_MS)
        : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: nextFailedCount,
        lockoutUntil,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: user.id,
        metadata: {
          email: normalizedEmail,
          failedLoginAttempts: nextFailedCount,
          lockoutUntil: lockoutUntil?.toISOString() || null,
          ip: context?.ip || null,
          userAgent: context?.userAgent || null,
        },
      },
    });

    throw new AuthServiceError(401, "Invalid credentials");
  }

  const accessToken = signAccessToken({
    id: user.id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
  const refreshToken = signRefreshToken({
    id: user.id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockoutUntil: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "LOGIN_SUCCESS",
      entityType: "User",
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.role,
        accessTokenExpiresIn: ACCESS_TOKEN_EXPIRY,
        refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRY,
        refreshTokenHash: hashRefreshToken(refreshToken),
        ip: context?.ip || null,
        userAgent: context?.userAgent || null,
        rememberMe: Boolean(input.rememberMe),
      },
    },
  });

  return {
    message: "Login successful",
    token: accessToken,
    accessToken,
    refreshToken,
    accessTokenExpiresIn: ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRY,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};
