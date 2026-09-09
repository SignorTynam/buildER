import { useCallback, useEffect, useRef, useState } from "react";

export interface ScrollOverflow {
  /** C'e contenuto oltre il bordo iniziale orizzontale (sinistro in LTR). */
  atStart: boolean;
  /** C'e contenuto oltre il bordo finale orizzontale (destro in LTR). */
  atEnd: boolean;
  /** C'e contenuto sopra il bordo superiore. */
  atTop: boolean;
  /** C'e contenuto sotto il bordo inferiore. */
  atBottom: boolean;
}

/**
 * Osserva quanto contenuto resta fuori da un contenitore scrollabile sui due
 * assi.
 *
 * Serve per dare un'indicazione visibile che lo scroll esiste: un contenitore
 * che scorre senza alcun segnale sembra semplicemente troncato, e i controlli
 * oltre il bordo restano di fatto invisibili. Lo stato si aggiorna su scroll,
 * su resize del contenitore e quando cambia il numero di figli, cosi la
 * sfumatura orizzontale o verticale sparisce appena il contenuto ci sta tutto.
 *
 * La logica ricalca quella gia usata da `ProjectFileTabs` per le sue frecce di
 * scorrimento; qui e estratta per poter essere condivisa.
 */
export function useScrollOverflow<T extends HTMLElement>(): [
  React.RefObject<T>,
  ScrollOverflow,
] {
  const ref = useRef<T>(null);
  const [overflow, setOverflow] = useState<ScrollOverflow>({
    atStart: false,
    atEnd: false,
    atTop: false,
    atBottom: false,
  });

  const update = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    // Sotto il pixel le differenze sono arrotondamenti di layout, non contenuto.
    const scrollLeft = Math.abs(element.scrollLeft);
    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    const scrollTop = element.scrollTop;
    const maxScrollTop = element.scrollHeight - element.clientHeight;

    setOverflow((current) => {
      const next: ScrollOverflow = {
        atStart: scrollLeft > 1,
        atEnd: maxScrollLeft - scrollLeft > 1,
        atTop: scrollTop > 1,
        atBottom: maxScrollTop - scrollTop > 1,
      };
      return current.atStart === next.atStart &&
        current.atEnd === next.atEnd &&
        current.atTop === next.atTop &&
        current.atBottom === next.atBottom
        ? current
        : next;
    });
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    update();
    element.addEventListener("scroll", update, { passive: true });

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    // I comandi della toolbar cambiano con la selezione: senza osservare i
    // figli la sfumatura resterebbe ferma allo stato precedente.
    const mutations = typeof MutationObserver === "undefined" ? null : new MutationObserver(update);
    mutations?.observe(element, { childList: true, subtree: true });

    return () => {
      element.removeEventListener("scroll", update);
      observer?.disconnect();
      mutations?.disconnect();
    };
  }, [update]);

  return [ref, overflow];
}
