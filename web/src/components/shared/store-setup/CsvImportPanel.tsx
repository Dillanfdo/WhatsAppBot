"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CsvImportPanelProps<T> = {
  label: string;
  columns: string;
  parse: (text: string) => { rows: T[]; errors: string[] };
  /** Returns an error message, or null when the row was saved. */
  importRow: (row: T) => Promise<string | null>;
  onDone: () => Promise<void>;
  children?: ReactNode;
};

export const CsvImportPanel = <T,>({ label, columns, parse, importRow, onDone, children }: CsvImportPanelProps<T>) => {
  const [text, setText] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const parsed = text ? parse(text) : null;

  const readFile = async (file: File | undefined) => {
    setText(file ? await file.text() : "");
  };

  const run = async () => {
    if (!parsed || parsed.errors.length > 0 || parsed.rows.length === 0) return;
    setBusy(true);
    const results = await Promise.all(parsed.rows.map((row) => importRow(row)));
    setBusy(false);
    const failed = results.filter((message): message is string => message !== null);
    if (failed.length > 0) {
      toast.error(`${failed.length} row(s) failed: ${failed[0]}`);
    } else {
      toast.success(`Imported ${results.length} row(s).`);
    }
    setText("");
    setFileKey((value) => value + 1);
    await onDone();
  };

  return (
    <details className="rounded-md border p-3 text-sm">
      <summary className="cursor-pointer font-medium">{label}</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          CSV with a header row. Columns: {columns}. The whole file is checked first; nothing is imported if a row has an error.
        </p>
        {children}
        <Input
          key={fileKey}
          type="file"
          accept=".csv,text/csv"
          aria-label={label}
          onChange={(event) => void readFile(event.target.files?.[0])}
        />
        {parsed && parsed.errors.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-destructive">
            {parsed.errors.slice(0, 8).map((error) => (
              <li key={error}>{error}</li>
            ))}
            {parsed.errors.length > 8 ? <li>and {parsed.errors.length - 8} more</li> : null}
          </ul>
        ) : null}
        {parsed && parsed.errors.length === 0 ? (
          <p className="text-muted-foreground">{parsed.rows.length} row(s) ready to import.</p>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={busy || !parsed || parsed.errors.length > 0 || parsed.rows.length === 0}
          onClick={() => void run()}
        >
          Import
        </Button>
      </div>
    </details>
  );
};
