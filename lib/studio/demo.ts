import { randomUUID, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { hashPassword } from '@/lib/auth/password';
import { transaction, log } from './mutations';
export const sampleInvoices = [
  {
    name: 'Arjun & Ananya',
    number: 'INV-0001',
    job: 'Wedding photography',
    total: 55000,
    paid: 20000,
    due: '2026-11-27',
  },
  {
    name: 'Bhavna Shah',
    number: 'INV-0002',
    job: 'Engagement portraits',
    total: 12000,
    paid: 0,
    due: '2026-12-03',
  },
  {
    name: 'Mira Kapoor',
    number: 'INV-0003',
    job: 'Album retouching',
    total: 6500,
    paid: 0,
    due: '2026-11-12',
  },
  {
    name: 'Kiran Iyer',
    number: 'INV-0004',
    job: 'Pre-wedding shoot',
    total: 8500,
    paid: 8500,
    due: '2026-11-15',
  },
];
import { demoBills as sampleBills } from '@/lib/finance/sample';
export async function seed(c: PoolClient, b: string, u: string) {
  for (const r of sampleInvoices) {
    const client = randomUUID(),
      i = randomUUID();
    await c.query(
      'INSERT INTO clients(id,business_id,name,notes) VALUES($1,$2,$3,$4)',
      [client, b, r.name, 'Sample photography client'],
    );
    await c.query(
      'INSERT INTO invoices(id,business_id,client_id,invoice_number,issue_date,due_date,status,subtotal_paise,total_paise) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)',
      [
        i,
        b,
        client,
        r.number,
        '2026-11-01',
        r.due,
        r.paid === r.total ? 'PAID' : r.paid ? 'PARTIALLY_PAID' : 'ISSUED',
        r.total * 100,
      ],
    );
    await c.query(
      'INSERT INTO invoice_items(invoice_id,description,quantity,unit_price_paise,line_total_paise) VALUES($1,$2,1,$3,$3)',
      [i, r.job, r.total * 100],
    );
    if (r.paid)
      await c.query(
        "INSERT INTO payments(business_id,invoice_id,amount_paise,received_date,method) VALUES($1,$2,$3,'2026-11-10','Sample owner entry')",
        [b, i, r.paid * 100],
      );
    if (r.number === 'INV-0001')
      await c.query(
        "INSERT INTO payment_promises(business_id,invoice_id,promised_amount_paise,promised_date,source_note,confirmation_status,paid_at_confirmation) VALUES($1,$2,3500000,'2026-11-27','Arjun confirmed the remaining ₹35,000 for 27 November.','CONFIRMED',2000000)",
        [b, i],
      );
    await log(c, b, u, 'Sample invoice imported', 'invoice', i, null, {
      number: r.number,
    });
  }
  for (const bill of sampleBills)
    await c.query(
      'INSERT INTO expenses(business_id,description,category,amount_paise,due_date) VALUES($1,$2,$3,$4,$5)',
      [b, bill.name, bill.category, bill.amount * 100, bill.due],
    );
}
export async function createDemo() {
  const hash = await hashPassword(randomBytes(32).toString('hex'));
  return transaction(async (c) => {
    const u = randomUUID(),
      b = randomUUID();
    await c.query(
      'INSERT INTO users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',
      [u, 'demo-' + u + '@example.invalid', 'Studio owner', hash],
    );
    await c.query(
      "INSERT INTO businesses(id,name,business_type,owner_user_id,opening_balance_paise,opening_balance_date,is_demo) VALUES($1,'Aperture Studio','Wedding photography',$2,1800000,'2026-11-21',true)",
      [b, u],
    );
    await c.query(
      "INSERT INTO business_memberships(business_id,user_id,role) VALUES($1,$2,'OWNER')",
      [b, u],
    );
    await seed(c, b, u);
    return u;
  });
}
