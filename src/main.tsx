import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n/I18nProvider";
import "./index.css";
import "./styles/editor-refactor.css";
import "./styles/panels.css";
import "./styles/app-command-bar.css";
import "./styles/project-explorer.css";
import "./styles/tokens.css";
import "./styles/foundations.css";
import "./styles/workspace-shell.css";
import "./styles/activity-rail.css";
import "./styles/editor-tabs.css";
import "./styles/context-menu.css";
import "./styles/panels-workspace.css";
import "./styles/errors-panel.css";
import "./styles/source-control-panel.css";
import "./styles/responsive.css";
import "./styles/ui.css";
import "./styles/settings.css";
import "./styles/canvas-navigation.css";
import "./styles/sql-playground.css";
import "./styles/releases.css";
// Ultimo: il livello di movimento aggiunge transizioni e entrate senza
// ridefinire il look dei fogli precedenti.
import "./styles/motion.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
