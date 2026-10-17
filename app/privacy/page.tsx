import { CONTACT, LegalPage } from "@/components/legal/LegalPage";

export const metadata = { title: "Privacy · Ripple" };

export default function Page() {
  return (
    <LegalPage title="Privacy policy" updated="2026-10-18">
      <p>Ripple is a change-impact graph for your company. This page says what data it handles, who processes it, and how to have it removed.</p>

      <h2>What we collect</h2>
      <ul>
        <li>Account identity from Clerk: your name and email, plus basic Google profile details if you sign in with Google.</li>
        <li>Content you connect: GitHub and Slack sources, uploaded documents and CSV files.</li>
        <li>An audit log of actions taken in your organization.</li>
        <li>Delivery records of the notices Ripple sends.</li>
      </ul>

      <h2>Who processes it</h2>
      <ul>
        <li>Clerk, for sign-in and organizations.</li>
        <li>Zerops, which hosts the app, its Postgres database and its FalkorDB graph database.</li>
        <li>OpenAI, which receives the text our agents read in order to reason about a change.</li>
        <li>Slack, GitHub and Resend, only if your organization connects them.</li>
      </ul>

      <h2>Security</h2>
      <ul>
        <li>Connector tokens are encrypted at rest with AES-256-GCM.</li>
        <li>Each organization&apos;s data lives in its own graph.</li>
        <li>A permission layer restricts Legal, Sales and Security sources to the owning team, on the server, before text reaches a viewer or an agent.</li>
      </ul>

      <h2>Google user data</h2>
      <p>
        If you sign in with Google we request only the openid, email and profile scopes, and use them solely to sign you in. We do not sell this data and do not use it for advertising.
        Ripple&apos;s use of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.
      </p>

      <h2>Deletion</h2>
      <p>
        Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we will delete your data. Deleting an organization removes its rows from our database; we remove its graph on request.
      </p>

      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </LegalPage>
  );
}
