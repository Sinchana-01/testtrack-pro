import { Role } from "@prisma/client";
import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../prisma";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";
import { sendVerificationEmail, sendResetEmail } from "../utils/email";

const router = Router();
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

const isStrongPassword = (password: string): boolean =>
  PASSWORD_REGEX.test(password);
const PUBLIC_REGISTRATION_ROLES: Role[] = [Role.TESTER, Role.DEVELOPER];

const appendPasswordHistory = (
  existing: string[],
  newPasswordHash: string
): string[] => {
  return [...existing, newPasswordHash].slice(-5);
};

const getApiBaseUrl = (): string =>
  process.env.API_BASE_URL || "http://localhost:4000";

const getFrontendBaseUrl = (): string =>
  process.env.FRONTEND_BASE_URL || process.env.BASE_URL || "http://localhost:3001";

const getAccessSecret = (): string => process.env.JWT_SECRET as string;

const getRefreshSecret = (): string =>
  (process.env.JWT_REFRESH_SECRET as string) || (process.env.JWT_SECRET as string);

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

/* =========================
   REGISTER (WITH EMAIL VERIFICATION)
========================= */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    const requestedRole = role as Role | undefined;
    if (requestedRole === Role.ADMIN) {
      return res.status(403).json({ message: "Admin self-registration is not allowed" });
    }
    const selectedRole =
      requestedRole && PUBLIC_REGISTRATION_ROLES.includes(requestedRole)
        ? requestedRole
        : Role.TESTER;

    if (!normalizedEmail || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    await prisma.user.create({
      data: {
        name:
          typeof name === "string" && name.trim()
            ? name.trim()
            : normalizedEmail.split("@")[0],
        email: normalizedEmail,
        password: hashedPassword,
        role: selectedRole,
        isVerified: false,
        verificationToken,
        verificationExpiry: new Date(Date.now() + 60 * 60 * 1000),
        passwordHistory: [hashedPassword],
      },
    });

    const verificationLink = `${getApiBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(
      verificationToken
    )}`;

    try {
      await sendVerificationEmail(normalizedEmail, verificationLink);
      return res.status(201).json({
        message:
          "Registration successful. Please check your email to verify your account.",
      });
    } catch (emailError) {
      console.error("VERIFICATION EMAIL ERROR:", emailError);
      return res.status(201).json({
        message:
          "Registration successful, but verification email could not be sent. Please request a new verification email.",
        emailSent: false,
      });
    }
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   RESEND VERIFICATION EMAIL
========================= */
router.post("/resend-verification", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const verificationLink = `${getApiBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(
      verificationToken
    )}`;
    await sendVerificationEmail(normalizedEmail, verificationLink);

    return res.json({ message: "Verification email sent" });
  } catch (error) {
    console.error("RESEND VERIFICATION ERROR:", error);
    return res.status(500).json({ message: "Unable to send verification email" });
  }
});

/* =========================
   VERIFY EMAIL
========================= */
router.get("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token as string,
        verificationExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationExpiry: null,
      },
    });

    return res.json({
      message: "Email verified successfully. You can now login.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   LOGIN
========================= */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body;
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Account lockout check removed - add lockoutUntil field to User model if needed

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your email before logging in" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
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

    return res.status(200).json({
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
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   REFRESH ACCESS TOKEN
========================= */
router.post("/refresh-token", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== "string") {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    const decoded = jwt.verify(refreshToken, getRefreshSecret()) as {
      userId: string;
      role: Role;
      tokenVersion: number;
      type?: "access" | "refresh";
    };

    if (decoded.type !== "refresh") {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        tokenVersion: true,
        isVerified: true,
      },
    });

    if (!user || !user.isVerified) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ message: "Session expired. Please login again." });
    }

    const nextAccessToken = signAccessToken({
      id: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });
    const nextRefreshToken = signRefreshToken({
      id: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    return res.json({
      message: "Token refreshed",
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      accessTokenExpiresIn: ACCESS_TOKEN_EXPIRY,
      refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRY,
    });
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
});

/* =========================
   FORGOT PASSWORD
========================= */
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.json({ message: "If user exists, email sent" });
    }

    const token = crypto.randomBytes(32).toString("hex");

    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        resetToken: token,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const link = `${getFrontendBaseUrl()}/reset-password?token=${encodeURIComponent(
      token
    )}`;
    await sendResetEmail(normalizedEmail, link);

    return res.json({ message: "Reset link sent to email" });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   RESET PASSWORD
========================= */
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token as string,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired link" });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      });
    }

    for (const oldHash of user.passwordHistory.slice(-5)) {
      if (await bcrypt.compare(newPassword, oldHash)) {
        return res
          .status(400)
          .json({ message: "Cannot reuse any of your last 5 passwords" });
      }
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const updatedHistory = appendPasswordHistory(
      user.passwordHistory,
      newPasswordHash
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newPasswordHash,
        passwordHistory: updatedHistory,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   CHANGE PASSWORD
========================= */
router.post(
  "/change-password",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          message: "Current password and new password are required",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
      });

      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(401).json({ message: "Current password incorrect" });
      }

      if (!isStrongPassword(newPassword)) {
        return res.status(400).json({
          message:
            "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
        });
      }

      for (const oldHash of user.passwordHistory.slice(-5)) {
        if (await bcrypt.compare(newPassword, oldHash)) {
          return res
            .status(400)
            .json({ message: "Cannot reuse any of your last 5 passwords" });
        }
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      const updatedHistory = appendPasswordHistory(
        user.passwordHistory,
        newPasswordHash
      );

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: newPasswordHash,
          passwordHistory: updatedHistory,
        },
      });

      return res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("CHANGE PASSWORD ERROR:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/* =========================
   LOGOUT ALL DEVICES
========================= */
router.post("/logout-all", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
    });

    return res.json({ message: "Logged out from all devices" });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   READ ALL USERS
========================= */
router.get(
  "/users",
  authenticate,
  authorizeRoles("ADMIN", "TESTER"),
  async (req: AuthRequest, res: Response) => {
  try {
    const users =
      req.user?.role === "ADMIN"
        ? await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, isActive: true },
          })
        : await prisma.user.findMany({
            where: { role: "DEVELOPER", isActive: true },
            select: { id: true, name: true, email: true, role: true, isActive: true },
          });

    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   UPDATE USER (ADMIN ONLY)
========================= */
router.put(
  "/users/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, role } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { name, role },
    });

    res.json({
      message: "User updated successfully",
      user: updatedUser,
    });
  }
);

/* =========================
   DELETE USER (ADMIN ONLY)
========================= */
router.delete(
  "/users/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    await prisma.user.delete({ where: { id } });

    res.json({ message: "User deleted successfully" });
  }
);

router.get(
  "/admin/users",
  authenticate,
  authorizeRoles("ADMIN"),
  async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
    });
    res.json(users);
  }
);

export default router;
