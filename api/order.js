/**
 * api/order.js — Ruhanvi Backend (Vercel Serverless)
 * Handles: orders + soulstar signups
 *
 * Environment variables needed in Vercel:
 *   JSONBIN_BIN_ID        (orders bin)
 *   JSONBIN_SOULSTAR_ID   (soulsars bin)  ← create a 2nd bin for this
 *   JSONBIN_API_KEY       (master key, same for both)
 *   ORDER_SECRET          ruhanvi2025secret
 *   ADMIN_EMAIL           hello@ruhanvi.com
 */

const ORDERS_BIN   = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`;
const SOULSARS_BIN = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_SOULSTAR_ID}`;
const API_KEY      = process.env.JSONBIN_API_KEY;
const SECRET       = process.env.ORDER_SECRET || 'ruhanvi2025secret';

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readBin(binUrl) {
  const r = await fetch(`${binUrl}/latest`, {
    headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' }
  });
  if (!r.ok) throw new Error('JSONBin read failed: ' + r.status);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

async function writeBin(binUrl, data) {
  const r = await fetch(binUrl, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
    body:    JSON.stringify(data)
  });
  if (!r.ok) throw new Error('JSONBin write failed: ' + r.status);
}

function addWorkingDays(days) {
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function nowFormatted() {
  return new Date().toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const action = req.query.action || 'save';

  try {

    // LIST ORDERS
    if (action === 'list') {
      if (req.query.secret !== SECRET) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
      const orders = await readBin(ORDERS_BIN);
      res.status(200).json({ success: true, orders });
      return;
    }

    // SAVE ORDER
    if (action === 'save') {
      if (req.method !== 'POST') { res.status(405).end(); return; }
      const body = req.body || {};
      if (body.secret !== SECRET) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
      const order = {
        id:           Date.now().toString() + Math.floor(Math.random() * 1000),
        customerName: String(body.name      || 'Unknown').slice(0, 200),
        email:        String(body.email     || '').slice(0, 200),
        phone:        String(body.phone     || '').slice(0, 50),
        address:      String(body.address   || '').slice(0, 500),
        products:     String(body.products  || '').slice(0, 1000),
        amount:       parseInt(body.amount) || 0,
        shipping:     String(body.shipping  || '').slice(0, 100),
        paymentId:    String(body.paymentId || '').slice(0, 100),
        notes:        body.notes ? String(body.notes).slice(0, 300) : ('Razorpay ID: ' + String(body.paymentId || '')),
        date:         nowFormatted(),
        rawDate:      new Date().toISOString().split('T')[0],
        deliveryDate: addWorkingDays(7),
        status:       'pending',
      };
      const orders = await readBin(ORDERS_BIN);
      orders.unshift(order);
      await writeBin(ORDERS_BIN, orders);
      res.status(200).json({ success: true, id: order.id });
      return;
    }

    // UPDATE ORDER STATUS
    if (action === 'update') {
      if (req.method !== 'POST') { res.status(405).end(); return; }
      const body = req.body || {};
      if (body.secret !== SECRET) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
      const orders = await readBin(ORDERS_BIN);
      const idx = orders.findIndex(o => String(o.id) === String(body.id));
      if (idx === -1) { res.status(404).json({ success: false, error: 'Order not found' }); return; }
      orders[idx].status = String(body.status).slice(0, 50);
      await writeBin(ORDERS_BIN, orders);
      res.status(200).json({ success: true });
      return;
    }

    // DELETE ORDER
    if (action === 'delete') {
      if (req.method !== 'POST') { res.status(405).end(); return; }
      const body = req.body || {};
      if (body.secret !== SECRET) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
      const orders = await readBin(ORDERS_BIN);
      await writeBin(ORDERS_BIN, orders.filter(o => String(o.id) !== String(body.id)));
      res.status(200).json({ success: true });
      return;
    }

    // SAVE SOULSTAR SIGNUP (public — no secret needed)
    if (action === 'soulstar-save') {
      if (req.method !== 'POST') { res.status(405).end(); return; }
      const body = req.body || {};
      const entry = {
        id:    Date.now().toString(),
        name:  String(body.name  || '').slice(0, 200),
        email: String(body.email || '').slice(0, 200),
        phone: String(body.phone || '').slice(0, 50),
        date:  nowFormatted(),
      };
      const soulsars = await readBin(SOULSARS_BIN);
      soulsars.unshift(entry);
      await writeBin(SOULSARS_BIN, soulsars);
      res.status(200).json({ success: true });
      return;
    }

    // LIST SOULSARS (admin only)
    if (action === 'soulstar-list') {
      if (req.query.secret !== SECRET) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
      const soulsars = await readBin(SOULSARS_BIN);
      res.status(200).json({ success: true, soulsars });
      return;
    }

    // CLEAR ALL SOULSARS
    if (action === 'soulstar-clear') {
      if (req.method !== 'POST') { res.status(405).end(); return; }
      const body = req.body || {};
      if (body.secret !== SECRET) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
      await writeBin(SOULSARS_BIN, []);
      res.status(200).json({ success: true });
      return;
    }

    res.status(400).json({ success: false, error: 'Unknown action' });

  } catch (err) {
    console.error('[order.js error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}/**
 * api/order.js — Ruhanvi Backend (Vercel Serverless)
 * Handles: orders + soulstar signups
 *
 * Environment variables needed in Vercel:
 *   JSONBIN_BIN_ID        (orders bin)
 *   JSONBIN_SOULSTAR_ID   (soulsars bin)  ← create a 2nd bin for this
 *   JSONBIN_API_KEY       (master key, same for both)
 *   ORDER_SECRET          ruhanvi2025secret
 *   ADMIN_EMAIL           hello@ruhanvi.com
 */

const ORDERS_BIN   = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`;
const SOULSARS_BIN = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_SOULSTAR_ID}`;
const API_KEY      = process.env.JSONBIN_API_KEY;
const SECRET       = process.env.ORDER_SECRET || 'ruhanvi2025secret';

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readBin(binUrl) {
  const r = await fetch(`${binUrl}/latest`, {
    headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' }
  });
  if (!r.ok) throw new Error('JSONBin read failed: ' + r.status);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

async function writeBin(binUrl, data) {
  const r = await fetch(binUrl, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
    body:    JSON.stringify(data)
  });
  if (!r.ok) throw new Error('JSONBin write failed: ' + r.status);
}

function addWorkingDays(days) {
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function nowFormatted() {
  return new Date().toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const action = req.query.action || 'save';

  try {

    // LIST ORDERS
    if (action === 'list') {
      if (req.query.secret !== SECRET) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
      const orders = await readBin(ORDERS_BIN);
      res.status(200).json({ success: true, orders });
      return;
    }

    // SAVE ORDER
    if (action === 'save') {
      if (req.method !== 'POST') { res.status(405).end(); return; }
      const body = req.body || {};
      if (body.secret !== SECRET) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
      const order = {
        id:           Date.now().toString() + Math.floor(Math.random() * 1000),
        customerName: String(body.name      || 'Unknown').slice(0, 200),
        email:        String(body.email     || '').slice(0, 200),
        phone:        String(body.phone     || '').slice(0, 50),
        address:      String(body.address   || '').slice(0, 500),
        products:     String(body.products  || '').slice(0, 1000),
        amount:       parseInt(body.amount) || 0,
        shipping:     String(body.shipping  || '').slice(0, 100),
        paymentId:    String(body.paymentId || '').slice(0, 100),
        notes:        body.notes ? String(body.notes).slice(0, 300) : ('Razorpay ID: ' + String(body.paymentId || '')),
        date:         nowFormatted(),
        rawDate:      new Date().toISOString().split('T')[0],
        deliveryDate: addWorkingDays(7),
        status:       'pending',
      };
      const orders = await readBin(ORDERS_BIN);
      orders.unshift(order);
      await writeBin(ORDERS_BIN, orders);
      res.status(200).json({ success: true, id: order.id });
      return;
    }

    // UPDATE ORDER STATUS
    if (action === 'update') {
      if (req.method !== 'POST') { res.status(405).end(); return; }
      const body = req.body || {};
      if (body.secret !== SECRET) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
      const orders = await readBin(ORDERS_BIN);
      const idx = orders.findIndex(o => String(o.id) === String(body.id));
      if (idx === -1) { res.status(404).json({ success: false, error: 'Order not found' }); return; }
      orders[idx].status = String(body.status).slice(0, 50);
      await writeBin(ORDERS_BIN, orders);
      res.status(200).json({ success: true });
      return;
    }

    // DELETE ORDER
    if (action === 'delete') {
      if (req.method !== 'POST') { res.status(405).end(); return; }
      const body = req.body || {};
      if (body.secret !== SECRET) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
      const orders = await readBin(ORDERS_BIN);
      await writeBin(ORDERS_BIN, orders.filter(o => String(o.id) !== String(body.id)));
      res.status(200).json({ success: true });
      return;
    }

    // SAVE SOULSTAR SIGNUP (public — no secret needed)
    if (action === 'soulstar-save') {
      if (req.method !== 'POST') { res.status(405).end(); return; }
      const body = req.body || {};
      const entry = {
        id:    Date.now().toString(),
        name:  String(body.name  || '').slice(0, 200),
        email: String(body.email || '').slice(0, 200),
        phone: String(body.phone || '').slice(0, 50),
        date:  nowFormatted(),
      };
      const soulsars = await readBin(SOULSARS_BIN);
      soulsars.unshift(entry);
      await writeBin(SOULSARS_BIN, soulsars);
      res.status(200).json({ success: true });
      return;
    }

    // LIST SOULSARS (admin only)
    if (action === 'soulstar-list') {
      if (req.query.secret !== SECRET) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
      const soulsars = await readBin(SOULSARS_BIN);
      res.status(200).json({ success: true, soulsars });
      return;
    }

    // CLEAR ALL SOULSARS
    if (action === 'soulstar-clear') {
      if (req.method !== 'POST') { res.status(405).end(); return; }
      const body = req.body || {};
      if (body.secret !== SECRET) { res.status(403).json({ success: false, error: 'Forbidden' }); return; }
      await writeBin(SOULSARS_BIN, []);
      res.status(200).json({ success: true });
      return;
    }

    res.status(400).json({ success: false, error: 'Unknown action' });

  } catch (err) {
    console.error('[order.js error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Ruhanvi — Order Notification API
 * Vercel Serverless Function  →  /api/order
 *
 * Receives a paid order from the frontend and:
 *   1. Sends YOU a rich HTML email notification
 *   2. Sends the CUSTOMER a confirmation email
 *
 * Uses Resend (resend.com) — free tier: 3,000 emails/month, no card needed.
 */

module.exports = async function handler(req, res) {
  // ── CORS ────────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' });

  // ── AUTH ────────────────────────────────────────────────────────────────────
  const { secret, paymentId, name, email, phone, address, products, amount, shipping } = req.body;

  if (secret !== process.env.ORDER_SECRET) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  // ── BUILD DATE STRINGS ──────────────────────────────────────────────────────
  const now = new Date();
  const fmt = (d) =>
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const deliveryDate = new Date(now);
  let days = 0;
  while (days < 7) {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
    const dow = deliveryDate.getDay();
    if (dow !== 0 && dow !== 6) days++;
  }

  // ── EMAIL TEMPLATES ─────────────────────────────────────────────────────────
  const ownerHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body{font-family:Georgia,serif;background:#FDF5F8;margin:0;padding:20px}
  .card{background:#fff;max-width:560px;margin:0 auto;border-radius:10px;border:1px solid #F0D5E0;overflow:hidden}
  .hdr{background:#8B3A5A;color:#fff;padding:24px 28px}
  .hdr h1{margin:0;font-size:20px;font-weight:normal}
  .hdr p{margin:4px 0 0;font-size:13px;opacity:.8}
  .body{padding:24px 28px}
  .row{display:flex;justify-content:space-between;border-bottom:1px solid #F0D5E0;padding:10px 0;font-size:14px}
  .lbl{color:#9C6478;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
  .val{color:#3D1A2B;font-weight:500;text-align:right;max-width:300px}
  .amt{font-size:22px;font-weight:bold;color:#8B3A5A}
  .box{background:#F0D5E0;border-radius:6px;padding:10px 14px;margin-top:14px;font-size:12px;color:#9C6478}
  .foot{background:#FCE8F0;padding:14px 28px;font-size:12px;color:#9C6478;text-align:center}
</style>
</head>
<body>
<div class="card">
  <div class="hdr">
    <h1>New Order — PAID ✅</h1>
    <p>Ruhanvi &bull; ${now.toLocaleString('en-IN')}</p>
  </div>
  <div class="body">
    <div class="row"><span class="lbl">Customer</span><span class="val">${name}</span></div>
    <div class="row"><span class="lbl">Email</span><span class="val">${email}</span></div>
    <div class="row"><span class="lbl">WhatsApp</span><span class="val">${phone}</span></div>
    <div class="row"><span class="lbl">Address</span><span class="val">${address.replace(/\n/g,'<br>')}</span></div>
    <div class="row"><span class="lbl">Products</span><span class="val">${products}</span></div>
    <div class="row"><span class="lbl">Shipping</span><span class="val">${shipping}</span></div>
    <div class="row" style="border:none;padding-top:14px">
      <span class="lbl" style="font-size:14px">Total Paid</span>
      <span class="amt">Rs.${Number(amount).toLocaleString('en-IN')}</span>
    </div>
    <div class="box">
      <strong>Razorpay ID:</strong> ${paymentId}<br>
      <strong>Est. Delivery:</strong> ${fmt(deliveryDate)}
    </div>
  </div>
  <div class="foot">Reply to this email or WhatsApp the customer to confirm dispatch.</div>
</div>
</body></html>`;

  const customerHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body{font-family:Georgia,serif;background:#FDF5F8;margin:0;padding:20px}
  .card{background:#fff;max-width:520px;margin:0 auto;border-radius:10px;border:1px solid #F0D5E0;overflow:hidden}
  .hdr{background:#8B3A5A;color:#fff;padding:28px;text-align:center}
  .hdr h1{margin:0 0 4px;font-size:22px;font-weight:normal}
  .hdr p{margin:0;font-size:13px;opacity:.75}
  .body{padding:28px;color:#3D1A2B;font-size:14px;line-height:1.8}
  .box{background:#FCE8F0;border-radius:8px;padding:14px 18px;margin:16px 0}
  .foot{text-align:center;padding:16px;font-size:12px;color:#9C6478;border-top:1px solid #F0D5E0}
</style>
</head>
<body>
<div class="card">
  <div class="hdr">
    <h1>Ruhanvi<span style="color:#F2B8CC">.</span></h1>
    <p>Soulful Guidance. Sacred Healing.</p>
  </div>
  <div class="body">
    <p>Dear ${name},</p>
    <p>Your payment of <strong>Rs.${Number(amount).toLocaleString('en-IN')}</strong> has been received and your order is confirmed. 🙏</p>
    <div class="box">
      <strong>What you ordered:</strong><br>${products}<br><br>
      <strong>Estimated Delivery:</strong> ${fmt(deliveryDate)}<br>
      <strong>Shipping to:</strong> ${address}
    </div>
    <p>We will reach out on WhatsApp once your crystals are dispatched. Each piece is cleansed and packaged with love before it leaves us.</p>
    <p>With gratitude,<br><em>Ruhanvi</em></p>
  </div>
  <div class="foot">Payment ID: ${paymentId} &bull; Questions? WhatsApp us anytime.</div>
</div>
</body></html>`;

  // ── SEND EMAILS VIA RESEND ──────────────────────────────────────────────────
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL   = process.env.NOTIFY_EMAIL;
  const FROM_EMAIL     = process.env.FROM_EMAIL;

  async function sendEmail(to, subject, html, replyTo) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     `Ruhanvi Orders <${FROM_EMAIL}>`,
        to:       [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    return r.ok;
  }

  try {
    await sendEmail(
      NOTIFY_EMAIL,
      `✅ New Paid Order — Rs.${amount} from ${name}`,
      ownerHtml,
      email
    );

    await sendEmail(
      email,
      'Your Ruhanvi order is confirmed 🌙',
      customerHtml
    );

    return res.status(200).json({ success: true, message: 'Emails sent' });
  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
