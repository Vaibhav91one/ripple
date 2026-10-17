import type { Brief, Conflict } from "@/lib/schemas";

// Email-safe: tables + inline styles only (clients ignore CSS variables and Tailwind).
// The hex values are the dark tokens from app/globals.css flattened for email clients.
// Pure props in, markup out, so #16 can pass it straight to Resend's `react` option.
export const c = {
  page: "#161616", surface: "#1d1d1d", hairline: "#2e2e2e", strong: "#f5f5f5",
  body: "#d0d0d0", faint: "#8f8f8f", conflict: "#f0756b", ripple: "#5fd0d9",
};
export const font = "Geist, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export type EmailReply = "seen" | "concern" | "not_relevant";
export const replyLabels: Record<EmailReply, string> = { seen: "Seen", concern: "Concern", not_relevant: "Not relevant" };

export type BriefEmailProps = {
  brief: Brief;
  teamName: string;
  decisionTitle: string;
  /** Conflict shown first when the brief's team is party to one. */
  conflict?: Conflict;
  /** artifactId -> title, for the source line under each quote. */
  sourceTitle: (artifactId: string) => string;
  /** Absolute or relative base, e.g. https://ripple.example. */
  baseUrl?: string;
  /** Signed ack token for this team and decision. */
  token: string;
};

function Quote({ quote, title }: { quote: string; title: string }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ marginTop: 8 }}>
      <tbody>
        <tr>
          <td style={{ borderLeft: `2px solid ${c.hairline}`, padding: "0 0 0 12px", fontSize: 13, lineHeight: "19px", color: c.body, fontFamily: font }}>
            &ldquo;{quote}&rdquo;
            <br />
            <span style={{ color: c.faint, fontSize: 12 }}>{title}</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function BriefEmail({ brief, teamName, decisionTitle, conflict, sourceTitle, baseUrl = "", token }: BriefEmailProps) {
  const card = { backgroundColor: c.surface, border: `1px solid ${c.hairline}`, borderRadius: 8 } as const;
  const pad = { padding: 16, fontFamily: font } as const;
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ backgroundColor: c.page, fontFamily: font }}>
      <tbody>
        <tr>
          <td align="center" style={{ padding: "32px 16px" }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ maxWidth: 560 }}>
              <tbody>
                <tr>
                  <td style={{ fontSize: 12, color: c.ripple, fontFamily: font, paddingBottom: 8 }}>
                    Ripple &middot; Brief for {teamName}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: 22, lineHeight: "28px", fontWeight: 600, color: c.strong, fontFamily: font, paddingBottom: 20 }}>
                    {decisionTitle}
                  </td>
                </tr>

                {conflict && (
                  <tr>
                    <td style={{ paddingBottom: 12 }}>
                      <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ ...card, borderColor: c.conflict }}>
                        <tbody>
                          <tr>
                            <td style={pad}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: c.conflict, textTransform: "uppercase", letterSpacing: "0.04em" }}>Conflict</div>
                              <div style={{ fontSize: 15, lineHeight: "22px", color: c.strong, marginTop: 4 }}>
                                This decision breaks a promise: {conflict.contractIds.length} contracts guarantee API v1 past the shutdown date.
                              </div>
                              {conflict.sources.map((s, i) => (
                                <Quote key={i} quote={s.quote} title={sourceTitle(s.artifactId)} />
                              ))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}

                {brief.claims.map((cl, i) => (
                  <tr key={i}>
                    <td style={{ paddingBottom: 12 }}>
                      <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={card}>
                        <tbody>
                          <tr>
                            <td style={pad}>
                              <div style={{ fontSize: 15, lineHeight: "22px", color: c.strong }}>{cl.text}</div>
                              {cl.sources.map((s, j) => (
                                <Quote key={j} quote={s.quote} title={sourceTitle(s.artifactId)} />
                              ))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ))}

                <tr>
                  <td style={{ padding: "12px 0 8px", fontSize: 13, color: c.body, fontFamily: font }}>
                    Let us know where {teamName} stands:
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" cellPadding={0} cellSpacing={0}>
                      <tbody>
                        <tr>
                          {(Object.keys(replyLabels) as EmailReply[]).map((k) => (
                            <td key={k} style={{ paddingRight: 8 }}>
                              <a
                                href={`${baseUrl}/ack/${token}?r=${k}`}
                                style={{
                                  display: "inline-block", padding: "9px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                                  fontFamily: font, textDecoration: "none",
                                  ...(k === "seen"
                                    ? { backgroundColor: c.ripple, color: c.page }
                                    : { backgroundColor: c.surface, color: c.strong, border: `1px solid ${c.hairline}` }),
                                }}
                              >
                                {replyLabels[k]}
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
