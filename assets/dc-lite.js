/* Runtime mínimo para as páginas do protótipo Brüder (holes, sc-for, sc-if, eventos, estado). */
(function () {
  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (p) {
    var next = typeof p === 'function' ? p(this.state, this.props) : p;
    this.state = Object.assign({}, this.state, next);
    if (this.__render) this.__render();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__render) this.__render(); };
  window.DCLogic = DCLogic;

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  var WHOLE = /^\s*\{\{([^}]+)\}\}\s*$/, ANY = /\{\{([^}]+)\}\}/g;
  function interp(str, scope) {
    return str.replace(ANY, function (_, p) { var v = lookup(p, scope); return v == null ? '' : String(v); });
  }
  var BOOL = { disabled: 1, checked: 1, selected: 1, hidden: 1, readonly: 1, required: 1 };

  function build(node, scope, out) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(interp(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      var list = lookup((node.getAttribute('list') || '').replace(/[{}]/g, ''), scope) || [];
      var as = node.getAttribute('as') || 'item';
      list.forEach(function (item, i) {
        var s = Object.create(scope); s[as] = item; s.$index = i;
        node.childNodes.forEach(function (c) { build(c, s, out); });
      });
      return;
    }
    if (tag === 'sc-if') {
      if (lookup((node.getAttribute('value') || '').replace(/[{}]/g, ''), scope)) node.childNodes.forEach(function (c) { build(c, scope, out); });
      return;
    }
    var pendingValue = null;
    var isSvg = node.namespaceURI === 'http://www.w3.org/2000/svg';
    var el = isSvg ? document.createElementNS(node.namespaceURI, node.tagName) : document.createElement(tag);
    Array.prototype.forEach.call(node.attributes, function (a) {
      var name = a.name, val = a.value, m = val.match(WHOLE);
      if (/^hint-/.test(name)) return;
      if (/^on[a-z]/i.test(name)) {
        var fn = m ? lookup(m[1], scope) : null;
        if (typeof fn === 'function') {
          var ev = name.slice(2).toLowerCase();
          if (ev === 'change' && (tag === 'input' || tag === 'textarea')) ev = 'input';
          el.addEventListener(ev, function (e) { fn(e); });
        }
        return;
      }
      if (m) {
        var v = lookup(m[1], scope);
        if (BOOL[name]) { if (v === true || v === 'true') el.setAttribute(name, ''); if (name === 'checked') el.checked = !!v; return; }
        if (name === 'value') { el.setAttribute('value', v == null ? '' : v); el.value = v == null ? '' : v; pendingValue = v; return; }
        if (v == null || v === false) return;
        el.setAttribute(name, String(v));
      } else {
        el.setAttribute(name, ANY.test(val) ? interp(val, scope) : val);
        ANY.lastIndex = 0;
      }
    });
    node.childNodes.forEach(function (c) { build(c, scope, el); });
    if (pendingValue != null && tag === 'select') el.value = pendingValue;
    out.appendChild(el);
  }

  function start() {
    var host = document.querySelector('x-dc');
    var code = document.querySelector('script[data-dc-script]');
    if (!host) return;
    var helmet = host.querySelector('helmet');
    if (helmet) { Array.prototype.slice.call(helmet.children).forEach(function (c) { document.head.appendChild(c); }); helmet.remove(); }
    var tpl = document.createElement('div');
    while (host.firstChild) tpl.appendChild(host.firstChild);
    var Component = new Function('DCLogic', (code ? code.textContent : 'class Component extends DCLogic { renderVals(){ return {}; } }') + '\nreturn Component;')(DCLogic);
    var props = {};
    try { var dp = JSON.parse(code.getAttribute('data-props') || '{}'); Object.keys(dp).forEach(function (k) { if (dp[k] && 'default' in dp[k]) props[k] = dp[k]['default']; }); } catch (e) {}
    var comp = new Component(props);
    var mount = document.createElement('div');
    host.parentNode.replaceChild(mount, host);
    comp.__render = function () {
      var a = document.activeElement, id = a && a.id, s = null, e = null;
      try { if (id && a.selectionStart != null) { s = a.selectionStart; e = a.selectionEnd; } } catch (x) {}
      var frag = document.createDocumentFragment();
      var vals = comp.renderVals ? comp.renderVals() : {};
      tpl.childNodes.forEach(function (c) { build(c, vals, frag); });
      mount.replaceChildren(frag);
      if (id) { var n = document.getElementById(id); if (n) { n.focus(); try { if (s != null) n.setSelectionRange(s, e); } catch (x) {} } }
    };
    comp.__render();
    if (comp.componentDidMount) comp.componentDidMount();
    if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
