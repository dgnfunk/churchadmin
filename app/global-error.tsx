"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="fatal-error">
          <h1>ChurchAdmin no está disponible temporalmente</h1>
          <p>No fue posible conectarse a la base de datos o al almacenamiento. No se sustituyeron datos reales por datos de demostración.</p>
          <button className="button primary" onClick={reset}>Intentar de nuevo</button>
        </main>
      </body>
    </html>
  );
}
