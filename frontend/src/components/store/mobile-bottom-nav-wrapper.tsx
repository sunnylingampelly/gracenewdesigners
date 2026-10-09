"use client";

import { useState } from "react";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { SearchOverlay } from "./search-overlay";

/**
 * Client wrapper component that manages the search overlay state
 * and provides it to the MobileBottomNav component.
 */
export function MobileBottomNavWrapper() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <MobileBottomNav onSearchOpen={() => setSearchOpen(true)} />
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
