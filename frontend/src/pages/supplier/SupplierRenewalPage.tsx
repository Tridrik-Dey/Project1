import { CalendarClock, Send } from "lucide-react";
import { Link } from "react-router-dom";

export function SupplierRenewalPage() {
  return (
    <section className="stack supplier-page-stack">
      <div className="panel">
        <h2><CalendarClock className="h-5 w-5" /> Rinnovo profilo</h2>
        <p className="subtle">
          Gestisci lo stato di rinnovo annuale e l'aggiornamento dei documenti richiesti.
        </p>
      </div>

      <div className="panel home-step-card">
        <div className="home-step-head">
          <span className="home-step-index">2</span>
          <h4>Workflow rinnovo</h4>
        </div>
        <p>
          La presa in carico completa del ciclo rinnovo verra estesa nei prossimi step
          con timeline, scadenze e invio aggiornamenti.
        </p>
        <Link className="home-inline-link home-inline-link-supplier" to="/supplier/documents">
          <span>Apri area documenti</span>
          <Send className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

