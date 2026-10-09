"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function ListTracker({ listName, count }: { listName: string; count: number }) {
  useEffect(() => {
    track("view_item_list", { item_list_name: listName, results: count });
  }, [listName, count]);
  return null;
}
