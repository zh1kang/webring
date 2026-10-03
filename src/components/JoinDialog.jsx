'use client';

import {useEffect, useRef, useState} from 'react';
import {LIMITS, RING_URL, canonicalWebsite, joinRequestUrl, slugify, validateMembers, widget} from '../ring.js';

const ID_PATTERN = '[a-z0-9][a-z0-9-]{0,39}';
const REPOSITORY = 'zh1kang/webring';

export default function JoinDialog({open, onClose, members, basePath}) {
  const dialog = useRef(null), copyTimer = useRef(null);
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [idEdited, setIdEdited] = useState(false);
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState('');
  const [dark, setDark] = useState(false);
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current.open) dialog.current.close();
  }, [open]);

  let snippet = '';
  let websiteError = '';
  if (website) {
    try {snippet = widget(RING_URL + basePath, website, {dark});}
    catch (error) {websiteError = error.message;}
  }
  const icon = `${basePath}/${dark ? 'icon.white.svg' : 'icon.svg'}`;

  async function copy() {
    if (!snippet) {setStatus(websiteError || 'Enter your website first.'); return;}
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true); clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {setStatus('Select the HTML and copy it manually.');}
  }
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const member = {id: values.id, name: values.name, website: canonicalWebsite(values.website), major: values.major, year: Number(values.year), message: values.message};
      const request = validateMembers([...members, member]).at(-1);
      location.href = joinRequestUrl(REPOSITORY, request);
    } catch (error) {setStatus(error.message);}
  }

  return <dialog ref={dialog} id="join-dialog" className="join" aria-labelledby="join-title" onClose={onClose}>
    <div className="join-frame">
      <div className="join-head">
        <img className="join-mark" src={`${basePath}/icon.svg`} alt="" width={32} height={32} />
        <div>
          <p className="join-kicker">firestoners/join</p>
          <h2 id="join-title">Join the ring</h2>
          <p>Add the badge to your footer, then send your details.</p>
        </div>
        <button className="bracket join-close" type="button" aria-label="Close join form" onClick={onClose}>esc</button>
      </div>
      <form id="join-form" onSubmit={submit} onInput={() => setStatus('')}>
        <fieldset className="join-step">
          <legend><span className="step-number">01</span>About you</legend>
          <div className="join-grid">
            <label className="field">
              <span>Name</span>
              <input name="name" required maxLength={LIMITS.name} autoComplete="name" placeholder="Alex Chen" value={name}
                onChange={event => {setName(event.target.value); if (!idEdited) setId(slugify(event.target.value));}} />
            </label>
            <label className="field">
              <span>Member ID</span>
              <input name="id" required pattern={ID_PATTERN} maxLength={40} placeholder="alex-chen" value={id} spellCheck={false} aria-describedby="id-hint"
                onChange={event => {setId(event.target.value.toLowerCase()); setIdEdited(Boolean(event.target.value));}} />
            </label>
            <label className="field wide">
              <span>Website</span>
              <input name="website" type="url" required placeholder="https://your.site" value={website} spellCheck={false} aria-invalid={Boolean(websiteError)} aria-describedby="website-hint"
                onChange={event => {setWebsite(event.target.value); setCopied(false);}} />
            </label>
            <label className="field">
              <span>Major</span>
              <input name="major" required maxLength={LIMITS.major} placeholder="Computer Science" />
            </label>
            <label className="field">
              <span>Class year</span>
              <input name="year" required inputMode="numeric" pattern="(19|20)[0-9]{2}" maxLength={4} placeholder="2027" title="A four-digit year, such as 2027" />
            </label>
            <label className="field wide">
              <span>Message <em>optional</em><span className="field-count" aria-hidden="true">{message.length}/{LIMITS.message}</span></span>
              <textarea name="message" rows={2} maxLength={LIMITS.message} placeholder="Builds tiny synths, writes about type" value={message} onChange={event => setMessage(event.target.value)} />
            </label>
          </div>
          <p className="field-hint" id="id-hint">Your ID becomes your ring link. Lowercase letters, numbers, and dashes.</p>
          <p className="field-hint error" id="website-hint" hidden={!websiteError}>{websiteError}</p>
        </fieldset>

        <fieldset className="join-step">
          <legend><span className="step-number">02</span>Your badge</legend>
          <div className={`badge${dark ? ' dark' : ''}`}>
            <div className="badge-stage">
              <div className="badge-theme" role="group" aria-label="Badge colour">
                <button type="button" aria-pressed={!dark} onClick={() => setDark(false)}>Light</button>
                <button type="button" aria-pressed={dark} onClick={() => setDark(true)}>Dark</button>
              </div>
              <div className="badge-preview" aria-label="Badge preview">
                <span aria-hidden="true">←</span>
                <img src={icon} alt="Firestone Library pixel badge" width={64} height={64} />
                <span aria-hidden="true">→</span>
              </div>
            </div>
            <div className="badge-code">
              <div className="badge-code-head">
                <span>HTML for your footer</span>
                <button id="copy" className="bracket" type="button" onClick={copy} disabled={!snippet} data-copied={copied || undefined}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <pre id="snippet" className={snippet ? undefined : 'empty'}>{snippet || 'Enter your website to generate your badge.'}</pre>
            </div>
          </div>
        </fieldset>

        <div className="join-foot">
          <p id="form-status" role="status">{status || 'Opens a prefilled GitHub issue form. A GitHub account is required.'}</p>
          <button className="primary" type="submit">Send request<span aria-hidden="true">→</span></button>
        </div>
      </form>
    </div>
  </dialog>;
}
