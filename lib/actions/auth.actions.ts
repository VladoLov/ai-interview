"use server";

import { auth } from "@/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();
import { cookies } from "next/headers";

const ONE_WEEK = 60 * 60 * 24 * 7;

export async function signUp(params: SignUpParams) {
  const { uid, name, email } = params;

  try {
    const userRecord = await db.collection("users").doc(uid).get();

    if (userRecord.exists) {
      return {
        success: false,
        message: "User already exists",
      };
    }
    await db.collection("users").doc(uid).set({
      name,
      email,
    });

    return {
      success: true,
      message: "Account created successfully",
    };
  } catch (error: any) {
    console.error("Error creating a user", error);

    if (error.code === "auth/email-already-exist") {
      return {
        success: false,
        message: "This email is already in use.",
      };
    }
    return {
      success: false,
      message: "Failed to create an account",
    };
  }
}

export async function signIn(params: SignInParams) {
  const { email, idToken } = params;

  try {
    const userRecord = await auth.getUserByEmail(email);
    if (!userRecord)
      return {
        success: false,
        message: "User does not exist. Create an account.",
      };

    await setSessionCookie(idToken);
  } catch (error: any) {
    console.log(error);

    return {
      success: false,
      message: "Failed to sign in",
    };
  }
}

export async function setSessionCookie(idToken: string) {
  const cookieStore = await cookies();

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: ONE_WEEK * 1000, // 7 days
  });

  cookieStore.set("session", sessionCookie, {
    maxAge: ONE_WEEK,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    /* console.debug("[Auth] Session cookie exists:", Boolean(sessionCookie)); */

    if (!sessionCookie) {
      console.warn("[Auth] No session cookie found");
      return null;
    }

    // Verify session cookie with Firebase
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    /*   console.debug("[Auth] Decoded claims:", decodedClaims); */

    // Fetch user from Firestore
    const userDoc = await db.collection("users").doc(decodedClaims.uid).get();
    /*  console.debug("[Auth] User document exists:", userDoc.exists); */

    if (!userDoc.exists) {
      console.warn(
        "[Auth] No user found in Firestore for ID:",
        decodedClaims.uid
      );
      return null;
    }

    const userData = userDoc.data();
    /*  console.debug("[Auth] User data retrieved:", userData); */

    return { ...userData, id: userDoc.id } as User;
  } catch (error) {
    console.error("[Auth] Error in getCurrentUser:", error);

    // Handle specific Firebase errors
    if (error instanceof Error) {
      if (error.message.includes("auth/session-cookie-expired")) {
        console.warn("[Auth] Session cookie expired");
      }
      if (error.message.includes("auth/session-cookie-revoked")) {
        console.warn("[Auth] Session cookie revoked");
      }
    }

    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const user = await getCurrentUser();

    // Add debug logging
    /* console.debug("[Auth] Current user:", user ? "authenticated" : "anonymous"); */

    return Boolean(user);
  } catch (error) {
    console.error("[Auth] Error checking authentication:", error);

    // For better error differentiation
    if (error instanceof Error) {
      throw new Error(`Authentication check failed: ${error.message}`);
    }

    throw new Error("Unknown authentication error occurred");
  }
}
