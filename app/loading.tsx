export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/diamond-studio-logo.png"
          alt="Diamond Studio by Nicole"
          className="h-24 w-24 animate-pulse rounded-2xl border border-gold/40 object-contain"
        />
        <p className="text-sm text-coolSilver">Cargando...</p>
      </div>
    </main>
  );
}
