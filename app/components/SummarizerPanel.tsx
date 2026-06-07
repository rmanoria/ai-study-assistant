"use client";

import { useState, useRef } from "react";
import { Loader2, Zap, FileText, X, Upload, Check, Copy } from "lucide-react";
import ChatBubble from "./ChatBubble";

const STYLES = [
  { id: "concise",  label: "📌 Concise",     prompt: "Write a concise summary in clear paragraphs." },
  { id: "bullets",  label: "• Bullets",       prompt: "Summarize using ONLY bullet points. Every point MUST start with '- '. No intro or outro text." },
  { id: "academic", label: "🎓 Academic",     prompt: "Write a formal academic-style summary with well-structured paragraphs." },
  { id: "eli5",     label: "🧒 ELI5",         prompt: "Explain this like I am five years old using very simple language and short sentences." },
  { id: "mindmap",  label: "🗺 Key Concepts", prompt: "Extract the 5-8 most important key concepts. Format each as: **Concept**: explanation." },
];

type FileState = {
  file: File;
  name: string;
  type: "pdf" | "docx" | "txt" | "image";
  extracting: boolean;
  extracted: string;
  error: string;
  statusMsg: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

async function extractTxtText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? "");
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/** Convert file to base64 string (without data URI prefix) */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * CLIENT-SIDE PDF text extraction via pdfjs-dist.
 * Uses workerSrc = "" to run in main thread — safe on all mobile browsers.
 */
async function extractPdfTextClient(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  // Disable worker entirely — runs synchronously in main thread.
  // This avoids the CDN/blob-worker failures on iOS Safari & mobile Chrome.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjs.GlobalWorkerOptions as any).workerSrc = "";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    // Prevent any network requests for CMaps / standard fonts on mobile
    disableFontFace: true,
    cMapUrl: undefined,
    standardFontDataUrl: undefined,
  }).promise;

  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: unknown) => (item as { str?: string }).str ?? "")
      .join(" ");
    pages.push(text);
  }
  return pages.join("\n\n").trim();
}

/**
 * CLIENT-SIDE: Render PDF pages to canvas images then send to vision API.
 * Also uses workerSrc = "" for mobile safety.
 */
async function pdfToImages(file: File, maxPages = 5): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjs.GlobalWorkerOptions as any).workerSrc = "";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    disableFontFace: true,
    cMapUrl: undefined,
    standardFontDataUrl: undefined,
  }).promise;

  const numPages = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];

  for (let p = 1; p <= numPages; p++) {
    try {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      await page.render({
        canvasContext: ctx,
        viewport,
      } as Parameters<typeof page.render>[0]).promise;

      const b64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
      if (b64) images.push(b64);
    } catch {
      // Skip unrenderable pages silently
    }
  }
  return images;
}

/**
 * SERVER-SIDE fallback: send raw PDF bytes to our API route for extraction.
 * The API uses a server-side pdfjs (Node canvas) — bypasses all browser issues.
 */
async function extractPdfViaServer(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  onProgress?.("Sending to server for extraction…");
  const base64 = await fileToBase64(file);
  const res = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool: "extract_document",
      payload: {
        base64,
        mediaType: "application/pdf",
        fileName: file.name,
      },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return (data.text ?? "").trim();
}

/** Send page images to AI vision via our API */
async function extractViaVision(
  images: string[],
  fileName: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const allText: string[] = [];

  for (let i = 0; i < images.length; i++) {
    onProgress?.(`Reading page ${i + 1} of ${images.length} with AI vision…`);
    const res = await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "extract_document",
        payload: {
          base64: images[i],
          mediaType: "image/jpeg",
          fileName: `${fileName} page ${i + 1}`,
        },
      }),
    });
    const data = await res.json();
    if (data.text) allText.push(data.text);
    else if (data.error) throw new Error(data.error);
  }

  return allText.join("\n\n");
}

/**
 * Full PDF extraction pipeline with multiple fallback layers:
 * 1. Client-side text extraction (pdfjs, no worker)
 * 2. If scanned → client-side canvas render → vision API
 * 3. If canvas fails → server-side extraction fallback
 * 4. If server returns little text → server sends to vision
 */
