import { wrap } from './_handler.js';
import { issStreams } from '../lib/iss-tv.mjs';
export default wrap(() => issStreams(), { sMaxAge: 300 });
