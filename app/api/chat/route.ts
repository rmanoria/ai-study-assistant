import Groq from "groq-sdk";
import axios from "axios";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODE_INSTRUCTIONS: Record<string, string> = {
  quick: "STRICTLY keep responses under 100 words. Be clear and direct.",
  deep: "Give thorough, detailed explanations with examples, analogies, and step-by-step breakdowns.",
  research: "Respond with academic depth. Use structured formatting with headers. Be scholarly and comprehensive. Use any web context provided.",
};

const SYSTEM_PROMPT = (mode: string, webContext: string) => `
You are StudyAI Pro — an advanced AI study assistant as smart and helpful as the best human tutor.

Current mode: ${mode.toUpperCase()}
Mode instruction: ${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.quick}

${webContext ? `Web Research Context:\n${webContext}\n` : ""}

Your capabilities:
- Explain any concept at any level with clarity and depth
- Solve math, science, coding, and academic problems step-by-step
- Help write and improve essays, papers, and assignments
- Answer questions across all subjects: math, science, history, literature, coding, languages, and more

Rules:
- Use markdown formatting (headers, bold, code blocks, bullet points, tables) for clarity
- Be encouraging and educational
- Always be accurate, helpful, and thorough
`.trim();

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const messages = JSON.parse(formData.get("messages") as string);
    const mode = (formData.get("mode") as string) || "quick";
    const image = formData.get("image");
    const uploadedImage = image instanceof File && image.size > 0 ? image : null;

    // Image: use llama-3.2-11b-vision (Groq's vision model)
    if (uploadedImage) {
      try {
        const bytes = await uploadedImage.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        const lastUserText = messages[messages.length - 1]?.content || "Analyze this image for studying.";

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
                { type: "text", text: lastUserText },
              ],
            },
          ],
        });

        return Response.json({ reply: response.choices[0]?.message?.content || "Could not analyze image." });
      } catch (err) {
        console.error("Vision error:", err);
        return Response.json({ reply: "⚠️ Image analysis failed. Please try again." });
      }
    }

    // Research mode: fetch web context via Tavily if key exists
    let webContext = "";
    if (mode === "research" && process.env.TAVILY_API_KEY) {
      try {
        const query = messages[messages.length - 1]?.content;
        const res = await axios.post("https://api.tavily.com/search", {
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: "advanced",
          max_results: 5,
        });
        webContext = JSON.stringify(res.data.results);
      } catch (e) {
        console.error("Tavily error:", e);
      }
    }

    // Normal chat
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
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
