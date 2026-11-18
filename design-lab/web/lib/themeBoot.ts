import { PREF_KEYS } from '@rb-lab/shared';

/**
 * Inline, render-blocking script placed in <head>: applies the saved/system
 * theme and Pause preference before first paint (THEME-01, no flash).
 * Kept in a plain module so the server layout can import the string.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var r=document.documentElement;var p=localStorage.getItem('${PREF_KEYS.theme}');if(p!=='light'&&p!=='dark')p='system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);r.dataset.theme=d?'dark':'light';r.dataset.themePref=p;if(localStorage.getItem('${PREF_KEYS.motion}')==='paused')r.dataset.motion='paused';}catch(e){}})();`;
