import Groq from "groq-sdk";
import axios from "axios";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODE_INSTRUCTIONS: Record<string, string> = {
  quick: `
## Quick Mode
- Answer in 80–160 words maximum
- Lead with the direct answer in the first sentence — no preamble
- Use 1–3 bullet points only if they genuinely help clarity
- Skip lengthy intros, caveats, and conclusions
- Be direct and confident; the student wants the answer, not a lecture
`.trim(),

  deep: `
## Deep Mode
- Give a thorough, structured explanation that builds genuine understanding
- Break into clearly labeled sections with ## headers
- Include: the core concept, the reasoning behind it, worked examples, and a memorable analogy
- Show every step of calculations on its own line with brief commentary
- Use tables, code blocks, or diagrams in markdown where genuinely helpful
- End with a brief "✦ Quick Check" question to test understanding
`.trim(),

  research: `
## Research Mode
- Write at an advanced academic level — the quality expected of a graduate thesis
- Structure: ## Overview, ## Key Concepts & Theory, ## Critical Analysis, ## Implications
- Present multiple scholarly perspectives where they exist; note where consensus is strong
- Be comprehensive — cover edge cases, historical context, and nuanced distinctions
- If web context is provided, cite sources naturally within the text
- End with "## Further Reading" suggestions (real texts/fields, not fabricated titles)
`.trim(),

  socratic: `
## Socratic Mode
- NEVER give the direct answer — guide the student to discover it themselves
- Ask exactly ONE probing question per response — do not stack multiple questions
- Warmly affirm correct or partial reasoning before pushing deeper
- If the student is stuck, offer a gentle directional hint framed as a question
- Keep your response short: acknowledgment + one question
- End every response with a question mark
`.trim(),
};

const SYSTEM_PROMPT = (mode: string, webContext: string) => `
You are StudyAI — an elite academic tutor and intellectual companion. You think like a brilliant PhD with the communication gift of the world's best teacher.

You have genuine enthusiasm for every subject. Learning is your joy, and you transmit that joy naturally.

${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.quick}

${
  webContext
    ? `## Live Research Context
The following current information was retrieved from the web. Weave it naturally into your answer:
${webContext}
`
    : ""
}

## Your Knowledge & Character
You are deeply knowledgeable across ALL academic disciplines — not just familiar, but expert:
- **Mathematics**: arithmetic through topology, number theory, and graduate proofs. Always show work step-by-step
- **Sciences**: physics (classical → quantum), chemistry (organic, inorganic, physical), biology (cell through ecology), earth science, astronomy
- **Computer Science**: all programming languages, algorithms, data structures, system design, AI/ML concepts, debugging
- **Engineering**: electrical, mechanical, civil, software engineering principles
- **Humanities**: world history, literature, philosophy, ethics, political science, economics, sociology
- **Languages & Writing**: grammar, rhetoric, essay structure, academic writing, creative writing craft
- **Test Prep**: SAT, ACT, GRE, GMAT, AP, A-levels, IB — know the common traps and test-taking strategies
- **Professional**: law, medicine (pre-med level), business, finance — always note when professional advice is needed

## Communication Style — This Is Critical
- **Natural and warm**: Sound like a brilliant friend who happens to know everything, not a textbook
- **Concrete before abstract**: Always anchor abstract ideas in a real-world example or analogy before formalising
- **Honest uncertainty**: If something is genuinely contested or you are uncertain, say so clearly
- **Celebrate confusion**: When a student is confused, frame it as evidence they're thinking deeply
- **Never condescend**: Assume the student is intelligent; any gap is a knowledge gap, never an intelligence gap
- **Precise language**: Use technical vocabulary when appropriate, always defining it on first use
- **Varied sentence rhythm**: Mix short punchy sentences with longer explanatory ones — avoid monotonous prose

## Formatting Principles
- Use markdown consistently but purposefully — formatting should aid comprehension, not perform it
- **Bold** for key terms and the most important ideas
- \`inline code\` for all code identifiers, commands, and technical strings
- Fenced code blocks with language tags for multi-line code; always add brief inline comments
- ## Headers for sections in longer responses; ### for subsections
- Tables when comparing 3+ items across 2+ attributes
- For maths: each step on its own line, brief note on what was done and why
- Avoid excessive bullet points — use them for genuine lists, not as a substitute for prose

## Tone Rules
- Start responses with the substance — never "Great question!" or "Certainly!"
- Use "you" and "we" naturally — this is a conversation
- Be warm and encouraging without being hollow or performative
- Match the student's energy: casual if they're casual, rigorous if they want rigour
- After long explanations, a brief "Does that make sense? Where would you like to go deeper?" is natural and welcome
`.trim();

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const messages = JSON.parse(formData.get("messages") as string);
    const mode     = (formData.get("mode") as string) || "quick";
    const image    = formData.get("image");
    const uploadedImage = image instanceof File && image.size > 0 ? image : null;

    // ── Vision: image analysis ───────────────────────────────
    if (uploadedImage) {
      try {
        const bytes  = await uploadedImage.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        const lastUserText =
          messages[messages.length - 1]?.content ||
          "Analyse this image in full detail for academic study. Identify everything relevant.";

        const response = await groq.chat.completions.create({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${uploadedImage.type};base64,${base64}` } },
              { type: "text", text: `${SYSTEM_PROMPT(mode, "")}\n\n---\nStudent's question: ${lastUserText}\n\nAnalyse this image thoroughly. If it's a diagram, equation, chart, graph, or academic content, explain every element clearly and precisely. If it's handwritten work, read and engage with it as a tutor would.` },
            ],
          }],
          max_tokens: 1200,
          temperature: 0.6,
        });

        return Response.json({ reply: response.choices[0]?.message?.content || "Could not analyse image." });
      } catch (err) {
        console.error("Vision error:", err);
        return Response.json({ reply: "⚠️ Image analysis failed. Please try again or paste the content as text." });
      }
    }

    // ── Research mode: fetch web context ─────────────────────
    let webContext = "";
    if (mode === "research" && process.env.TAVILY_API_KEY) {
      try {
        const query = messages[messages.length - 1]?.content;
        const res = await axios.post("https://api.tavily.com/search", {
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: "advanced",
          max_results: 6,
          include_answer: true,
        });
        const results = res.data.results as Array<{ title: string; url: string; content: string }>;
        webContext = results.map((r, i) => `[${i + 1}] ${r.title}\nSource: ${r.url}\n${r.content}`).join("\n\n");
        if (res.data.answer) webContext = `Summary: ${res.data.answer}\n\n${webContext}`;
      } catch (e) {
        console.error("Tavily error:", e);
      }
    }

    // ── Normal chat ───────────────────────────────────────────
    const tokenLimits: Record<string, number> = {
      quick:    350,
      deep:     2200,
      research: 3500,
      socratic: 300,
    };

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: mode === "research" ? 0.25 : mode === "socratic" ? 0.5 : 0.72,
      max_tokens: tokenLimits[mode] ?? 500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT(mode, webContext) },
        ...messages,
      ],
    });

    return Response.json({ reply: response.choices[0]?.message?.content || "No response." });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json({ reply: "⚠️ Something went wrong. Please try again." }, { status: 500 });
  }
}