async function extractPdfWithFallbacks(
  file: File,
  onProgress: (msg: string) => void
): Promise<string> {
  // ── Layer 1: client-side text extraction ──
  let text = "";
  try {
    onProgress("Extracting text from PDF…");
    text = await extractPdfTextClient(file);
  } catch (clientErr) {
    console.warn("Client-side PDF text extraction failed:", clientErr);
    // Jump straight to server fallback
    text = "";
  }

  const hasText = text.replace(/\s/g, "").length >= 150;

  if (hasText) return text;

  // ── Layer 2: try client-side canvas → vision ──
  let usedCanvas = false;
  try {
    onProgress("Scanned PDF detected — rendering pages…");
    const images = await pdfToImages(file, 8);
    if (images.length > 0) {
      usedCanvas = true;
      text = await extractViaVision(images, file.name, onProgress);
      if (text.replace(/\s/g, "").length >= 50) return text;
    }
  } catch (canvasErr) {
    console.warn("Canvas render failed (mobile?):", canvasErr);
  }

  // ── Layer 3: server-side fallback ──
  if (!usedCanvas || text.replace(/\s/g, "").length < 50) {
    try {
      onProgress("Using server-side extraction…");
      text = await extractPdfViaServer(file, onProgress);
      if (text.replace(/\s/g, "").length >= 50) return text;
    } catch (serverErr) {
      console.warn("Server-side PDF extraction failed:", serverErr);
    }
  }

  // ── Layer 4: nothing worked ──
  throw new Error(
    "Could not extract text from this PDF. It may be password-protected or heavily corrupted."
  );
}

