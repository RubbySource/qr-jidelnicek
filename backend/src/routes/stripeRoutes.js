const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

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

router.post('/create-checkout', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe není nakonfigurován. Nastavte STRIPE_SECRET_KEY.' });
  }
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return res.status(503).json({ error: 'STRIPE_PRICE_ID není nastaven.' });
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

    const baseUrl = (process.env.PUBLIC_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/admin?stripe=success`,
      cancel_url: `${baseUrl}/admin?stripe=cancel`,
      metadata: { restaurant_id: String(r.id) },
    });

    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('Stripe create-checkout error:', err);
    res.status(500).json({ error: err.message || 'failed to create checkout session' });
  }
});

async function handleStripeWebhook(req, res) {
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
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const restaurantId = s.metadata?.restaurant_id ? Number(s.metadata.restaurant_id) : null;
        const customerId = typeof s.customer === 'string' ? s.customer : s.customer?.id || null;
        const subscriptionId = typeof s.subscription === 'string' ? s.subscription : s.subscription?.id || null;

        if (restaurantId) {
          db.prepare(
            "UPDATE restaurants SET plan = 'pro', subscription_status = 'active', stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE id = ?"
          ).run(customerId, subscriptionId, restaurantId);
        } else if (customerId) {
          db.prepare(
            "UPDATE restaurants SET plan = 'pro', subscription_status = 'active', stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE stripe_customer_id = ?"
          ).run(subscriptionId, customerId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        db.prepare(
          "UPDATE restaurants SET plan = 'free', subscription_status = 'expired' WHERE stripe_customer_id = ?"
        ).run(sub.customer);
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    res.status(500).json({ error: 'webhook handler failed' });
  }
}

module.exports = router;
module.exports.handleStripeWebhook = handleStripeWebhook;
