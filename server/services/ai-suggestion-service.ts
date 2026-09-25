import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3-pro-preview";

export class AISuggestionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AISuggestionError";
  }
}

type ProviderErrorDetails = {
  status?: unknown;
  code?: unknown;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asProviderError(error: unknown, operation: string): AISuggestionError {
  const details =
    error && typeof error === "object"
      ? (error as ProviderErrorDetails)
      : {};
  const status =
    typeof details.status === "number" ? details.status : undefined;
  const code = stringValue(details.code);

  // Avoid logging provider response bodies or headers, which can contain sensitive data.
  console.error(`Gemini ${operation} request failed`, { status, code });

  if (
    status === 429 ||
    code?.toUpperCase() === "RESOURCE_EXHAUSTED" ||
    code?.toUpperCase() === "QUOTA_EXCEEDED"
  ) {
    return new AISuggestionError(
      "The managed AI provider is temporarily limiting requests or has exhausted its available quota. Please try again later.",
      429,
    );
  }

  if (status === 401 || status === 403) {
    return new AISuggestionError(
      "AI suggestions are unavailable because the managed AI provider rejected its credentials. Please contact an administrator.",
      503,
    );
  }

  return new AISuggestionError(
    "The managed AI provider could not generate suggestions right now. Please try again later.",
    503,
  );
}

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

type GeminiClient = Pick<GoogleGenAI, "models">;
type GeminiClientFactory = () => GeminiClient;

export class AISuggestionService {
  constructor(private readonly clientFactory?: GeminiClientFactory) {}

  private getClient(): GeminiClient {
    if (this.clientFactory) return this.clientFactory();

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new AISuggestionError(
        "Replit-managed Gemini credentials are not enabled for this app. Approve the AI integration in the Project Editor or contact an administrator.",
        503,
      );
    }

    return new GoogleGenAI({ apiKey });
  }

  async generateTitle({
    url,
    maxTokens = 50,
  }: GenerateTitleOptions): Promise<string> {
    if (!url.trim()) {
      throw new AISuggestionError("A URL is required to generate a title.", 400);
    }

    try {
      const response = await this.getClient().models.generateContent({
        model: MODEL,
        contents: `Generate a short, concise, and descriptive title for this URL: ${url}
The title should be clear, professional, and accurately represent the content of the URL.
Respond with only the title, no additional text or quotes.`,
        config: { maxOutputTokens: maxTokens },
      });

      const title = response.text?.trim();
      if (!title) {
        throw new AISuggestionError(
          "The AI provider returned an empty title. Please try again.",
          502,
        );
      }

      return title;
    } catch (error) {
      if (error instanceof AISuggestionError) throw error;
      throw asProviderError(error, "title generation");
    }
  }

  async generateShortcodeSuggestions({
    url,
    title = "",
    count = 3,
    maxTokens = 100,
  }: GenerateShortcodeOptions): Promise<string[]> {
    if (!url.trim()) {
      throw new AISuggestionError(
        "A URL is required to generate shortcode suggestions.",
        400,
      );
    }
    if (!Number.isInteger(count) || count < 1 || count > 8) {
      throw new AISuggestionError(
        "Shortcode suggestion count must be between 1 and 8.",
        400,
      );
    }

    try {
      const response = await this.getClient().models.generateContent({
        model: MODEL,
        contents: `Generate ${count} memorable, short, and unique shortcode suggestions for this URL: ${url}
${title ? `The URL title is: ${title}` : ""}

Rules for shortcodes:
- Each shortcode should be between 4-12 characters
- Use only lowercase letters, numbers, and hyphens
- Make them easy to remember and type
- They should relate to the content of the URL when possible
- No spaces or special characters other than hyphens

Response format: Return a JSON object with a "shortcodes" array containing exactly ${count} shortcode strings.`,
        config: {
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
        },
      });

      const content = response.text;
      if (!content) {
        throw new AISuggestionError(
          "The AI provider returned an empty shortcode response. Please try again.",
          502,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new AISuggestionError(
          "The AI provider returned an unreadable shortcode response. Please try again.",
          502,
        );
      }

      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("shortcodes" in parsed) ||
        !Array.isArray(parsed.shortcodes)
      ) {
        throw new AISuggestionError(
          "The AI provider returned an invalid shortcode response. Please try again.",
          502,
        );
      }

      const shortcodePattern = /^(?=.{4,12}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;
      const shortcodes = Array.from(
        new Set(
          parsed.shortcodes
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim().toLowerCase())
            .filter((value) => shortcodePattern.test(value)),
        ),
      ).slice(0, count);

      if (shortcodes.length === 0) {
        throw new AISuggestionError(
          "The AI provider did not return any valid shortcode suggestions. Please try again.",
          502,
        );
      }

      return shortcodes;
    } catch (error) {
      if (error instanceof AISuggestionError) throw error;
      throw asProviderError(error, "shortcode generation");
    }
  }
}

export const aiSuggestionService = new AISuggestionService();