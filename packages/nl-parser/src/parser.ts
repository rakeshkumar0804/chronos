import { queryDeterministicFallback, queryGemini } from "./llm-provider.js";
import { LLMConstraintOutput, ParserContext, ParserOptions, ParseResult } from "./types.js";
import { validateParsedConstraint } from "./validator.js";

/**
 * Parses a natural language scheduling statement into a validated, structured Constraint.
 *
 * PRODUCTION / LIVE PATH:
 * - When `GEMINI_API_KEY` is provided, it ALWAYS calls the Google Gemini API with structured JSON Schema output.
 * - If Gemini encounters an error in live mode, it reports the real error and NEVER silently substitutes the fallback.
 *
 * TEST / OFFLINE PATH:
 * - When `GEMINI_API_KEY` is absent AND in test/CI mode (`NODE_ENV === "test"` or `useFallbackIfNoKey: true`),
 *   it utilizes the deterministic local parser to allow zero-dependency offline test execution.
 */
export async function parseConstraint(
  naturalLanguageInput: string,
  context: ParserContext,
  options?: ParserOptions
): Promise<ParseResult> {
  if (!naturalLanguageInput || naturalLanguageInput.trim().length === 0) {
    return {
      success: false,
      error: "Natural language input cannot be empty.",
    };
  }

  let llmOutput: LLMConstraintOutput;
  const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;

  if (apiKey) {
    // Production path: ALWAYS use real Gemini API
    try {
      llmOutput = await queryGemini(naturalLanguageInput, context, options);
    } catch (err: any) {
      // Do not silently fallback in live mode — report actual Gemini failure
      return {
        success: false,
        error: `Gemini API Error: ${err?.message || err}`,
      };
    }
  } else {
    // Offline / CI testing path
    const isTestEnv = process.env.NODE_ENV === "test" || options?.useFallbackIfNoKey === true;
    if (isTestEnv) {
      console.warn(
        "[CHRONOS NL-PARSER WARNING] GEMINI_API_KEY is not configured. Utilizing offline deterministic fallback parser for test/CI environment."
      );
      llmOutput = queryDeterministicFallback(naturalLanguageInput, context);
    } else {
      return {
        success: false,
        error: "GEMINI_API_KEY is not configured. Please set the GEMINI_API_KEY environment variable to use natural language constraint parsing.",
      };
    }
  }

  // Execute institutional database-backed validation
  const validation = validateParsedConstraint(llmOutput, context);

  if (!validation.valid || !validation.constraint) {
    return {
      success: false,
      rawLLMOutput: llmOutput,
      error: validation.error || "Constraint validation failed against institutional database.",
    };
  }

  return {
    success: true,
    constraint: validation.constraint,
    rawLLMOutput: llmOutput,
  };
}
