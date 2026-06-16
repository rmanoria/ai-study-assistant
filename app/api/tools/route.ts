import { NextRequest, NextResponse } from 'next/server';
import { inflateSync, inflateRawSync, unzipSync } from 'zlib';
import { promisify } from 'util';

export const runtime = 'nodejs';

const GROQ_URL  = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL     = 'llama-3.3-70b-versatile';
const MAX_CHARS = 8000;

function truncate(text: string, max = MAX_CHARS): string {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + '\n\n[Content truncated — showing first 8,000 characters]';
}

async function groq(system: string, user: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system.slice(0, 400) },
        { role: 'user',   content: truncate(user) },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const e = await res.text().catch(() => '');
    throw new Error(`Groq error: ${res.status} — ${e.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseJSON(raw: string): unknown {
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

// ─── PDF extraction (no external deps) ───────────────────────────────────────
function tryDecompress(data: Buffer): Buffer | null {
  // Try zlib (with header)
  try { return inflateSync(data); } catch { /* continue */ }
  // Try raw deflate (no header)
  try { return inflateRawSync(data); } catch { /* continue */ }
  // Try unzip (gzip)
  try { return unzipSync(data); } catch { /* continue */ }
  return null;
}

function decodePdfString(s: string): string {
  // Unescape PDF escape sequences
  return s
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\\\/g, '\\')
    .replace(/\\([()\\])/g, '$1')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHexString(h: string): string {
  const hex = h.replace(/[<>\s]/g, '');
  let out = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code >= 32 && code < 127) out += String.fromCharCode(code);
    else if (code === 10 || code === 13) out += ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

function extractFromStream(content: string): string {
  const parts: string[] = [];
  const btBlocks = content.match(/BT[\s\S]{0,5000}?ET/g) || [];

  for (const block of btBlocks) {
    // Parenthesis strings: (Hello World)
    const parens = block.match(/\(([^)\\]{0,500}(?:\\.[^)\\]{0,500})*)\)/g) || [];
    for (const p of parens) {
      const inner = decodePdfString(p.slice(1, -1));
      if (inner.length > 1 && /[a-zA-Z]/.test(inner)) parts.push(inner);
    }

    // Hex strings: <48656c6c6f>
    const hexes = block.match(/<([0-9a-fA-F\s]{4,400})>/g) || [];
    for (const h of hexes) {
      const decoded = decodeHexString(h);
      if (decoded.length > 1 && /[a-zA-Z]/.test(decoded)) parts.push(decoded);
    }

    // TJ arrays: [(text) spacing (more text)] TJ
    const tjArrays = block.match(/\[([^\]]{0,1000})\]\s*TJ/g) || [];
    for (const tj of tjArrays) {
      const tjParens = tj.match(/\(([^)\\]{0,300}(?:\\.[^)\\]{0,300})*)\)/g) || [];
      for (const p of tjParens) {
        const inner = decodePdfString(p.slice(1, -1));
        if (inner.length > 1 && /[a-zA-Z]/.test(inner)) parts.push(inner);
      }
    }
  }

  return parts.join(' ');
}

function extractPdfText(buf: Buffer): string {
  const allParts: string[] = [];
  const raw = buf.toString('latin1'); // latin1 is byte-safe for binary

  // Match all PDF objects
  const objRegex = /\d+ \d+ obj([\s\S]*?)endobj/g;
  let objMatch: RegExpExecArray | null;

  while ((objMatch = objRegex.exec(raw)) !== null) {
    const obj = objMatch[1];
    const streamMatch = obj.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
    if (!streamMatch) continue;

    const isFlate =
      /\/Filter\s*\/FlateDecode/.test(obj) ||
      /\/Filter\s*\[.*?\/FlateDecode.*?\]/.test(obj);

    const isText =
      /\/Subtype\s*\/Form/.test(obj) ||
      /\/Type\s*\/Page/.test(obj) ||
      !/\/Subtype\s*\/Image/.test(obj); // skip image streams

    if (!isText) continue;

    if (isFlate) {
      try {
        const compressed = Buffer.from(streamMatch[1], 'latin1');
        const decompressed = tryDecompress(compressed);
        if (decompressed) {
          const text = extractFromStream(decompressed.toString('latin1'));
          if (text.trim()) allParts.push(text);
        }
      } catch { /* skip */ }
    } else {
      // Uncompressed — extract directly
      const text = extractFromStream(streamMatch[1]);
      if (text.trim()) allParts.push(text);
    }
  }

  // Also try raw uncompressed scan of the whole file
  const rawText = extractFromStream(raw);
  if (rawText.trim()) allParts.push(rawText);

  // Clean up and deduplicate
  const combined = allParts.join('\n');
  const lines = combined
    .split(/[\n\r]+/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l.length > 3 && /[a-zA-Z]{2,}/.test(l))
    .filter(l => !/^[\d\s.\-+()]+$/.test(l));

  const seen = new Set<string>();
  return lines
    .filter(l => {
      if (seen.has(l)) return false;
      seen.add(l);
      return true;
    })
    .join('\n')
    .trim();
}

// ─── DOCX extraction ──────────────────────────────────────────────────────────
function extractDocxText(buf: Buffer): string {
  const raw = buf.toString('utf8', 0, Math.min(buf.length, 5_000_000));
  const wtMatches = raw.match(/<w:t(?:\s[^>]*)?>([^<]{1,500})<\/w:t>/g) || [];

  if (wtMatches.length > 0) {
    return wtMatches
      .map(m => m.replace(/<[^>]+>/g, '').trim())
      .filter(t => t.length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const sequences = raw.match(/[A-Za-z][A-Za-z0-9 ,.'"\-:;!?()\n]{10,}/g) || [];
  return sequences
    .map(s => s.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(s => s.split(' ').length >= 3)
    .join(' ');
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { tool, payload } = await req.json();

    // ── EXTRACT PDF ──────────────────────────────────────────────────────────
    if (tool === 'extract_pdf') {
      const { base64 } = payload;
      if (!base64) return NextResponse.json({ error: 'No file data received' });

      const buf  = Buffer.from(base64, 'base64');
      const text = extractPdfText(buf);

      if (text.length < 30) {
        return NextResponse.json({
          error:
            'Could not extract readable text from this PDF. It may be a scanned document (image-based). Try copying all text from the PDF and pasting it into the text box instead.',
        });
      }

      return NextResponse.json({ text: text.slice(0, 80000) });
    }

    // ── EXTRACT DOCX ─────────────────────────────────────────────────────────
    if (tool === 'extract_docx') {
      const { base64 } = payload;
      if (!base64) return NextResponse.json({ error: 'No file data received' });

      const buf  = Buffer.from(base64, 'base64');
      const text = extractDocxText(buf);

      if (text.length < 20) {
        return NextResponse.json({
          error: 'Could not extract text from this document. Try saving it as .txt first.',
        });
      }

      return NextResponse.json({ text: text.slice(0, 80000) });
    }

    // ── FLASHCARDS ───────────────────────────────────────────────────────────
    if (tool === 'flashcards') {
      const { topic, count = '10', difficulty = 'medium', instruction = '' } = payload;
      const system = `You are an expert educator. Respond with valid JSON only — no markdown, no explanation.`;
      const user   = `Create ${count} flashcards about "${topic}". Difficulty: ${difficulty}.
${instruction ? `Instruction: ${instruction}` : ''}
Return JSON array: [{"q":"question","a":"answer","tag":"category","hint":"optional hint"}]`;

      const raw  = await groq(system, user);
      const data = parseJSON(raw);
      return NextResponse.json({ data });
    }

    // ── QUIZ ─────────────────────────────────────────────────────────────────
    if (tool === 'quiz') {
      const { topic, type = 'mcq', count = '8', difficulty = 'medium' } = payload;
      const system = `You are an expert quiz creator. Respond with valid JSON only — no markdown, no explanation.`;
      const fmt = type === 'mcq'
        ? `[{"type":"mcq","question":"...","options":["A","B","C","D"],"answer":"exact option text","explanation":"..."}]`
        : type === 'tf'
        ? `[{"type":"tf","question":"...","answer":"true","explanation":"..."}]`
        : `[{"type":"short","question":"...","answer":"expected answer","explanation":"..."}]`;
      const user = `Create ${count} ${type} questions about "${topic}". Difficulty: ${difficulty}.
Return JSON: ${fmt}. For MCQ: exactly 4 options, answer must match one exactly.`;

      const raw  = await groq(system, user);
      const data = parseJSON(raw);
      return NextResponse.json({ data });
    }

    // ── SUMMARIZE ────────────────────────────────────────────────────────────
    if (tool === 'summarize') {
      const { text, style = 'concise', level = 'undergraduate', isImage = false } = payload;
      const styleGuides: Record<string, string> = {
        concise:  'Write a concise paragraph summary of the key points.',
        bullets:  'Write a bulleted list of key points using markdown.',
        academic: 'Write an academic summary with formal language, thesis, and supporting points.',
        eli5:     "Explain like I'm 5 using very simple language and relatable analogies.",
        mindmap:  'Extract the main concept and sub-concepts as a structured markdown outline.',
        outline:  'Create a detailed hierarchical outline using markdown headers and bullet points.',
      };
      const system = `You are an expert academic summarizer for a ${level} audience. ${styleGuides[style] || styleGuides.concise} Use markdown formatting.`;

      let summary: string;

      if (isImage) {
        const base64full = (text as string).replace(/^\[IMAGE:/, '').replace(/\]$/, '');
        const mediaMatch = base64full.match(/^data:([^;]+);base64,/);
        const mediaType  = mediaMatch ? mediaMatch[1] : 'image/jpeg';
        const imageData  = base64full.replace(/^data:[^;]+;base64,/, '').slice(0, 180000);

        const res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.2-11b-vision-preview',
            messages: [
              { role: 'system', content: system.slice(0, 400) },
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageData}` } },
                  { type: 'text', text: 'Summarize the content of this image.' },
                ],
              },
            ],
            max_tokens: 1000,
          }),
        });

        if (!res.ok) throw new Error(`Vision error: ${res.status}`);
        const vd = await res.json();
        summary = vd.choices?.[0]?.message?.content || 'Could not analyse image.';
      } else {
        const cleaned = (text as string || '').trim();
        if (!cleaned) return NextResponse.json({ error: 'No text content provided.' });
        summary = await groq(system, `Summarize the following content:\n\n${cleaned}`);
      }

      return NextResponse.json({ text: summary });
    }

    // ── CHECK ANSWER ─────────────────────────────────────────────────────────
    if (tool === 'check_answer') {
      const { question, expected, given } = payload;
      const system = `You are a fair academic evaluator. Be encouraging but honest. Respond in 2-3 sentences.`;
      const result = await groq(
        system,
        `Question: ${question}\nExpected: ${expected}\nStudent: ${given}\n\nIs this correct?`
      );
      return NextResponse.json({ result });
    }

    // ── PLANNER ──────────────────────────────────────────────────────────────
    if (tool === 'planner') {
      const { topic } = payload;
      const system = `You are an expert study planner. Respond with valid JSON only — no markdown, no explanation.`;
      const user   = `Create a study plan for: "${topic}".
Return JSON: {"name":"Plan name","subjects":[{"name":"Subject","tasks":["Task 1","Task 2"]}]}
Include 3-5 subjects with 3-6 specific actionable tasks each.`;

      const raw  = await groq(system, user);
      const data = parseJSON(raw);
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: 'Unknown tool' }, { status: 400 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Tools API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
