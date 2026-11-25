import { wrap } from './_handler.js';
import { rovers } from '../lib/nasa.mjs';
export default wrap(() => rovers(), { sMaxAge: 300 });
