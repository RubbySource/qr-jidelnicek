const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'emails');
const FROM = process.env.EMAIL_FROM || 'QR Jidelnicek <onboarding@resend.dev>';

let resendClient = null;
function getClient() {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const { Resend } = require('resend');
  resendClient = new Resend(apiKey);
  return resendClient;
}

function loadTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.html`), 'utf8');
}

function render(template, vars) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    vars[key] === undefined || vars[key] === null ? '' : String(vars[key])
  );
}

function getLoginUrl() {
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
  return `${base.replace(/\/$/, '')}/login`;
}

async function send({ to, subject, template, vars }) {
  const client = getClient();
  if (!client) {
    console.warn(`[emailService] RESEND_API_KEY missing — skipping send to=${to} subject="${subject}"`);
    return { ok: false, reason: 'no-api-key' };
  }
  const html = render(loadTemplate(template), vars);
  try {
    const result = await client.emails.send({ from: FROM, to, subject, html });
    return { ok: true, id: result?.data?.id || null };
  } catch (err) {
    console.error('[emailService] send failed:', err.message);
    return { ok: false, reason: 'send-error', error: err.message };
  }
}

async function sendWelcomeEmail(to, restaurantName) {
  return send({
    to,
    subject: 'Vítejte v QR Jídelníček Pro',
    template: 'welcome',
    vars: {
      restaurantName,
      loginUrl: getLoginUrl(),
      daysLeft: '',
    },
  });
}

async function sendTrialExpiringEmail(to, restaurantName, daysLeft) {
  return send({
    to,
    subject: `Váš trial končí za ${daysLeft} ${daysLeft === 1 ? 'den' : daysLeft < 5 ? 'dny' : 'dní'}`,
    template: 'trial-expiring',
    vars: {
      restaurantName,
      daysLeft: String(daysLeft),
      loginUrl: getLoginUrl(),
    },
  });
}

module.exports = { sendWelcomeEmail, sendTrialExpiringEmail };
