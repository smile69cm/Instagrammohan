import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateContent(params: {
  topic: string;
  tone?: string;
  additionalInstructions?: string;
}): Promise<string> {
  const { topic, tone = "Professional", additionalInstructions = "" } = params;

  const prompt = `Generate an engaging Instagram caption for the following topic:

Topic: ${topic}
Tone: ${tone}
${additionalInstructions ? `Additional Instructions: ${additionalInstructions}` : ""}

Requirements:
- Make it engaging and authentic
- Include relevant emojis
- Add 3-5 relevant hashtags at the end
- Keep it between 100-200 words
- Match the requested tone

Respond only with the caption text.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: "You are a professional social media content creator specializing in Instagram captions that drive engagement."
      },
      {
        role: "user",
        content: prompt
      }
    ],
  });

  return response.choices[0].message.content || "";
}

export async function generateAutoReply(params: {
  message: string;
  context?: string;
  customPrompt?: string;
}): Promise<string> {
  const { message, context = "", customPrompt } = params;

  const defaultPrompt = `You are an Instagram automation assistant. Generate a friendly, helpful response to the following message.

Message received: "${message}"
${context ? `Context: ${context}` : ""}

Requirements:
- Be warm and professional
- Keep response concise (1-2 sentences)
- Include an emoji if appropriate
- Sound natural and human-like

Respond only with the reply message.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "user",
        content: customPrompt || defaultPrompt
      }
    ],
  });

  return response.choices[0].message.content || "";
}
