'use client';

import { useId } from 'react';
import type { ThemePreference } from '@rb-lab/shared';
import { usePrefs } from './PrefsProvider';

const OPTIONS: Array<{ id: ThemePreference; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

/** Theme (Light/Dark/System) and Pause motion. UI preferences only. */
export function DisplaySettings() {
  const { themePref, setThemePref, paused, setPaused, reducedMotion } = usePrefs();
  const name = useId();
  return (
    <div className="display-settings">
      <fieldset className="segmented">
        <legend>Theme</legend>
        <div className="segmented-row">
          {OPTIONS.map((o) => (
            <label key={o.id} className="segment">
              <input
                type="radio"
                name={name}
                value={o.id}
                checked={themePref === o.id}
                onChange={() => setThemePref(o.id)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="motion-row">
        <button type="button" className="toggle" aria-pressed={paused} onClick={() => setPaused(!paused)}>
          <span className="toggle-track" aria-hidden="true">
            <span className="toggle-thumb" />
          </span>
          Pause background motion
        </button>
        {reducedMotion ? (
          <p className="hint">Your device asks for reduced motion, so the background is a still illustration.</p>
        ) : null}
      </div>
    </div>
  );
}
