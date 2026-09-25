import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

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
  type?: unknown;
  request_id?: unknown;
  error?: {
    code?: unknown;
    type?: unknown;
  };
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
  const code =
    stringValue(details.code) ?? stringValue(details.error?.code);
  const type =
    stringValue(details.type) ?? stringValue(details.error?.type);

  // Avoid logging provider response bodies or headers, which can contain sensitive data.
  console.error(`OpenAI ${operation} request failed`, {
    status,
    code,
    type,
    requestId: stringValue(details.request_id),
  });

  if (
    code === "credit_balance_exhausted" ||
    code === "insufficient_quota" ||
    type === "insufficient_quota"
  ) {
    return new AISuggestionError(
      "AI suggestions are unavailable because the AI provider account has no credits. Please ask an administrator to restore provider billing.",
      503,
    );
  }

  if (status === 401 || status === 403) {
    return new AISuggestionError(
      "AI suggestions are unavailable because the AI provider rejected its credentials. Please contact an administrator.",
      503,
    );
  }

  if (status === 429) {
    return new AISuggestionError(
      "The AI provider is temporarily rate limiting requests. Please wait a moment and try again.",
      429,
    );
  }

  return new AISuggestionError(
    "The AI provider could not generate suggestions right now. Please try again later.",
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

export class OpenAIService {
  constructor(private readonly clientFactory?: () => OpenAI) {}

  private getClient(): OpenAI {
    if (this.clientFactory) return this.clientFactory();

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new AISuggestionError(
        "AI suggestions are not configured. Please contact an administrator.",
        503,
      );
    }

    return new OpenAI({ apiKey });
  }

  async generateTitle({
    url,
    maxTokens = 50,
  }: GenerateTitleOptions): Promise<string> {
    if (!url.trim()) {
      throw new AISuggestionError("A URL is required to generate a title.", 400);
    }

    try {
      const response = await this.getClient().chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: `Generate a short, concise, and descriptive title for this URL: ${url}
The title should be clear, professional, and accurately represent the content of the URL.
Respond with only the title, no additional text or quotes.`,
          },
        ],
        max_tokens: maxTokens,
      });

      const title = response.choices[0]?.message.content?.trim();
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
      const response = await this.getClient().chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: `Generate ${count} memorable, short, and unique shortcode suggestions for this URL: ${url}
${title ? `The URL title is: ${title}` : ""}

Rules for shortcodes:
- Each shortcode should be between 4-12 characters
- Use only lowercase letters, numbers, and hyphens
- Make them easy to remember and type
- They should relate to the content of the URL when possible
- No spaces or special characters other than hyphens

Response format: Return a JSON object with a "shortcodes" array containing exactly ${count} shortcode strings.`,
          },
        ],
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message.content;
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

export const openAiService = new OpenAIService();