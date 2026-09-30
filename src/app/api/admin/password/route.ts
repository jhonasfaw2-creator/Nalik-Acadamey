import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/http";

// ── Admin password change ────────────────────────────────────────────
// POST /api/admin/password — change the admin password (requires session).
//
// Credential model: the bcrypt hash lives in the Setting table under the key
// "admin_password_hash". When no hash exists yet, login falls back to the
// ADMIN_PASSWORD environment variable (the "temporary password" case). Once
// changed here, the DB hash takes precedence over the env password, so the
// temporary credential is dead and the admin owns their own secret.
//
// Environment deployments that prefer not to use the DB can still seed
// ADMIN_PASSWORD_HASH directly; a DB hash always wins over both.

const PASSWORD_HASH_KEY = "admin_password_hash";

async function getStoredHash(): Promise<string | null> {
  const row = await prisma.setting.findUnique({
    where: { key: PASSWORD_HASH_KEY },
    select: { value: true },
  });
  return row?.value ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { currentPassword, newPassword } = body as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return NextResponse.json(
        { error: "Current and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (newPassword.length > 200) {
      return NextResponse.json(
        { error: "New password is too long (max 200 characters)." },
        { status: 400 }
      );
    }
    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "New password must be different from the current password." },
        { status: 400 }
      );
    }

    const storedHash = await getStoredHash();

    // Verify the current password against hash-or-env, same rules as login.
    let currentMatches = false;
    if (storedHash) {
      try {
        currentMatches = bcrypt.compareSync(currentPassword, storedHash);
      } catch {
        currentMatches = false;
      }
    } else {
      const envPlain = process.env.ADMIN_PASSWORD?.trim();
      // Local dev convenience default mirrors the login route.
      const expected = envPlain || (process.env.NODE_ENV === "production" ? undefined : "admin123");
      if (expected) {
        currentMatches = currentPassword === expected;
      }
    }

    if (!currentMatches) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 }
      );
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await prisma.setting.upsert({
      where: { key: PASSWORD_HASH_KEY },
      update: { value: hash },
      create: { key: PASSWORD_HASH_KEY, value: hash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin password change error:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
