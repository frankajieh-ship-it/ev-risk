/**
 * /dealer/inventory/import — Bulk CSV import for dealer inventory
 *
 * Drag-drop CSV upload → column mapping preview → validation error list →
 * confirm import with row-by-row progress reporting.
 */

"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Loader2, ArrowLeft, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface FailedRow {
  row: number;
  reason: string;
}

interface ImportResult {
  inserted: number;
  failed: FailedRow[];
}

interface PreviewRow {
  [key: string]: string;
}

const SAMPLE_CSV = `VIN,Make,Model,Year,Trim,Price,Mileage,Color,Status,ListingURL
1HGCM82633A004352,Honda,Accord,2022,Sport,28500,12400,Sonic Gray Pearl,active,
5YJSA1E26MF444444,Tesla,Model S,2021,Long Range,64900,18200,Midnight Silver,active,
WBY1Z4C51FV503456,BMW,i3,2020,Rex,22000,31000,Capparis White,active,`;

export default function DealerInventoryImportPage() {
  const { session } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsePreview = useCallback((text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return;

    const hdrs = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
    setHeaders(hdrs);

    const rows: PreviewRow[] = [];
    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const vals = lines[i].split(",").map((v) => v.replace(/^"|"$/g, "").trim());
      const row: PreviewRow = {};
      hdrs.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
      rows.push(row);
    }
    setPreview(rows);
  }, []);

  const handleFile = useCallback((f: File) => {
    setResult(null);
    setError(null);

    if (!f.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setError("File exceeds 2MB limit");
      return;
    }

    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => parsePreview(e.target?.result as string ?? "");
    reader.readAsText(f);
  }, [parsePreview]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = async () => {
    if (!file || !session?.access_token) return;

    setImporting(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/dealer/inventory/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? "Import failed");
        return;
      }

      setResult(data);
    } catch {
      setError("Network error — please try again");
    } finally {
      setImporting(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "offo-inventory-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dealer/inventory"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Inventory
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-gray-900">Import CSV</h1>
        </div>
        <button
          onClick={downloadSample}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50"
        >
          <Download className="w-3.5 h-3.5" />
          Download sample CSV
        </button>
      </div>

      {/* Column format guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
        <p className="font-medium mb-1.5">Expected columns (case-insensitive):</p>
        <p className="font-mono text-xs text-blue-700">
          VIN, <strong>Make*</strong>, <strong>Model*</strong>, Year, Trim, Price, Mileage, Color, Status, ListingURL
        </p>
        <p className="text-xs text-blue-600 mt-1.5">* Required &nbsp;·&nbsp; Max 500 rows per file &nbsp;·&nbsp; 2MB limit &nbsp;·&nbsp; Status defaults to &ldquo;active&rdquo; if blank</p>
      </div>

      {/* Result banner */}
      {result && (
        <div className={`rounded-xl border p-4 mb-6 ${result.inserted > 0 ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            {result.inserted > 0 ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            )}
            <p className={`font-semibold text-sm ${result.inserted > 0 ? "text-green-800" : "text-yellow-800"}`}>
              {result.inserted > 0
                ? `${result.inserted} vehicle${result.inserted !== 1 ? "s" : ""} imported successfully`
                : "No vehicles were imported"}
              {result.failed.length > 0 && ` · ${result.failed.length} row${result.failed.length !== 1 ? "s" : ""} skipped`}
            </p>
          </div>
          {result.failed.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
              {result.failed.map((f) => (
                <div key={f.row} className="flex items-start gap-2 text-xs text-yellow-700">
                  <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-500" />
                  <span>Row {f.row}: {f.reason}</span>
                </div>
              ))}
            </div>
          )}
          {result.inserted > 0 && (
            <Link
              href="/dealer/inventory"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-green-700 hover:text-green-800"
            >
              View inventory →
            </Link>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-2 text-sm text-red-700">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Drop zone */}
      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-green-400 bg-green-50"
              : file
                ? "border-green-300 bg-green-50/40"
                : "border-gray-200 hover:border-green-300 hover:bg-gray-50"
          }`}
        >
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="w-10 h-10 text-green-600" />
              <p className="font-medium text-gray-800">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              <p className="text-xs text-gray-400">Click to replace</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-gray-300" />
              <div>
                <p className="font-medium text-gray-700">Drop your CSV here</p>
                <p className="text-sm text-gray-400 mt-0.5">or click to browse</p>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

      {/* Preview table */}
      {preview.length > 0 && !result && (
        <div className="mt-6">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Preview (first {preview.length} rows)
          </p>
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="px-3 py-2 font-medium text-gray-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[160px] truncate">
                        {row[h] || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex gap-3 justify-end">
            <button
              onClick={() => { setFile(null); setPreview([]); setHeaders([]); setError(null); }}
              className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              {importing ? "Importing..." : "Import vehicles"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
