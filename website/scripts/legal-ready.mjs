// Says whether the legal notice and privacy policy are complete (src/data/legal.mjs). The deploy
// workflow publishes the site only then: a German website needs a valid Impressum. Writes
// "ready=true" or "ready=false" to $GITHUB_OUTPUT when it is set; always exits 0.
import { appendFileSync } from 'node:fs';
import { missingLegal } from '../src/data/legal.mjs';

const missing = missingLegal();
const ready = missing.length === 0;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ready=${ready}\n`);
if (ready) console.log('[legal] the legal notice and privacy policy are complete.');
else console.log(`[legal] not complete, missing in website/src/data/legal.mjs: ${missing.join(', ')}. The site is built and checked but not deployed.`);
