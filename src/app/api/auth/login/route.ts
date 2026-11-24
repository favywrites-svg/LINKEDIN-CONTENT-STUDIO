import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE_NAME,
  createAccessSessionToken,
} from "@/lib/auth-token";

const LoginSchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const configuredPassword = process.env.APP_ACCESS_PASSWORD?.trim();
  if (!configuredPassword) {
    return NextResponse.json({ unlocked: true });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success || parsed.data.password !== configuredPassword) {
    return NextResponse.json(
      { error: "Invalid workspace passcode." },
      { status: 401 }
    );
  }

  const secret = process.env.APP_SESSION_SECRET?.trim() || undefined;
  const token = await createAccessSessionToken(configuredPassword, secret);

  const response = NextResponse.json({ unlocked: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
