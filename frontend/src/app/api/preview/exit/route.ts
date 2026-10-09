import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_COOKIE } from "@/lib/preview";

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path") ?? "/";
  (await draftMode()).disable();
  (await cookies()).delete(PREVIEW_COOKIE);
  redirect(path.startsWith("/") && !path.startsWith("//") ? path : "/");
}
