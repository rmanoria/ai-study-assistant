import { NextRequest, NextResponse } from 'next/server';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

async function groq(system: string, user: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: 3000,
      temperature: 0.7,
    }),
  });

  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseJSON(raw: string): unknown {
  // Strip markdown fences
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

export async function POST(req: NextRequest) {
  try {
    const { tool, payload } = await req.json();

    // ─── FLASHCARDS ───────────────────────────────────────────────────────────
    if (tool === 'flashcards') {
      const { topic, count = '10', difficulty = 'medium', instruction = '' } = payload;
      const system = `You are an expert educator creating flashcards. Always respond with valid JSON only — no markdown, no explanation.`;
      const user = `Create ${count} flashcards about "${topic}".
Difficulty: ${difficulty}.
${instruction ? `Extra instruction: ${instruction}` : ''}

Return a JSON array of objects with these exact keys:
[{"q": "question text", "a": "answer text", "tag": "category", "hint": "optional hint"}]

Requirements:
- Questions should be clear and specific
- Answers should be concise but complete
- Tag should be a 1-2 word category
- Vary the question types (definition, application, comparison)
- Adjust complexity for ${difficulty} difficulty`;

      const raw = await groq(system, user);
      const data = parseJSON(raw);
      return NextResponse.json({ data });
    }

    // ─── QUIZ ─────────────────────────────────────────────────────────────────
    if (tool === 'quiz') {
      const { topic, type = 'mcq', count = '8', difficulty = 'medium' } = payload;
      const system = `You are an expert quiz creator. Always respond with valid JSON only — no markdown, no explanation.`;

      let format = '';
      if (type === 'mcq') {
        format = `[{"type":"mcq","question":"...","options":["A","B","C","D"],"answer":"exact option text","explanation":"..."}]`;
      } else if (type === 'tf') {
        format = `[{"type":"tf","question":"...","answer":"true" or "false","explanation":"..."}]`;
      } else {
        format = `[{"type":"short","question":"...","answer":"expected answer","explanation":"..."}]`;
      }

      const user = `Create ${count} ${type === 'mcq' ? 'multiple choice' : type === 'tf' ? 'true/false' : 'short answer'} questions about "${topic}".
Difficulty: ${difficulty}.
Return a JSON array: ${format}
For MCQ, include exactly 4 options and make sure the answer matches one option exactly.`;

      const raw = await groq(system, user);
      const data = parseJSON(raw);
      return NextResponse.json({ data });
    }

    // ─── SUMMARIZE ────────────────────────────────────────────────────────────
    if (tool === 'summarize') {
      const { text, style = 'concise', level = 'undergraduate' } = payload;
      const styleGuides: Record<string, string> = {
        concise:  'Write a concise paragraph summary hitting only the key points.',
        bullets:  'Write a bulleted list of key points and takeaways.',
        academic: 'Write an academic summary with formal language, thesis, and supporting points.',
        eli5:     'Explain like I\'m 5 — use simple language, relatable analogies.',
        mindmap:  'Extract the main concept and key sub-concepts in a structured outline.',
        outline:  'Create a detailed hierarchical outline with main topics and sub-points.',
      };

      const system = `You are an expert academic summarizer. Level: ${level}. ${styleGuides[style] || styleGuides.concise}`;
      const text_summary = await groq(system, `Summarize the following content:\n\n${text}`);
      return NextResponse.json({ text: text_summary });
    }

    // ─── CHECK SHORT ANSWER ───────────────────────────────────────────────────
    if (tool === 'check_answer') {
      const { question, expected, given } = payload;
      const system = `You are a fair academic evaluator. Assess if the student's answer is correct or partially correct. Be encouraging but honest. Respond in 2-3 sentences.`;
      const result = await groq(system, `Question: ${question}\nExpected answer: ${expected}\nStudent's answer: ${given}\n\nIs the student's answer correct? Explain.`);
      return NextResponse.json({ result });
    }

    // ─── PLANNER ─────────────────────────────────────────────────────────────
    if (tool === 'planner') {
      const { topic } = payload;
      const system = `You are an expert study planner. Always respond with valid JSON only — no markdown, no explanation.`;
      const user = `Create a comprehensive study plan for: "${topic}".
Return JSON with this structure:
{"name":"Plan name","subjects":[{"name":"Subject/Topic","tasks":["Task 1","Task 2","Task 3"]}]}
Include 3-5 subjects with 3-6 specific, actionable tasks each.`;

      const raw = await groq(system, user);
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
