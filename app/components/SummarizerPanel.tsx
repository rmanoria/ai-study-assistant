"use client";

import { useState, useRef } from "react";
import { Loader2, Zap, FileText, X, Upload } from "lucide-react";
import ChatBubble from "./ChatBubble";

const STYLES = [
  { id: "concise",  label: "📌 Concise" },
  { id: "bullets",  label: "• Bullets" },
  { id: "academic", label: "🎓 Academic" },
  { id: "eli5",     label: "🧒 ELI5" },
  { id: "mindmap",  label: "🗺 Key Concepts" },
];

type FileState = {
  file: File;
  name: string;
  type: "pdf" | "docx" | "txt";
  extracting: boolean;
  extracted: string;
  error: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/** PDF → text using unpkg-hosted worker (stable, no CDN mismatch) */
async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  // Use unpkg with the exact installed version — avoids CDN 404s
  const version = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    const line    = content.items
      .map((item: unknown) => (item as { str?: string }).str ?? "")
      .join(" ");
    pages.push(line);
  }
  return pages.join("\n\n").trim();
}

/** DOCX → text via mammoth */
async function extractDocxText(file: File): Promise<string> {
  const mammoth     = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result      = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

/** TXT → text via FileReader */
async function extractTxtText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader  = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? "");
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

export default function SummarizerPanel() {
  const [input, setInput]         = useState("");
  const [style, setStyle]         = useState("concise");
  const [result, setResult]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  function getFileType(file: File): "pdf" | "docx" | "txt" | null {
    const n = file.name.toLowerCase();
    if (n.endsWith(".pdf"))               return "pdf";
    if (n.endsWith(".docx") || n.endsWith(".doc")) return "docx";
    if (n.endsWith(".txt"))               return "txt";
    return null;
  }

  async function processFile(file: File) {
    const type = getFileType(file);
    if (!type) {
      alert("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
      return;
    }
    const fs: FileState = { file, name: file.name, type, extracting: true, extracted: "", error: "" };
    setFileState(fs);
    setInput("");
    setResult("");

    try {
      let text = "";
      if (type === "pdf")  text = await extractPdfText(file);
      if (type === "docx") text = await extractDocxText(file);
      if (type === "txt")  text = await extractTxtText(file);

      if (!text.trim()) throw new Error("No readable text found in this file.");
      setFileState({ ...fs, extracting: false, extracted: text });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to extract text.";
      setFileState({ ...fs, extracting: false, error: msg });
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function clearFile() {
    setFileState(null);
    setInput("");
    setResult("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function summarize() {
    const text = (fileState?.extracted || input).trim();
    if (!text) return;
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "summarize", payload: { text, style } }),
      });
      const data = await res.json();
      setResult(data.text || "Failed to summarize.");
    } catch {
      setResult("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const activeText   = fileState?.extracted || input;
  const wordCount    = activeText.split(/\s+/).filter(Boolean).length;
  const canSummarize = !!activeText.trim() && !fileState?.extracting;

  const FILE_ICON: Record<string, string> = { pdf: "📄", docx: "📝", txt: "📃" };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 overflow-y-auto flex-1 w-full">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-green-500/20 border border-green-500/30 shrink-0">
          <Zap size={18} className="text-green-400" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-white">AI Summarizer</h2>
          <p className="text-xs sm:text-sm text-gray-400">Paste text or upload a PDF, Word, or TXT file</p>
        </div>
      </div>

      {/* Style picker */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStyle(s.id)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all
              ${style === s.id
                ? "bg-green-600 border-green-600 text-white"
                : "bg-white/5 border-white/10 text-gray-400 hover:border-green-500/40 hover:text-green-300"
              }`}
          >{s.label}</button>
        ))}
      </div>

      {/* File chip — shown after upload */}
      {fileState && (
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all
          ${fileState.error
            ? "bg-red-500/10 border-red-500/30"
            : fileState.extracting
              ? "bg-white/5 border-white/10"
              : "bg-green-500/10 border-green-500/30"
          }`}
        >
          <div className="text-xl shrink-0">{FILE_ICON[fileState.type] ?? "📁"}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{fileState.name}</p>
            {fileState.extracting && (
              <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                <Loader2 size={11} className="animate-spin" /> Extracting text…
              </p>
            )}
            {fileState.error && (
              <p className="text-xs text-red-400 mt-0.5 leading-snug">{fileState.error}</p>
            )}
            {fileState.extracted && !fileState.extracting && (
              <p className="text-xs text-green-400 mt-0.5">
                {formatBytes(fileState.file.size)} · {fileState.extracted.split(/\s+/).filter(Boolean).length.toLocaleString()} words ready
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors"
              title="Replace file"
            ><FileText size={13} /></button>
            <button
              onClick={clearFile}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 transition-colors"
              title="Remove file"
            ><X size={13} /></button>
          </div>
        </div>
      )}

      {/* Upload zone — only when no file */}
      {!fileState && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all px-5 py-4
            ${dragOver
              ? "border-green-500/70 bg-green-500/10"
              : "border-white/10 hover:border-green-500/40 hover:bg-white/3"
            }`}
        >
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
            <Upload size={17} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Drop a file or click to upload</p>
            <p className="text-xs text-gray-500 mt-0.5">PDF, Word (.docx), or plain text (.txt)</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {["PDF", "DOCX", "TXT"].map((t) => (
              <span key={t} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-gray-500 tracking-wider">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* OR divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/8" />
        <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">or paste text</span>
        <div className="flex-1 h-px bg-white/8" />
      </div>

      {/* Textarea */}
      <textarea
        value={
          fileState?.extracted
            ? fileState.extracted.slice(0, 2000) + (fileState.extracted.length > 2000 ? "…" : "")
            : input
        }
        onChange={(e) => { if (!fileState) setInput(e.target.value); }}
        readOnly={!!fileState?.extracted}
        placeholder="Paste your lecture notes, article, textbook content, or any text here…"
        className={`w-full border text-gray-200 text-sm placeholder:text-gray-600 rounded-2xl px-4 py-3.5 outline-none transition-colors resize-none leading-relaxed
          ${fileState?.extracted
            ? "bg-white/3 border-green-500/20 text-gray-400 cursor-default"
            : "bg-white/5 border-white/10 focus:border-green-500/50"
          }`}
        rows={5}
      />

      {/* Action row */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={summarize}
          disabled={loading || !canSummarize}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl text-sm font-semibold transition-all"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : "⚡"}
          {loading ? "Summarizing…" : fileState?.extracted ? "Summarize Document" : "Summarize"}
        </button>

        {wordCount > 0 && !fileState?.extracting && (
          <span className="text-xs text-gray-500">
            {wordCount.toLocaleString()} words
            {fileState && <span className="text-gray-600"> · {fileState.name}</span>}
          </span>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Summary</div>
            <button
              onClick={() => navigator.clipboard?.writeText(result)}
              className="text-[10px] px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            >📋 Copy</button>
          </div>
          <ChatBubble role="assistant" content={result} darkMode={true} />
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !fileState && !input && (
        <div className="flex flex-col items-center justify-center gap-3 text-center py-6">
          <div className="text-4xl">⚡</div>
          <div className="text-white font-semibold">Summarize anything instantly</div>
          <div className="text-gray-400 text-sm max-w-xs">
            Upload a document or paste text and AI will distill it into your chosen format.
          </div>
        </div>
      )}
    </div>
  );
}
