Here’s the proposition in her language:

> **“Everything good you do with ChatGPT for school gets saved automatically into your own private ‘teacher brain’ — and from that, you get ready-to-reuse lesson packs, worksheets, tests and emails without redoing the work.”**

Now break that into pieces you can actually say to her.

---

## 1. Start with her current pain (in her words)

“You know how…”

* You have **great chats with ChatGPT** about a poem or a novel…
* Then the next day you **can’t find that exact answer again**?
* You **copy–paste bits into Word/Docs**, but it’s messy and you never go back?
* Every September you’re basically **rebuilding the same lessons** from scratch?

**chat2repo = stop losing the good stuff.**
It turns ChatGPT into a filing cabinet that organizes itself. 

---

## 2. What she actually gets (outcomes, not tech)

### Outcome A — A private “Teacher Brain” that remembers everything

Every time she gets a good answer from ChatGPT:

* She clicks one button on the message (“Send to notebook”).
* That answer is saved into her **private teacher notebook online**, with date and topic. 
* She can **search it later** by topic, book, year group, exam, etc. 

No more:

* “What was that amazing explanation of Macbeth I got last month?”
* “Where’s that set of exam-style questions I generated last year?”

It’s all in one place, forever.

---

### Outcome B — Reusable lesson packs instead of one-off chats

You frame it like:

> “If you like something you made with ChatGPT — a lesson, a worksheet, an exam — you tag it, and from then on it’s part of your ‘pack’ for that text or year group.”

Concretely:

* She asks ChatGPT: “Create a 40-minute lesson for *Othello* Act 1 Scene 3 for 5th years, with learning outcomes and homework.”
* When she’s happy, she says:
  “Summarize this as my final lesson plan and add tags at the end:
  `#LessonPlan #Othello #5thYear`”
* She clicks **Save to notebook** (chat2repo button).
* That goes into a folder like `/english/5th-year/othello/lesson-plans/`. 

Next year, when *Othello* comes around, her whole stack of lessons is already there — she just tweaks, not rebuilds.

---

### Outcome C — Automatic “little helpers” (GitHub Actions) that work for her

You don’t sell her “GitHub Actions”.
You sell her **“little robots that tidy and organise your stuff in the background.”**

Examples tailored to her:

1. **Yesterday’s teaching brain, in one email**

   Every morning at 7am she gets an email:

   > “Here’s what you created yesterday:
   > – 2 new lesson plans (#LessonPlan)
   > – 1 set of exam questions (#ExamQuestions)
   > – 1 parent email template (#ParentEmail)”

   That’s literally one of the sample workflows: daily summary of what was saved yesterday. 

2. **Auto-formatted lesson plans**

   When something is tagged `#LessonPlan`:

   * A workflow takes the raw ChatGPT text,
   * Drops it into a **consistent template** (Objectives, Starter, Main, Plenary, Homework),
   * Saves it into her “Lesson Plans” folder.

   Result: all her lessons end up in the same format without her doing the formatting.

3. **Build question banks from tags**

   Tag something `#ExamQuestions #Poetry`:

   * Workflow extracts just the questions,
   * Files them under `/exam-questions/poetry/`,
   * Over time she gets a **growing bank of questions** she can reuse.

   This follows the same pattern as the general Actions ideas (trigger on tags → process content → save structured outputs). 

You handle the tech (GitHub, Actions).
She just sees: “If I tag it right, the little robots do useful things for me.”

---

## 3. How you explain what she actually does, step-by-step

Keep it ultra-simple; this is the **user story** you pitch:

1. **Install once**

   * “I’ll put a small button into your browser that appears inside ChatGPT.”
     (This is the chat2repo extension. )

2. **Use ChatGPT exactly as you do now**

   * She keeps planning lessons, writing emails, creating tests.

3. **When something is worth keeping**

   * She either:

     * Adds a line at the end:
       `#LessonPlan #Macbeth #TY`
     * Or tells ChatGPT: “Summarize this for my notes and add sensible tags.”
   * She clicks the **Send to notebook** button on that ChatGPT answer. 

4. **That’s it**

   * The note is saved in a structured way.
   * Her “robots” (Actions) run in the background and:

     * Update her lesson library
     * Update her question bank
     * Send summaries

No new app. No new login. Just:

> “Plan as normal in ChatGPT, and click this button when something is good.”

---

## 4. The actual pitch lines you can use with her

Pick one of these depending on her mood:

**Short & practical**

> “This just means you don’t lose your best ChatGPT lessons. One click and they go into your own private teacher notebook, and little automations turn them into proper lesson plans and question banks.”

**Workload angle**

> “Every time you make a good lesson or exam with ChatGPT, this keeps it forever and organises it for next year. After a term, you basically have a reusable scheme of work without extra effort.”

**Stress angle**

> “Instead of starting from scratch every time, this lets Future-You reuse everything Past-You already did in ChatGPT.”

---

## 5. Your next steps (for you, not her)

1. **Decide her tag vocabulary** (keep it tiny)

   * `#LessonPlan`
   * `#ExamQuestions`
   * `#Homework`
   * `#ParentEmail`
   * `#YearGroup:1stYear/2ndYear/...`
   * `#Text:Macbeth`, `#Text:Othello`, etc.

2. **Set up her “teacher brain” repo + extension**

   * Create a private repo like `sarah-english-notes`. 
   * Install chat2repo in her browser and connect it to that repo with a PAT.
   * Set default tags in settings (e.g. `#English #Teaching`). 

3. **Wire up 1–2 high-value automations**

   * Daily email of whatever she tagged yesterday.
   * Auto-format anything with `#LessonPlan` into a template. 

4. **Sit beside her for one real planning session**

   * Have her do what she always does in ChatGPT.
   * When she’s happy with something, show:

     * “Add tags → click this button → done.”
   * Then show her the email / folder created the next day.

If that one session feels lighter for her and she sees last night’s work appear automatically, she’ll get it.

---

If you want, next step I can:

* Design a **micro-tag set just for English teachers**, and
* Sketch the exact GitHub Action behaviour for the “lesson pack robot” and the “daily summary” robot, in non-code English so you can implement or hand off.

#Spec #Wedge #Project:chat2repo

