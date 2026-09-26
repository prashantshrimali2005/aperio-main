const { GoogleGenAI } = require("@google/genai");

async function run() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "What is this document?" },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: Buffer.from("%PDF-1.4\n%EOF\n").toString("base64")
              }
            }
          ]
        }
      ]
    });
    console.log("Success:", response.text);
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
