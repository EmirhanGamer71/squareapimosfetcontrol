import { fetchingClass } from './fetch.mjs';

const ac = new fetchingClass("https://api.github.com");

(async () => {
  try {
    const res = await ac.load();
    console.log(await res.json());
  } catch (e) {
    console.error(e);
  }
})();
