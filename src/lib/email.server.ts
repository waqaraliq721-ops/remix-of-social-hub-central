// Transactional email sender. Sends through the Lovable Gmail connector
// gateway using the connected Google account as the sender.

const GMAIL_GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

export type SendEmailInput = { to: string; subject: string; html: string };

export function emailConfigured() {
  return !!process.env["LOVABLE_API_KEY"] && !!process.env["GOOGLE_MAIL_API_KEY"];
}

const b64 = (s: string) =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

function rawMessage(to: string, subject: string, html: string) {
  const message = [
    `To: ${to}`,
    `Subject: ${header(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");
  return b64(message).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<boolean> {
  if (!emailConfigured() || !to) return false;
  try {
    const response = await fetch(`${GMAIL_GATEWAY}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
        "X-Connection-Api-Key": process.env["GOOGLE_MAIL_API_KEY"]!,
        "content-type": "application/json",
      },
      body: JSON.stringify({ raw: rawMessage(to, subject, html) }),
    });
    if (!response.ok) {
      console.error("gmail send failed", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("email send error", error);
    return false;
  }
}

function shell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#0b0713;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#f5f3ff">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="font-size:20px;font-weight:700;letter-spacing:-.02em;color:#c4b5fd">Orbit</div>
    <h1 style="font-size:26px;line-height:1.25;margin:22px 0 12px">${title}</h1>
    <div style="font-size:15px;line-height:1.65;color:#d8d2ea">${body}</div>
    <p style="margin-top:32px;font-size:12px;color:#8d84a8">You are receiving this because you have an Orbit account.</p>
  </div></body></html>`;
}

export function welcomeEmail(email: string) {
  return {
    subject: "Welcome to Orbit 🎬",
    html: shell(
      "Welcome aboard!",
      `<p>Hi ${email.split("@")[0]}, your Orbit workspace is ready.</p>
       <p>You're on the <strong>Free</strong> plan: 5 video exports per month, with an Orbit watermark and voiceover disabled.</p>
       <p>Upgrade any time from the Plans page to unlock watermark-free exports, AI voiceover and unlimited rendering.</p>
       <ul>
         <li><strong>Basic — 999 PKR</strong>: 3 exports per week, voiceover, no watermark.</li>
         <li><strong>Ultimate — 2499 PKR</strong>: everything, unlimited exports.</li>
       </ul>
       <p>Happy creating!</p>`,
    ),
  };
}

export function tierUpgradeEmail(email: string, tier: string) {
  const nice = tier === "ultimate" ? "Ultimate" : tier === "basic" ? "Basic" : "Free";
  return {
    subject: `Your Orbit plan is now ${nice} 🎉`,
    html: shell(
      `Congratulations — you're on ${nice}!`,
      `<p>Hi ${email.split("@")[0]}, your payment has been confirmed and your account has been upgraded to the <strong>${nice}</strong> plan.</p>
       ${
         tier === "ultimate"
           ? "<p>You now have unlimited exports, every feature unlocked and no watermark.</p>"
           : tier === "basic"
             ? "<p>You now get 3 exports per week with AI voiceover and no watermark.</p>"
             : "<p>Your plan has been set to Free.</p>"
       }
       <p>Jump back in and start exporting.</p>`,
    ),
  };
}
