import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import prisma from "../prisma";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: Role;
    tokenVersion?: number;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  const verifyToken = async () => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
        userId: string;
        role: Role;
        tokenVersion: number;
        type?: "access" | "refresh";
      };

      if (decoded.type && decoded.type !== "access") {
        return res.status(401).json({ message: "Invalid token" });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, tokenVersion: true },
      });

      if (!user || user.tokenVersion !== decoded.tokenVersion) {
        return res.status(401).json({ message: "Session expired" });
      }

      req.user = {
        userId: decoded.userId,
        role: decoded.role,
        tokenVersion: decoded.tokenVersion,
      };
      next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid token" });
    }
  };

  verifyToken();
};
