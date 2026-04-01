const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";

interface SheetProperties {
  sheetId: number;
  title: string;
}

interface SpreadsheetMetadata {
  sheets?: Array<{ properties?: SheetProperties }>;
}

interface GoogleServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
}

export interface SpreadsheetTab {
  sheetId: number;
  title: string;
}

export async function readSheetRows(input: {
  credentials: GoogleServiceAccountCredentials;
  spreadsheetId: string;
  gid?: number | null;
  sheetTabName?: string | null;
}): Promise<string[][]> {
  const accessToken = await getAccessToken(input.credentials);
  const sheetTitle = await resolveSheetTitle({
    accessToken,
    spreadsheetId: input.spreadsheetId,
    gid: input.gid,
    sheetTabName: input.sheetTabName,
  });

  const range = `${escapeSheetRange(sheetTitle)}!A:Z`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets read failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as { values?: string[][] };
  return payload.values ?? [];
}

export async function writeSheetRows(input: {
  credentials: GoogleServiceAccountCredentials;
  spreadsheetId: string;
  gid?: number | null;
  sheetTabName?: string | null;
  rows: string[][];
}): Promise<void> {
  const accessToken = await getAccessToken(input.credentials);
  const sheetTitle = await resolveSheetTitle({
    accessToken,
    spreadsheetId: input.spreadsheetId,
    gid: input.gid,
    sheetTabName: input.sheetTabName,
  });

  const range = `${escapeSheetRange(sheetTitle)}!A:Z`;

  const clearResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }
  );

  if (!clearResponse.ok) {
    const errorText = await clearResponse.text();
    throw new Error(`Google Sheets clear failed with status ${clearResponse.status}: ${errorText}`);
  }

  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheetId}/values/${encodeURIComponent(
      `${escapeSheetRange(sheetTitle)}!A1`
    )}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: `${sheetTitle}!A1`,
        majorDimension: "ROWS",
        values: input.rows,
      }),
    }
  );

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Google Sheets write failed with status ${updateResponse.status}: ${errorText}`);
  }
}

export function parseSpreadsheetReference(sheetUrl: string): {
  spreadsheetId: string;
  gid: number | null;
} {
  const spreadsheetMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!spreadsheetMatch) {
    throw new Error("Invalid Google Sheet URL");
  }

  const url = new URL(sheetUrl);
  const hashGidMatch = url.hash.match(/gid=([0-9]+)/);
  const gidValue = url.searchParams.get("gid") || hashGidMatch?.[1] || null;

  return {
    spreadsheetId: spreadsheetMatch[1],
    gid: gidValue ? Number(gidValue) : null,
  };
}

export async function listSpreadsheetTabs(input: {
  credentials: GoogleServiceAccountCredentials;
  spreadsheetId: string;
}): Promise<SpreadsheetTab[]> {
  const accessToken = await getAccessToken(input.credentials);
  const metadata = await fetchSpreadsheetMetadata(input.spreadsheetId, accessToken);

  return (metadata.sheets ?? [])
    .map((sheet) => sheet.properties)
    .filter((sheet): sheet is SheetProperties => Boolean(sheet?.title) && typeof sheet?.sheetId === "number")
    .map((sheet) => ({
      sheetId: sheet.sheetId,
      title: sheet.title.trim(),
    }));
}

async function resolveSheetTitle(input: {
  accessToken: string;
  spreadsheetId: string;
  gid?: number | null;
  sheetTabName?: string | null;
}): Promise<string> {
  if (input.sheetTabName && input.sheetTabName.trim().length > 0) {
    return input.sheetTabName.trim();
  }

  const metadata = await fetchSpreadsheetMetadata(input.spreadsheetId, input.accessToken);
  const sheets = metadata.sheets ?? [];

  if (input.gid !== null && input.gid !== undefined) {
    const matched = sheets.find((sheet) => sheet.properties?.sheetId === input.gid);
    if (matched?.properties?.title) {
      return matched.properties.title;
    }
  }

  const fallbackTitle = sheets[0]?.properties?.title;
  if (!fallbackTitle) {
    throw new Error("No sheet tabs found in spreadsheet");
  }

  return fallbackTitle;
}

async function fetchSpreadsheetMetadata(
  spreadsheetId: string,
  accessToken: string
): Promise<SpreadsheetMetadata> {
  const metadataResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!metadataResponse.ok) {
    const errorText = await metadataResponse.text();
    throw new Error(
      `Google Sheets metadata lookup failed with status ${metadataResponse.status}: ${errorText}`
    );
  }

  return (await metadataResponse.json()) as SpreadsheetMetadata;
}

async function getAccessToken(
  credentials: GoogleServiceAccountCredentials
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope: SHEETS_SCOPE,
      aud: TOKEN_AUDIENCE,
      exp: now + 3600,
      iat: now,
    })
  );

  const signingInput = `${header}.${payload}`;
  const signature = await signJwt(signingInput, credentials.privateKey);
  const assertion = `${signingInput}.${signature}`;

  const tokenResponse = await fetch(TOKEN_AUDIENCE, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Google OAuth token request failed with status ${tokenResponse.status}: ${errorText}`);
  }

  const payloadJson = (await tokenResponse.json()) as { access_token?: string };
  if (!payloadJson.access_token) {
    throw new Error("Google OAuth token missing access_token");
  }

  return payloadJson.access_token;
}

async function signJwt(data: string, privateKeyPem: string): Promise<string> {
  const normalizedKey = privateKeyPem.replace(/\\n/g, "\n");
  const binary = pemToArrayBuffer(normalizedKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binary,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(data)
  );

  return encodeBase64Url(signature);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const binaryString = atob(cleaned);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes.buffer;
}

function encodeBase64Url(data: string | ArrayBuffer): string {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function escapeSheetRange(sheetTitle: string): string {
  return `'${sheetTitle.replace(/'/g, "''")}'`;
}
