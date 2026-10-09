import { cookies, draftMode } from "next/headers";

export const PREVIEW_COOKIE = "gnd-preview-token";

/** The signed preview token when an admin has entered preview mode, otherwise null. */
export async function previewToken(): Promise<string | null> {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return null;
  return (await cookies()).get(PREVIEW_COOKIE)?.value ?? null;
}
