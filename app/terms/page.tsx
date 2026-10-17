import { CONTACT, LegalPage } from "@/components/legal/LegalPage";

export const metadata = { title: "Terms · Ripple" };

export default function Page() {
  return (
    <LegalPage title="Terms of service" updated="2026-10-18">
      <h2>Beta service</h2>
      <p>Ripple is a beta. It may change, break or go away without notice.</p>

      <h2>As is</h2>
      <p>It is provided as is, without warranties of any kind. Agent output can be wrong: check the quoted source before you act on it.</p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not break the law or break the terms of the services you connect.</li>
        <li>Do not connect data you have no right to share.</li>
        <li>Do not attack, overload or probe Ripple, or try to read another organization&apos;s data.</li>
      </ul>

      <h2>Your content</h2>
      <p>What you connect or upload stays yours. You give us permission to process it only to run Ripple for you.</p>

      <h2>Termination</h2>
      <p>You can stop using Ripple at any time and ask us to delete your data. We may suspend access that breaks these terms.</p>

      <h2>Contact</h2>
      <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also the <a href="/privacy">privacy policy</a>.</p>
    </LegalPage>
  );
}
