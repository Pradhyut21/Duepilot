'use client';
import { useState } from 'react';
import { Hidden, StudioForm } from '@/components/forms/StudioForm';
import { money, dayLabel } from '@/lib/studio/format';
export function Receive({
  id,
  today,
  issue,
  left,
}: {
  id: string;
  today: string;
  issue: string;
  left: number;
}) {
  const [key, setKey] = useState('');
  return (
    <StudioForm
      action="payment"
      label="Record confirmed payment"

    >
      <Hidden name="id" value={id} />
      <input type="hidden" name="key" value={key} />
      <div className="pair">
        <label>
          Received amount (₹)
          <input
            name="amount"
            required
            type="number"
            min=".01"
            step=".01"
            max={left / 100}
            onFocus={() => {
              if (!key) setKey(crypto.randomUUID());
            }}
          />
        </label>
        <label>
          Received date
          <input
            name="date"
            type="date"
            min={issue}
            max={today}
            defaultValue={today}
            required
          />
        </label>
      </div>
      <label>
        Payment method
        <input name="method" placeholder="e.g. Bank transfer" required />
      </label>
      <label>
        Reference note (optional)
        <input name="reference" />
      </label>
      <label className="check">
        <input
          name="confirmed"
          type="checkbox"
          required
          onChange={() => {
            if (!key) setKey(crypto.randomUUID());
          }}
        />
        I confirm the studio received this payment.
      </label>
    </StudioForm>
  );
}
export function Reminder({
  id,
  number,
  client,
  due,
  left,
  studio,
  existing,
}: {
  id: string;
  number: string;
  client: string;
  due: string;
  left: number;
  studio: string;
  existing?: { id: string; content: string; approvalStatus: string };
}) {
  const draft = (variant: number) =>
    variant % 2
      ? 'Hello ' +
        client +
        ', a quick follow-up on ' +
        number +
        '. The outstanding balance is ' +
        money(left) +
        ', due ' +
        dayLabel(due, true) +
        '. Could you confirm the payment date? Thank you, ' +
        studio +
        '.'
      : 'Hi ' +
        client +
        ', I’m following up on invoice ' +
        number +
        ', due ' +
        dayLabel(due, true) +
        '. Our records show ' +
        money(left) +
        ' outstanding. Please let us know when we can expect payment. Thank you, ' +
        studio +
        '.';
  const [text, setText] = useState(existing?.content || draft(0)),
    [v, setV] = useState(0),
    [notice, setNotice] = useState('');
  return (
    <>
      <p>
        Rule-based draft using this invoice. Review the wording before copying
        it.
      </p>
      <StudioForm action="reminder" label="Save reminder">
        <Hidden name="id" value={id} />
        <Hidden name="draft" value={existing?.id || ''} />
        <label>
          Reminder text
          <textarea
            name="content"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            maxLength={2500}
          />
        </label>
        <label>
          Reminder status
          <select
            name="status"
            defaultValue={existing?.approvalStatus || 'DRAFT'}
          >
            <option value="DRAFT">Draft</option>
            <option value="MANUALLY_SENT">I manually sent this reminder</option>
          </select>
        </label>
        <div className="actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setV(v + 1);
              setText(draft(v + 1));
            }}
          >
            Regenerate
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setNotice('Copied to clipboard.');
              } catch {
                setNotice('Select and copy the reminder text manually.');
              }
            }}
          >
            Copy reminder
          </button>
          <small role="status">{notice}</small>
        </div>
      </StudioForm>
    </>
  );
}
export function PromiseNote({
  id,
  client,
  number,
}: {
  id: string;
  client: string;
  number: string;
}) {
  const [source, setSource] = useState(''),
    [proposal, setProposal] = useState<{
      amount: string;
      date: string;
      client: string;
    } | null>(null);
  const [amount, setAmount] = useState(''),
    [date, setDate] = useState('');
  function extract() {
    const m = source.match(
      /(?:₹|rs\.?\s*)\s*([\d,]+(?:\.\d{1,2})?)\s*(k\b)?|\b(\d+(?:\.\d{1,2})?)\s*(k)\b/i,
    );
    const raw = (m?.[1] || m?.[3] || '').replaceAll(',', '');
    const a = raw ? (m?.[2] || m?.[4] ? String(Number(raw) * 1000) : raw) : '';
    const d = source.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || '';
    const candidate = source
      .toLocaleLowerCase()
      .includes(client.toLocaleLowerCase())
      ? client
      : '';
    setProposal({ amount: a, date: d, client: candidate });
    setAmount(a);
    setDate(d);
  }
  return (
    <>
      <p>
        Rule-based note extraction. Choose an explicit date for relative phrases
        such as “next Friday”.
      </p>
      <label>
        Original client note
        <textarea
          value={source}
          rows={3}
          maxLength={1800}
          onChange={(e) => {
            setSource(e.target.value);
            setProposal(null);
          }}
        />
      </label>
      <button
        className="button secondary"
        disabled={!source.trim()}
        onClick={extract}
      >
        Review proposed fields
      </button>
      {proposal && (
        <>
          <p>
            {proposal.client
              ? 'Name mentioned in note: ' + proposal.client
              : 'Client match is uncertain.'}{' '}
            Confirm this note belongs to {client}, invoice {number}. Confirming
            replaces the previous active promise.
          </p>
          <StudioForm
            action="promise"
            label="Confirm payment promise"

          >
            <Hidden name="id" value={id} />
            <Hidden name="source" value={source} />
            <Hidden name="proposed" value={JSON.stringify(proposal)} />
            <div className="pair">
              <label>
                Promised amount (₹)
                <input
                  name="amount"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Promised date
                <input
                  name="date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            </div>
            <label className="check">
              <input name="confirmed" required type="checkbox" />I confirm the
              client, amount and date.
            </label>
          </StudioForm>
          <StudioForm
            action="note.reject"
            label="Reject proposed fields"

          >
            <Hidden name="id" value={id} />
            <Hidden name="source" value={source} />
            <Hidden name="proposed" value={JSON.stringify(proposal)} />
          </StudioForm>
        </>
      )}
    </>
  );
}
