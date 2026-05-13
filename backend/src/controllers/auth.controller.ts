import { Request, Response, NextFunction } from "express";

import { User, UserRole, EmailVerificationToken } from "../models";
import { createRawToken, hashToken } from "../utils/crypto";
import { sendVerificationEmail } from "../utils/mailer";
import { signAuthToken } from "../utils/jwt";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "tradelab_token";

function normalizeEmail(email: unknown): string {
  return String(email || "").trim().toLowerCase();
}

function publicUser(user: any) {
  return {
    id: user._id,
    email: user.email,
    displayName: user.name,
    role: user.role,
    isEmailVerified: Boolean(user.isEmailVerified),
  };
}

function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(req.body.email);
    const { password, displayName } = req.body;
    const requestedRole = req.body.role || UserRole.USER;

    const allowedPublicRoles = [UserRole.USER, UserRole.INSTRUCTOR];
    const role = allowedPublicRoles.includes(requestedRole)
      ? requestedRole
      : UserRole.USER;

    if (!email || !password || !displayName) {
      return res.status(400).json({
        message: "Email, password, and display name are required.",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const user = await User.create({
      email,
      password,
      name: String(displayName).trim(),
      role,
      isEmailVerified: false,
    });

    const rawToken = createRawToken();
    const tokenHash = hashToken(rawToken);

    await EmailVerificationToken.deleteMany({
      user: user._id,
      used: false,
    });

    await EmailVerificationToken.create({
      user: user._id,
      token: tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      used: false,
    });

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${rawToken}`;

    await sendVerificationEmail({
      to: user.email,
      displayName: user.name,
      verificationUrl,
    });

    return res.status(201).json({
      message:
        "Registration successful. Please check your email to verify your account.",
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawToken = req.query.token || req.body.token;

    if (!rawToken) {
      return res.status(400).json({
        message: "Verification token is required.",
      });
    }

    const tokenHash = hashToken(String(rawToken));

    const verificationToken = await EmailVerificationToken.findOne({
      token: tokenHash,
      used: false,
    });

    if (!verificationToken) {
      return res.status(400).json({
        message: "Invalid or already used verification token.",
      });
    }

    if (verificationToken.expiresAt < new Date()) {
      return res.status(400).json({
        message: "Verification token has expired.",
      });
    }

    const user = await User.findById(verificationToken.user);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    user.isEmailVerified = true;
    await user.save();

    verificationToken.used = true;
    await verificationToken.save();

    return res.json({
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
      });
    }

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    return res.json({
      message: "Login successful.",
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  return res.json({
    message: "Logout successful.",
  });
}

export async function getCurrentUser(req: Request, res: Response) {
  return res.json({
    user: publicUser((req as any).user),
  });
}

export async function resendVerificationEmail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({
        message: "Email is required.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        message: "This email is already verified.",
      });
    }

    const rawToken = createRawToken();
    const tokenHash = hashToken(rawToken);

    await EmailVerificationToken.deleteMany({
      user: user._id,
      used: false,
    });

    await EmailVerificationToken.create({
      user: user._id,
      token: tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      used: false,
    });

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${rawToken}`;

    await sendVerificationEmail({
      to: user.email,
      displayName: user.name,
      verificationUrl,
    });

    return res.json({
      message: "Verification email sent again.",
    });
  } catch (error) {
    next(error);
  }
}