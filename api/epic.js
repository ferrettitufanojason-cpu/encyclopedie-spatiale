import { wrap } from './_handler.js';
import { epic } from '../lib/nasa.mjs';
export default wrap(() => epic(), { sMaxAge: 300 });
