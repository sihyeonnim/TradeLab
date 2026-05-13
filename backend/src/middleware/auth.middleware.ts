import { Request, Response, NextFunction } from "express";
import { User } from "../models";
import { verifyAuthToken } from "../utils/jwt";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "tradelab_token";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({
        message: "Invalid authentication token.",
      });
    }

    (req as any).user = user;
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return function roleMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        message: "You do not have permission to access this resource.",
      });
    }

    next();
  };
}