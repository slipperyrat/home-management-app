import { NextRequest } from "next/server";
import { withAPISecurity } from "@/lib/security/apiProtection";
import { createCSRFResponse } from "@/lib/security/csrf";

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const csrfResponse = createCSRFResponse(user.id);
      return Response.json(csrfResponse);
    } catch (error) {
      console.error('Error generating CSRF token:', error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }, {
    requireAuth: true,
    requireCSRF: false, // This endpoint doesn't need CSRF protection
    rateLimitConfig: 'api'
  });
}
