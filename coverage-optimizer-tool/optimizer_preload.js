/* Coverage Optimizer — pre-load page. Client.
 *
 * Own file/IIFE. The overlay's markup is static in optimizer.html; this file
 * only wires it: pick who is using the tool (one of three pills, like the
 * Multi-Coverage Discount switch), and hold the tool back until BOTH a name is
 * chosen and both rate files say Loaded — then Start reveals it. The rate rows
 * and bar are driven by optimizer_rates.js (it loads rates/ on every launch and
 * fires 'ratesstatus' when a row changes); the chosen name goes to the top-bar
 * chip #tcUser, which optimizer_history.js reads (name on the saved test case,
 * initials — data-ini — as the file-name prefix). Nothing is remembered between
 * launches: it asks every time.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var app = document.querySelector('.app');
  var user = null;   // the chosen pill

  app.inert = true;   // no tabbing/clicking into the tool behind the page until Start

  function ratesLoaded() {
    return !document.querySelector('.pl-rate:not([data-state="loaded"])');
  }

  function update() {
    var ready = !!user && ratesLoaded();
    $('plStart').disabled = !ready;
    $('plHint').textContent = ready ? '' : !user ? 'Choose your name.' : 'Waiting for both rate files to load.';
  }

  Array.prototype.forEach.call(document.querySelectorAll('.pl-user'), function (btn) {
    btn.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.pl-user'), function (b) {
        b.setAttribute('aria-checked', String(b === btn));
      });
      user = btn;
      update();
    });
  });

  document.addEventListener('ratesstatus', update);

  function enter(name, ini) {
    $('tcUser').textContent = name;
    $('tcUser').dataset.ini = ini;
    $('preload').hidden = true;
    app.inert = false;
  }

  $('plStart').addEventListener('click', function () {
    if (!$('plStart').disabled) enter(user.dataset.user, user.dataset.ini);
  });

  // DEV BYPASS (still coding) — skips the name + rates gate. Uses the picked
  // name if there is one, else "Dev" / dev_ (the saved-file prefix). Delete
  // this handler and the #plSkip button in optimizer.html when done coding.
  $('plSkip').addEventListener('click', function () {
    enter(user ? user.dataset.user : 'Dev', user ? user.dataset.ini : 'dev');
  });

  update();
})();
