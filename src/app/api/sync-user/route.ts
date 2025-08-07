import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { syncUser } from "@/lib/syncUser";

export async function POST(req: Request) {
  try {
    console.log("🚀 API route called");
    const authHeader = req.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "");
    const clerkUser = await currentUser();

    console.log("🔄 Syncing user", clerkUser?.id);

    if (!clerkUser) {
      console.error("❌ No Clerk user found");
      return NextResponse.json({ error: "No user" }, { status: 401 });
    }

    const email = clerkUser.emailAddresses?.[0]?.emailAddress || "";
    const name = clerkUser.firstName && clerkUser.lastName
      ? `${clerkUser.firstName} ${clerkUser.lastName}`
      : clerkUser.firstName || clerkUser.lastName || "";

    console.log("📧 User details:", { id: clerkUser.id, email, name });
    const result = await syncUser({ id: clerkUser.id, email, name });
    console.log("✅ Sync result", result);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("❌ Sync user error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
} 