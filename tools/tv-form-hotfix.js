/* Developer-only live upgrade for an already-open pre-fix CCTV form.
 * Runs entirely on the TV. Never reads, copies, submits or logs input values.
 * The persistent fix is in web/cctv.js; this preserves a user's in-progress form.
 */
(function () {
  'use strict';
  var root = document.getElementById('cctv');
  if (!root) return 'No open CCTV form';
  if (window.__freeMyTvInputFix) return 'Remote form navigation already patched';
  var editing = null, anchor = null;
  function controls() { return root.querySelectorAll('button, input'); }
  function start(input) { input.blur(); input.readOnly = false; editing = input; input.focus(); }
  function finish(input, advance) {
    input.readOnly = true; editing = null; input.blur();
    var list = controls();
    for (var i = 0; i < list.length; i++) if (list[i] === input) { list[Math.min(list.length - 1, i + (advance ? 1 : 0))].focus(); return; }
  }
  var fields = root.querySelectorAll('input'), focused = document.activeElement;
  for (var f = 0; f < fields.length; f++) (function (input) {
    input.readOnly = true;
    if (input.type === 'number') { input.type = 'text'; input.setAttribute('inputmode', 'numeric'); }
    input.onfocus = function () { anchor = input; };
    input.onblur = function () { input.readOnly = true; if (editing === input) editing = null; };
    input.onclick = function () { if (editing !== input) start(input); };
  })(fields[f]);
  root.style.overflowY = 'auto';
  if (focused && focused.tagName === 'INPUT') { focused.blur(); focused.focus(); }
  window.__freeMyTvInputFix = function (event) {
    var target = event.target || document.activeElement, key = event.keyCode;
    if (!root.parentNode || !root.contains(target) || !root.querySelector('input')) return;
    var input = target.tagName === 'INPUT';
    if (input && (editing === target || key === 65376 || key === 65385)) {
      if (key === 65376 || key === 65385 || key === 10009 || key === 461 || key === 27) finish(target, key === 65376);
      event.stopImmediatePropagation(); return;
    }
    if (input && key === 13) { start(target); event.stopImmediatePropagation(); return; }
    if (key >= 37 && key <= 40) {
      var list = controls(), at = -1;
      for (var i = 0; i < list.length; i++) if (list[i] === document.activeElement || list[i] === anchor && at < 0) at = i;
      if (at < 0) at = 0;
      var delta = key === 37 || key === 38 ? -1 : 1;
      var next = list[Math.max(0, Math.min(list.length - 1, at + delta))];
      if (next) { next.focus(); anchor = next; }
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  window.addEventListener('keydown', window.__freeMyTvInputFix, true);
  return 'Remote form navigation patched without reading or clearing field values';
})();
