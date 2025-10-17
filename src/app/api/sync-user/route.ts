import { NextRequest, NextResponse } from "next/server";
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { syncUser } from "@/lib/syncUser";

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (_req: NextRequest, user: RequestUser | null) => {
    try {
      console.log("🚀 API route called");
      console.log("🔄 Syncing user", user?.id);

      if (!user) {
        console.error("❌ No Clerk user found");
        return NextResponse.json({ error: "No user" }, { status: 401 });
      }

      const email = user.emailAddresses?.[0]?.emailAddress || "";
      const name = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || "";

      console.log("📧 User details:", { id: user.id, email, name });
      const result = await syncUser({ id: user.id, email, name });
      console.log("✅ Sync result", result);

      return NextResponse.json({ success: true });
    } catch (e) {
      console.error("❌ Sync user error", e);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }, {
    requireAuth: true,
    requireCSRF: false, // Sync user doesn't need CSRF
    rateLimitConfig: 'api'
  });
} 