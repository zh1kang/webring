'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {resolveNavigation} from '../ring.js';
import Network from './Network.jsx';
import Wordmark from './Wordmark.jsx';
import JoinDialog from './JoinDialog.jsx';
import CrestIntro from './CrestIntro.jsx';

export default function Webring({members, basePath}) {
  const [introduced, setIntroduced] = useState(false);
  const finishIntro = useCallback(() => setIntroduced(true), []);
  const [joinOpen, setJoinOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState('');
  const membersButton = useRef(null), membersClose = useRef(null);
  const openJoin = useCallback(() => setJoinOpen(true), []);
  const closeJoin = useCallback(() => setJoinOpen(false), []);
  const closeMembers = useCallback(() => {setMembersOpen(false); membersButton.current?.focus();}, []);
  useEffect(() => {
    function navigate() {
      if (location.hash === '#graph') return;
      const result = resolveNavigation(members, location.hash);
      if (result.destination) location.replace(result.destination);
      setSelectedId(result.selected === undefined ? null : members[result.selected].id);
      setMessage(result.error || '');
    }
    navigate();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [members]);
  useEffect(() => {
    if (membersOpen) membersClose.current?.focus();
    const escape = event => {if (event.key === 'Escape' && membersOpen && !joinOpen) closeMembers();};
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [membersOpen, joinOpen, closeMembers]);
  return <div inert={!introduced} className={`site${introduced ? ' introduced' : ' introducing'}`}>
    {!introduced && <CrestIntro onComplete={finishIntro} />}
    <a className="skip" href="#graph">Skip to graph</a>
    <header><a className="brand" href="#" aria-label="Princeton webring home"><img src={`${basePath}/icon.svg`} alt="" width={32} height={32} />Princeton webring</a><nav className="header-nav"><button ref={membersButton} id="members-toggle" aria-expanded={membersOpen} aria-controls="members-panel" onClick={() => setMembersOpen(value => !value)}>Members</button><button className="text-button" id="join" onClick={openJoin}>Join</button></nav></header>
    <main>
      <Wordmark />
      <div className="network-shell">
        <Network people={members} selectedId={selectedId} onSelectionChange={setSelectedId} active={introduced} suspended={joinOpen || membersOpen} />
        {message && <p className="navigation-status" role="status">{message}</p>}
        <section id="members-panel" className="members-panel" aria-label="Members" hidden={!membersOpen}>
          <div className="members-heading"><h2>Members</h2><span className="members-count">{String(members.length).padStart(2, '0')}</span><button ref={membersClose} id="members-close" className="bracket" aria-label="Close members" onClick={closeMembers}>esc</button></div>
          <ol id="member-list">{members.length === 0 && <li className="member-empty">No members yet. <button className="text-button" onClick={() => {setMembersOpen(false); openJoin();}}>Join first</button></li>}{members.map((person, index) => <li key={person.id}><button className="member-row" aria-current={selectedId === person.id ? 'true' : undefined} onClick={() => {setSelectedId(person.id); setMembersOpen(false);}}><span className="member-index">{String(index + 1).padStart(2, '0')}</span><span className="member-name"><span className="ink-label">{person.name}</span></span><span className="member-host">{new URL(person.website).hostname}</span>{person.year && <span className="member-year">’{String(person.year).slice(-2)}</span>}</button></li>)}</ol>
        </section>
      </div>
      <footer><span>{members.length === 1 ? '1 member' : `${members.length} members`}</span><a href="https://github.com/zh1kang/webring">GitHub</a></footer>
    </main>
    <JoinDialog open={joinOpen} onClose={closeJoin} members={members} basePath={basePath} />
  </div>;
}
