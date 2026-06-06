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
  type: "pdf" | "docx" | "txt";
  extracting: boolean;
  extracted: string;
  error: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text    = content.items.map((item: unknown) => (item as { str?: string }).str ?? "").join(" ");
    pages.push(text);
  }
  return pages.join("\n\n").trim();
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth     = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result      = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

async function extractTxtText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader   = new FileReader();
    reader.onload  = (e) => resolve((e.target?.result as string) ?? "");
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
  const [copied, setCopied]       = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  function getFileType(file: File): "pdf" | "docx" | "txt" | null {
    const n = file.name.toLowerCase();
    if (n.endsWith(".pdf"))  return "pdf";
    if (n.endsWith(".docx") || n.endsWith(".doc")) return "docx";
    if (n.endsWith(".txt"))  return "txt";
    return null;
  }

  async function processFile(file: File) {
    const type = getFileType(file);
    if (!type) { alert("Please upload a PDF, DOCX, or TXT file."); return; }
    const fs: FileState = { file, name: file.name, type, extracting: true, extracted: "", error: "" };
    setFileState(fs);
    setInput("");
    setResult("");
    try {
      let text = "";
      if (type === "pdf")  text = await extractPdfText(file);
      if (type === "docx") text = await extractDocxText(file);
      if (type === "txt")  text = await extractTxtText(file);
      if (!text.trim()) throw new Error("No readable text found. The file may be scanned or image-based.");
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
    const styleConfig = STYLES.find(s => s.id === style);
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
      setResult(data.text || "Failed to summarize.");
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
  const FILE_ICON: Record<string, string> = { pdf: "📄", docx: "📝", txt: "📃" };

  return (
    <>
      {/* Transparent scrollbar global style */}
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 999px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
        .custom-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.12) transparent; }
      `}</style>

      {/* Copied toast */}
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-999 transition-all duration-300 pointer-events-none
        ${copied ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl shadow-xl">
          <Check size={15} />
          Copied to clipboard!
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
              <p className="text-xs text-gray-400">Upload a document or paste text</p>
            </div>
          </div>

          {/* Style picker */}
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Summary Style</p>
            <div className="flex gap-2 flex-wrap">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                    ${style === s.id
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-green-500/40 hover:text-green-300"
                    }`}
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
                ${dragOver ? "border-green-500/70 bg-green-500/10" : "border-white/10 hover:border-green-500/40 hover:bg-white/2"}`}
            >
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <Upload size={20} className="text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Drop a file or click to upload</p>
                <p className="text-xs text-gray-500 mt-1">PDF, Word (.docx), or plain text (.txt)</p>
              </div>
              <div className="flex gap-2">
                {["PDF", "DOCX", "TXT"].map((t) => (
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
                    <Loader2 size={11} className="animate-spin" /> Extracting text…
                  </p>
                )}
                {fileState.error && <p className="text-xs text-red-400 mt-0.5 leading-snug">{fileState.error}</p>}
                {fileState.extracted && !fileState.extracting && (
                  <p className="text-xs text-green-400 mt-0.5">
                    {formatBytes(fileState.file.size)} · {fileState.extracted.split(/\s+/).filter(Boolean).length.toLocaleString()} words ready
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

          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileInput} />

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
                ? "bg-white/2 border-green-500/20 text-gray-500 cursor-default"
                : "bg-white/5 border-white/10 focus:border-green-500/50 text-gray-200"
              }`}
            rows={8}
          />

          {/* Summarize */}
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
        <div className="flex flex-col flex-1 overflow-hidden md:w-1/2">

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
            <div className="flex flex-col flex-1 overflow-hidden p-4 sm:p-6 gap-4">
              {/* Result header */}
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Summary</span>
                  <span className="text-xs text-gray-600">· {STYLES.find(s => s.id === style)?.label}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all
                    ${copied
                      ? "bg-green-600/20 border-green-500/40 text-green-400"
                      : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                    }`}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              {/* Scrollable result — transparent thin scrollbar */}
              <div className="flex-1 overflow-y-auto custom-scroll bg-white/2 border border-white/8 rounded-2xl p-4 sm:p-5">
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
                {STYLES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
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
