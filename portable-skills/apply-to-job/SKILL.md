---
name: apply-to-job
description: Tailor a resume and write a cover letter for one job posting, as one-page PDFs ready to submit, without inventing anything. Use when someone shares a job link or posting, says "help me apply to this", "tailor my resume", or "write a cover letter for this job".
---

# Apply to a Job

The person you are helping wants to apply to a job, not do homework. They give you a posting. You give back a tailored resume, a cover letter, and an honest read on their chances.

Talk to them in plain words. No file names, code, or tech terms unless something breaks.

## What you need

1. **Their resume.** Look in this chat and the project's files first. Ask only if it is not there.
2. **The job posting.** A link or pasted text. If the link will not open, or you see only part of the page, ask them to copy and paste the whole job description. Never guess what a posting says.
3. **`render.py`**, the file that came with these instructions. It makes the PDFs and checks them.

Ask nothing else up front. Make your best call, then list what you assumed in the report.

Several postings at once? Do them one at a time, each with its own files.

## Steps

1. **Read the resume.** Every job, date, duty, tool, and number in it is everything you may say. Nothing else.
2. **Read the posting.** Save its full text as `posting.txt`. Note the title, employer, department, location, remote or residency rules, pay, main duties, required and preferred qualifications, and job ID.
3. **Write `content.json`** in the format below, following the truth rules.
4. **Run the script:**

       python render.py content.json --resume <their resume file> --posting posting.txt --out out

   It accepts the resume as a PDF or as a .txt of its text. It prints one line per problem. Fix each one in `content.json` and run it again until it prints `OK`.
   - `SHORT LAST LINE`: a bullet ends with a few words alone on its last line. Make it shorter or longer.
   - `NEW NUMBER`: a number in neither the resume nor the posting. Remove it or use the resume's number.
   - `TOO LONG`: the page does not fit even at 80% size. Cut the weakest bullets.
5. **Check your own work.** Read every bullet and sentence against the resume.
   - It says something the resume does not: a **hard** problem. Fix it.
   - It says it more strongly than the resume does: a **soft** problem. Tone it down.
   - It rests on a guess about their plans (moving, hours, licenses, work samples): an **assumption**. Keep it and list it in the report.

   Run step 4 again after any change.
6. **Hand over** the two PDFs from `out` as downloads, then the report.

## Truth rules

- Reword and reorder only. Never add a job, duty, tool, skill, license, or result they did not list.
- Use only numbers from the resume. Never create a metric. The script flags numbers that are in neither the resume nor the posting, but it skips the letter's date and address, and it cannot see numbers written as words ("three").
- Keep job titles, employers, and dates exactly as the resume writes them.
- Keep the resume's verb strength. "Supported" stays "supported", not "managed". "Facilitated" does not become "led".
- List only skills the resume backs up.
- Current jobs in present tense. Past jobs in past tense.
- Several current ("Present") jobs may be ordered by fit for this posting. Past jobs stay in date order, newest first.
- Use the posting's own words where the resume truthfully supports them.

## Cover letter

Four paragraphs, about 250 to 350 words in total:

1. **Hook.** The role by name and why this person fits it.
2. **Best evidence.** The resume experience closest to the main duties.
3. **Range.** A second, different strength from the resume that covers another requirement.
4. **Logistics and close.** Location or remote fit, availability if they told you, a plain thank-you. Never guess either one.

On a stretch role, name the gap once, honestly and briefly, and show what bridges it. Do not talk them out of the job.

The script adds "Dear Hiring Team," before the body and "Sincerely," with their name after it.

## content.json format

```json
{
  "candidate": {"name": "Jordan Rivera", "contact": ["Newark, NJ", "(555) 010-0199", "jordan@example.com"]},
  "tag": "Acme_Program_Coordinator",
  "resume": {
    "summary": "Two or three sentences aimed at this posting.",
    "jobs": [
      {
        "header": "Program Assistant, Acme Health",
        "location": "Remote",
        "dates": "03/2023 – Present",
        "bullets": ["One duty or result per bullet.", "..."]
      }
    ],
    "skills": ["Scheduling", "Microsoft Excel"],
    "education": [{"degree": "B.A., Communication", "detail": "State University, 2021"}]
  },
  "letter": {
    "date": "October 23, 2026",
    "address": ["People Operations", "Acme Health", "Pasadena, CA"],
    "re": "Program Coordinator (Job ID 12345)",
    "body": ["Hook", "Best evidence", "Range", "Logistics and close"]
  }
}
```

- `contact` comes from the resume as written.
- `address` starts with the posting's department, or "Hiring Team" if it names none.
- `tag` names the files (`<Name>_Resume_<tag>.pdf`). Use the employer plus a short role name.
- Leave the job ID out of `re` if the posting has none.

## If the script cannot run

If you cannot run Python here, say so in one plain sentence. Then give the resume and the letter as text in the chat, laid out so they can paste each into a document. Still do step 5 and the report.

## Report

Short, in this order:

**Fit: Strong, Stretch, or Long shot.** One sentence why, tied to the required qualifications.
- Strong: meets every required qualification.
- Stretch: meets most, with one clear gap.
- Long shot: misses several, or a hard requirement (a license, years of experience, a residency rule).

Count a requirement as met only when the resume shows it. Shown in part counts as a gap. Location and on-site days are not fit: they go under "Check before you send".

**Your files:** the two PDFs.

**Cover letter text:** the four paragraphs, for application sites that have a paste box.

**Check before you send:** each assumption as a yes-or-no question ("Are you open to moving to Honolulu?"). Add anything the posting asks for that the files cannot cover, such as work samples, license numbers, or references.
