You are helping me build a Stoic-philosophy mental-wellness app called "The Stoic Mirror."
It is currently a focused, single-feature app: a user enters a concern (or selects from
broad categories such as Anxiety & Fear, Grief & Loss, Anger & Frustration, etc.) and
receives relevant Stoic guidance. My current content library is modest, and my top product
priorities are (1) quality and reliability over feature count, and (2) being honest with
users about how their answers are used.

I have decided on a core personalization principle and need you to help me implement the
lightest concrete version of it. Please read this principle carefully before coding.

## The core principle

Do NOT personalize by FILTERING the quote/advice library down to a narrow subset. That
approach shrinks the content pool, introduces repetition, and feels cheap. Instead,
personalize by RE-ORDERING and FRAMING the same full library around the user's selected
concern. The user's answer should shape WHICH content surfaces sooner and HOW it is
presented — not WHICH content exists.

This keeps the entire library in rotation (no repetition), makes the personalization
visible and honest (the user sees their concern reflected), and scales to a modest
content set.

## Technique to build NOW: Prioritize + Contextualize

Implement exactly this technique. Do not build the other two techniques yet — they are
explicitly deferred (see below).

1. Boosting relevance (re-ordering, not filtering):
   - Keep ALL quotes/entries eligible at all times. No hard filtering out of any content.
   - Tag each quote with one or more concern tags (e.g., "anxiety", "grief", "anger").
   - When a user selects a concern, score/rank the library so that quotes matching that
     concern are shown/weighted higher and appear sooner, while non-matching quotes still
     appear later in rotation (just deprioritized, never removed).

2. Contextual framing (light touch):
   - Do not rewrite the Stoic quotes themselves — leave the source text intact.
   - Add a single short, honest lead-in or tag that ties the surfaced guidance to the
     user's concern only where it adds value and does not distort the quote's meaning.
     Example pattern: "For what you're working through: Claudia, on moving through fear."
   - Keep framing subtle and respectful. Do not invent clinical claims.

3. Visible, honest payoff:
   - Make it clear to the user that their selected concern is active (e.g., confirm it on
     the opening screen) so the personalization feels real and transparent, not hidden.
   - Use honest wording such as "We'll surface content that matches what you're working
     through." Do not promise individualized clinical therapy or diagnosis.

## Techniques to implement LATER (do NOT build now, but design with these in mind)

1. Adaptive sequencing over a period:
   - Later, map the user's concern to a gentle emotional arc (e.g., for grief: comfort →
     acceptance → strength) and sequence daily/curated sessions through that arc over time,
     while a broad library remains browsable in parallel. Plan your data model and content
     tags now so this can be added without a rebuild.

2. Personalization through reflection (not content):
   - Later, use the user's concern to drive the app's core "enter a concern, receive Stoic
     advice" response framing itself (the advice phrasing and follow-up prompts), rather
     than only surfacing fixed quotes. Design the concern model and the framing layer so
     this can be appended cleanly.

## Implementation guidance

- Keep the current single-feature scope tight. Favor correctness, readability, and easy
  testing over breadth.
- Structure the content data model (tags, quote text, concern mappings, optional framing
  templates) so that the two deferred techniques can be added later with minimal change.
- Preserve the full library in every path — no code path may hard-exclude content.
- After you implement, briefly explain: (a) how ranking/boosting works, (b) how the
  contextual framing is applied without altering quote text, (c) how your data model
  already accommodates the two future techniques.
- Leave clearly-marked code comments or a DESIGN.md note describing how the two future techniques will plug in.
