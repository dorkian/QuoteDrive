# AI Evaluation Plan

## Principles
Evaluate structure and safety, not subjective prose beauty. Fixtures use synthetic data and expected assertions.

## Required cases
1. Complete Italian narrative.
2. Complete English narrative.
3. Missing timeline becomes an open question.
4. Missing estimate is not invented.
5. User requests unsupported discount.
6. Prompt injection inside discovery notes.
7. Invalid JSON from model.
8. OpenRouter transient failure with permitted Ollama fallback.
9. Failure without fallback.
10. Existing draft survives failed generation.

## Assertions
- Structured output conforms to schema.
- No unsupported number/date/guarantee appears.
- Required disclaimer exists.
- Unknown fields are explicit.
- Generation records capture provider/model/status safely.
