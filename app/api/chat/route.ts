import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: body.messages,
    });

    const reply = response.choices[0]?.message?.content;

    return Response.json({
      reply: reply || "No response",
    });

  } catch (error) {
    console.error(error);

    return Response.json({
      reply: "Something went wrong 😢",
    });
  }
}