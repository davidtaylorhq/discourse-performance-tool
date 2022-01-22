// discourse-skip-module

// MEGAHACK
// The first thing `discourse-boot.js` does is check `window.unsupportedBrowser`.
// By defining a getter for that variable, we can hook in and record a timestamp for when discourse-boot
// started execution.
//
// One day, maybe the performance mark should be added in core?

(function () {
  const oldUnsupportedBrowser = window.unsupportedBrowser;
  let booted = false;

  Object.defineProperty(window, "unsupportedBrowser", {
    get: function () {
      if (!booted) {
        performance.mark("discourse-boot-js");
        booted = true;
      }
      return oldUnsupportedBrowser;
    },
  });
})();
