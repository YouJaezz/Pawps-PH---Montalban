"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { AnthropicSetupHelp, FreeParseTips } from "@/app/suppliers/normalize/AnthropicSetupHelp";
import { triggerCsvDownload } from "@/lib/pricelist-normalize-csv";
import { exportPricelistPdf } from "@/lib/pricelist-normalize-pdf";
import { computeNormalizeStats } from "@/lib/pricelist-normalize-stats";
import type {
  NormalizeUploadFile,
  PawpsNormalizedRow,
} from "@/lib/pricelist-normalize-types";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf";
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const surface = { background: "#101820", borderColor: "#1e1e30" };
const accent = "#0E6DE3";
const wsColor = "#4dcc88";
const retailColor = "#5599dd";

type Step = 1 | 2 | 3;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatPhp(n: number | null): string {
  if (n == null) return "—";
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export function NormalizePricelistClient(props: {
  suppliers: { id: number; name: string }[];
  aiConfigured: boolean;
}) {
  const [step, setStep] = useState<Step>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [rows, setRows] = useState<PawpsNormalizedRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => computeNormalizeStats(rows), [rows]);

  const canProceedStep1 =
    files.length > 0 || pastedText.trim().length > 0;

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${line}`]);
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const valid: File[] = [];
    for (const f of list) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const ok =
        f.type.startsWith("image/") ||
        f.type === "application/pdf" ||
        ["pdf", "png", "jpg", "jpeg"].includes(ext);
      if (!ok) continue;
      if (f.size > MAX_FILE_BYTES) {
        setError(`${f.name} exceeds 8 MB limit`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length) {
      setFiles((prev) => [...prev, ...valid]);
      setError(null);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const runScan = async (preferAi = false) => {
    if (!supplierName.trim()) {
      setError("Enter a supplier name");
      return;
    }
    setStep(3);
    setScanning(true);
    setProgress(5);
    setLog([]);
    setError(null);
    setRows([]);

    try {
      appendLog("Preparing files…");
      setProgress(15);

      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      const nonImageFiles = files.filter((f) => !f.type.startsWith("image/"));
      let textForParse = pastedText.trim();
      const useAi = preferAi && props.aiConfigured;

      const uploadFiles: NormalizeUploadFile[] = [];

      if (!useAi && imageFiles.length > 0) {
        appendLog(
          `Reading ${imageFiles.length} photo(s) with OCR in your browser…`,
        );
        setProgress(35);
        const { extractTextFromImageFiles } = await import(
          "@/lib/pricelist-normalize-ocr-client"
        );
        const ocrParts: string[] = [];
        for (let i = 0; i < imageFiles.length; i++) {
          const f = imageFiles[i]!;
          appendLog(`OCR: ${f.name} (${i + 1}/${imageFiles.length})…`);
          const text = await extractTextFromImageFiles([f]);
          if (text.trim()) ocrParts.push(text.trim());
          setProgress(
            35 + Math.round(((i + 1) / Math.max(imageFiles.length, 1)) * 30),
          );
        }
        textForParse = [textForParse, ...ocrParts].filter(Boolean).join("\n\n");
        if (!textForParse) {
          throw new Error(
            "Could not read text from the photo. Try a clearer image or paste the pricelist text.",
          );
        }
        appendLog(`OCR extracted ${textForParse.length.toLocaleString()} characters`);
      }

      const filesToUpload = useAi ? files : nonImageFiles;
      for (let i = 0; i < filesToUpload.length; i++) {
        const f = filesToUpload[i]!;
        appendLog(`Encoding ${f.name}…`);
        const base64 = await fileToBase64(f);
        uploadFiles.push({
          name: f.name,
          mimeType: f.type,
          base64,
        });
        setProgress(
          65 + Math.round(((i + 1) / Math.max(filesToUpload.length, 1)) * 15),
        );
      }

      appendLog(
        useAi
          ? "Smart scan — Claude AI + your catalog…"
          : textForParse
            ? "Parsing extracted text + catalog matching…"
            : "Quick parse + catalog matching…",
      );
      setProgress(82);

      const res = await fetch("/api/suppliers/normalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: uploadFiles,
          pastedText: textForParse,
          supplierName: supplierName.trim(),
          extraInstructions,
          preferAi: useAi,
        }),
      });

      setProgress(85);
      appendLog("Parsing response…");

      const data = (await res.json()) as {
        rows?: PawpsNormalizedRow[];
        error?: string;
        code?: string;
        method?: "free" | "ai";
        catalogMatched?: number;
        warning?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      if (!data.rows?.length) {
        throw new Error("No rows returned");
      }

      setRows(data.rows);
      setProgress(100);
      appendLog(
        `Done — ${data.rows.length} products (${data.method === "ai" ? "Smart scan" : "Quick parse"})`,
      );
      if (data.catalogMatched) {
        appendLog(
          `Matched against ${data.catalogMatched} known brands/products in your catalog`,
        );
      }
      if (data.warning) {
        appendLog(`Note: ${data.warning}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setError(msg);
      appendLog(`Error: ${msg}`);
      setProgress(0);
    } finally {
      setScanning(false);
    }
  };

  const resetAll = () => {
    setStep(1);
    setFiles([]);
    setPastedText("");
    setSupplierName("");
    setExtraInstructions("");
    setRows([]);
    setLog([]);
    setProgress(0);
    setError(null);
    setScanning(false);
  };

  const inputClass =
    "w-full rounded-lg border px-3 py-2 text-sm text-zinc-50 outline-none focus:border-brand-blue/50";
  const inputStyle = {
    ...surface,
    borderWidth: 1,
    borderStyle: "solid" as const,
  };

  const btnPrimary =
    "rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40";
  const btnSecondary =
    "rounded-lg border px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/5 disabled:opacity-40";

  return (
    <div className="max-w-5xl space-y-6">
      {props.aiConfigured ? (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
          style={{ borderWidth: 1, borderStyle: "solid" }}
        >
          <div className="text-sm font-medium text-amber-100">
            Smart scan available
          </div>
          <p className="mt-1 text-xs text-amber-100/80">
            For PDFs and photos, use <strong>Smart scan</strong> — it reads the file
            with Claude and matches brands, flavors, and kg sizes against your
            inventory and supplier catalog.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border border-brand-cyan/30 bg-brand-blue/10 p-4"
          style={{ borderWidth: 1, borderStyle: "solid" }}
        >
          <div className="text-sm font-medium text-brand-cyan/90">
            Free mode — catalog matching enabled
          </div>
          <div className="mt-2">
            <AnthropicSetupHelp />
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex flex-wrap gap-2 text-xs">
        {([1, 2, 3] as const).map((n) => (
          <span
            key={n}
            className="rounded-full px-3 py-1 font-medium"
            style={{
              background: step === n ? accent : "#1e1e30",
              color: step === n ? "#0f0f14" : "#8888aa",
            }}
          >
            {n}. {n === 1 ? "Upload" : n === 2 ? "Supplier" : "Review"}
          </span>
        ))}
      </div>

      {/* STEP 1 */}
      {step === 1 ? (
        <section
          className="rounded-xl border p-5"
          style={{ ...surface, borderWidth: 1, borderStyle: "solid" }}
        >
          <h2 className="text-sm font-semibold text-zinc-100">Upload pricelist</h2>
          <p className="mt-1 text-xs text-zinc-500">
            PDF, PNG, or JPG — multiple files OK. Or paste raw text / Google Sheets
            data below.
          </p>

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition"
            style={{
              borderColor: dragOver ? accent : "#1e1e30",
              background: dragOver ? "rgba(232,164,74,0.08)" : "rgba(0,0,0,0.2)",
            }}
          >
            <span className="text-2xl" style={{ color: accent }}>
              ↓
            </span>
            <span className="mt-2 text-sm text-zinc-300">
              Drag & drop files here, or click to browse
            </span>
            <span className="mt-1 text-[11px] text-zinc-500">PDF · PNG · JPG</span>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-zinc-400">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex justify-between gap-2">
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    className="shrink-0 text-red-400 hover:underline"
                    onClick={() =>
                      setFiles((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <label className="mt-4 block">
            <span className="text-[11px] text-zinc-500">Pasted text (optional)</span>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={6}
              placeholder="Paste table rows, Google Sheets export, or plain text…"
              className={`${inputClass} mt-1 font-mono text-xs`}
              style={inputStyle}
            />
          </label>

          {error ? (
            <p className="mt-3 text-xs text-red-400">{error}</p>
          ) : null}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={!canProceedStep1}
              className={btnPrimary}
              style={{ background: accent, color: "#0f0f14" }}
              onClick={() => {
                setError(null);
                setStep(2);
              }}
            >
              Next →
            </button>
          </div>
        </section>
      ) : null}

      {/* STEP 2 */}
      {step === 2 ? (
        <section
          className="rounded-xl border p-5"
          style={{ ...surface, borderWidth: 1, borderStyle: "solid" }}
        >
          <h2 className="text-sm font-semibold text-zinc-100">Supplier setup</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Supplier name is written into every CSV row.
          </p>

          <label className="mt-4 block">
            <span className="text-[11px] text-zinc-500">Supplier name *</span>
            <input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. PawBuddies.ph"
              className={`${inputClass} mt-1`}
              style={inputStyle}
            />
          </label>

          {props.suppliers.length > 0 ? (
            <div className="mt-3">
              <span className="text-[11px] text-zinc-500">Quick select</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {props.suppliers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="rounded-lg border px-2.5 py-1 text-xs text-zinc-200 hover:border-brand-blue/40"
                    style={{ borderColor: "#1e1e30", background: "#0f0f14" }}
                    onClick={() => setSupplierName(s.name)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label className="mt-4 block">
            <span className="text-[11px] text-zinc-500">
              Extra instructions for Smart scan (optional)
            </span>
            <textarea
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              rows={3}
              placeholder='e.g. "Prices are per bag, not per kg"'
              className={`${inputClass} mt-1 text-xs`}
              style={inputStyle}
            />
          </label>

          {error ? (
            <p className="mt-3 text-xs text-red-400">{error}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-between gap-3">
            <button
              type="button"
              className={btnSecondary}
              style={{ borderColor: "#1e1e30" }}
              onClick={() => setStep(1)}
            >
              ← Back
            </button>
            {props.aiConfigured ? (
              <button
                type="button"
                disabled={!supplierName.trim()}
                className={btnPrimary}
                style={{ background: accent, color: "#0f0f14" }}
                onClick={() => void runScan(true)}
                title="Claude reads the file and uses your inventory + supplier catalog to fix names, flavors, and sizes"
              >
                Smart scan (recommended)
              </button>
            ) : null}
            <button
              type="button"
              disabled={!supplierName.trim()}
              className={
                props.aiConfigured ? btnSecondary : btnPrimary
              }
              style={
                props.aiConfigured
                  ? { borderColor: "#1e1e30" }
                  : { background: accent, color: "#0f0f14" }
              }
              onClick={() => void runScan(false)}
            >
              {props.aiConfigured ? "Quick parse (free)" : "Parse pricelist"}
            </button>
          </div>
        </section>
      ) : null}

      {/* STEP 3 */}
      {step === 3 ? (
        <section className="space-y-4">
          {(scanning || log.length > 0) && (
            <div
              className="rounded-xl border p-4"
              style={{ ...surface, borderWidth: 1, borderStyle: "solid" }}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                <span>{scanning ? "Scanning…" : "Scan complete"}</span>
                <span>{progress}%</span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full"
                style={{ background: "#1e1e30" }}
              >
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    background: accent,
                  }}
                />
              </div>
              {log.length > 0 ? (
                <ul
                  className="mt-3 max-h-28 overflow-y-auto font-mono text-[10px] leading-relaxed text-zinc-500"
                >
                  {log.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          {error && !scanning ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-300">
              <p>{error}</p>
              <div className="mt-3 border-t border-red-500/20 pt-3 text-zinc-300">
                <FreeParseTips />
              </div>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <>
              <div
                className="grid grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-5"
                style={{ ...surface, borderWidth: 1, borderStyle: "solid" }}
              >
                <Stat label="Total items" value={String(stats.totalItems)} />
                <Stat label="Types" value={String(stats.typesCount)} />
                <Stat
                  label="With WS price"
                  value={String(stats.withWholesale)}
                  highlight={wsColor}
                />
                <Stat
                  label="With retail"
                  value={String(stats.withRetail)}
                  highlight={retailColor}
                />
                <Stat
                  label="Avg WS"
                  value={
                    stats.avgWholesale != null
                      ? formatPhp(stats.avgWholesale)
                      : "—"
                  }
                  highlight={wsColor}
                />
              </div>

              <div
                className="overflow-hidden rounded-xl border"
                style={{ ...surface, borderWidth: 1, borderStyle: "solid" }}
              >
                <div className="scrollable-table-body max-h-[min(60vh,520px)] overflow-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr style={{ background: "#101820" }}>
                        {[
                          "#",
                          "Type",
                          "Item",
                          "Flavor",
                          "Size",
                          "Per kg",
                          "Wholesale",
                          "Retail",
                        ].map((h) => (
                          <th
                            key={h}
                            className="border-b px-2 py-2 font-medium text-zinc-400"
                            style={{ borderColor: "#1e1e30" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr
                          key={i}
                          className="border-b border-[#1e1e30]/80 hover:bg-white/[0.02]"
                        >
                          <td className="px-2 py-1.5 text-zinc-500">{i + 1}</td>
                          <td className="px-2 py-1.5 text-zinc-300">{r.type}</td>
                          <td className="px-2 py-1.5 font-medium text-zinc-100">
                            {r.item}
                          </td>
                          <td className="px-2 py-1.5 text-zinc-400">
                            {r.flavor ?? "—"}
                          </td>
                          <td className="px-2 py-1.5 text-zinc-400">
                            {r.size ?? "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right text-zinc-400">
                            {formatPhp(r.per_kg)}
                          </td>
                          <td
                            className="px-2 py-1.5 text-right font-medium"
                            style={{ color: wsColor }}
                          >
                            {formatPhp(r.wholesale)}
                          </td>
                          <td
                            className="px-2 py-1.5 text-right"
                            style={{ color: retailColor }}
                          >
                            {formatPhp(r.retail)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnPrimary}
                  style={{ background: wsColor, color: "#0f0f14" }}
                  onClick={() => triggerCsvDownload(supplierName.trim(), rows)}
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  style={{ borderColor: "#1e1e30" }}
                  onClick={() =>
                    exportPricelistPdf(supplierName.trim(), rows)
                  }
                >
                  Export PDF
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  style={{ borderColor: accent, color: accent }}
                  onClick={resetAll}
                >
                  Process another file
                </button>
                <Link
                  href="/suppliers"
                  className={`${btnSecondary} inline-flex items-center`}
                  style={{ borderColor: "#1e1e30" }}
                >
                  Upload to catalog →
                </Link>
              </div>
            </>
          ) : !scanning && error ? (
            <div className="flex gap-2">
              <button
                type="button"
                className={btnSecondary}
                style={{ borderColor: "#1e1e30" }}
                onClick={() => setStep(2)}
              >
                ← Back to supplier
              </button>
              <button
                type="button"
                className={btnPrimary}
                style={{ background: accent, color: "#0f0f14" }}
                onClick={() => void runScan(false)}
              >
                Retry scan
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Stat(props: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {props.label}
      </div>
      <div
        className="mt-0.5 text-lg font-semibold tabular-nums"
        style={{ color: props.highlight ?? "#e8e8f0" }}
      >
        {props.value}
      </div>
    </div>
  );
}
