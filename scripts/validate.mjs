import {readFile} from 'node:fs/promises';
import {validateMembers} from '../src/ring.js';
const members = validateMembers(JSON.parse(await readFile(new URL('../data/members.json', import.meta.url), 'utf8')));
console.log(`Validated ${members.length} members.`);
