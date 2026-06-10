"use client";

import { useState, useRef } from "react";
import { Loader2, Zap, FileText, X, Upload, Check, Copy, Download } from "lucide-react";
import ChatBubble from "./ChatBubble";

const STYLES = [
  { id: "concise",  label: "📌 Concise",     prompt: "Write a concise summary in 3-5 clear paragraphs capturing the main ideas." },
  { id: "bullets",  label: "• Bullets",       prompt: "Summarize using ONLY bullet points grouped under ## topic headers. Every bullet MUST start with '- '. No intro or outro text." },
  { id: "academic", label: "🎓 Academic",     prompt: "Write a formal academic-style summary with sections: ## Introduction, ## Key Arguments, ## Conclusions." },
  { id: "eli5",     label: "🧒 ELI5",         prompt: "Explain this like I am five years old. Use very simple words, short sentences, and fun real-life analogies." },
  { id: "mindmap",  label: "🗺 Key Concepts", prompt: "Extract the 6-10 most important key concepts grouped by ## theme. Format: **Concept**: explanation." },
  { id: "outline",  label: "📋 Outline",      prompt: "Create a hierarchical outline: ## Main Topics, ### Subtopics, - bullet points. Cover ALL major content." },
];

const LEVELS = [
  { id: "elementary",    label: "🧒 Elementary" },
  { id: "highschool",    label: "🏫 High School" },
  { id: "undergraduate", label: "🎓 University"  },
  { id: "graduate",      label: "🔬 Graduate"    },
];

type FileState = {
  file: File; name: string; type: "pdf" | "docx" | "txt" | "image";
  extracting: boolean; extracted: string; error: string; statusMsg: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = (e) => res(((e.target?.result as string) ?? "").split(",")[1] ?? "");
    r.onerror = () => rej(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

// Read file as ArrayBuffer
async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = (e) => res(e.target?.result as ArrayBuffer);
    r.onerror = () => rej(new Error("Failed to read file"));
    r.readAsArrayBuffer(file);
  });
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth     = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  return (await mammoth.extractRawText({ arrayBuffer })).value.trim();
}

async function extractTxtText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = (e) => res((e.target?.result as string) ?? "");
    r.onerror = () => rej(new Error("Failed to read file"));
    r.readAsText(file);
  });
}

// Render PDF pages to JPEG images using canvas (no worker needed)
async function renderPdfToImages(
  arrayBuffer: ArrayBuffer,
  maxPages: number,
  onProgress?: (msg: string) => void
): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");

  // Try CDN worker first, fall back to no worker
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pdfjs.GlobalWorkerOptions as any).workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pdfjs.GlobalWorkerOptions as any).workerSrc = "";
  }

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    disableFontFace: true,
    useWorkerFetch: false,
  }).promise;

  const total  = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];

  for (let p = 1; p <= total; p++) {
    onProgress?.(`Rendering page ${p} of ${total}…`);
    try {
      const page     = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas   = document.createElement("canvas");
      canvas.width   = Math.floor(viewport.width);
      canvas.height  = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport } as Parameters<typeof page.render>[0]).promise;
      const b64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
      if (b64) images.push(b64);
      canvas.remove();
    } catch (e) {
      console.warn(`Page ${p} render failed:`, e);
    }
  }
  return images;
}

// Try to extract text layer from PDF
async function extractPdfTextLayer(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pdfjs.GlobalWorkerOptions as any).workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pdfjs.GlobalWorkerOptions as any).workerSrc = "";
  }

  const pdf   = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer), disableFontFace: true }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    pages.push(content.items.map((i: unknown) => (i as { str?: string }).str ?? "").join(" "));
  }
  return pages.join("\n\n").trim();
}

// Send images to vision API
async function sendImagesToVision(
  images: string[],
  fileName: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const results: string[] = [];
  for (let i = 0; i < images.length; i++) {
    onProgress?.(`AI reading page ${i + 1} of ${images.length}…`);
    const res  = await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "extract_document",
        payload: { base64: images[i], mediaType: "image/jpeg", fileName: `${fileName} page ${i + 1}` },
      }),
    });
    const data = await res.json();
    if (data.text)  results.push(data.text);
    if (data.error) console.warn("Vision page error:", data.error);
  }
  return results.join("\n\n");
}

