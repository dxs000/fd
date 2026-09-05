import jwt from "jsonwebtoken";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "";

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.cookies;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is not set");
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const { password: _, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (error: any) {
    logger.error(error, "protect middleware error");
    return res.status(401).json({ success: false, message: "Not authorized" });
  }
};
