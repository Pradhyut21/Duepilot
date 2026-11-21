'use client';
import { useState } from 'react';
import { StudioForm, Hidden } from '@/components/forms/StudioForm';
import type { Studio } from '@/lib/studio/data';
export function Profile({
  p,
  today,
  owner,
  onboarding = false,
}: {
  p: Studio['profile'];
  today: string;
  owner: string;
  onboarding?: boolean;
}) {
  const [logo, setLogo] = useState(p.logo || ''),
    [problem, setProblem] = useState('');
  return (
    <StudioForm
      action="profile"
      label={onboarding ? 'Open dashboard' : 'Save studio settings'}
      go={onboarding ? '/app' : undefined}
    >
      <div className="pair">
        <label>
          Business name
          <input name="name" defaultValue={p.name} required maxLength={180} />
        </label>
        <label>
          Owner display name
          <input name="owner" defaultValue={owner} required />
        </label>
      </div>
      <label>
        Business type
        <input
          name="type"
          defaultValue={
            p.businessType === 'UNSPECIFIED'
              ? 'Wedding photography'
              : p.businessType
          }
          required
        />
      </label>
      <div className="pair">
        <label>
          Opening cash (₹)
          <input
            name="opening"
            type="number"
            step=".01"
            min="0"
            defaultValue={p.openingBalancePaise / 100}
            required
          />
        </label>
        <label>
          Opening balance date
          <input
            name="openingDate"
            type="date"
            defaultValue={p.openingBalanceDate || today}
            max={today}
            required
          />
        </label>
      </div>
      <label>
        Forecast horizon
        <select name="horizon" defaultValue={p.horizon}>
          {[30, 60, 90].map((n) => (
            <option key={n} value={n}>
              {n} days
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" name="useDue" defaultChecked={p.useDueDates} />
        Use future due dates for receipts without a confirmed date
      </label>
      <label>
        Studio logo (optional, up to 60 KB)
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (
              f.size > 60000 ||
              !['image/png', 'image/jpeg', 'image/webp'].includes(f.type)
            ) {
              setProblem('Choose a PNG, JPEG or WebP under 60 KB.');
              return;
            }
            const r = new FileReader();
            r.onload = () => {
              setLogo(String(r.result));
              setProblem('');
            };
            r.readAsDataURL(f);
          }}
        />
      </label>
      <Hidden name="logo" value={logo} />
      {problem && <p role="alert">{problem}</p>}
    </StudioForm>
  );
}
