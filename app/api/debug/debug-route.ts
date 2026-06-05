export async function GET() {
  const key = process.env.GROQ_API_KEY;

  if (!key) {
    return Response.json({ status: "❌ MISSING", message: "GROQ_API_KEY is not set in .env.local" });
  }

  if (!key.startsWith("gsk_")) {
    return Response.json({ status: "⚠️ INVALID FORMAT", message: "Key exists but doesn't start with gsk_", preview: key.slice(0, 8) + "..." });
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 5,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    if (res.ok) {
      return Response.json({ status: "✅ WORKING", message: "Groq API key is valid and working!", preview: key.slice(0, 8) + "..." });
    }

    const err = await res.json();
    return Response.json({ status: "❌ API ERROR", message: err?.error?.message || "Unknown error", code: res.status, preview: key.slice(0, 8) + "..." });
  } catch (e) {
    return Response.json({ status: "❌ NETWORK ERROR", message: String(e) });
  }
}
