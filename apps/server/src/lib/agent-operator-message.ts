const INTERNAL_CONTROL_PATTERN =
  /\b(needs_input|checkpoint|Nova comment|to Nova|runtime bridge|NOVA_RUNTIME|operator input before|operator input|pause)\b/i;

const splitSentences = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];

const normalizeSubject = (subject: string) =>
  subject
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b(the|a|an|exact|desired)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const buildFallbackQuestion = (subject: string) => {
  const normalized = normalizeSubject(subject);

  if (!normalized) {
    return "I need one quick clarification before I continue. What would you like me to do next?";
  }

  if (normalized.includes("color scheme")) {
    return "What color scheme would you like me to use before I continue?";
  }

  if (normalized === "color" || normalized.includes("title color")) {
    return "What color would you like me to use before I continue?";
  }

  return `I need one quick clarification before I continue: could you confirm the ${normalized}?`;
};

const deriveFallbackQuestion = (text: string) => {
  const directSubjectMatch = text.match(
    /ask (?:the )?exact ([a-z0-9 _-]+?) question/i
  );

  if (directSubjectMatch?.[1]) {
    return buildFallbackQuestion(directSubjectMatch[1]);
  }

  const confirmationMatch = text.match(
    /confirm(?:ation)?(?: of)? (?:the )?(?:exact |desired )?([a-z0-9 _-]+)/i
  );

  if (confirmationMatch?.[1]) {
    return buildFallbackQuestion(confirmationMatch[1]);
  }

  if (/color/i.test(text)) {
    return buildFallbackQuestion("color scheme");
  }

  return "I need one quick clarification before I continue. Could you confirm the remaining design choice?";
};

export const humanizeAgentOperatorMessage = (body: string) => {
  const trimmed = body.trim();

  if (!trimmed || !INTERNAL_CONTROL_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const sentences = splitSentences(trimmed);
  const questionIndex = sentences.findIndex((sentence) => sentence.includes("?"));

  if (questionIndex >= 0) {
    const collected = [sentences[questionIndex]];

    for (let index = questionIndex + 1; index < sentences.length; index += 1) {
      const sentence = sentences[index] ?? "";
      if (/^(please|confirm|let me know|share)\b/i.test(sentence)) {
        collected.push(sentence);
        continue;
      }
      break;
    }

    return collected.join(" ").trim();
  }

  return deriveFallbackQuestion(trimmed);
};
