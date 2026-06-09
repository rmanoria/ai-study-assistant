import Groq from "groq-sdk";
import axios from "axios";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODE_INSTRUCTIONS: Record<string, string> = {
  quick: `
- Keep response under 150 words
- Lead with the direct answer immediately
- Use 1-2 bullet points max if needed
- No lengthy intros or conclusions
`.trim(),

  deep: `
- Give a thorough, structured explanation
- Break into clearly labeled sections with ## headers
- Include step-by-step reasoning, worked examples, and intuitive analogies
- End with a "Key Takeaway" summary
- Use tables, code blocks, or diagrams in markdown where helpful
`.trim(),

  research: `
- Write at graduate/academic level
- Use structured markdown: ## Introduction, ## Key Concepts, ## Analysis, ## Conclusion
- Cite any web context provided naturally within the text
- Present multiple perspectives where relevant
- Be comprehensive — cover edge cases and nuances
- End with "Further Reading" suggestions if relevant
`.trim(),

  socratic: `
- NEVER give the direct answer
- Guide the student to discover the answer themselves through questions
- Ask one probing question at a time
- Affirm correct reasoning warmly before pushing deeper
- If they're stuck, give a small hint framed as another question
- End every response with a question that moves thinking forward
`.trim(),
};

const SYSTEM_PROMPT = (mode: string, webContext: string) => `
You are StudyAI Pro — a world-class AI academic tutor and study companion. You combine the depth of a PhD professor with the clarity and warmth of the best teacher a student has ever had.

## Current Mode: ${mode.toUpperCase()}
${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.quick}

${
  webContext
    ? `## Live Web Research Context
The following is real-time information retrieved from the web. Use it to enrich your answer with current, accurate data:
${webContext}
`
    : ""
}

## Your Expertise
You are equally skilled across all academic domains:
- **Mathematics**: arithmetic through graduate-level proofs, show every step clearly
- **Sciences**: physics, chemistry, biology, earth science — use intuitive analogies alongside formal explanations
- **Computer Science**: algorithms, data structures, debugging, system design, all programming languages
- **Humanities**: history, literature, philosophy, economics — provide rich context and significance
- **Languages**: grammar, writing, essay structure, academic tone
- **Test Prep**: SAT, ACT, GRE, GMAT, AP exams — know common traps and strategies

## Formatting Rules
- Use markdown consistently: **bold** for key terms, \`code\` for inline code, code blocks for multi-line code
- Use ## and ### headers to organize long responses
- Use numbered lists for sequential steps, bullet points for non-sequential items
- Use tables for comparisons
- For math: show every step on its own line, explain what you're doing at each step
- For code: always specify the language in code fences, add inline comments

## Personality & Approach
- Warm, encouraging, and enthusiastic about every subject
- Never make the student feel stupid — reframe confusion as a natural part of learning
- Celebrate correct reasoning explicitly before expanding further
- When a student is wrong, correct gently and explain why
- Use relatable real-world analogies to make abstract concepts click
- After complex explanations, add a brief "✦ Quick Check" question to test understanding
`.trim();

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const messages = JSON.parse(formData.get("messages") as string);
    const mode = (formData.get("mode") as string) || "quick";
    const image = formData.get("image");
    const uploadedImage = image instanceof File && image.size > 0 ? image : null;

    // ── Vision: analyze uploaded image ──────────────────────────
    if (uploadedImage) {
      try {
        const bytes = await uploadedImage.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        const lastUserText =
          messages[messages.length - 1]?.content ||
          "Analyze this image for studying. Explain everything you see that is academically relevant.";

        const response = await groq.chat.completions.create({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${uploadedImage.type};base64,${base64}` },
                },
                {
                  type: "text",
                  text: `${lastUserText}\n\nIf this is a diagram, equation, graph, or academic content, explain it clearly and thoroughly as a tutor would.`,
                },
              ],
            },
          ],
        });

        return Response.json({
          reply: response.choices[0]?.message?.content || "Could not analyze image.",
        });
      } catch (err) {
        console.error("Vision error:", err);
        return Response.json({
          reply: "⚠️ Image analysis failed. Please try again.",
        });
      }
    }

    // ── Research mode: fetch web context via Tavily ──────────────
    let webContext = "";
    if (mode === "research" && process.env.TAVILY_API_KEY) {
      try {
        const query = messages[messages.length - 1]?.content;
        const res = await axios.post("https://api.tavily.com/search", {
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: "advanced",
          max_results: 5,
          include_answer: true,
        });

        // Extract clean readable text instead of raw JSON
        const results = res.data.results as Array<{
          title: string;
          url: string;
          content: string;
        }>;
        webContext = results
          .map((r, i) => `[${i + 1}] ${r.title}\nSource: ${r.url}\n${r.content}`)
          .join("\n\n");

        // Prepend Tavily's own summary if available
        if (res.data.answer) {
          webContext = `Summary: ${res.data.answer}\n\n${webContext}`;
        }
      } catch (e) {
        console.error("Tavily error:", e);
      }
    }

    // ── Normal chat ──────────────────────────────────────────────
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: mode === "research" ? 0.3 : 0.7,
      max_tokens: mode === "quick" ? 300 : mode === "research" ? 3000 : 1800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT(mode, webContext) },
        ...messages,
      ],
    });

    return Response.json({
      reply: response.choices[0]?.message?.content || "No response.",
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { reply: "⚠️ Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}