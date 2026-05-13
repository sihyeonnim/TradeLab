import jwt, { Secret, SignOptions } from "jsonwebtoken";

export function signAuthToken(user: any): string {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in .env");
  }

  const secret: Secret = process.env.JWT_SECRET;

  const options: SignOptions = {
    expiresIn: "7d",
  };

  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      email: user.email,
    },
    secret,
    options
  );
}

export function verifyAuthToken(token: string): any {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in .env");
  }

  const secret: Secret = process.env.JWT_SECRET;

  return jwt.verify(token, secret);
}