import Groq from "groq-sdk";

if (!process.env.GROQ_API_KEY) {
  console.warn("⚠️  GROQ_API_KEY is not set in .env.local");
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

type ToolType =
  | "flashcards"
  | "quiz"
  | "summarize"
  | "studyplan"
  | "note_action"
  | "extract_document";

// ── Prompt builders ───────────────────────────────────────────
const TOOL_PROMPTS: Record<string, (payload: Record<string, string>) => string> = {

  // ── Flashcards ───────────────────────────────────────────────
  flashcards: ({ topic, count, difficulty, instruction }) => {
    const diff = difficulty || "medium";
    return `Create exactly ${count} flashcards about: "${topic}"
Difficulty level: ${diff}
${instruction || ""}

Return ONLY a raw JSON array — no backticks, no markdown, no explanation:
[{"q":"question","a":"detailed answer","tag":"subtopic category","hint":"one-sentence hint to help remember without giving the answer away"}]

Rules:
- Questions must match the "${diff}" difficulty level
- Answers should be complete but concise
- Tags should be specific subtopics
- Hints must not directly reveal the answer
- Return EXACTLY ${count} items`;
  },

  // ── Quiz ─────────────────────────────────────────────────────
  quiz: ({ topic, count, difficulty, qType }) => {
    const diff     = difficulty || "medium";
    const type     = qType || "mcq";
    const typeDesc = type === "mcq"         ? "multiple-choice (4 options)"
                   : type === "truefalse"   ? "true/false"
                   : type === "shortanswer" ? "short answer"
                   :                         "mixed (a variety of MCQ, true/false, and short answer)";

    const mcqFormat = `{"type":"mcq","q":"question","opts":["option A","option B","option C","option D"],"ans":0,"explain":"why this answer is correct"}`;
    const tfFormat  = `{"type":"truefalse","q":"statement to evaluate","ans":true,"explain":"why this is true or false"}`;
    const saFormat  = `{"type":"shortanswer","q":"question","keywords":["keyword1","keyword2","keyword3"],"modelAnswer":"complete model answer","explain":"full explanation"}`;

    const formatExample =
      type === "mcq"         ? `[${mcqFormat}]`
    : type === "truefalse"   ? `[${tfFormat}]`
    : type === "shortanswer" ? `[${saFormat}]`
    : `[${mcqFormat}, ${tfFormat}, ${saFormat}]`;

    return `Create exactly ${count} ${diff} ${typeDesc} quiz questions about: "${topic}"

Return ONLY a raw JSON array — no backticks, no markdown, no explanation:
${formatExample}

Rules:
- "ans" for MCQ is the 0-based index of the correct option
- "ans" for true/false is a JSON boolean (true or false)
- "keywords" for short answer: 2-4 words/phrases that must appear in a correct answer
- "modelAnswer" for short answer: a complete 1-2 sentence ideal answer
- All options in MCQ must be plausible — avoid obviously wrong distractors
- Explanations must be educational and clearly explain the correct answer
- Match "${diff}" difficulty throughout
- For "mixed" type: distribute question types roughly evenly
- Return EXACTLY ${count} items`;
  },

  // ── Summarize ────────────────────────────────────────────────
  summarize: ({ text, style, stylePrompt, level }) => {
    const audience = level || "undergraduate";

    const builtInStyles: Record<string, string> = {
      concise:
        `Write a concise summary in 3-5 clear paragraphs capturing the main ideas.
No bullet points. Use plain prose. Each paragraph should cover a distinct aspect.`,

      bullets:
        `Summarize using ONLY bullet points grouped under ## topic headers.
STRICT RULES:
- Every bullet MUST start with "- "
- Use ## headers to group bullets by theme
- No intro sentence, no conclusion sentence — only grouped bullets
- Aim for 8-12 bullets total covering all main ideas
- Each bullet must be a complete, informative sentence`,

      academic:
        `Write a formal academic abstract with these sections:
## Introduction
## Key Arguments  
## Methodology (if applicable)
## Conclusions
Use formal academic language throughout.`,

      eli5:
        `Explain this like I am 5 years old.
Use very simple words, short sentences (max 12 words each), and one fun real-life analogy.
No jargon whatsoever.`,

      mindmap:
        `Extract the 6-10 most important key concepts, grouped by theme.
Format:
## Theme Name
**Concept**: one to two sentence explanation of why it matters.

List every concept on its own line. No intro or outro text.`,

      outline:
        `Create a complete hierarchical outline of the content.
Format:
## Main Topic
### Subtopic
- Supporting point
- Supporting point

Cover ALL major content areas. Use as many levels as needed.`,
    };

    const instruction = stylePrompt || builtInStyles[style] || builtInStyles.concise;

    return `${instruction}

Audience level: ${audience}. Calibrate vocabulary, depth, and complexity accordingly:
- elementary: very simple words, relatable examples, no jargon
- highschool: clear language, minimal jargon, everyday examples
- undergraduate: standard academic language, some technical terms OK
- graduate: full technical depth, assume domain knowledge

Text to summarize:

${text.slice(0, 15000)}`;
  },

  // ── Study plan ───────────────────────────────────────────────
  studyplan: ({ goal }) =>
    `Create a detailed, actionable study plan for: "${goal}"

Return ONLY a raw JSON array — no backticks, no markdown, no explanation:
[{"name":"Subject or Topic","tasks":["specific actionable task 1","specific actionable task 2","specific actionable task 3","specific actionable task 4"],"color":"#hexcolor"}]

Rules:
- Give 2-4 subjects with 4-6 specific, actionable tasks each
- Tasks should be concrete (e.g. "Read Chapter 3 and make summary notes" not "Study chapter 3")
- Use these hex colors in order: #6c63ff, #10b981, #f59e0b, #ec4899, #22d3ee
- Tasks should be sequenced logically (foundational → advanced)`,

  // ── Note actions ─────────────────────────────────────────────
  note_action: ({ body, action }) => {
    const actions: Record<string, string> = {
      summarize:
        `Summarize these study notes concisely in 3-5 sentences. Keep all key facts and concepts:\n\n${body}`,

      improve:
        `Improve the writing quality, clarity, and academic tone of these notes. Keep ALL key information — do not remove any facts. Fix grammar, improve structure, and enhance readability:\n\n${body}`,

      bullet:
        `Convert these notes into well-organized bullet points grouped under ## topic headers.
Rules:
- Every bullet must start with "- "
- Group under ## headers by topic
- Keep all key information
- Each bullet should be a complete sentence\n\n${body}`,

      quiz:
        `Generate exactly 5 quiz questions based on these study notes.
Format as a numbered list:
1. [Question]
   Answer: [Complete answer]
   
Make questions that test genuine understanding, not just memorization.\n\n${body}`,

      expand:
        `Expand these study notes with additional explanations, examples, analogies, and context.
Rules:
- Keep all existing content
- Add depth and clarity to each point
- Add real-world examples where helpful
- Use ## headers to organize sections
- Maintain an educational, clear tone\n\n${body}`,
    };
    return actions[action] ?? actions.summarize;
  },
};

// ── Main handler ──────────────────────────────────────────────
export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { error: "GROQ_API_KEY is missing. Add it to your .env.local file and restart the server." },
      { status: 500 }
    );
  }

  try {
    const body              = await req.json();
    const { tool, payload } = body as { tool: ToolType; payload: Record<string, string> };

    if (!tool) return Response.json({ error: "No tool specified." }, { status: 400 });

    // ── extract_document: vision model ───────────────────────────
    if (tool === "extract_document") {
      const { base64, mediaType, fileName } = payload;
      if (!base64 || !mediaType) {
        return Response.json({ error: "Missing base64 or mediaType." }, { status: 400 });
      }

      const isImage         = mediaType.startsWith("image/");
      const visionMediaType = isImage ? mediaType : "image/png";

      const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${visionMediaType};base64,${base64}` },
            },
            {
              type: "text",
              text: `This is ${isImage ? "an image" : `a scanned document called "${fileName}"`}. Extract and transcribe ALL visible text content accurately. Return only the raw extracted text — no commentary, no preamble, no explanation.`,
            },
          ],
        }],
      });

      const extracted = response.choices[0]?.message?.content?.trim() || "";
      if (!extracted) {
        return Response.json({ error: "Could not extract any text from the document." }, { status: 500 });
      }
      return Response.json({ text: extracted });
    }

    // ── All other tools ──────────────────────────────────────────
    if (!TOOL_PROMPTS[tool]) {
      return Response.json({ error: `Invalid tool: "${tool}".` }, { status: 400 });
    }

    const prompt = TOOL_PROMPTS[tool](payload);

    // Calibrate model params per tool
    const isJsonTool = ["flashcards", "quiz", "studyplan"].includes(tool);
    const maxTokens  = tool === "summarize" ? 3000
                     : tool === "note_action" && payload.action === "expand" ? 2500
                     : tool === "quiz" && Number(payload.count) > 15 ? 4096
                     : 2048;
    const temperature = isJsonTool ? 0.25 : tool === "summarize" ? 0.5 : 0.4;

    const systemPrompt = isJsonTool
      ? `You are a precise educational content generator.
Return ONLY valid raw JSON — absolutely no markdown fences, no backticks, no preamble, no explanation, nothing before or after the JSON array.
The first character of your response must be "[" and the last must be "]".`
      : `You are a precise study assistant. Follow all formatting instructions exactly.
Do not wrap your response in markdown code blocks or backticks.
Do not add any preamble or explanation unless specifically asked.`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: prompt       },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim() || "";

    // ── JSON parsing for structured tools ──
    if (isJsonTool) {
      try {
        // Strip any accidental markdown fences
        const clean = text
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/, "")
          .trim();
        const data = JSON.parse(clean);
        return Response.json({ data });
      } catch (parseError) {
        console.error("JSON parse error:", parseError, "\nRaw:", text.slice(0, 500));

        // Attempt recovery: find first [ ... ] block
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          try {
            const data = JSON.parse(match[0]);
            return Response.json({ data });
          } catch { /* fall through */ }
        }

        return Response.json(
          { error: "AI returned invalid JSON. Please try again.", raw: text.slice(0, 200) },
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
      return Response.json({ error: "Rate limit hit. Wait a moment and try again." }, { status: 429 });
    }
    if (msg.includes("model") || msg.includes("404")) {
      return Response.json({ error: "Model not available. Check your Groq account access." }, { status: 404 });
    }
    return Response.json({ error: "Something went wrong. Check your terminal for details." }, { status: 500 });
  }
}