import { redirect } from "next/navigation";

export default async function LegacySchedulePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  if (query.get("view") === "my") query.set("view", "mine");
  redirect(`/services${query.size ? `?${query.toString()}` : "?view=calendar"}`);
}
