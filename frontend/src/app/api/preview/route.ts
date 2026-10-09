import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_COOKIE } from "@/lib/preview";

/**
 * Enter preview mode with a short-lived token issued by the admin API. The token itself is
 * verified by Laravel on every request, so this handler never grants access on its own.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const path = searchParams.get("path") ?? "/";

  if (!token || !path.startsWith("/") || path.startsWith("//")) {
    return new Response("Invalid preview link", { status: 400 });
  }

  (await draftMode()).enable();
  (await cookies()).set(PREVIEW_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 });
  redirect(path);
}
