/* KITSU/LIVE — layout registry.
 *
 * A "layout" is a whole site design, not a colour scheme: it owns the
 * navigation chrome, the composition of the home page, and the shape of a
 * catalogue card. Pages ask the active layout to render those; everything
 * else (routing, data, store, player) is shared.
 */
import press from './press.js';
import orbit from './orbit.js';
import broadsheet from './broadsheet.js';
import terminal from './terminal.js';
import stage from './stage.js';

export const LAYOUTS = [press, orbit, broadsheet, terminal, stage];
export const LAYOUT_IDS = LAYOUTS.map((l) => l.id);
export const getLayout = (id) => LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];

let active = LAYOUTS[0];
export const setActive = (id) => { active = getLayout(id); return active; };
export const current = () => active;
