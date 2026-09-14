---
name: draft-email
description: "Draft a work email in Chris's register — scannable, one idea per line, a third shorter than instinct. Use when asked to draft, write, or reply to an email, reach out to a stakeholder, make an access or permission request, chase a referral, or send a status note to a manager or business partner."
argument-hint: "<who it goes to and what it needs to do>"
---

# /draft-email — Scannable, Not Readable

Chris's stakeholders skim email in a notification pane. They do not read it.
Every fact must sit on the skim path or it is invisible.

This Skill drafts. It never sends. Output the email as a copyable block and let
Chris send it himself.

## The shape (non-negotiable)

- **One idea per line.** Hard newline after each sentence. No wrapping prose blocks.
- **Blank line between blocks.** A block is one topic.
- **No block over four lines.** Split a dense passage into its separate facts.
- **Cut a third.** Whatever draft feels finished, it is still too long. Cut again.

The failure mode is a five-sentence paragraph that buries the ask inside it.
Splitting that paragraph into four lines loses nothing and surfaces everything.

## Voice rules

| Rule | Do | Not |
|---|---|---|
| Salutation | `Good afternoon, Som,` · `Hello Steve,` | `Hi Som` (no comma, too casual) |
| Sign-off, warm or internal | `Well wishes,` | `Best,` · `Regards,` |
| Sign-off, cold ask | `Thanks for any direction you can give,` | `Thanks!` |
| Names | `Steve` if he knows them | `Stephen` — the formal name signals a name he was handed, not a relationship |
| Shared corporate assets | `the Fixed Income account` | `our Fixed Income account` |
| Hedges | `If this isn't your area, a pointer is just as appreciated.` | `I suspect this may not be your area` — never put a limitation in the reader's mouth |

Weave in the referral or relationship early — "I've been working with Steve and
company" earns more trust than any amount of explanation.

## Asks

Number them. Two is the healthy maximum.

**State the cheap ask beside the thorough one.** A process question alone invites
a heavyweight answer. Pair it:

> Functionally we just need a link to whoever can grant access, but I want to
> make sure we do our due diligence.

That gives the reader a fast path and still signals rigour.

Close with a low-cost escape hatch — "Happy to talk for 15 minutes if that is
quicker than writing it out."

## Access and permission requests

These carry one extra rule, and it is the one that decides whether the email works.

**The defusing block goes BEFORE the asks.** An access request that arrives
without it reads as a security risk instead of a task.

State plainly what is *not* being asked for:

```text
To be clear on what this needs:
We are not asking anyone for banking credentials.
Plaid runs the approval with the bank directly.
An authorized account owner opens a one-time link and approves read-only access.
No username, password, or MFA code is shared with my team.
```

**Mask account numbers to the last four digits.** Add "I can give the full
account number to whoever needs it." Email gets forwarded; the full number does
not belong in it.

## Process

1. **Ground the facts first.** Read the repo, the docs, or the data files for
   real identifiers, dates, and names. A drafted email with an invented account
   number or entity name is worse than a placeholder.
2. **Name any placeholder in plain words** — `[THE LEGAL ENTITY THAT OWNS IT]`,
   not `[X]`. Say why it matters so Chris knows whether to bother filling it in.
3. Draft to the shape and voice rules above.
4. **Reread and cut a third.** This step is not optional and it is the one most
   often skipped.
5. Output the email in a fenced block, then list the judgment calls made — cc
   suggestions, what was masked, what was inferred — so Chris can override any
   of them.

## The skeleton for a cold ask

Referral name · team and plain purpose · the specific asset · the defusing block ·
numbered asks · the 15-minute offer · sign-off.

The ordering carries the email. Do not rearrange it.

## Worked example — cold access request

Names, bank, and digits below are stand-ins. Real ones come from the live thread.

```text
Good afternoon, Som,

Marcus Webb passed your name to me as a good place to start.
If this isn't your area, a pointer to the right person is just as appreciated.

I am on the Emerging Technology team.
I've been working with Steve and company on an internal tool that classifies the cash activity on our bank statements.
Today someone loads the statements by hand.
We want the tool to retrieve them automatically instead, through Plaid.

The account in scope is the Fixed Income cash account at [THE BANK], ending 1234.
I can give the full account number to whoever needs it.

To be clear on what this needs:
We are not asking anyone for banking credentials.
Plaid runs the approval with the bank directly.
An authorized account owner opens a one-time link and approves read-only access.
No username, password, or MFA code is shared with my team.

Two things I am trying to find out:

1. Who administers that account and can authorize read-only data sharing?
2. What is the process to grant an application that access? Functionally we just need a link to whoever can grant access, but I want to make sure we do our due diligence.

Happy to talk for 15 minutes if that is quicker than writing it out.

Well wishes,
Chris
```

## Worked example — short internal reply

Most email is this size. Do not inflate it.

```text
Hello Steve,

My apologies. I was out of office last week.
I do not have slides, but I do have a demo video I can share.
We also have tomorrow's working session to baseline quickly before we get into what I need from the team.

Well wishes,
Chris
```

## Boundary

This Skill sets register and shape for email Chris sends as himself.

It is not `/nickify` — that briefs a non-technical client with a work order.
It is not jargon translation. Plain does not mean vague: technical terms stay
exact, and the Lexicon still applies.

Never send, schedule, or post the draft anywhere. Chris sends it.
