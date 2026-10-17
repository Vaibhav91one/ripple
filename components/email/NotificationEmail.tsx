import type { ActionKind, Message } from "@/lib/notify/message";
import { c, font } from "./BriefEmail";

// General notification email, built from buildMessage(). Same table + inline-style rules as BriefEmail.
export const actionLabels: Record<ActionKind, string> = { ack: "Acknowledge", concern: "Raise a concern", not_relevant: "Not relevant", open: "Open in Ripple" };

export function NotificationEmail({ message }: { message: Message }) {
  const primary = message.actions[0]?.kind;
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ backgroundColor: c.page, fontFamily: font }}>
      <tbody>
        <tr>
          <td align="center" style={{ padding: "32px 16px" }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ maxWidth: 560 }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: 12, color: c.ripple, fontFamily: font, paddingBottom: 8 }}>Ripple</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 22, lineHeight: "28px", fontWeight: 600, color: c.strong, fontFamily: font, paddingBottom: 8 }}>{message.title}</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 14, lineHeight: "21px", color: c.faint, fontFamily: font, paddingBottom: 16 }}>Why you: {message.why}</td>
                </tr>
                {message.quotes.map((q, i) => (
                  <tr key={i}>
                    <td style={{ borderLeft: `2px solid ${c.hairline}`, padding: "0 0 0 12px", fontSize: 13, lineHeight: "19px", color: c.body, fontFamily: font }}>
                      &ldquo;{q.text}&rdquo;
                      <br />
                      <a href={q.url} style={{ color: c.faint, fontSize: 12, textDecoration: "none" }}>{q.source}</a>
                      <div style={{ height: 12 }} />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ paddingTop: 8 }}>
                    <table role="presentation" cellPadding={0} cellSpacing={0}>
                      <tbody>
                        <tr>
                          {message.actions.map((a) => (
                            <td key={a.kind} style={{ paddingRight: 8 }}>
                              <a
                                href={a.url}
                                style={{
                                  display: "inline-block", padding: "9px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, fontFamily: font, textDecoration: "none",
                                  ...(a.kind === primary ? { backgroundColor: c.ripple, color: c.page } : { backgroundColor: c.surface, color: c.strong, border: `1px solid ${c.hairline}` }),
                                }}
                              >
                                {actionLabels[a.kind]}
                              </a>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
