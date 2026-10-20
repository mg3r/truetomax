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
    title: "Getting around",
    body: [
      "On a computer, everything is down the left side, grouped by what you're doing: your day (Today, Tasks, Rituals, Schedule), building (Vision, Projects, Practices, Ideas), and reflecting and sharing (Journal, Socials, Partner). Profile sits at the bottom.",
      "On your phone, the bar at the bottom has Today, Tasks, Projects and Partner; Menu opens everything else.",
    ],
  },
  {
    title: "Today",
    body: [
      "Each morning the day is prepared for you: an affirmation, one line naming what would make today count (taken only from what you've set or uploaded yourself: your tasks, projects, schedule, rituals, practices, Vision, journal and docs, never from the partner's own ideas), a reading from your copy of The Creative Act, and a question drawn from it. The reading is a whole section: it starts where the section starts and runs until it ends, even across pages, so it never stops mid-thought. The affirmation and question are written in the partner's own words; the reading is your book.",
      "Today is for doing, not planning: you add things on the other tabs (Tasks, Rituals, Practices, Schedule, Projects) and they show up here. Below the reading: your rituals to tick off, the practices you did today (tap to log them), then what to do today, which joins your Google Calendar events, today's Schedule items, and tasks set for today, in time order. Unfinished one-time tasks carry over to the next day (marked \u201ccarried over\u201d); things that repeat on your Schedule don't, they come back on their next day.",
      "Your partner suggests up to three tasks a day, starting with Up next tasks from your projects. Add the ones that fit; skip the rest. What you add, finish and skip teaches it what works.",
      "Moves this week counts every time you share your work or ask someone to pay you. It's the number that changes everything else. Write your answer to the question in the journal at the bottom.",
    ],
  },
  {
    title: "Tasks",
    body: [
      "Every task in one running checklist: from all your projects, and ones with no project. It's grouped into Today, Coming up (dated for later this week or beyond), Up next, Later and Done, and each task shows its day and project when it has one.",
      "Add like a Notes checklist: tap the empty line at the end of Today, Up next or Later, type, press Enter, and keep going. Tap a task to rename it, move it between Today, Up next and Later, or put it in a project. Tick to finish; \u00d7 deletes. Filter by project at the top; anything you add while filtered goes into that project.",
      "Import a list: take a photo of a handwritten list, or upload a PDF, Word or text file. Each item is added to Up next, and anything crossed out or ticked is marked done, including tasks you already had.",
    ],
  },
  {
    title: "Rituals",
    body: [
      "The things that keep you regulated: daily, nightly, and weekly. Daily and nightly items show on Today as a checklist that starts fresh each morning.",
      "Weekly items are about how often, not which day: \u201cSauna, 2\u00d7 a week\u201d. They sit in their own Weekly part of Today's checklist (below today and tonight) with how many you've done this week, and once you've hit the number they step aside until Monday. If you want one on set days, pick the days instead: it shows on just those days, still with its count for the week (\u201c1 of 3 this week\u201d).",
      "On Schedule, each day has a Daily rituals line at the top and a Nightly rituals line in the evening, with how many you did (\u201c2 of 4\u201d); weekly ones on any day get one line for the whole week. Drag the dots to reorder. The seven small dots on each item show the last week. Your partner sees what's holding and what's slipping.",
    ],
  },
  {
    title: "Schedule",
    body: [
      "Your whole week in one place. Each day shows the things you repeat every week, your Google Calendar events, and any task set for that date: ones you added on Today, here, or in a project. Anytime comes first, then morning, afternoon and evening, in time order.",
      "Add something as Just once (pick the day) or Every week (pick the days); anything that lands on today shows on Today right away. Set it with a part of day, an optional exact time, and an optional project. A one-time task is the same task everywhere: tick it, edit it or delete it here, on Today, or in its project.",
      "Tap an item's words to edit it, or its time to change when it happens. If something is in your Google Calendar and also here (same name), it shows once: your item, at the calendar's time, with a link to the event. Tap a calendar event to open it in Google Calendar. Weekly items are added to Today each morning; \u201cAdd changes to today\u201d brings in edits right away.",
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
      "What you're building. Each project has goals (plain text with a checkbox) and tasks, shown as a list or a board. Everything edits in place; × deletes.",
      "Tasks sit in one of four places. Today: on Today and on Schedule, and it carries over until it's done. Up next: planned and waiting. It shows in your Tasks list, and your partner offers it as one of the morning's suggestions when it fits (\u201cFrom Pottery\u201d); adding it moves it to today. Later: someday, out of the way; it never comes to you on its own, so move it to Up next when it's time. Done: finished.",
      "Your partner suggests next steps for each project: tap \u201cSuggest next steps\u201d and it proposes 3\u20135, drawing on the project's goals and tasks, your vision, your docs and uploads, your journal, your socials and what it has learned about how you work. Keep the ones you want (they go to Up next); let the rest go.",
      "Deleting a project removes its tasks and goals, and your partner forgets them too.",
    ],
  },
  {
    title: "Practices",
    body: [
      "What you make and offer: DJing, pottery, cooking, baking, fermenting. Where rituals keep you grounded, practices are the work you share, and they feed your projects.",
      "Add one at the top; rename, reorder (drag the dots) or remove it in place. Tap a practice to link the projects it feeds. Each shows how many times you did it this week and when you last did. Log a session with \u201cPracticed today?\u201d here, or by tapping it under Practiced today on Today.",
      "Your partner sees which practices are alive and which have gone quiet, which projects they feed, and builds suggestions and sharing ideas around them.",
    ],
  },
  {
    title: "Ideas",
    body: [
      "Two kinds. Work & income: feasible ways to earn from what you already do. Test one, or eliminate it and say why, and it won't be suggested again. Sharing: posts and series to make, built from what you're doing this week and from what's landing on your socials.",
    ],
  },
  {
    title: "Journal",
    body: [
      "Everything you've written, newest first. It's the richest thing your partner learns from.",
    ],
  },
  {
    title: "Socials",
    body: [
      "Your pages in one place. Instagram for now; more platforms will join it here.",
      "See your followers and the last 30 days at a glance (posts, views, reach, saves, shares), then every post with its numbers, sorted by Latest or Best. Tap a post to open it on Instagram.",
      "\u201cRead my posts\u201d has your partner go through them and say what's working, what isn't, and 3\u20135 specific things to try this week, each with the evidence behind it. Post ideas under Ideas \u2192 Sharing use all of this.",
      "Posts refresh from Instagram every few hours. New posts count as a move (shared) on Today automatically.",
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

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** The guide, with its sections listed on the side (across the top on a phone) to jump straight to one. */
export function HowItWorks() {
  return (
    <div className="md:grid md:grid-cols-[9rem_1fr] md:gap-8">
      <nav aria-label="Sections" className="-mx-4 mb-8 overflow-x-auto px-4 md:sticky md:top-10 md:mx-0 md:mb-0 md:self-start md:overflow-visible md:px-0">
        <ul className="flex gap-1.5 md:flex-col md:gap-0.5">
          {SECTIONS.map((s) => (
            <li key={s.title} className="shrink-0">
              <a href={`#${slug(s.title)}`} className="block rounded-full border border-line px-3 py-1 text-sm whitespace-nowrap text-muted hover:text-ink md:rounded-none md:border-0 md:px-0 md:py-1">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="max-w-[62ch] space-y-12">
        {SECTIONS.map((s) => (
          <section key={s.title} id={slug(s.title)} className="scroll-mt-6">
            <h2 className="font-serif text-xl">{s.title}</h2>
            <div className="mt-2 space-y-3 leading-relaxed">
              {s.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
