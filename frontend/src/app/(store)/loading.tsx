export default function Loading() {
  return (
    <div className="container-editorial pt-14 pb-24" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton mt-6 h-12 w-2/3 max-w-xl" />
      <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[4/5]" />
            <div className="skeleton mt-4 h-4 w-3/4" />
            <div className="skeleton mt-2 h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
