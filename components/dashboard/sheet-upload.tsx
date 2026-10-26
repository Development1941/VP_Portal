"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileUp } from "lucide-react";
import { ActionForm, Submit } from "@/components/common/forms";
import type { FormState } from "@/lib/form";

export function SheetUpload({
  action,
  title,
  hint,
  field,
  button,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  title: string;
  hint: string;
  field: string;
  button: string;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = ".csv,.xlsx,.xls";

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setOver(false);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function remember(file: File | undefined, fromDrop: boolean) {
    const input = inputRef.current;
    if (!input || !file) return;
    const name = file.name.toLowerCase();
    const allowed = name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!allowed) {
      if (!fromDrop) input.value = "";
      setFileName("");
      return;
    }
    if (fromDrop) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
    }
    setFileName(file.name);
  }

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        {button}
      </button>
      {open
        ? createPortal(
            <div className="upload-modal" role="presentation" onClick={close}>
              <div className="upload-card" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
                <div className="upload-head">
                  <h3>{title}</h3>
                  <button type="button" className="upload-x" aria-label="Close" onClick={close}>
                    ×
                  </button>
                </div>
                <p className="upload-hint">{hint}</p>
                <ActionForm action={action} className="upload-form" onDone={close}>
                  <div
                    className={over ? "upload-drop over" : "upload-drop"}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setOver(true);
                    }}
                    onDragLeave={() => setOver(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setOver(false);
                      remember(event.dataTransfer.files?.[0], true);
                    }}
                  >
                    <span className="upload-mark" aria-hidden>
                      <FileUp strokeWidth={1.75} />
                    </span>
                    <p>{fileName || "Drag and drop a file to upload"}</p>
                    <button type="button" className="btn upload-select" onClick={() => inputRef.current?.click()}>
                      Select files
                    </button>
                    <input
                      ref={inputRef}
                      className="upload-file"
                      type="file"
                      name={field}
                      accept={accept}
                      onChange={(event) => remember(event.target.files?.[0], false)}
                    />
                  </div>
                  <div className="upload-foot">
                    <button type="button" className="upload-cancel" onClick={close}>
                      Cancel
                    </button>
                    <Submit disabled={!fileName}>Upload</Submit>
                  </div>
                </ActionForm>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
