import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateTitleOptions {
  url: string;
  maxTokens?: number;
}

interface GenerateShortcodeOptions {
  url: string;
  title?: string;
  count?: number;
  maxTokens?: number;
}

export class OpenAIService {
  // Generate a descriptive title based on the URL
  async generateTitle({ url, maxTokens = 50 }: GenerateTitleOptions): Promise<string> {
    try {
      const prompt = `Generate a short, concise, and descriptive title for this URL: ${url}
      The title should be clear, professional, and accurately represent the content of the URL.
      Respond with only the title, no additional text or quotes.`;

      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      });

      return response.choices[0].message.content?.trim() || "Untitled Link";
    } catch (error) {
      console.error("Error generating title with OpenAI:", error);
      return "Untitled Link";
    }
  }

  // Generate shortcode suggestions based on the URL and/or title
  async generateShortcodeSuggestions({ 
    url, 
    title = "", 
    count = 3, 
    maxTokens = 100 
  }: GenerateShortcodeOptions): Promise<string[]> {
    try {
      const prompt = `Generate ${count} memorable, short, and unique shortcode suggestions for this URL: ${url}
      ${title ? `The URL title is: ${title}` : ""}
      
      Rules for shortcodes:
      - Each shortcode should be between 4-12 characters
      - Use only lowercase letters, numbers, and hyphens
      - Make them easy to remember and type
      - They should relate to the content of the URL when possible
      - No spaces or special characters other than hyphens
      
      Response format: Return a JSON object with a "shortcodes" array containing exactly ${count} shortcode strings.
      Example response: {"shortcodes": ["tech-news", "daily-up", "code-tip"]}`;

      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) return [];
      
      try {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed.shortcodes) ? parsed.shortcodes : [];
      } catch (parseError) {
        console.error("Error parsing OpenAI JSON response:", parseError);
        // Fallback: Try to extract values if the response isn't proper JSON
        const matches = content.match(/"([a-z0-9-]+)"/g);
        return matches ? matches.map(m => m.replace(/"/g, '')).slice(0, count) : [];
      }
    } catch (error) {
      console.error("Error generating shortcode suggestions with OpenAI:", error);
      return [];
    }
  }
}

export const openAiService = new OpenAIService();