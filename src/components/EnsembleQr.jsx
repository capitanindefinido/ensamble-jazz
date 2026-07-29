import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode, X } from "lucide-react";

/**
 * Botón + modal con QR al hash del ensamble (para la puerta de la sala).
 */
export default function EnsembleQr({ ensambleId, ensambleNombre }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!open || !ensambleId) return;
    const href = `${window.location.origin}${window.location.pathname}#/ensamble/${encodeURIComponent(ensambleId)}`;
    setUrl(href);
    let cancelled = false;
    QRCode.toDataURL(href, {
      width: 240,
      margin: 2,
      color: { dark: "#241d14", light: "#f5efe2" },
    }).then((u) => {
      if (!cancelled) setDataUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [open, ensambleId]);

  if (!ensambleId) return null;

  return (
    <>
      <button
        type="button"
        className="be-qr-btn"
        onClick={() => setOpen(true)}
        aria-label="Código QR del ensamble"
      >
        <QrCode size={14} /> QR sala
      </button>
      {open ? (
        <div className="be-qr-scrim" onClick={() => setOpen(false)}>
          <div
            className="be-qr-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="QR del ensamble"
          >
            <button
              type="button"
              className="be-sheet-close"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
            <p className="be-qr-title">{ensambleNombre || ensambleId}</p>
            <p className="be-qr-hint">Pegalo en la puerta de la sala</p>
            {dataUrl ? (
              <img src={dataUrl} alt={`QR ${ensambleId}`} className="be-qr-img" />
            ) : (
              <p className="be-qr-hint">Generando…</p>
            )}
            <p className="be-qr-url">{url}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
