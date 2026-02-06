import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../prisma";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";
import { sendVerificationEmail, sendResetEmail } from "../utils/email";

const router = Router();

/* =========================
   REGISTER (WITH EMAIL VERIFICATION)
========================= */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        isVerified: false,
        verificationToken,
        verificationExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const verificationLink = `http://localhost:4000/api/auth/verify-email?token=${verificationToken}`;

    await sendVerificationEmail(email, verificationLink);

    return res.status(201).json({
      message:
        "Registration successful. Please check your email to verify your account.",
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({ message: "Server error" });
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your email before logging in" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
const { rememberMe } = req.body;

const tokenExpiry = rememberMe ? "7d" : "15m";

const token = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET as string,
  { expiresIn: tokenExpiry }
);


    return res.status(200).json({
      message: "Login successful",
      token,
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
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json({ message: "If user exists, email sent" });

  const token = crypto.randomBytes(32).toString("hex");

  await prisma.user.update({
    where: { email },
    data: {
      resetToken: token,
      resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  const link = `${process.env.BASE_URL}/reset-password?token=${token}`;
  await sendResetEmail(email, link);

  res.json({ message: "Reset link sent to email" });
});

/* =========================
   RESET PASSWORD
========================= */
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user)
    return res.status(400).json({ message: "Invalid or expired link" });

  // 🔐 Password rules
  const strong =
    newPassword.length >= 8 &&
    /[A-Z]/.test(newPassword) &&
    /[0-9]/.test(newPassword) &&
    /[@$!%*?&]/.test(newPassword);

  if (!strong)
    return res.status(400).json({ message: "Weak password" });

  // 🔁 Password history (last 5)
  for (const old of user.passwordHistory.slice(-5)) {
    if (await bcrypt.compare(newPassword, old)) {
      return res
        .status(400)
        .json({ message: "Cannot reuse old password" });
    }
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      passwordHistory: [...user.passwordHistory, hashed],
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  res.json({ message: "Password reset successful" });
});
router.post("/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
  });

  if (!user || !(await bcrypt.compare(currentPassword, user.password)))
    return res.status(401).json({ message: "Current password incorrect" });

  // reuse same rules + history check as above
});

/* =========================
   READ ALL USERS
========================= */
router.get("/users", authenticate, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
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
  async (req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
    });
    res.json(users);
  }
);
router.post(
  "/testcases",
  authenticate,
  authorizeRoles("DEVELOPER"),
  async (req, res) => {
    res.json({ message: "Test case created" });
  }
);
router.get(
  "/reports",
  authenticate,
  authorizeRoles("ADMIN", "DEVELOPER"),
  async (req, res) => {
    res.json({ message: "Reports data" });
  }
);


export default router;
