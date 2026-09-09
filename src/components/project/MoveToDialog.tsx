import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/useI18n";
import type { ProjectMoveDestination } from "../../utils/projectExplorer";
import { Button, Field, Modal } from "../ui";

interface MoveToDialogProps {
  open: boolean;
  nodeName: string;
  destinations: ProjectMoveDestination[];
  onMove: (targetParentId: string) => void;
  onClose: () => void;
}

/**
 * Fase J2.c — alternativa da tastiera al drag & drop. Dialog "Sposta in…": scegli una cartella
 * di destinazione (solo quelle valide, calcolate da getValidMoveDestinations) e conferma.
 * Focus trap, Esc e Invio arrivano dalla Modal shell / dal form; nessun mouse richiesto.
 */
export function MoveToDialog({ open, nodeName, destinations, onMove, onClose }: MoveToDialogProps) {
  const { t } = useI18n();
  const [targetId, setTargetId] = useState("");

  useEffect(() => {
    if (open) {
      setTargetId(destinations[0]?.id ?? "");
    }
  }, [open, destinations]);

  if (!open) {
    return null;
  }

  const hasDestinations = destinations.length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={t("projectExplorer.moveDialog.title", { name: nodeName })}
      size="sm"
      className="action-modal"
      testId="move-to-dialog"
    >
      <form
        className="action-modal-content"
        onSubmit={(event) => {
          event.preventDefault();
          if (targetId) {
            onMove(targetId);
          }
        }}
      >
        {hasDestinations ? (
          <Field label={t("projectExplorer.moveDialog.destinationLabel")}>
            {({ id, describedBy }) => (
              <select
                id={id}
                aria-describedby={describedBy}
                className="ui-select"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                data-autofocus
              >
                {destinations.map((destination) => (
                  <option key={destination.id} value={destination.id}>
                    {`${"  ".repeat(destination.depth)}${destination.name}`}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : (
          <p className="ui-modal__subtitle">{t("projectExplorer.moveDialog.noDestinations")}</p>
        )}

        <div className="ui-modal__footer action-modal-actions">
          <Button variant="secondary" onClick={onClose}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={!hasDestinations || !targetId}>
            {t("projectExplorer.moveDialog.confirm")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
