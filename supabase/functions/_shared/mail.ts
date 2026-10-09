/** Minimal SMTP (STARTTLS) for Brevo — secrets from env, never log credentials. */
export type MailMsg = { to: string; subject: string; text: string; html?: string };

function env(name: string) {
  return (Deno.env.get(name) || '').trim();
}

export function smtpConfigured() {
  return !!(env('SMTP_HOST') && env('SMTP_USER') && (env('SMTP_PASS') || env('BREVO_SMTP_KEY')));
}

async function readLine(conn: Deno.Conn): Promise<string> {
  const buf = new Uint8Array(1);
  const chunks: number[] = [];
  while (true) {
    const n = await conn.read(buf);
    if (n === null) break;
    if (buf[0] === 10) break; // \n
    if (buf[0] !== 13) chunks.push(buf[0]);
  }
  return new TextDecoder().decode(new Uint8Array(chunks));
}

async function readResponse(conn: Deno.Conn): Promise<{ code: number; lines: string[] }> {
  const lines: string[] = [];
  while (true) {
    const line = await readLine(conn);
    if (!line) break;
    lines.push(line);
    if (line.length >= 4 && line[3] === ' ') {
      return { code: parseInt(line.slice(0, 3), 10), lines };
    }
  }
  return { code: 0, lines };
}

async function writeCmd(conn: Deno.Conn, cmd: string) {
  await conn.write(new TextEncoder().encode(cmd + '\r\n'));
}

export async function sendMail(msg: MailMsg): Promise<void> {
  const host = env('SMTP_HOST') || 'smtp-relay.brevo.com';
  const port = parseInt(env('SMTP_PORT') || '587', 10);
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS') || env('BREVO_SMTP_KEY');
  const fromEmail = env('SMTP_ADMIN_EMAIL') || env('SMTP_FROM') || 'planner.Moms@gmail.com';
  const fromName = env('SMTP_SENDER_NAME') || 'Mom.OS';
  if (!user || !pass) throw new Error('SMTP not configured');

  let conn: Deno.Conn = await Deno.connect({ hostname: host, port });
  let res = await readResponse(conn);
  if (res.code !== 220) throw new Error(`SMTP greet ${res.code}`);

  await writeCmd(conn, `EHLO mom-os.github.io`);
  res = await readResponse(conn);
  if (res.code !== 250) throw new Error(`SMTP EHLO ${res.code}`);

  await writeCmd(conn, 'STARTTLS');
  res = await readResponse(conn);
  if (res.code !== 220) throw new Error(`SMTP STARTTLS ${res.code}`);

  conn = await Deno.startTls(conn, { hostname: host });
  await writeCmd(conn, `EHLO mom-os.github.io`);
  res = await readResponse(conn);
  if (res.code !== 250) throw new Error(`SMTP EHLO2 ${res.code}`);

  await writeCmd(conn, 'AUTH LOGIN');
  res = await readResponse(conn);
  if (res.code !== 334) throw new Error(`SMTP AUTH ${res.code}`);
  await writeCmd(conn, btoa(user));
  res = await readResponse(conn);
  if (res.code !== 334) throw new Error(`SMTP USER ${res.code}`);
  await writeCmd(conn, btoa(pass));
  res = await readResponse(conn);
  if (res.code !== 235) throw new Error(`SMTP login rejected ${res.code}`);

  const fromHeader = `${fromName} <${fromEmail}>`;
  await writeCmd(conn, `MAIL FROM:<${fromEmail}>`);
  res = await readResponse(conn);
  if (res.code !== 250) throw new Error(`SMTP MAIL ${res.code}`);
  await writeCmd(conn, `RCPT TO:<${msg.to}>`);
  res = await readResponse(conn);
  if (res.code !== 250 && res.code !== 251) throw new Error(`SMTP RCPT ${res.code}`);
  await writeCmd(conn, 'DATA');
  res = await readResponse(conn);
  if (res.code !== 354) throw new Error(`SMTP DATA ${res.code}`);

  const boundary = 'momos_' + crypto.randomUUID().replace(/-/g, '');
  const html = msg.html || `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${msg.text.replace(/</g, '&lt;')}</pre>`;
  const data = [
    `From: ${fromHeader}`,
    `To: ${msg.to}`,
    `Subject: ${msg.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    msg.text,
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
    `--${boundary}--`,
    '.',
  ].join('\r\n');
  await conn.write(new TextEncoder().encode(data + '\r\n'));
  res = await readResponse(conn);
  if (res.code !== 250) throw new Error(`SMTP send ${res.code}`);
  await writeCmd(conn, 'QUIT');
  try { conn.close(); } catch { /* ignore */ }
}
