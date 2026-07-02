export default function AppLoading() {
  return (
    <main className="mx-auto min-h-[60vh] max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="h-8 w-48 animate-pulse rounded-md bg-neutral-200" />
      <div className="mt-4 h-4 w-80 max-w-full animate-pulse rounded bg-neutral-100" />
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-56 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50" />
        ))}
      </div>
    </main>
  );
}
