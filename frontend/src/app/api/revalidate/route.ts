import { revalidateTag } from "next/cache";

/**
 * On-demand cache refresh, e.g. called by a deployment hook or the admin after publishing.
 * POST { tags?: string[] } with header `x-revalidate-secret`.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("x-revalidate-secret") !== secret) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { tags?: string[] };
  const tags = body.tags?.length ? body.tags.slice(0, 20) : ["catalog"];
  for (const tag of tags) revalidateTag(tag, "max");
  return Response.json({ revalidated: tags });
}