export default function SummarizerPanel() {
  const [input, setInput]         = useState("");
  const [style, setStyle]         = useState("concise");
  const [result, setResult]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const [copied, setCopied]       = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  function getFileType(file: File): "pdf" | "docx" | "txt" | "image" | null {
    const n = file.name.toLowerCase();
    if (n.endsWith(".pdf")) return "pdf";
    if (n.endsWith(".docx") || n.endsWith(".doc")) return "docx";
    if (n.endsWith(".txt")) return "txt";
    if (file.type.startsWith("image/")) return "image";
    return null;
  }

  async function processFile(file: File) {
    const type = getFileType(file);
    if (!type) { alert("Please upload a PDF, DOCX, TXT, or image file."); return; }

    const fs: FileState = {
      file, name: file.name, type,
      extracting: true, extracted: "", error: "", statusMsg: "Reading file…",
    };
    setFileState(fs);
    setInput("");
    setResult("");

    const setStatus = (msg: string) =>
      setFileState((p) => p ? { ...p, statusMsg: msg } : p);

    try {
      let text = "";

      if (type === "image") {
        setStatus("Analyzing image with AI vision…");
        const base64 = await fileToBase64(file);
        const res = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "extract_document",
            payload: { base64, mediaType: file.type, fileName: file.name },
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        text = data.text;

      } else if (type === "pdf") {
        text = await extractPdfWithFallbacks(file, setStatus);

      } else if (type === "docx") {
        setStatus("Extracting text from Word document…");
        text = await extractDocxText(file);

      } else if (type === "txt") {
        text = await extractTxtText(file);
      }

      if (!text?.trim()) throw new Error("No readable text found in this file.");
      setFileState((p) => p ? { ...p, extracting: false, extracted: text, statusMsg: "" } : p);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to extract text.";
      setFileState((p) => p ? { ...p, extracting: false, error: msg, statusMsg: "" } : p);
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
    const styleConfig = STYLES.find((s) => s.id === style);
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "summarize",
          payload: { text, style, stylePrompt: styleConfig?.prompt ?? "" },
        }),
      });
      const data = await res.json();
      setResult(data.text || data.error || "Failed to summarize.");
    } catch {
      setResult("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard?.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeText   = fileState?.extracted || input;
  const wordCount    = activeText.split(/\s+/).filter(Boolean).length;
  const canSummarize = !!activeText.trim() && !fileState?.extracting;
  const FILE_ICON: Record<string, string> = { pdf: "📄", docx: "📝", txt: "📃", image: "🖼️" };

  return (
    <>
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 999px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
        .custom-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.12) transparent; }
      `}</style>

      {/* Copied toast */}
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none
        ${copied ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl shadow-xl">
          <Check size={15} /> Copied to clipboard!
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* ── LEFT: Input ── */}
        <div className="flex flex-col gap-4 p-4 sm:p-6 overflow-y-auto custom-scroll md:w-1/2 md:border-r md:border-white/8 shrink-0">

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-500/20 border border-green-500/30 shrink-0">
              <Zap size={18} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">AI Summarizer</h2>
              <p className="text-xs text-gray-400">PDF, Word, TXT, or images — including scanned docs</p>
            </div>
          </div>

          {/* Style picker */}
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Summary Style</p>
            <div className="flex gap-2 flex-wrap">
              {STYLES.map((s) => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                    ${style === s.id ? "bg-green-600 border-green-600 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:border-green-500/40 hover:text-green-300"}`}
                >{s.label}</button>
              ))}
            </div>
          </div>

          {/* Upload zone / File chip */}
          {!fileState ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all py-7 px-5 text-center
                ${dragOver ? "border-green-500/70 bg-green-500/10" : "border-white/10 hover:border-green-500/40 hover:bg-white/5"}`}
            >
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <Upload size={20} className="text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Drop a file or click to upload</p>
                <p className="text-xs text-gray-500 mt-1">PDF (text or scanned), Word, TXT, or images</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {["PDF", "DOCX", "TXT", "PNG", "JPG"].map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-gray-500 tracking-wider">{t}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5
              ${fileState.error ? "bg-red-500/10 border-red-500/30" : fileState.extracting ? "bg-white/5 border-white/10" : "bg-green-500/10 border-green-500/30"}`}
            >
              <div className="text-xl shrink-0">{FILE_ICON[fileState.type]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{fileState.name}</p>
                {fileState.extracting && (
                  <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <Loader2 size={11} className="animate-spin" />
                    {fileState.statusMsg || "Processing…"}
                  </p>
                )}
                {fileState.error && (
                  <div>
                    <p className="text-xs text-red-400 mt-0.5 leading-snug">{fileState.error}</p>
                    <button onClick={() => processFile(fileState.file)}
                      className="text-xs text-violet-400 hover:text-violet-300 mt-1 underline">
                      Try again
                    </button>
                  </div>
                )}
                {fileState.extracted && !fileState.extracting && (
                  <p className="text-xs text-green-400 mt-0.5">
                    {formatBytes(fileState.file.size)} · {fileState.extracted.split(/\s+/).filter(Boolean).length.toLocaleString()} words extracted ✓
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors" title="Replace">
                  <FileText size={13} />
                </button>
                <button onClick={clearFile}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 transition-colors" title="Remove">
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,image/*" className="hidden" onChange={handleFileInput} />

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
                ? fileState.extracted.slice(0, 3000) + (fileState.extracted.length > 3000 ? "\n\n[… truncated for preview]" : "")
                : input
            }
            onChange={(e) => { if (!fileState) setInput(e.target.value); }}
            readOnly={!!fileState?.extracted}
            placeholder="Paste lecture notes, articles, textbook content, or any text here…"
            className={`w-full border text-sm placeholder:text-gray-600 rounded-2xl px-4 py-3.5 outline-none transition-colors resize-none leading-relaxed custom-scroll
              ${fileState?.extracted
                ? "bg-white/2 border-green-500/20 text-gray-400 cursor-default"
                : "bg-white/5 border-white/10 focus:border-green-500/50 text-gray-200"
              }`}
            rows={8}
          />

          {/* Summarize button */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={summarize}
              disabled={loading || !canSummarize}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl text-sm font-semibold transition-all"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : "⚡"}
              {loading ? "Summarizing…" : fileState?.extracted ? "Summarize Document" : "Summarize Text"}
            </button>
            {wordCount > 0 && !fileState?.extracting && (
              <span className="text-xs text-gray-500">{wordCount.toLocaleString()} words</span>
            )}
          </div>
        </div>

        {/* ── RIGHT: Output ── */}
        <div className="flex flex-col flex-1 min-h-0 md:w-1/2 overflow-y-auto">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <div className="w-12 h-12 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                <Loader2 size={22} className="text-green-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold">Summarizing…</p>
                <p className="text-gray-500 text-sm mt-1">AI is reading and distilling your content</p>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="flex flex-col p-4 sm:p-6 gap-4">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Summary</span>
                  <span className="text-xs text-gray-600">· {STYLES.find((s) => s.id === style)?.label}</span>
                </div>
                <button onClick={handleCopy}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all
                    ${copied ? "bg-green-600/20 border-green-500/40 text-green-400" : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20"}`}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="w-full bg-white/2 border border-white/8 rounded-2xl p-4 sm:p-5">
                <ChatBubble role="assistant" content={result} darkMode={true} />
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">⚡</div>
              <div>
                <p className="text-white font-semibold text-lg">Your summary will appear here</p>
                <p className="text-gray-500 text-sm mt-1.5 max-w-xs">Upload a document or paste text on the left, choose a style, and hit Summarize.</p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
                {STYLES.map((s) => (
                  <button key={s.id} onClick={() => setStyle(s.id)}
                    className={`text-left px-4 py-2.5 rounded-xl border text-xs font-medium transition-all
                      ${style === s.id ? "bg-green-600/20 border-green-500/40 text-green-300" : "bg-white/3 border-white/8 text-gray-500 hover:border-white/15 hover:text-gray-300"}`}
                  >
                    {s.label}
                    <span className="block text-[10px] font-normal opacity-60 mt-0.5">{s.prompt.slice(0, 55)}…</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
