'use client';

import { Check, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import Input from '@/components/common/Input';
import { EMPTY_CRITERIA, SOURCE_LABEL, SOURCES, type SearchCriteria, type Source } from '@/lib/searchCriteria';

type Props = {
  value?: SearchCriteria; // controlled
  defaultValue?: SearchCriteria; // uncontrolled start value (default: empty)
  onChange?: (value: SearchCriteria) => void;
  name?: string; // also emit a hidden input with the criteria as JSON, so FormData carries it
};

const legendClass = 'mb-xs text-sm font-medium';
const hintClass = 'text-xs font-normal text-muted-foreground';
const chipBase = 'inline-flex items-center gap-xs rounded-md border px-sm py-xs text-sm font-medium';

const splitTerms = (text: string) => [...new Set(text.split(',').map((t) => t.trim()).filter(Boolean))];

// The search criteria fields: Sources toggle chips, Topics / Exclude as comma-separated inputs shown as
// chips, Region, Language and Notes. Controlled (value + onChange) or uncontrolled (defaultValue); pass
// `name` to put the JSON in a hidden input for <form> / FormData use.
export default function SearchCriteriaFields({ value, defaultValue, onChange, name }: Props) {
  const id = useId();
  const [inner, setInner] = useState<SearchCriteria>(defaultValue ?? EMPTY_CRITERIA);
  const criteria = value ?? inner;
  // Latest value, so two changes before the next render (e.g. quick chip clicks) don't overwrite each other.
  const latest = useRef(criteria);
  latest.current = criteria;

  function update(patch: Partial<SearchCriteria> | ((c: SearchCriteria) => Partial<SearchCriteria>)) {
    const next = { ...latest.current, ...(typeof patch === 'function' ? patch(latest.current) : patch) };
    latest.current = next;
    if (value === undefined) setInner(next);
    onChange?.(next);
  }

  function toggleSource(s: Source) {
    update((c) => ({ sources: c.sources.includes(s) ? c.sources.filter((x) => x !== s) : [...c.sources, s] }));
  }

  return (
    <div className="flex flex-col gap-sm" data-testid="search-criteria-fields">
      {name && <input type="hidden" name={name} value={JSON.stringify(criteria)} />}

      <fieldset>
        <legend className={legendClass}>Sources</legend>
        <div className="flex flex-wrap gap-xs">
          {SOURCES.map((s) => {
            const on = criteria.sources.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSource(s)}
                className={`${chipBase} focus-visible:outline-2 focus-visible:outline-focus ${
                  on ? 'border-button bg-button text-on-button hover:bg-button-hover' : 'border-border bg-background hover:bg-panel'
                }`}
              >
                {on && <Check className="size-3.5" aria-hidden />}
                {SOURCE_LABEL[s]}
              </button>
            );
          })}
        </div>
        <p className={`mt-xs ${hintClass}`}>None picked = search everywhere.</p>
      </fieldset>

      <div className="grid gap-sm sm:grid-cols-2">
        <TermsInput
          id={`${id}-topics`}
          label="Topics"
          placeholder="e.g. pricing, customer service"
          terms={criteria.topics}
          onChange={(topics) => update({ topics })}
        />
        <TermsInput
          id={`${id}-exclude`}
          label="Exclude keywords"
          placeholder="e.g. band, album"
          terms={criteria.excludeKeywords}
          onChange={(excludeKeywords) => update({ excludeKeywords })}
        />
      </div>

      <div className="grid grid-cols-2 gap-sm">
        <Input
          label="Region"
          id={`${id}-region`}
          placeholder="e.g. US"
          maxLength={60}
          value={criteria.region}
          onChange={(e) => update({ region: e.target.value })}
        />
        <Input
          label="Language"
          id={`${id}-language`}
          placeholder="e.g. English"
          maxLength={40}
          value={criteria.language}
          onChange={(e) => update({ language: e.target.value })}
        />
      </div>

      <label htmlFor={`${id}-notes`} className="flex flex-col gap-xs text-sm font-medium">
        Notes
        <textarea
          id={`${id}-notes`}
          rows={3}
          maxLength={1000}
          value={criteria.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Anything else to focus on"
          className="resize-y rounded-md border border-border bg-background px-sm py-sm text-base font-normal text-text focus-visible:outline-2 focus-visible:outline-focus"
        />
      </label>
    </div>
  );
}

type TermsProps = { id: string; label: string; placeholder: string; terms: string[]; onChange: (terms: string[]) => void };

// Comma-separated text input (placeholder shows the format); the parsed terms show as removable chips underneath.
function TermsInput({ id, label, placeholder, terms, onChange }: TermsProps) {
  const [text, setText] = useState(terms.join(', '));
  // Resync when the terms change from outside (a chip removed, or a new controlled value).
  if (splitTerms(text).join('\n') !== terms.join('\n')) setText(terms.join(', '));

  return (
    <div className="flex flex-col gap-xs">
      <Input
        label={label}
        id={id}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(splitTerms(e.target.value));
        }}
        aria-description="Separate with commas"
      />
      {terms.length > 0 && (
        <ul className="flex flex-wrap gap-xs" aria-label={label}>
          {terms.map((t) => (
            <li key={t} className={`${chipBase} border-border bg-panel py-0 pr-xs`}>
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => onChange(terms.filter((x) => x !== t))}
                className="rounded-sm text-muted-foreground hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