// Send raw PDF bytes to server for extraction
async function sendPdfToServer(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  onProgress?.("Sending PDF to server…");
  const base64 = await fileToBase64(file);
  const res    = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool: "extract_document",
      payload: { base64, mediaType: "application/pdf", fileName: file.name },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return (data.text ?? "").trim();
}

// Master PDF pipeline
async function extractPdf(file: File, onProgress: (msg: string) => void): Promise<string> {
  const hasText = (t: string) => t.replace(/\s/g, "").length > 100;

  // Step 1: Try text layer extraction
  let text = "";
  try {
    onProgress("Reading PDF text layer…");
    const ab = await fileToArrayBuffer(file);
    text = await extractPdfTextLayer(ab);
    if (hasText(text)) {
      onProgress("Text extracted successfully.");
      return text;
    }
  } catch (e) {
    console.warn("Text layer extraction failed:", e);
  }

  // Step 2: Render pages to images → vision AI
  try {
    onProgress("No text layer found — rendering pages as images…");
    const ab     = await fileToArrayBuffer(file);
    const images = await renderPdfToImages(ab, 10, onProgress);
    if (images.length > 0) {
      onProgress(`Sending ${images.length} page(s) to AI vision…`);
      text = await sendImagesToVision(images, file.name, onProgress);
      if (hasText(text)) return text;
    }
  } catch (e) {
    console.warn("Canvas render pipeline failed:", e);
  }

  // Step 3: Send raw PDF to server
  try {
    text = await sendPdfToServer(file, onProgress);
    if (hasText(text)) return text;
  } catch (e) {
    console.warn("Server extraction failed:", e);
  }

  // Step 4: Last resort — send raw base64 PDF to vision API directly
  try {
    onProgress("Trying direct vision analysis…");
    const base64 = await fileToBase64(file);
    const res    = await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "extract_document",
        payload: { base64, mediaType: "application/pdf", fileName: file.name },
      }),
    });
    const data = await res.json();
    if (data.text && hasText(data.text)) return data.text;
  } catch (e) {
    console.warn("Direct vision failed:", e);
  }

  throw new Error(
    "Could not extract text from this PDF. Try copy-pasting the content directly into the text box below."
  );
}

