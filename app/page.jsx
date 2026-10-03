import members from '../data/members.json';
import {validateMembers} from '../src/ring.js';
import Webring from '../src/components/Webring.jsx';

export default function Home() {
  return <Webring members={validateMembers(members)} basePath={process.env.NEXT_PUBLIC_BASE_PATH || ''} />;
}
