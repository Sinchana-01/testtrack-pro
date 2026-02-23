import { Request, Response } from "express";
import { ZodError } from "zod";
import { AuthServiceError, loginUser, parseLoginInput } from "../services/auth.service";

export const loginController = async (req: Request, res: Response) => {
  try {
    const payload = parseLoginInput(req.body);
    const result = await loginUser(payload, {
      ip: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    if (error instanceof AuthServiceError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("LOGIN ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