export default function SummarizerPanel() {
  const [input,     setInput]     = useState("");
  const [style,     setStyle]     = useState("concise");
  const [level,     setLevel]     = useState("undergraduate");
  const [result,    setResult]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [dragOver,  setDragOver]  = useState(false);
  const [copied,    setCopied]    = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);

  function getFileType(file: File): "pdf" | "docx" | "txt" | "image" | null {
    const n = file.name.toLowerCase();
    if (n.endsWith(".pdf"))                          return "pdf";
    if (n.endsWith(".docx") || n.endsWith(".doc"))  return "docx";
    if (n.endsWith(".txt"))                          return "txt";
    if (file.type.startsWith("image/"))             return "image";
    return null;
  }

  async function processFile(file: File) {
    const type = getFileType(file);
    if (!type) { alert("Supported files: PDF, DOCX, TXT, or images."); return; }

    setFileState({ file, name: file.name, type, extracting: true, extracted: "", error: "", statusMsg: "Starting…" });
    setInput("");
    setResult("");

    const setStatus = (msg: string) =>
      setFileState(p => p ? { ...p, statusMsg: msg } : p);

    try {
      let text = "";

      if (type === "image") {
        setStatus("Analyzing image with AI vision…");
        const base64 = await fileToBase64(file);
        const res    = await fetch("/api/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: "extract_document", payload: { base64, mediaType: file.type, fileName: file.name } }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        text = data.text;
      } else if (type === "pdf") {
        text = await extractPdf(file, setStatus);
      } else if (type === "docx") {
        setStatus("Extracting Word document text…");
        text = await extractDocxText(file);
      } else if (type === "txt") {
        setStatus("Reading text file…");
        text = await extractTxtText(file);
      }

      if (!text?.trim()) throw new Error("No readable text found in this file.");
      setFileState(p => p ? { ...p, extracting: false, extracted: text, statusMsg: "" } : p);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to extract text.";
      setFileState(p => p ? { ...p, extracting: false, error: msg, statusMsg: "" } : p);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function clearFile() {
    setFileState(null); setInput(""); setResult("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function summarize() {
    const text = (fileState?.extracted || input).trim();
    if (!text) return;
    const styleConfig = STYLES.find(s => s.id === style);
    setLoading(true); setResult("");
    try {
      const res  = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "summarize",
          payload: {
            text,
            style,
            level,
            stylePrompt: `${styleConfig?.prompt ?? ""}\n\nAudience level: ${level}. Calibrate vocabulary and complexity accordingly.`,
          },
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

  function exportMarkdown() {
    const styleName = STYLES.find(s => s.id === style)?.label ?? style;
    const md   = `# Summary — ${styleName}\n_Level: ${level}_\n\n${result}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `summary-${style}-${Date.now()}.md`; a.click();
    URL.revokeObjectURL(url);
  }

  const activeText      = fileState?.extracted || input;
  const inputWordCount  = activeText.trim().split(/\s+/).filter(Boolean).length;
  const outputWordCount = result.trim().split(/\s+/).filter(Boolean).length;
  const canSummarize    = !!activeText.trim() && !fileState?.extracting;
  const compressionPct  = inputWordCount > 0 && outputWordCount > 0
    ? Math.round((1 - outputWordCount / inputWordCount) * 100) : null;

  const FILE_ICON: Record<string, string> = { pdf: "📄", docx: "📝", txt: "📃", image: "🖼️" };

  return (
    <>
      <style>{`
        .sum-scroll::-webkit-scrollbar{width:4px}
        .sum-scroll::-webkit-scrollbar-track{background:transparent}
        .sum-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:999px}
        .sum-scroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.12) transparent}
      `}</style>

      {/* Toast */}
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none ${copied ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl shadow-xl">
          <Check size={15}/> Copied!
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* LEFT */}
        <div className="flex flex-col gap-4 p-4 sm:p-6 overflow-y-auto sum-scroll md:w-1/2 md:border-r md:border-white/7 shrink-0">

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-500/20 border border-green-500/30 shrink-0">
              <Zap size={18} className="text-green-400"/>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">AI Summarizer</h2>
              <p className="text-xs text-gray-400">PDF, Word, TXT, images — including scanned docs</p>
            </div>
          </div>

          {/* Styles */}
          <div>
            <p className="text-xs text-[#5a5a7a] font-medium mb-2">Summary Style</p>
            <div className="flex gap-2 flex-wrap">
              {STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                    ${style === s.id ? "bg-green-600 border-green-600 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:border-green-500/40 hover:text-green-300"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Level */}
          <div>
            <p className="text-xs text-[#5a5a7a] font-medium mb-2">Audience Level</p>
            <div className="flex gap-2 flex-wrap">
              {LEVELS.map(l => (
                <button key={l.id} onClick={() => setLevel(l.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                    ${level === l.id ? "bg-emerald-700 border-emerald-600 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:border-emerald-500/40 hover:text-emerald-300"}`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Upload */}
          {!fileState ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all py-7 px-5 text-center
                ${dragOver ? "border-green-500/70 bg-green-500/10" : "border-white/10 hover:border-green-500/40 hover:bg-white/5"}`}>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <Upload size={20} className="text-gray-400"/>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Drop a file or click to upload</p>
                <p className="text-xs text-[#5a5a7a] mt-1">PDF (text or scanned), Word, TXT, or images</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {["PDF","DOCX","TXT","PNG","JPG"].map(t => (
                  <span key={t} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-gray-500 tracking-wider">{t}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors
              ${fileState.error ? "bg-red-500/10 border-red-500/30" : fileState.extracting ? "bg-white/5 border-white/10" : "bg-green-500/10 border-green-500/30"}`}>
              <div className="text-xl shrink-0">{FILE_ICON[fileState.type]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{fileState.name}</p>
                {fileState.extracting && (
                  <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <Loader2 size={11} className="animate-spin"/> {fileState.statusMsg || "Processing…"}
                  </p>
                )}
                {fileState.error && (
                  <div>
                    <p className="text-xs text-red-400 mt-0.5 leading-snug">{fileState.error}</p>
                    <button onClick={() => processFile(fileState.file)} className="text-xs text-violet-400 hover:text-violet-300 mt-1 underline">Try again</button>
                  </div>
                )}
                {fileState.extracted && !fileState.extracting && (
                  <p className="text-xs text-green-400 mt-0.5">
                    {formatBytes(fileState.file.size)} · {fileState.extracted.split(/\s+/).filter(Boolean).length.toLocaleString()} words extracted ✓
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors" title="Replace">
                  <FileText size={13}/>
                </button>
                <button onClick={clearFile} className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 transition-colors" title="Remove">
                  <X size={13}/>
                </button>
              </div>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,image/*" className="hidden" onChange={handleFileInput}/>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/8"/>
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">or paste text</span>
            <div className="flex-1 h-px bg-white/8"/>
          </div>

          <textarea
            value={fileState?.extracted ? fileState.extracted.slice(0, 3000) + (fileState.extracted.length > 3000 ? "\n\n[… truncated for preview]" : "") : input}
            onChange={e => { if (!fileState) setInput(e.target.value); }}
            readOnly={!!fileState?.extracted}
            placeholder="Paste lecture notes, articles, textbook content, or any text here…"
            rows={8}
            className={`w-full border text-sm placeholder:text-[#5a5a7a] rounded-2xl px-4 py-3.5 outline-none transition-colors resize-none leading-relaxed sum-scroll
              ${fileState?.extracted ? "bg-white/2 border-green-500/20 text-gray-400 cursor-default" : "bg-white/5 border-white/10 focus:border-green-500/50 text-gray-200"}`}
          />

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={summarize} disabled={loading || !canSummarize}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl text-sm font-semibold transition-all">
              {loading ? <Loader2 size={15} className="animate-spin"/> : "⚡"}
              {loading ? "Summarizing…" : fileState?.extracted ? "Summarize Document" : "Summarize Text"}
            </button>
            {inputWordCount > 0 && !fileState?.extracting && (
              <span className="text-xs text-[#5a5a7a]">{inputWordCount.toLocaleString()} words</span>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col flex-1 min-h-0 md:w-1/2 overflow-y-auto sum-scroll">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <div className="w-12 h-12 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                <Loader2 size={22} className="text-green-400 animate-spin"/>
              </div>
              <div className="text-center">
                <p className="text-white font-semibold">Summarizing…</p>
                <p className="text-gray-500 text-sm mt-1">AI is reading and distilling your content</p>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="flex flex-col p-4 sm:p-6 gap-4">
              <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-2 h-2 rounded-full bg-green-400"/>
                  <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Summary</span>
                  <span className="text-xs text-gray-600">· {STYLES.find(s => s.id === style)?.label}</span>
                  <span className="text-xs text-gray-600">· {LEVELS.find(l => l.id === level)?.label}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCopy}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all
                      ${copied ? "bg-green-600/20 border-green-500/40 text-green-400" : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20"}`}>
                    {copied ? <Check size={13}/> : <Copy size={13}/>}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button onClick={exportMarkdown}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-white/20 transition-all">
                    <Download size={13}/> .md
                  </button>
                </div>
              </div>

              {compressionPct !== null && compressionPct > 0 && (
                <div className="flex gap-3 flex-wrap">
                  {[
                    { label: "Input",       value: `${inputWordCount.toLocaleString()} words`,  color: "text-gray-300"    },
                    { label: "Summary",     value: `${outputWordCount.toLocaleString()} words`, color: "text-green-400"   },
                    { label: "Compression", value: `${compressionPct}% shorter`,                color: "text-emerald-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex-1 min-w-24 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-center">
                      <div className={`text-sm font-bold ${color}`}>{value}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="w-full bg-white/2 border border-white/8 rounded-2xl p-4 sm:p-5">
                <ChatBubble role="assistant" content={result} darkMode={true}/>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">⚡</div>
              <div>
                <p className="text-white font-semibold text-lg">Your summary will appear here</p>
                <p className="text-gray-500 text-sm mt-1.5 max-w-xs">Upload a document or paste text, choose a style and level, then hit Summarize.</p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setStyle(s.id)}
                    className={`text-left px-4 py-2.5 rounded-xl border text-xs font-medium transition-all
                      ${style === s.id ? "bg-green-600/20 border-green-500/40 text-green-300" : "bg-white/3 border-white/8 text-gray-500 hover:border-white/15 hover:text-gray-300"}`}>
                    {s.label}
                    <span className="block text-[10px] font-normal opacity-60 mt-0.5">{s.prompt.slice(0, 60)}…</span>
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
