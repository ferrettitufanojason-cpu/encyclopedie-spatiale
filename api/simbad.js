import { wrap } from './_handler.js';
import { simbadLookup } from '../lib/nasa.mjs';
export default wrap(req => simbadLookup(new URL(req.url, 'http://x').searchParams.get('q')), { sMaxAge: 3600 });
