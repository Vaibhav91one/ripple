// Email channel adapter: the only place that talks to Resend.
import { Resend } from "resend";
import type { Env as AppEnv } from "../env";

export type EmailEnv = Partial<Pick<AppEnv, "RESEND_API_KEY" | "RESEND_FROM">>;
export type EmailResult = { status: "sent" | "preview" | "failed"; to: string | null; id?: string; error?: string };

export async function sendEmail(env: EmailEnv, to: string | null, subject: string, html: string): Promise<EmailResult> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM || !to) return { status: "preview", to };
  try {
    const { data, error } = await new Resend(env.RESEND_API_KEY).emails.send({ from: env.RESEND_FROM, to, subject, html });
    return error ? { status: "failed", to, error: error.message } : { status: "sent", to, id: data?.id };
  } catch (e) {
    return { status: "failed", to, error: String(e) };
  }
}
