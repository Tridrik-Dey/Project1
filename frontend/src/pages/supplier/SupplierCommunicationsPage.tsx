import { MessageSquare, Send } from "lucide-react";
import { Link } from "react-router-dom";

export function SupplierCommunicationsPage() {
  return (
    <section className="stack supplier-page-stack">
      <div className="panel">
        <h2><MessageSquare className="h-5 w-5" /> Comunicazioni</h2>
        <p className="subtle">
          Qui trovi le comunicazioni operative del tuo percorso di iscrizione e revisione.
        </p>
      </div>

      <div className="panel home-step-card">
        <div className="home-step-head">
          <span className="home-step-index">1</span>
          <h4>Centro notifiche fornitore</h4>
        </div>
        <p>
          La vista completa delle richieste di integrazione e dei messaggi amministrativi
          verra completata nei prossimi step di questa fase.
        </p>
        <Link className="home-inline-link home-inline-link-supplier" to="/supplier/dashboard">
          <span>Torna alla dashboard fornitore</span>
          <Send className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

