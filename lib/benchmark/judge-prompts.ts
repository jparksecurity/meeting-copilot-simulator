import { TickLog, CardResult } from '../types';

// ─── Trigger Judge ───

export const TRIGGER_JUDGE_SYSTEM = `You are an expert evaluator for a meeting copilot system.
Your job is to judge whether the copilot's decision to intervene (or hold) at a given moment was correct.

You will receive:
- The transcript slice visible to the copilot
- The target participant
- The copilot's decision (intervene or hold)
- The copilot's cards (if any)

Evaluate:
1. decision_correct (0 or 1): Was the intervene/hold decision appropriate given the transcript context?
2. count_appropriateness (0-4): If intervene, was the number of cards appropriate? (0=way too many/few, 4=perfect count)
3. hold_quality (0-4 or null): If hold, how good was the hold decision? null if intervene.

Return JSON only:
{
  "candidate_decision": "hold" | "intervene",
  "decision_correct": 0 | 1,
  "count_appropriateness": 0-4,
  "hold_quality": null | 0-4,
  "short_reason": "one sentence",
  "confidence": 0.0-1.0
}`;

export function buildTriggerJudgeUser(
  tick: TickLog,
  targetParticipant: string,
  formattedTranscript: string
): string {
  const decision = tick.result.intervene ? 'intervene' : 'hold';
  const cards = tick.result.cards.length > 0
    ? tick.result.cards.map((c, i) => `  ${i + 1}. [${c.type}] ${c.text}`).join('\n')
    : '  (none)';

  return `<evaluation_input>
  <target_participant>${targetParticipant}</target_participant>
  <transcript_slice>
${formattedTranscript}
  </transcript_slice>
  <copilot_decision>${decision}</copilot_decision>
  <copilot_reason>${tick.result.why}</copilot_reason>
  <copilot_cards>
${cards}
  </copilot_cards>
</evaluation_input>

Judge the copilot's trigger decision. Return JSON only.`;
}

// ─── Card Judge ───

export const CARD_JUDGE_SYSTEM = `You are an expert evaluator for individual meeting copilot cards.

You will receive a single card along with the transcript context and target participant.

Evaluate the card on these dimensions (each 0-4):
- type_fit: Does the declared card type match what the card actually does?
- timing: Is this card timely given the current conversation moment?
- goal_fit: Does the card help the target participant specifically?
- grounding: Is the card grounded in the actual transcript (no invented facts)?
- actionability: Can the participant act on this card immediately?
- social_tact: Is the card socially appropriate and not manipulative?
- specificity: Is the card specific to this conversation (not generic advice)?
- brevity_clarity: Is the card concise and clear?

Also check for hard failures:
- "generic": Card is generic coaching, not specific to transcript
- "ungrounded": Card invents facts not in the transcript
- "manipulative": Card suggests manipulative behavior
- "duplicate": Card duplicates another card in the set

Return JSON only:
{
  "index": <card index>,
  "declared_type": "<type from card>",
  "inferred_type": "<what type it actually is>",
  "admissible": true/false,
  "hard_fail_flags": [],
  "scores": {
    "type_fit": 0-4, "timing": 0-4, "goal_fit": 0-4, "grounding": 0-4,
    "actionability": 0-4, "social_tact": 0-4, "specificity": 0-4, "brevity_clarity": 0-4
  },
  "primary_failure_mode": "none" | "generic" | "ungrounded" | "manipulative" | "duplicate",
  "short_reason": "one sentence",
  "confidence": 0.0-1.0
}`;

export function buildCardJudgeUser(
  card: CardResult,
  index: number,
  formattedTranscript: string,
  targetParticipant: string
): string {
  return `<evaluation_input>
  <target_participant>${targetParticipant}</target_participant>
  <transcript_slice>
${formattedTranscript}
  </transcript_slice>
  <card index="${index}">
    <type>${card.type}</type>
    <text>${card.text}</text>
  </card>
</evaluation_input>

Judge this individual card. Return JSON only.`;
}

// ─── Set Judge ───

export const SET_JUDGE_SYSTEM = `You are an expert evaluator for a set of meeting copilot cards shown together.

You will receive all cards from one intervention along with the transcript context.

Evaluate the card SET on these dimensions (each 0-4):
- coverage: Do the cards together cover the key opportunity in the transcript?
- diversity: Do the cards offer meaningfully different actions (not just rewordings)?
- ranking: Is the first card the safest/most useful, with decreasing priority?
- restraint: Is the number of cards appropriate (not too many for the situation)?
- consistency: Are the cards internally consistent (no contradictions)?

Also identify:
- duplicate_pairs: Pairs of card indices that are near-duplicates
- best_card_index: Which card is the single best one
- should_reduce_card_count: Would fewer cards be better?

Return JSON only:
{
  "set_scores": {
    "coverage": 0-4, "diversity": 0-4, "ranking": 0-4,
    "restraint": 0-4, "consistency": 0-4
  },
  "duplicate_pairs": [],
  "best_card_index": 0,
  "should_reduce_card_count": false,
  "short_reason": "one sentence",
  "confidence": 0.0-1.0
}`;

export function buildSetJudgeUser(
  tick: TickLog,
  targetParticipant: string,
  formattedTranscript: string
): string {
  const cards = tick.result.cards
    .map((c, i) => `  <card index="${i}"><type>${c.type}</type><text>${c.text}</text></card>`)
    .join('\n');

  return `<evaluation_input>
  <target_participant>${targetParticipant}</target_participant>
  <transcript_slice>
${formattedTranscript}
  </transcript_slice>
  <card_set>
${cards}
  </card_set>
</evaluation_input>

Judge this card set as a whole. Return JSON only.`;
}
