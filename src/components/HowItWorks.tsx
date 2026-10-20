// How truetomax works, in plain words. Keep this in step with the app: every change to a feature updates this page.

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "What it's for",
    body: [
      "truetomax is your guiding light: it gives each day a direction, helps you carry out your visions, share your gifts through aligned action, and find work that pays without going back to a job.",
      "Everything in it feeds one partner, which reads what you write and what you actually do, and changes how it guides you over time.",
    ],
  },
  {
    title: "Today",
    body: [
      "Each morning the day is prepared for you: an affirmation, one line naming what would make today count, a random page from your copy of The Creative Act, and a question drawn from that page. The affirmation and question are written in the partner's own words; the page is from your book.",
      "Below that: your routine to tick off, then what to do today. That list joins your Google Calendar events, today's Schedule items, and project tasks set for today, in time order. Unfinished tasks carry over to the next day.",
      "Your partner suggests up to three tasks a day. Add the ones that fit; skip the rest. What you add, finish and skip teaches it what works.",
      "Moves this week counts every time you share your work or ask someone to pay you. It's the number that changes everything else. Write your answer to the question in the journal at the bottom.",
    ],
  },
  {
    title: "Routine",
    body: [
      "The things you do daily, nightly, or on certain days of the week. They show up on Today as a checklist that starts fresh each morning; weekly ones also show on their days in Schedule.",
      "Drag the dots to reorder. The seven small dots on each item show the last week, filled where you did it. Your partner sees what's holding and what's slipping.",
    ],
  },
  {
    title: "Schedule",
    body: [
      "Your weekly rhythm: things you do on set days, as morning, afternoon, evening or anytime, with an exact time if you want one. Each day shows these with your Google Calendar events, anytime first, then morning, afternoon and evening.",
      "Tap an item's words to edit it, or its time to change when it happens. Tap a calendar event to open it in Google Calendar. Schedule items are added to Today each morning; “Add changes to today” brings in edits right away.",
    ],
  },
  {
    title: "Vision",
    body: [
      "One running doc, in your own words: what's alive for you and what you're building toward. New sections go on top; drag to reorder. Your partner reads it and asks you about it, but never writes it for you.",
    ],
  },
  {
    title: "Projects",
    body: [
      "What you're building. Each project has goals (plain text with a checkbox) and tasks you set for Today, Up next, Later or Done, shown as a list or a board. Everything edits in place; × deletes.",
      "Deleting a project removes its tasks and goals, and your partner forgets them too.",
    ],
  },
  {
    title: "Journal and Ideas",
    body: [
      "Journal holds everything you've written. It's the richest thing your partner learns from.",
      "Ideas has two sides. Work & income: feasible ways to earn from what you already do; test one, or eliminate it and say why, and it won't be suggested again. Sharing: posts and series to make, plus how your recent Instagram posts did.",
    ],
  },
  {
    title: "Partner",
    body: [
      "Chat is your creative partner. Ask it anything, think out loud, or tell it what happened. Each conversation is its own thread; start a new one any time and find past ones under Conversations. A focus review runs process of elimination: what to keep, pause or drop, and the one path most likely to bring in income in the next 90 days.",
      "Before every reply it reads your Vision, projects, routine, schedule, recent journal, your docs, what it has learned, and memories from further back that match what you're talking about, found by meaning rather than exact words. What you tell it in chat becomes memory too.",
      "Learned is what it has figured out about you. Once a week (when there's enough to go on) it reads everything and proposes things it thinks are true for you to confirm or reject, suggests schedule changes, tunes how it suggests tasks, and writes you a short review. Confirmed things steer every suggestion; rejected things are never acted on. A dot shows when something is waiting for you.",
    ],
  },
  {
    title: "Profile",
    body: [
      "Context is what your partner knows about your life: About you, your docs (upload PDF, Word or text files, link a Google Doc, or link a whole Drive folder that stays in sync daily), and your book.",
      "Settings connects Google (calendar, docs and Drive) and Instagram, turns on the 7am morning notification for this device, and signs you out. Every connection is read-only: truetomax never posts, edits or sends anything for you.",
    ],
  },
];

export function HowItWorks() {
  return (
    <div className="max-w-[62ch] space-y-10">
      {SECTIONS.map((s) => (
        <section key={s.title}>
          <h2 className="font-serif text-xl">{s.title}</h2>
          <div className="mt-2 space-y-3 leading-relaxed">
            {s.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
