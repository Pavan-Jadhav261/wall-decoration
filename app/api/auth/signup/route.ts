import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { assertJwtConfigured, AUTH_COOKIE_NAME, signAuthToken } from "@/lib/auth";
import { createUser, findUserByEmail, normalizeEmail } from "@/lib/users";

export async function POST(request: Request) {
  try {
    assertJwtConfigured();

    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    const email = normalizeEmail(String(body?.email ?? ""));
    const password = String(body?.password ?? "");

    if (!name || !email || password.length < 8) {
      return NextResponse.json(
        { message: "Please provide name, email, and password (min 8 chars)." },
        { status: 400 },
      );
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { message: "Email already exists. Please login instead." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ name, email, passwordHash });
    const token = await signAuthToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
      message: "Sign up successful.",
    });
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sign up. Please try again.";
    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
