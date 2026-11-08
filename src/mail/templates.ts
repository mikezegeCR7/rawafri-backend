/**
 * Every email RawAfri sends. Each function returns a subject and HTML body
 * built on one shared layout, so all emails look alike and are easy to change.
 *
 * Anything a person typed (names, notes, reasons, complaint text) goes
 * through `esc()` before it reaches the HTML.
 */

export type EmailContent = { subject: string; html: string };

/**
 * Plain-text copy of an email, sent alongside the HTML. Mail apps show it
 * as plain text (nothing in it is run or rendered), and spam filters trust
 * messages that carry one. Built from the HTML so the two never drift.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    // Links become "Label: https://…" so they stay usable.
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      return text && text !== href ? `${text}: ${href}` : href;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|tr|table|li)>/gi, '\n')
    .replace(/<\/td>/gi, '  ')
    .replace(/<hr[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const COLORS = {
  cocoa: '#3a2418',
  cream: '#faf6ee',
  card: '#ffffff',
  border: '#ece3d3',
  muted: '#7a6a5c',
  green: '#1f5c3a',
  terracotta: '#b5532f',
  noteBg: '#fbf3e2',
};

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Whole naira normally; kobo only when present (matches the storefront). */
export function naira(amount: unknown): string {
  const n = Number(amount ?? 0);
  return `₦${n.toLocaleString('en-NG', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** The storefront address, for links in emails. */
export function siteUrl(): string {
  const configured =
    process.env.FRONTEND_URL ?? process.env.ALLOWED_ORIGINS?.split(',')[0];
  return (configured?.trim() || 'http://localhost:5173').replace(/\/$/, '');
}

const p = (html: string) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${COLORS.cocoa}">${html}</p>`;

const small = (html: string) =>
  `<p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:${COLORS.muted}">${html}</p>`;

const button = (label: string, href: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px">
    <tr><td style="border-radius:8px;background:${COLORS.green}">
      <a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(label)}</a>
    </td></tr>
  </table>`;

const box = (inner: string, bg: string = COLORS.cream) => `
  <div style="margin:18px 0;padding:14px 16px;border-radius:10px;background:${bg};border:1px solid ${COLORS.border}">${inner}</div>`;

const code = (otp: string) => `
  <div style="margin:20px 0;padding:16px;border-radius:10px;background:${COLORS.cream};border:1px solid ${COLORS.border};text-align:center">
    <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:${COLORS.cocoa};font-family:Consolas,Menlo,monospace">${esc(otp)}</span>
  </div>`;

const rows = (pairs: [string, string][]) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${COLORS.cocoa}">
    ${pairs
      .map(
        ([k, v]) => `
      <tr>
        <td style="padding:6px 0;color:${COLORS.muted}">${k}</td>
        <td style="padding:6px 0;text-align:right;font-weight:600">${v}</td>
      </tr>`,
      )
      .join('')}
  </table>`;

// `_summary` is kept for readability at call sites; hidden preview text is
// deliberately not rendered, because spam filters count hidden text against us.
function layout(heading: string, body: string, _summary = ''): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.cream};font-family:Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.cream}">
    <tr><td align="center" style="padding:28px 14px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
        <tr><td style="padding:0 4px 16px;font-size:22px;font-weight:700;color:${COLORS.cocoa};font-family:Georgia,serif">RawAfri</td></tr>
        <tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:14px;padding:28px 26px">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${COLORS.cocoa};font-family:Georgia,serif;font-weight:700">${heading}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:16px 4px 0;font-size:12px;line-height:1.5;color:${COLORS.muted}">
          You're receiving this because you have an account at RawAfri.<br>
          Need help? Visit <a href="${siteUrl()}/help" style="color:${COLORS.muted}">${siteUrl().replace(/^https?:\/\//, '')}/help</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const orderLink = (orderId: string) => `${siteUrl()}/orders/${orderId}`;

// ─── Shared shapes ──────────────────────────────────────────────────────────

export type EmailOrderItem = {
  productName: string;
  unitName: string;
  quantity: number;
  lineTotal: unknown;
  note?: string | null;
};

export type EmailOrder = {
  id: string;
  orderNumber: string;
  subtotal: unknown;
  discountAmount: unknown;
  deliveryFee: unknown;
  totalAmount: unknown;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  items: EmailOrderItem[];
};

export type EmailBankAccount = {
  bankName: string;
  accountName: string;
  accountNumber: string;
};

const unitLabel = (unitName: string) =>
  unitName.toLowerCase() === 'unit' ? '' : ` · ${esc(unitName)}`;

function itemsTable(items: EmailOrderItem[]): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${COLORS.cocoa};border-top:1px solid ${COLORS.border}">
    ${items
      .map(
        (i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border}">
          <strong>${esc(i.productName)}</strong><span style="color:${COLORS.muted}">${unitLabel(i.unitName)}</span><br>
          <span style="color:${COLORS.muted};font-size:13px">Qty ${i.quantity}</span>
          ${
            i.note
              ? `<div style="margin-top:6px;padding:6px 9px;border-radius:6px;background:${COLORS.noteBg};font-size:13px">Your note: ${esc(i.note)}</div>`
              : ''
          }
        </td>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};text-align:right;vertical-align:top;font-weight:600;white-space:nowrap">${naira(i.lineTotal)}</td>
      </tr>`,
      )
      .join('')}
  </table>`;
}

function totals(order: EmailOrder): string {
  const pairs: [string, string][] = [['Subtotal', naira(order.subtotal)]];
  if (Number(order.discountAmount ?? 0) > 0) {
    pairs.push(['Discount', `−${naira(order.discountAmount)}`]);
  }
  pairs.push(['Delivery', naira(order.deliveryFee)]);
  pairs.push(['<strong style="color:#3a2418">Total</strong>', naira(order.totalAmount)]);
  return rows(pairs);
}

function bankDetails(accounts: EmailBankAccount[], amount: unknown, orderNumber: string): string {
  if (accounts.length === 0) {
    return box(p('Our bank details are shown on your order page. Please pay the exact amount below.'));
  }
  return box(`
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${COLORS.cocoa}">Pay by bank transfer</p>
    ${accounts
      .map((a) =>
        rows([
          ['Bank', esc(a.bankName)],
          ['Account name', esc(a.accountName)],
          ['Account number', `<span style="font-family:Consolas,Menlo,monospace;letter-spacing:1px">${esc(a.accountNumber)}</span>`],
        ]),
      )
      .join('<hr style="border:none;border-top:1px solid #ece3d3;margin:8px 0">')}
    <hr style="border:none;border-top:1px solid ${COLORS.border};margin:8px 0">
    ${rows([
      ['Amount to send', naira(amount)],
      ['Use as reference', esc(orderNumber)],
    ])}`);
}

// ─── Account ────────────────────────────────────────────────────────────────

export function welcomeEmail(firstName: string): EmailContent {
  return {
    subject: 'Welcome to RawAfri',
    html: layout(
      `Welcome, ${esc(firstName)}`,
      p('Your RawAfri account is ready. Fresh food straight from the market, delivered to your door.') +
        p('Here is how it works: choose your items, place your order, pay by bank transfer, and our team prepares your order as soon as your payment is confirmed.') +
        button('Start shopping', siteUrl()),
      'Your RawAfri account is ready.',
    ),
  };
}

export function passwordResetCodeEmail(otp: string): EmailContent {
  return {
    subject: `Your RawAfri password reset code: ${otp}`,
    html: layout(
      'Reset your password',
      p('Use this code to reset your password:') +
        code(otp) +
        small('The code expires in 10 minutes.') +
        small("If you didn't ask to reset your password, you can ignore this email — your password stays the same."),
      'Your password reset code',
    ),
  };
}

export function passwordChangedEmail(firstName: string): EmailContent {
  return {
    subject: 'Your RawAfri password was changed',
    html: layout(
      'Your password was changed',
      p(`Hi ${esc(firstName)}, the password for your RawAfri account was just changed, and you've been signed out on your other devices.`) +
        box(p("<strong>Wasn't you?</strong> Reset your password straight away and contact us so we can secure your account.")) +
        button('Reset password', `${siteUrl()}/forgot-password`),
      'Your password was changed.',
    ),
  };
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export function orderPlacedEmail(
  firstName: string,
  order: EmailOrder,
  accounts: EmailBankAccount[],
): EmailContent {
  return {
    subject: `Order ${order.orderNumber} received — please complete your payment`,
    html: layout(
      'Thank you, your order is in',
      p(`Hi ${esc(firstName)}, we've received order <strong>${esc(order.orderNumber)}</strong>. To get it moving, transfer the total below and upload your receipt on your order page.`) +
        bankDetails(accounts, order.totalAmount, order.orderNumber) +
        itemsTable(order.items) +
        `<div style="height:8px"></div>` +
        totals(order) +
        box(
          `<p style="margin:0 0 4px;font-size:13px;color:${COLORS.muted}">Delivering to</p>` +
            `<p style="margin:0;font-size:14px;color:${COLORS.cocoa}">${esc(order.deliveryAddress)}, ${esc(order.deliveryCity)}, ${esc(order.deliveryState)}</p>`,
        ) +
        button('Upload your receipt', orderLink(order.id)),
      `Pay ${naira(order.totalAmount)} to complete order ${order.orderNumber}.`,
    ),
  };
}

const STATUS_COPY: Record<string, { subject: string; heading: string; body: string }> = {
  AWAITING_PAYMENT: {
    subject: "We're waiting for your payment",
    heading: "We're waiting for your payment",
    body: 'Your order is reserved. Transfer the total and upload your receipt on your order page so we can start preparing it.',
  },
  PAYMENT_CONFIRMED: {
    subject: 'Payment confirmed',
    heading: 'Your payment is confirmed',
    body: "We've confirmed your payment. Your order is next in line to be prepared.",
  },
  PREPARING_ORDER: {
    subject: "We're preparing your order",
    heading: "We're preparing your order",
    body: 'Our team is getting your items ready, following any notes you left.',
  },
  OUT_FOR_DELIVERY: {
    subject: 'Your order is on its way',
    heading: 'Your order is on its way',
    body: 'Your order has left us and is heading to you. Please keep your phone close so our rider can reach you.',
  },
  AWAITING_CUSTOMER_CONFIRMATION: {
    subject: 'Your order has arrived — please confirm',
    heading: 'Your order has arrived',
    body: 'Once you have your items, please confirm delivery on your order page. That lets us close the order.',
  },
  DELIVERED: {
    subject: 'Order delivered — thank you',
    heading: 'Delivered. Enjoy!',
    body: "Your order is complete. Thank you for shopping with RawAfri — we'd love to serve you again.",
  },
  CANCELLED: {
    subject: 'Your order was cancelled',
    heading: 'Your order was cancelled',
    body: "This order has been cancelled. If you already paid, our team will contact you about your refund. If you have questions, reply through the Help page.",
  },
};

export function orderStatusEmail(
  firstName: string,
  order: Pick<EmailOrder, 'id' | 'orderNumber' | 'totalAmount'>,
  status: string,
  note?: string | null,
): EmailContent {
  const copy = STATUS_COPY[status] ?? {
    subject: 'Your order was updated',
    heading: 'Your order was updated',
    body: 'There is an update on your order.',
  };
  return {
    subject: `${copy.subject} · ${order.orderNumber}`,
    html: layout(
      copy.heading,
      p(`Hi ${esc(firstName)},`) +
        p(copy.body) +
        (note ? box(p(`<strong>Message from our team:</strong> ${esc(note)}`)) : '') +
        rows([
          ['Order', esc(order.orderNumber)],
          ['Total', naira(order.totalAmount)],
        ]) +
        button('View your order', orderLink(order.id)),
      `${copy.heading} — order ${order.orderNumber}`,
    ),
  };
}

export function deliveryCodeEmail(orderNumber: string, otp: string): EmailContent {
  return {
    subject: `Your delivery confirmation code: ${otp}`,
    html: layout(
      'Confirm your delivery',
      p(`Here is the code to confirm you've received order <strong>${esc(orderNumber)}</strong>:`) +
        code(otp) +
        small('Enter it on your order page. It expires in 10 minutes.') +
        small("Only share this code once you have your items in hand."),
      'Your delivery confirmation code',
    ),
  };
}

// ─── Payments ───────────────────────────────────────────────────────────────

export function receiptReceivedEmail(
  firstName: string,
  order: Pick<EmailOrder, 'id' | 'orderNumber' | 'totalAmount'>,
): EmailContent {
  return {
    subject: `We received your receipt · ${order.orderNumber}`,
    html: layout(
      "We've got your receipt",
      p(`Hi ${esc(firstName)}, thanks for uploading your payment receipt for order <strong>${esc(order.orderNumber)}</strong>.`) +
        p("Our team is checking it against our bank account now. We'll email you as soon as it's confirmed.") +
        rows([['Amount', naira(order.totalAmount)]]) +
        button('View your order', orderLink(order.id)),
      'Your receipt is being checked.',
    ),
  };
}

export function paymentVerifiedEmail(
  firstName: string,
  order: Pick<EmailOrder, 'id' | 'orderNumber' | 'totalAmount'>,
): EmailContent {
  return {
    subject: `Payment confirmed · ${order.orderNumber}`,
    html: layout(
      'Your payment is confirmed',
      p(`Hi ${esc(firstName)}, good news — we've confirmed your payment of <strong>${naira(order.totalAmount)}</strong> for order <strong>${esc(order.orderNumber)}</strong>.`) +
        p("We're preparing your order now and will let you know when it's on its way.") +
        button('Track your order', orderLink(order.id)),
      `Payment of ${naira(order.totalAmount)} confirmed.`,
    ),
  };
}

export function paymentRejectedEmail(
  firstName: string,
  order: Pick<EmailOrder, 'id' | 'orderNumber' | 'totalAmount'>,
  reason: string,
): EmailContent {
  return {
    subject: `Action needed: we couldn't confirm your payment · ${order.orderNumber}`,
    html: layout(
      "We couldn't confirm your payment",
      p(`Hi ${esc(firstName)}, we weren't able to confirm the payment for order <strong>${esc(order.orderNumber)}</strong>.`) +
        box(p(`<strong>Reason:</strong> ${esc(reason)}`), COLORS.noteBg) +
        p(`Please check the transfer and upload a clear receipt for <strong>${naira(order.totalAmount)}</strong> on your order page.`) +
        button('Upload a new receipt', orderLink(order.id)),
      "We couldn't confirm your payment.",
    ),
  };
}

// ─── Complaints ─────────────────────────────────────────────────────────────

const COMPLAINT_STATUS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'Being handled',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export function complaintReceivedEmail(
  firstName: string,
  subject: string,
  message: string,
  orderNumber?: string | null,
): EmailContent {
  return {
    subject: `We received your complaint: ${subject}`,
    html: layout(
      "We've received your complaint",
      p(`Hi ${esc(firstName)}, thanks for letting us know. Our team will look into it and get back to you.`) +
        box(
          `<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${COLORS.cocoa}">${esc(subject)}</p>` +
            (orderNumber ? small(`Order ${esc(orderNumber)}`) : '') +
            `<p style="margin:0;font-size:14px;line-height:1.6;color:${COLORS.cocoa};white-space:pre-line">${esc(message)}</p>`,
        ) +
        button('Go to Help', `${siteUrl()}/help`),
      "We've received your complaint.",
    ),
  };
}

export function complaintUpdatedEmail(
  firstName: string,
  subject: string,
  status: string,
  adminResponse?: string | null,
): EmailContent {
  const label = COMPLAINT_STATUS[status] ?? status;
  return {
    subject: `Update on your complaint: ${subject}`,
    html: layout(
      'There is an update on your complaint',
      p(`Hi ${esc(firstName)}, your complaint <strong>"${esc(subject)}"</strong> is now <strong>${esc(label)}</strong>.`) +
        (adminResponse ? box(p(`<strong>Our response:</strong><br>${esc(adminResponse).replace(/\n/g, '<br>')}`)) : '') +
        button('Go to Help', `${siteUrl()}/help`),
      `Your complaint is now ${label}.`,
    ),
  };
}

// ─── Admin alerts ───────────────────────────────────────────────────────────

const adminLink = () => `${siteUrl()}/admin`;

export function adminNewOrderEmail(order: EmailOrder, customerName: string): EmailContent {
  const notes = order.items.filter((i) => i.note).length;
  return {
    subject: `New order ${order.orderNumber} — ${naira(order.totalAmount)}`,
    html: layout(
      'New order received',
      p(`<strong>${esc(customerName)}</strong> placed order <strong>${esc(order.orderNumber)}</strong>. It's waiting for their payment.`) +
        (notes > 0 ? box(p(`This order has <strong>${notes}</strong> item note${notes === 1 ? '' : 's'} — check them before packing.`), COLORS.noteBg) : '') +
        itemsTable(order.items).replace(/Your note:/g, 'Customer note:') +
        `<div style="height:8px"></div>` +
        totals(order) +
        button('Open admin', adminLink()),
      `${customerName} ordered ${naira(order.totalAmount)}.`,
    ),
  };
}

export function adminReceiptUploadedEmail(
  orderNumber: string,
  customerName: string,
  amount: unknown,
): EmailContent {
  return {
    subject: `Receipt to check — ${orderNumber}`,
    html: layout(
      'A payment receipt needs checking',
      p(`<strong>${esc(customerName)}</strong> uploaded a receipt for order <strong>${esc(orderNumber)}</strong>.`) +
        rows([['Expected amount', naira(amount)]]) +
        p('Check it against the bank account, then verify or reject it under Payments.') +
        button('Open admin', adminLink()),
      `Receipt uploaded for ${orderNumber}.`,
    ),
  };
}

export function adminNewComplaintEmail(
  customerName: string,
  subject: string,
  message: string,
  orderNumber?: string | null,
): EmailContent {
  return {
    subject: `New complaint: ${subject}`,
    html: layout(
      'New complaint',
      p(`<strong>${esc(customerName)}</strong> filed a complaint${orderNumber ? ` about order <strong>${esc(orderNumber)}</strong>` : ''}.`) +
        box(
          `<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${COLORS.cocoa}">${esc(subject)}</p>` +
            `<p style="margin:0;font-size:14px;line-height:1.6;color:${COLORS.cocoa};white-space:pre-line">${esc(message)}</p>`,
        ) +
        button('Open admin', adminLink()),
      `${customerName}: ${subject}`,
    ),
  };
}
