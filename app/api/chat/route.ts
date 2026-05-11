import Groq from "groq-sdk";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const messages = JSON.parse(
      formData.get("messages") as string
    );

    const mode =
      (formData.get("mode") as string) || "quick";

   const image = formData.get("image");

const uploadedImage =
  image instanceof File ? image : null;

    let webContext = "";

    if (mode === "research") {
      try {
        const latestMessage =
          messages[messages.length - 1]?.content;

        const searchResponse = await axios.post(
          "https://api.tavily.com/search",
          {
            api_key: process.env.TAVILY_API_KEY,
            query: latestMessage,
            search_depth: "advanced",
            max_results: 5,
          }
        );

        webContext = JSON.stringify(
          searchResponse.data.results
        );
      } catch (error) {
        console.error("Tavily Error:", error);
      }
    }

   if (uploadedImage) {
      const bytes = await uploadedImage.arrayBuffer();

      const base64Image = Buffer.from(bytes).toString(
        "base64"
      );

      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest",
      });

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
          mimeType: uploadedImage.type,
          },
        },

        `Analyze this image and help the student understand it.`,
      ]);

      const response = result.response.text();

      return Response.json({
        reply: response,
      });
    }

    // NORMAL CHAT
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",

      messages: [
        {
          role: "system",
          content: `
You are an advanced AI Study Assistant.

Current Mode: ${mode}

Internet Research Context:
${webContext}

MODE RULES:

QUICK MODE:
- STRICTLY keep responses under 80 words.

DEEP MODE:
- Give detailed explanations.

RESEARCH MODE:
- Use research style responses.

GENERAL RULES:
- Use markdown.
- Be educational.
`,
        },

        ...messages,
      ],
    });

    return Response.json({
      reply:
        response.choices[0]?.message?.content ||
        "No response",
    });

  } catch (error) {
    console.error(error);

    return Response.json({
      reply: "Something went wrong 😢",
    });
  }
}