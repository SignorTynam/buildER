import type { Page } from "@playwright/test";

/**
 * Raggiungibilita reale dei controlli, non solo geometria.
 *
 * Le verifiche responsive basate su bounding box dicono soltanto "dove sta il
 * rettangolo". Un controllo puo stare dentro il viewport, essere visibile e
 * non ricevere comunque nessun click perche un overlay gli sta sopra: e cosi
 * che una toolbar interamente coperta da un drawer ha superato le suite
 * esistenti. Qui l'asserzione e "chi riceve davvero il click", via
 * `elementFromPoint` sul centro di ogni controllo.
 *
 * Stare dentro un contenitore scrollabile NON e un difetto: prima del
 * probe ogni elemento viene portato in vista con `scrollIntoView`, cosi
 * "serve uno scroll" resta distinto da "e coperto da un overlay".
 */

export interface ControlGroup {
  /** Nome leggibile usato nei messaggi di errore. */
  name: string;
  /** Selettore CSS dei controlli del gruppo. */
  selector: string;
  /** Il gruppo puo legittimamente non esistere a questo viewport. */
  optional?: boolean;
}

export interface ControlProbe {
  group: string;
  label: string;
  reachable: boolean;
  blockedBy: string;
  outsideViewport: boolean;
}

/** Descrizione compatta di un probe fallito, per i messaggi di assert. */
export function describeProbe(probe: ControlProbe): string {
  const reason = probe.outsideViewport ? "fuori dal viewport" : `coperto da ${probe.blockedBy || "?"}`;
  return `${probe.group} › ${probe.label} (${reason})`;
}

export async function probeControls(page: Page, groups: ControlGroup[]): Promise<ControlProbe[]> {
  return page.evaluate((groupList) => {
    const results: ControlProbe[] = [];

    for (const group of groupList) {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(group.selector));

      for (const element of elements) {
        // Controlli non renderizzati a questo breakpoint (display: none) non
        // sono un difetto di raggiungibilita: sono una scelta di layout.
        if (element.getBoundingClientRect().width < 1 || element.getBoundingClientRect().height < 1) {
          continue;
        }

        element.scrollIntoView({ block: "nearest", inline: "nearest" });

        const rect = element.getBoundingClientRect();
        const outsideViewport =
          rect.right > window.innerWidth + 1 ||
          rect.left < -1 ||
          rect.bottom > window.innerHeight + 1 ||
          rect.top < -1;

        const x = Math.round(rect.x + rect.width / 2);
        const y = Math.round(rect.y + rect.height / 2);
        const hit = document.elementFromPoint(x, y);

        results.push({
          group: group.name,
          label: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40),
          reachable: hit != null && element.contains(hit),
          blockedBy: hit instanceof Element ? `${hit.tagName.toLowerCase()}.${hit.className}`.slice(0, 60) : "",
          outsideViewport,
        });
      }
    }

    return results;
  }, groups);
}

/** Gruppi presenti quando e aperto uno schema ER, con l'Explorer chiuso. */
export const ER_EDITOR_CONTROL_GROUPS: ControlGroup[] = [
  { name: "activity rail", selector: ".project-activity-button" },
  { name: "file tabs", selector: ".project-file-tab" },
  // Selettore per classe e non per aria-label: l'etichetta e localizzata e
  // cambia con la lingua dell'interfaccia.
  { name: "ER toolbar", selector: ".designer-context-toolbar button" },
  { name: "viewport HUD", selector: ".canvas-viewport-hud button" },
  // La minimap vive in un layer suo, con offset propri: restava fuori dal
  // probe e il suo pulsante finiva sotto la toolbar senza che nessuno se ne
  // accorgesse.
  { name: "minimap toggle", selector: ".canvas-minimap-toggle" },
];
