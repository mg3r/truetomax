import type { Metadata } from "next";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = { title: `Privacy · ${APP_NAME}` };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl">Privacy</h1>
      <p className="mt-1 text-sm text-muted">Last updated October 19, 2026</p>

      <div className="mt-8 max-w-[62ch] space-y-5 leading-relaxed">
        <p>
          {APP_NAME} is a personal app used by one person, its owner. It is not offered to the public, and no one else can create an account.
        </p>
        <h2 className="pt-2 font-serif text-xl">What it reads</h2>
        <p>
          With the owner&rsquo;s permission, it reads Google Calendar events, Google Docs and files in Google Drive folders the owner links, and posts and
          insights from the owner&rsquo;s Instagram account. All access is read-only. It never creates, changes, sends or deletes anything in those accounts.
        </p>
        <h2 className="pt-2 font-serif text-xl">How it&rsquo;s used</h2>
        <p>
          The information is used only to plan the owner&rsquo;s day and to give the owner suggestions inside the app. To write those suggestions, relevant text
          is sent to Anthropic&rsquo;s Claude API. Nothing is sold, shared for advertising, or used to train AI models.
        </p>
        <h2 className="pt-2 font-serif text-xl">Where it&rsquo;s stored</h2>
        <p>
          Data is stored in a private Supabase database protected so that only the owner&rsquo;s account can read it. Access tokens for Google and Instagram are
          stored there too, and can be removed at any time with Disconnect in the app&rsquo;s settings, or by revoking access in the Google or Instagram account.
        </p>
        <h2 className="pt-2 font-serif text-xl">Google user data</h2>
        <p>
          {APP_NAME}&rsquo;s use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use
          requirements.
        </p>
        <h2 className="pt-2 font-serif text-xl">Deleting data</h2>
        <p>Disconnecting an account in the app removes its stored tokens and synced data. The owner can delete everything else from the database at any time.</p>
        <h2 className="pt-2 font-serif text-xl">Contact</h2>
        <p>maxwellrgross@gmail.com</p>
      </div>
    </main>
  );
}
