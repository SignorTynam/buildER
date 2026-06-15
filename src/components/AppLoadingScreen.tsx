import { useMemo } from "react";
import builderLogo from "../image/buildER no background.png";

const LOADING_TIPS = [
  "Suggerimento: usa Reverse Engineering SQL per partire da CREATE TABLE gia esistenti.",
  "Suggerimento: il pannello Code ti permette di controllare il DSL ERS mentre lavori sul canvas.",
  "Suggerimento: esporta in PNG o SVG quando vuoi inserire il diagramma nella relazione.",
  "Suggerimento: il menu comandi ti permette di trovare rapidamente workflow, export e viste.",
  "Suggerimento: usa la vista logica per controllare tabelle, chiavi e vincoli prima dell'SQL.",
  "Suggerimento: se importi SQL, controlla sempre warning e preview prima di applicare.",
  "Suggerimento: rinomina subito entita e relazioni per mantenere il modello leggibile.",
  "Suggerimento: usa Notes per salvare decisioni progettuali direttamente nel progetto.",
  "Suggerimento: il formato .ersp mantiene diagramma, viste e stato del progetto.",
  "Suggerimento: mantieni gli attributi vicini al loro host per un diagramma piu chiaro.",
];

export function AppLoadingScreen() {
  const tip = useMemo(() => LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)], []);

  return (
    <main className="app-loading-screen" data-testid="app-loading-screen" role="status" aria-live="polite">
      <section className="app-loading-card" aria-label="Caricamento buildER">
        <img className="app-loading-logo" src={builderLogo} alt="buildER" draggable={false} />
        <div className="app-loading-brand">
          <span>buildER</span>
          <strong>Preparazione workspace...</strong>
        </div>
        <div className="app-loading-progress" aria-hidden="true">
          <span className="app-loading-progress-bar" />
        </div>
        <p className="app-loading-tip" data-testid="app-loading-tip">
          {tip}
        </p>
      </section>
    </main>
  );
}
