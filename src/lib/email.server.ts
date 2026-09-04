// Transactional email sender. Uses Resend when RESEND_API_KEY +
// NOTIFICATION_FROM_EMAIL are configured in project settings; otherwise it
// no-ops so the rest of the app keeps working without email credentials.

export type SendEmailInput = { to: string; subject: string; html: string };

export function emailConfigured() {
  return !!process.env["RESEND_API_KEY"] && !!process.env["NOTIFICATION_FROM_EMAIL"];
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["NOTIFICATION_FROM_EMAIL"];
  if (!apiKey || !from || !to) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!response.ok) {
      console.error("email send failed", response.status, await response.text());
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
    <div style="font-size:20px;font-weight:700;letter-spacing:-.02em;background:linear-gradient(90deg,#a78bfa,#f0abfc);-webkit-background-clip:text;background-clip:text;color:transparent">Orbit</div>
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
