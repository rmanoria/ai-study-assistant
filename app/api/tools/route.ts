import Groq from "groq-sdk";

if (!process.env.GROQ_API_KEY) {
  console.warn("⚠️  GROQ_API_KEY is not set in .env.local");
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

type ToolType = "flashcards" | "quiz" | "summarize" | "studyplan" | "note_action";

const TOOL_PROMPTS: Record<ToolType, (payload: Record<string, string>) => string> = {
  flashcards: ({ topic, count }) =>
    `Create exactly ${count} flashcards about: "${topic}"

Return ONLY a JSON array, no markdown backticks, no other text whatsoever:
[{"q":"question","a":"answer","tag":"category"}]

Questions should be clear and educational. Answers should be concise but complete.`,

  quiz: ({ topic, count, difficulty }) =>
    `Create ${count} ${difficulty} multiple-choice quiz questions about: "${topic}"

Return ONLY a JSON array, no backticks, no markdown, nothing else:
[{"q":"question","opts":["option A","option B","option C","option D"],"ans":0,"explain":"why the correct answer is right"}]

"ans" is the 0-based index of the correct option. Make all 4 options plausible.`,

  summarize: ({ text, style }) => {
    const styles: Record<string, string> = {
      concise:
        "Write a concise 3-5 sentence summary capturing the key ideas in plain prose paragraphs.",

      bullets:
        `Summarize the following text using ONLY bullet points.
STRICT RULES you must follow:
- Every single point MUST start with a dash and a space: "- "
- Do NOT write any introduction sentence or paragraph before the bullets
- Do NOT write any conclusion sentence after the bullets
- Do NOT use bold headers or sections — just a flat list of bullet points
- Aim for 6-10 bullet points covering all the main ideas
- Each bullet should be a complete, informative sentence
Example of correct format:
- The company was founded in 1998 by two Stanford students.
- Revenue grew 40% year-over-year for the first five years.
- The product reached 1 billion users in 2016.`,

      academic:
        "Write a formal academic-style abstract summarizing the main arguments, methodology, and conclusions in structured paragraphs.",

      eli5:
        "Explain this like I'm 5 years old. Use very simple words, short sentences, and a fun relatable analogy. No jargon.",

      mindmap:
        `Extract the 5-8 most important key concepts from the text.
For each concept write it in this exact format:
**Concept Name**: One or two sentence explanation of why it matters.

List each concept on its own line. Do not add any intro or outro text.`,
    };

    const instruction = styles[style] ?? styles.concise;

    return `${instruction}

Text to summarize:

${text}`;
  },

  studyplan: ({ goal }) =>
    `Create a study plan for: "${goal}"

Return ONLY a JSON array, no backticks, nothing else:
[{"name":"Subject/Topic","tasks":["task 1","task 2","task 3"],"color":"#hexcolor"}]

Give 2-4 subjects with 3-5 specific, actionable tasks each. Use hex colors: #6c63ff, #10b981, #f59e0b, #ec4899, #22d3ee.`,

  note_action: ({ body, action }) => {
    const actions: Record<string, string> = {
      summarize: `Summarize this note concisely in 3-5 sentences:\n\n${body}`,
      improve:   `Improve the writing quality and clarity of this note. Keep all key information:\n\n${body}`,
      bullet:    `Convert this note into clear, organized bullet points grouped by topic:\n\n${body}`,
    };
    return actions[action] ?? actions.summarize;
  },
};

export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { error: "GROQ_API_KEY is missing. Add it to your .env.local file and restart the server." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { tool, payload } = body as { tool: ToolType; payload: Record<string, string> };

    if (!tool || !TOOL_PROMPTS[tool]) {
      return Response.json({ error: "Invalid tool." }, { status: 400 });
    }

    const prompt = TOOL_PROMPTS[tool](payload);

    const systemPrompt =
      tool === "summarize"
        ? "You are a precise study assistant. Follow the formatting instructions EXACTLY as given. Do not add any text that wasn't asked for. Do not wrap your response in markdown code blocks."
        : "You are a precise study assistant. Follow all instructions exactly. For JSON responses, return ONLY valid raw JSON — no markdown fences, no backticks, no preamble, no explanation, nothing else.";

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2048,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: prompt },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim() || "";

    const jsonTools: ToolType[] = ["flashcards", "quiz", "studyplan"];
    if (jsonTools.includes(tool)) {
      try {
        const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        const data  = JSON.parse(clean);
        return Response.json({ data });
      } catch (parseError) {
        console.error("JSON parse error:", parseError, "\nRaw response:", text);
        return Response.json(
          { error: "AI returned invalid JSON. Please try again.", raw: text },
          { status: 500 }
        );
      }
    }

    return Response.json({ text });
  } catch (error: unknown) {
    console.error("Tools API error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("API key") || msg.includes("401")) {
      return Response.json({ error: "Invalid Groq API key. Check your .env.local file." }, { status: 401 });
    }
    if (msg.includes("rate") || msg.includes("429")) {
      return Response.json({ error: "Groq rate limit hit. Wait a moment and try again." }, { status: 429 });
    }
    return Response.json({ error: "Something went wrong. Check your terminal for details." }, { status: 500 });
  }
}
