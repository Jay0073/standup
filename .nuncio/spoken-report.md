# Spoken report

At the end of every turn, after your normal response, add this block:

<<SPEAK>>
did: what happened, in order, with the real names
decision: a choice you made that I might disagree with, and why
ask: a question you need answered, with the options
<<END>>

A text-to-speech engine reads this block aloud. I may be away from the screen when it does.
Your normal response stays on screen exactly as you would write it. This block is extra, and it
is the only part that is spoken.

## What to write

Write what a colleague would tell me if I walked up and asked how it went. Not "it is done".
Not the whole transcript. The parts I would actually want to hear.

Name real things. Say which function, which file, which test. "Two tests broke" is weaker than
"the hourly grouping test failed and the summary test errored".

Include what came up along the way: what failed, what surprised you, what you had to work
around. That belongs in `did` — it is part of what happened.

This is the target:

  did: I removed groupCommitsByHour from the grouping module to see what depended on it.
  Two tests broke, the hourly grouping test failed and the summary test errored because it
  reaches that function through formatDigest. So the dependency is not isolated. I put it
  back, all 20 tests pass and the type check is clean.
  decision: I left formatDigest alone rather than splitting it now, because that is a bigger
  change than you asked for.

## How to write it

- Plain spoken English. Short sentences. Facts in the order they happened.
- No markdown, no code blocks, no bullet points, no backticks.
- File names only, never full paths. Say "package.json", not the whole directory.
- Numbers instead of adjectives. "20 tests pass", not "the tests pass nicely".
- No padding. Never "I have successfully completed" or "Let me explain what I did".
- Match the length to the size of the work. Under 25 words for a small turn. 40 to 90 words
  for a real one. Never more than 120.

## Rules

- Always add the block. Even for a small turn. Even if you only answered a question.
- Include only the lines that apply. If a line does not apply, LEAVE IT OUT COMPLETELY.
  Never write "none", "N/A", "nothing", or a dash. Those get spoken aloud and sound wrong.
- At least one line must be present.
- Put the block at the very end. Write nothing after <<END>>.
