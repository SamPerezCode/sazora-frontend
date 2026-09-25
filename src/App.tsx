import { Store } from "lucide-react";

function App() {
  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-12 sm:px-8">
      <section
        aria-labelledby="welcome-title"
        className="w-full max-w-md rounded-3xl border border-outline bg-surface p-6 shadow-xl sm:p-10"
      >
        <Store
          aria-hidden="true"
          size={28}
          strokeWidth={1.75}
          className="mb-6 text-brand"
        />

        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
          Operación gastronómica, conectada
        </p>

        <h1
          id="welcome-title"
          className="mt-3 text-3xl font-bold tracking-tight text-heading sm:text-4xl"
        >
          Bienvenido a Sazora
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted">
          El mejor espacio para administrar la operación de tu
          restaurante.
        </p>
      </section>
    </main>
  );
}

export default App;
