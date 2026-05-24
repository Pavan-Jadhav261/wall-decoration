import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { assertJwtConfigured, AUTH_COOKIE_NAME, signAuthToken } from "@/lib/auth";
import { findUserByEmail, normalizeEmail } from "@/lib/users";

export async function POST(request: Request) {
  try {
    assertJwtConfigured();

    const body = await request.json();
    const email = normalizeEmail(String(body?.email ?? ""));
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 },
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const token = await signAuthToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
      message: "Login successful.",
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
      error instanceof Error ? error.message : "Login failed. Please try again.";
    return NextResponse.json(
      { message },
      { status: 500 },
    );
  }
}
