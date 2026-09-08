// Google Sheets user database, through the Lovable connector gateway.
// Sheet columns (Users tab):
// A User ID | B Email | C Signup Date | D Current Tier | E Tier Changed At
// F Exports This Week | G Exports This Month | H Total Exports | I Last Export At
// J Watermark | K Voiceover | L Welcome Email Sent | M Last Synced | N Notes

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

export type SheetRow = {
  rowNumber: number; // 1-based sheet row
  userId: string;
  email: string;
  signupDate: string;
  tier: "free" | "basic" | "ultimate";
  tierChangedAt: string;
  week: number;
  month: number;
  total: number;
  lastExportAt: string;
  watermark: string;
  voiceover: string;
  welcomeSent: string;
  notes: string;
};

export function sheetsConfigured() {
  return !!process.env["LOVABLE_API_KEY"] && !!process.env["GOOGLE_SHEETS_API_KEY"] && !!process.env["ORBIT_USERS_SHEET_ID"];
}

function sheetId() {
  return process.env["ORBIT_USERS_SHEET_ID"]!;
}
function tab() {
  return process.env["ORBIT_USERS_SHEET_TAB"] || "Users";
}

async function gateway(path: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "X-Connection-Api-Key": process.env["GOOGLE_SHEETS_API_KEY"]!,
      "content-type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets request failed [${res.status}]: ${text}`);
  }
  return res.json();
}

function normaliseTier(value: string): "free" | "basic" | "ultimate" {
  const v = (value || "").trim().toLowerCase();
  return v === "basic" || v === "ultimate" ? v : "free";
}

/** Reads every user row from the sheet. */
export async function readRows(): Promise<SheetRow[]> {
  const data = (await gateway(`/spreadsheets/${sheetId()}/values/${tab()}!A2:N5000`)) as {
    values?: string[][];
  };
  return (data.values ?? [])
    .map((r, i) => ({
      rowNumber: i + 2,
      userId: r[0] ?? "",
      email: r[1] ?? "",
      signupDate: r[2] ?? "",
      tier: normaliseTier(r[3] ?? ""),
      tierChangedAt: r[4] ?? "",
      week: Number(r[5] ?? 0) || 0,
      month: Number(r[6] ?? 0) || 0,
      total: Number(r[7] ?? 0) || 0,
      lastExportAt: r[8] ?? "",
      watermark: r[9] ?? "",
      voiceover: r[10] ?? "",
      welcomeSent: r[11] ?? "",
      notes: r[13] ?? "",
    }))
    .filter((r) => r.userId);
}

export async function findRow(userId: string): Promise<SheetRow | null> {
  const rows = await readRows();
  return rows.find((r) => r.userId === userId) ?? null;
}

export type UserSnapshot = {
  userId: string;
  email: string;
  tier: "free" | "basic" | "ultimate";
  week: number;
  month: number;
  total: number;
  lastExportAt?: string;
  watermark: boolean;
  voiceover: boolean;
  welcomeSent: boolean;
  signupDate?: string;
  tierChangedAt?: string;
};

/**
 * Creates the user's row when missing, otherwise refreshes the usage columns.
 * The tier column is owned by the sheet (manual upgrades), so it is only
 * written when the row is created.
 */
export async function upsertUserRow(snapshot: UserSnapshot): Promise<SheetRow | null> {
  if (!sheetsConfigured()) return null;
  const existing = await findRow(snapshot.userId);
  const now = new Date().toISOString();

  if (!existing) {
    await gateway(`/spreadsheets/${sheetId()}/values/${tab()}!A1:N1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: {
        values: [
          [
            snapshot.userId,
            snapshot.email,
            snapshot.signupDate ?? now,
            snapshot.tier,
            snapshot.tierChangedAt ?? now,
            snapshot.week,
            snapshot.month,
            snapshot.total,
            snapshot.lastExportAt ?? "",
            snapshot.watermark ? "yes" : "no",
            snapshot.voiceover ? "yes" : "no",
            snapshot.welcomeSent ? "yes" : "no",
            now,
            "",
          ],
        ],
      },
    });
    return findRow(snapshot.userId);
  }

  // Update everything except the tier column (D) which the owner edits by hand.
  await gateway(
    `/spreadsheets/${sheetId()}/values:batchUpdate`,
    {
      method: "POST",
      body: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: `${tab()}!B${existing.rowNumber}`, values: [[snapshot.email]] },
          {
            range: `${tab()}!F${existing.rowNumber}:M${existing.rowNumber}`,
            values: [
              [
                snapshot.week,
                snapshot.month,
                snapshot.total,
                snapshot.lastExportAt ?? existing.lastExportAt,
                snapshot.watermark ? "yes" : "no",
                snapshot.voiceover ? "yes" : "no",
                snapshot.welcomeSent ? "yes" : "no",
                now,
              ],
            ],
          },
        ],
      },
    },
  );
  return { ...existing, email: snapshot.email };
}

/** Writes the tier back to the sheet (used when the app changes it, rare). */
export async function writeTier(rowNumber: number, tier: string) {
  if (!sheetsConfigured()) return;
  await gateway(`/spreadsheets/${sheetId()}/values/${tab()}!D${rowNumber}:E${rowNumber}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: { values: [[tier, new Date().toISOString()]] },
  });
}
