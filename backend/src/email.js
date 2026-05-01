const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'emails');

let resendClient = null;
function getResend() {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  try {
    const { Resend } = require('resend');
    resendClient = new Resend(apiKey);
    return resendClient;
  } catch (err) {
    console.warn('resend package not available:', err.message);
    return null;
  }
}

function loadTemplate(name) {
  const file = path.join(TEMPLATES_DIR, `${name}.html`);
  return fs.readFileSync(file, 'utf8');
}

function render(template, vars) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    vars[key] === undefined || vars[key] === null ? '' : String(vars[key])
  );
}

async function sendEmail({ to, subject, template, vars }) {
  const from = process.env.EMAIL_FROM || 'QR Jidelnicek <onboarding@resend.dev>';
  const html = render(loadTemplate(template), vars || {});

  const client = getResend();
  if (!client) {
    console.log(`[email:dry-run] to=${to} subject="${subject}" template=${template}`);
    return { dryRun: true };
  }

  try {
    const result = await client.emails.send({ from, to, subject, html });
    return result;
  } catch (err) {
    console.error('Resend send failed:', err.message);
    return { error: err.message };
  }
}

module.exports = { sendEmail };
