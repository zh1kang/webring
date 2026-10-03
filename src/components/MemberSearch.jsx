"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

const LIMIT = 8;

export function matchMembers(members, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const ranked = [];
  members.forEach((person, index) => {
    const name = person.name.toLowerCase();
    const host = new URL(person.website).hostname;
    const rank = name.startsWith(needle)
      ? 0
      : name.split(/\s+/).some((word) => word.startsWith(needle))
        ? 1
        : `${name} ${host} ${person.major || ""} ${person.year || ""} ${person.message || ""}`.toLowerCase().includes(needle)
          ? 2
          : -1;
    if (rank >= 0) ranked.push({ index, rank, host });
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
}

const everyone = (members) =>
  members.map((person, index) => ({
    index,
    rank: 0,
    host: new URL(person.website).hostname,
  }));

export default function MemberSearch({ members, onPick, onOpenChange }) {
  const id = useId();
  const dialog = useRef(null),
    input = useRef(null),
    trigger = useRef(null),
    list = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const matches = useMemo(
    () => (query.trim() ? matchMembers(members, query) : everyone(members)),
    [members, query],
  );
  const shown = matches.slice(0, LIMIT);
  const activeMatch = open ? shown[active] : undefined;

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      input.current?.focus();
    } else if (!open && node.open) node.close();
    onOpenChange(open);
  }, [open, onOpenChange]);
  useEffect(() => {
    const shortcut = (event) => {
      const command = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (event.key !== "/" && !command) return;
      if (!command && (event.ctrlKey || event.metaKey || event.altKey)) return;
      if (document.querySelector("dialog[open]")) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function close() {
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  }
  function pick(match) {
    setOpen(false);
    setQuery("");
    onPick(match.index);
  }
  function handleKey(event) {
    if (!shown.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + shown.length) % shown.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(shown[active] ?? shown[0]);
    }
  }

  const listId = `${id}-results`;
  const optionId = (index) => `${id}-option-${index}`;
  const status = !query.trim()
    ? `${members.length} ${members.length === 1 ? "person" : "people"}`
    : matches.length
      ? `${matches.length} ${matches.length === 1 ? "person" : "people"} found`
      : "No one found";
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="find-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.25" />
          <path d="m12.6 12.6 4.2 4.2" />
        </svg>
        Find someone
        <kbd aria-hidden="true">[/]</kbd>
      </button>
      <dialog
        ref={dialog}
        className="finder"
        aria-label="Find someone"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className={`finder-card${shown.length ? " has-results" : ""}`}>
          <label className="finder-row">
            <span className="finder-prefix" aria-hidden="true">firestoners/</span>
            <input
              ref={input}
              id="search"
              type="text"
              role="combobox"
              aria-label="Find someone"
              aria-autocomplete="list"
              aria-expanded={open && shown.length > 0}
              aria-controls={listId}
              aria-activedescendant={activeMatch ? optionId(active) : undefined}
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKey}
            />
            <button type="button" className="finder-x" aria-label="Close search" onClick={close}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8m0-8-8 8" /></svg>
            </button>
          </label>
          <ul ref={list} id={listId} className="finder-list" role="listbox" aria-label="Members">
            {shown.map((match, index) => {
              const person = members[match.index];
              return (
                <li
                  key={person.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  className="finder-item"
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerMove={() => setActive(index)}
                  onClick={() => pick(match)}
                >
                  <span className="finder-name">{person.name}</span>
                  <span className="finder-host">{match.host}</span>
                </li>
              );
            })}
          </ul>
          {!shown.length && <p className="finder-empty">No one matches “{query.trim()}”</p>}
        </div>
        <div className="finder-foot" aria-hidden="true">
          <span>[↓] [↑]</span>
          <span>[enter] to open</span>
        </div>
        <button type="button" className="finder-close" onClick={close}>
          Close [esc]
        </button>
        <p className="sr-only" role="status">{open ? status : ""}</p>
      </dialog>
    </>
  );
}
