import { wrap } from './_handler.js';
import { apod } from '../lib/nasa.mjs';
export default wrap(() => apod(), { sMaxAge: 1800 });
