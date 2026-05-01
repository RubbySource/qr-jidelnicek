const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { sendEmail } = require('../email');

const router = express.Router();

const PRICE_AMOUNT = 19900;
const PRICE_CURRENCY = 'czk';

let stripeClient = null;
function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try {
    const Stripe = require('stripe');
    stripeClient = new Stripe(key, { apiVersion: '2024-06-20' });
    return stripeClient;
  } catch (err) {
    console.warn('stripe package not available:', err.message);
    return null;
  }
}

router.get('/status', requireAuth, (req, res) => {
  const r = db.prepare(
    'SELECT id, name, slug, email, plan, subscription_status, trial_expires_at, stripe_customer_id, stripe_subscription_id FROM restaurants WHERE id = ?'
  ).get(req.user.id);
  if (!r) return res.status(404).json({ error: 'not found' });

  let daysLeft = null;
  if (r.trial_expires_at) {
    const ms = new Date(r.trial_expires_at + 'Z').getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  res.json({
    subscription_status: r.subscription_status,
    plan: r.plan,
    trial_expires_at: r.trial_expires_at,
    days_left: daysLeft,
    has_subscription: !!r.stripe_subscription_id,
    price_czk: PRICE_AMOUNT / 100,
  });
});

router.post('/checkout', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe není nakonfigurován. Nastavte STRIPE_SECRET_KEY.' });
  }

  const r = db.prepare(
    'SELECT id, name, email, slug, stripe_customer_id FROM restaurants WHERE id = ?'
  ).get(req.user.id);
  if (!r) return res.status(404).json({ error: 'not found' });

  try {
    let customerId = r.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: r.email,
        name: r.name,
        metadata: { restaurant_id: String(r.id), slug: r.slug },
      });
      customerId = customer.id;
      db.prepare('UPDATE restaurants SET stripe_customer_id = ? WHERE id = ?').run(customerId, r.id);
    }

    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: PRICE_CURRENCY,
            product_data: { name: 'QR Jídelníček Pro — měsíční předplatné' },
            unit_amount: PRICE_AMOUNT,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl.replace(/\/$/, '')}/admin?billing=success`,
      cancel_url: `${baseUrl.replace(/\/$/, '')}/admin?billing=cancel`,
      metadata: { restaurant_id: String(r.id) },
    });

    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: err.message || 'failed to create checkout session' });
  }
});

async function handleWebhook(req, res) {
  const stripe = getStripe();
  if (!stripe) return res.status(503).send('stripe not configured');

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (secret) {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } else {
      event = JSON.parse(req.body.toString('utf8'));
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object;
        const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'expired';
        db.prepare(
          'UPDATE restaurants SET subscription_status = ?, stripe_subscription_id = ?, plan = ? WHERE stripe_customer_id = ?'
        ).run(status, sub.id, status === 'active' ? 'pro' : 'trial', sub.customer);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        db.prepare(
          "UPDATE restaurants SET subscription_status = 'expired', plan = 'trial' WHERE stripe_customer_id = ?"
        ).run(sub.customer);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const r = db.prepare(
          'SELECT id, name, email, slug FROM restaurants WHERE stripe_customer_id = ?'
        ).get(invoice.customer);
        if (r) {
          db.prepare(
            "UPDATE restaurants SET subscription_status = 'active', plan = 'pro' WHERE id = ?"
          ).run(r.id);

          const amount = ((invoice.amount_paid || PRICE_AMOUNT) / 100).toLocaleString('cs-CZ');
          const nextBilling = invoice.lines?.data?.[0]?.period?.end
            ? new Date(invoice.lines.data[0].period.end * 1000).toLocaleDateString('cs-CZ')
            : '—';
          const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
          sendEmail({
            to: r.email,
            subject: 'Platba potvrzena — QR Jídelníček Pro',
            template: 'payment-confirmed',
            vars: {
              restaurantName: r.name,
              amount,
              nextBillingAt: nextBilling,
              adminUrl: `${baseUrl.replace(/\/$/, '')}/admin`,
            },
          }).catch((e) => console.error('payment-confirmed email error:', e));
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        db.prepare(
          "UPDATE restaurants SET subscription_status = 'expired' WHERE stripe_customer_id = ?"
        ).run(invoice.customer);
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'webhook handler failed' });
  }
}

module.exports = router;
module.exports.handleWebhook = handleWebhook;
