import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const messagesRaw = formData.get('messages') as string;
    const mode = (formData.get('mode') as string) || 'quick';

    const messages = JSON.parse(messagesRaw || '[]');

    const systemPrompts: Record<string, string> = {
      quick:    'You are StudyAI, a concise academic tutor. Give direct, focused answers. Be clear and efficient.',
      deep:     'You are StudyAI, a thorough academic tutor. Provide in-depth explanations with examples, analogies, and multiple perspectives.',
      research: 'You are StudyAI, a graduate-level research assistant. Provide comprehensive, scholarly answers with context, nuance, and academic depth.',
      socratic: 'You are StudyAI using the Socratic method. Guide the student to understanding through thoughtful questions rather than direct answers.',
    };

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ reply: '⚠️ No API key configured. Please set GROQ_API_KEY in your .env.local file.' });
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompts[mode] || systemPrompts.quick },
          ...messages,
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ reply: `⚠️ API error: ${res.status} — ${err}` });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'No response received.';
    return NextResponse.json({ reply });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ reply: `⚠️ Server error: ${message}` }, { status: 500 });
  }
}
