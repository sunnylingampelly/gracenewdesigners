import { cn } from "@/lib/utils";

/**
 * Skeleton loader components for mobile-optimized loading states.
 * Provides visual feedback while content loads, improving perceived performance.
 */

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse", className)}>
      <div className="skeleton aspect-[3/4] w-full" />
      <div className="mt-3 space-y-2">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Image */}
        <div className="skeleton aspect-[3/4] w-full" />
        
        {/* Details */}
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-8 w-4/5" />
            <div className="skeleton h-6 w-32" />
          </div>
          
          <div className="skeleton h-px w-full" />
          
          <div className="space-y-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
          </div>
          
          <div className="space-y-3">
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ListingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-10 w-28" />
      </div>
      <ProductGridSkeleton count={8} />
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="skeleton aspect-[16/9] w-full animate-pulse lg:aspect-[21/9]" />
  );
}

export function TextSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 animate-pulse", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "skeleton h-4",
            i === lines - 1 ? "w-2/3" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

export function NavigationSkeleton() {
  return (
    <div className="flex gap-6 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton h-4 w-16" />
      ))}
    </div>
  );
}

export function CollectionCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="skeleton aspect-[4/5] w-full" />
      <div className="mt-4 space-y-2">
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    </div>
  );
}

export function BagItemSkeleton() {
  return (
    <div className="flex gap-4 animate-pulse">
      <div className="skeleton h-24 w-20 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-3 w-1/3" />
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-2">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-12 w-full" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-12 w-full" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-24 w-full" />
      </div>
      <div className="skeleton h-12 w-full" />
    </div>
  );
}
