/**
 * Referenced from: https://levelup.gitconnected.com/debounce-in-javascript-improve-your-applications-performance-5b01855e086
 *
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * `delay` milliseconds.
 * @param func
 * @param delay
 * @returns {(function(...[*]): void)|*}
 */
const debounce = (func, delay = 300) => {
  let debounceTimer;
  return (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(this, args), delay);
  }
};