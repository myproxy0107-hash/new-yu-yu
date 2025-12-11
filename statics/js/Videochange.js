  /* cookie helpers */
      function getCookie(name) {
        const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
        return v ? decodeURIComponent(v.pop()) : null;
      }
      function setCookie(name, value, days) {
        const d = new Date();
        d.setTime(d.getTime() + (days||30) * 24 * 60 * 60 * 1000);
        const expires = "expires=" + d.toUTCString();
        document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/";
      }

      document.addEventListener('DOMContentLoaded', function() {
        const settingsToggle = document.getElementById('settingsToggle');
        const settingsPanel = document.getElementById('settingsPanel');
        const settingsSaveBtn = document.getElementById('settingsSaveBtn');
        const proxyToggle = document.getElementById('proxyToggle');
        const vcSelectPanel = document.getElementById('vcSelectPanel');

        // 初期値をクッキーから読み出し（なければ既定値）
        const vcCookie = getCookie('vc') || '0';
        if (vcSelectPanel) vcSelectPanel.value = vcCookie;
        const proxyCookie = getCookie('proxy') || ('{{ proxy }}' === 'True' ? 'True' : 'False');
        proxyToggle.checked = proxyCookie === 'True';

        function openSettings() {
          settingsPanel.classList.add('open');
          settingsPanel.setAttribute('aria-hidden', 'false');
        }
        function closeSettings() {
          settingsPanel.classList.remove('open');
          settingsPanel.setAttribute('aria-hidden', 'true');
        }

        settingsToggle.addEventListener('click', function(e){
          e.stopPropagation();
          if (settingsPanel.classList.contains('open')) closeSettings();
          else openSettings();
        });

        // クリックでパネル外を押したら閉じる
        document.addEventListener('click', function(e){
          if (!settingsPanel.contains(e.target) && !settingsToggle.contains(e.target)) closeSettings();
        });

        // 保存ボタン
        settingsSaveBtn.addEventListener('click', function(){
          const newVc = vcSelectPanel.value;
          setCookie('vc', newVc, 30);
          if (proxyToggle.checked) setCookie('proxy', 'True', 30);
          else setCookie('proxy', 'False', 30);

          // トースト表示（重複抑制付き）
          showToast('設定を保存しました!!', '保存完了');

          closeSettings();
        });
      });

      /* トースト（重複抑制 / 最大同時表示数）実装 */
      (function(){
        const wrap = document.getElementById('toastWrap');
        if (!wrap) return;

        const maxToasts = 3; // 同時表示数
        const dedupeMap = new Map(); // key -> {el, timeoutId, expiresAt}

        function makeKey(title, body) {
          return (title || '') + '||' + (body || '');
        }

        function ensureSpace() {
          const toasts = wrap.querySelectorAll('.toast');
          if (toasts.length < maxToasts) return;
          let oldest = null;
          toasts.forEach(t => {
            const created = parseInt(t.getAttribute('data-created') || '0', 10);
            if (!oldest || created < parseInt(oldest.getAttribute('data-created') || '0', 10)) oldest = t;
          });
          if (oldest) dismiss(oldest);
        }

        function createToastElement(title, body) {
          const el = document.createElement('div');
          el.className = 'toast';
          el.setAttribute('data-created', String(Date.now()));
          el.innerHTML = '<div class="close-x" aria-hidden="true">✕</div>' +
                         '<div class="title">' + (title || '') + '</div>' +
                         '<div class="body">' + (body || '') + '</div>' +
                         '<span class="hint">左から右へスライドで閉じる</span>';
          return el;
        }

        function dismiss(el) {
          if (!el || !el.parentNode) return;
          const key = el._toastKey;
          el.classList.remove('show');
          el.style.transform = 'translateX(14px) translateY(-8px) scale(.98)';
          el.style.opacity = '0';
          if (el._toastTimeoutId) clearTimeout(el._toastTimeoutId);
          if (key && dedupeMap.has(key)) dedupeMap.delete(key);
          setTimeout(()=> { try { el.remove(); } catch(e) {} }, 260);
        }

        function focusToast(el) {
          el.style.transition = 'none';
          el.style.transform = 'translateY(-6px)';
          setTimeout(()=> {
            el.style.transition = '';
            el.style.transform = '';
          }, 260);
        }

        function createOrRefreshToast(title, body, ttl = 4200) {
          const key = makeKey(title, body);

          if (dedupeMap.has(key)) {
            const info = dedupeMap.get(key);
            clearTimeout(info.timeoutId);
            info.timeoutId = setTimeout(()=> dismiss(info.el), ttl);
            info.expiresAt = Date.now() + ttl;
            focusToast(info.el);
            return info.el;
          }

          ensureSpace();

          const el = createToastElement(title, body);
          el._toastKey = key;
          wrap.appendChild(el);
          requestAnimationFrame(()=> el.classList.add('show') );

          const timeoutId = setTimeout(()=> dismiss(el), ttl);
          el._toastTimeoutId = timeoutId;

          dedupeMap.set(key, { el, timeoutId, expiresAt: Date.now() + ttl });

          const closeX = el.querySelector('.close-x');
          if (closeX) {
            closeX.addEventListener('click', function(e){
              e.stopPropagation();
              clearTimeout(el._toastTimeoutId);
              dismiss(el);
            });
          }

          let startX = 0;
          let currentX = 0;
          let dragging = false;

          function onPointerDown(ev) {
            dragging = true;
            el.classList.add('dragging');
            startX = ev.type && ev.type.startsWith && ev.type.startsWith('touch') ? ev.touches[0].clientX : ev.clientX;
            currentX = startX;
            el.style.transition = 'none';
          }
          function onPointerMove(ev) {
            if (!dragging) return;
            const clientX = ev.type && ev.type.startsWith && ev.type.startsWith('touch') ? ev.touches[0].clientX : ev.clientX;
            currentX = clientX;
            const dx = currentX - startX;
            el.style.transform = `translateX(${Math.max(0, dx)}px)`;
            el.style.opacity = String(Math.max(0, 1 - Math.abs(dx) / 300));
          }
          function onPointerUp(ev) {
            if (!dragging) return;
            dragging = false;
            el.classList.remove('dragging');
            el.style.transition = '';
            const dx = currentX - startX;
            if (dx > 120) {
              dismiss(el);
            } else {
              el.style.transform = '';
              el.style.opacity = '';
            }
          }

          el.addEventListener('mousedown', onPointerDown);
          window.addEventListener('mousemove', onPointerMove);
          window.addEventListener('mouseup', onPointerUp);
          el.addEventListener('touchstart', onPointerDown, {passive:true});
          window.addEventListener('touchmove', onPointerMove, {passive:true});
          window.addEventListener('touchend', onPointerUp);

          return el;
        }

        window.showToast = function(message, title, ttl) {
          const body = message || '';
          const head = title || '通知';
          const time = typeof ttl === 'number' ? ttl : 4200;
          createOrRefreshToast(head, body, time);
        };
      })();

document.addEventListener('DOMContentLoaded', function () {
  const vcSelect = document.getElementById('vcSelectPanel');
  const saveBtn = document.getElementById('settingsSaveBtn');

  function vcToPath(vc) {
    switch(String(vc)) {
      case '1': return '/watch';
      case '2': return '/w';
      case '3': return '/ume';
      default:  return '/edu';
    }
  }

  function setVcCookie(val) {
    const d = new Date();
    d.setTime(d.getTime() + 30*24*60*60*1000);
    document.cookie = 'vc=' + encodeURIComponent(String(val)) + ';expires=' + d.toUTCString() + ';path=/';
  }

  function replaceToVcPath(vcValue) {
    try {
      const targetPath = vcToPath(vcValue);
      const query = window.location.search || '';
      // 既に同じパスなら何もしない
      if (window.location.pathname === targetPath) return;
      // 履歴を残さず置き換えて遷移
      location.replace(targetPath + query);
    } catch (e) {
      console.warn('vc replace failed', e);
    }
  }

  // 保存ボタンでも反映（既存の保存処理を優先するため短い遅延で実行）
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      const val = vcSelect ? vcSelect.value : '0';
      setVcCookie(val);
      setTimeout(function () { replaceToVcPath(val); }, 40);
    });
  }



document.addEventListener('DOMContentLoaded', function(){
  const saveBtn = document.getElementById('settingsSaveBtn');
  const vcSelect = document.getElementById('vcSelectPanel');
  if (!saveBtn || !vcSelect) return;

  // vc -> path
  function vcToPath(vc) {
    switch(String(vc)) {
      case '1': return '/watch';
      case '2': return '/w';
      case '3': return '/ume';
      default:  return '/edu';
    }
  }

  // cookie 書き込み
  function setVcCookie(val) {
    const d = new Date();
    d.setTime(d.getTime() + 30*24*60*60*1000);
    document.cookie = 'vc=' + encodeURIComponent(String(val)) + ';expires=' + d.toUTCString() + ';path=/';
  }

  // showToast が存在しない場合に備えた最小実装
  function ensureShowToastExists() {
    if (typeof window.showToast === 'function') return;
    window.showToast = function(message, title, ttl) {
      const wrapId = 'toastWrap';
      let wrap = document.getElementById(wrapId);
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = wrapId;
        wrap.className = 'toast-wrap';
        wrap.style.position = 'fixed';
        wrap.style.top = '20px';
        wrap.style.right = '20px';
        wrap.style.zIndex = '150';
        document.body.appendChild(wrap);
      }
      const el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('data-created', String(Date.now()));
      el.innerHTML = '<div class="title">' + (title || '通知') + '</div><div class="body">' + (message || '') + '</div><div class="close-x" aria-hidden="true" style="position:absolute;right:8px;top:6px;cursor:pointer;">✕</div>';
      wrap.appendChild(el);
      requestAnimationFrame(()=> el.classList.add('show'));
      const time = typeof ttl === 'number' ? ttl : 4200;
      const tid = setTimeout(()=> {
        try { el.remove(); } catch(e){}
      }, time);
      const cx = el.querySelector('.close-x');
      if (cx) cx.addEventListener('click', function(e){ e.stopPropagation(); clearTimeout(tid); try{ el.remove(); }catch(_){} });
    };
  }

  // showToast を呼び、実際に DOM に追加されたトースト要素を監視して Promise を返す
  function showToastAsync(message, title, ttl) {
    ensureShowToastExists();
    return new Promise((resolve) => {
      const wrap = document.getElementById('toastWrap') || (function(){ const w = document.createElement('div'); w.id='toastWrap'; w.className='toast-wrap'; document.body.appendChild(w); return w; })();
      const before = Array.from(wrap.children);
      // call existing toast
      try { window.showToast(message, title, ttl); } catch(e){ console.warn('showToast failed', e); resolve(); return; }

      // find newly added toast (wait up to 200ms if not immediate)
      let newToast = null;
      const findNew = () => {
        const after = Array.from(wrap.children);
        for (let el of after) if (!before.includes(el)) return el;
        return null;
      };
      newToast = findNew();
      const maxWaitForInsert = 300;
      let waited = 0;
      const pollInterval = 50;
      const pollTimer = setInterval(() => {
        newToast = findNew();
        waited += pollInterval;
        if (newToast || waited >= maxWaitForInsert) {
          clearInterval(pollTimer);
          if (!newToast) {
            // If not found, fallback to waiting the ttl then resolve
            setTimeout(resolve, typeof ttl === 'number' ? ttl : 4200);
            return;
          }
          // Observe removal OR wait ttl
          const ttlMs = typeof ttl === 'number' ? ttl : 4200;
          let resolved = false;
          // If the toast element is removed, resolve early
          const mo = new MutationObserver(() => {
            if (!document.body.contains(newToast)) {
              if (!resolved) { resolved = true; mo.disconnect(); resolve(); }
            }
          });
          mo.observe(document.body, { childList: true, subtree: true });
          // Also watch for its removal from parent via periodic check (safety)
          const checkTimer = setInterval(() => {
            if (!document.body.contains(newToast)) {
              if (!resolved) { resolved = true; clearInterval(checkTimer); mo.disconnect(); resolve(); }
            }
          }, 150);
          // Fallback: resolve after ttl
          setTimeout(() => {
            if (!resolved) { resolved = true; clearInterval(checkTimer); mo.disconnect(); resolve(); }
          }, ttlMs + 100); // small buffer
        }
      }, pollInterval);
    });
  }

  // replace 実行
  function doReplaceForVc(val) {
    try {
      const target = vcToPath(val);
      const query = window.location.search || '';
      if (window.location.pathname === target) return;
      location.replace(target + query);
    } catch(e){ console.warn('replace error', e); }
  }

  // attach unified save handler (avoid duplicates)
  if (!saveBtn.__vc_postsave_attached__) {
    saveBtn.addEventListener('click', function(){
      // delay slightly so existing save logic runs first
      setTimeout(async function(){
        try {
          const val = vcSelect.value || '0';
          setVcCookie(val);

          // show toast and wait until it disappears or TTL
          // TTL: match your site's toast default if known; use 2000-4200ms typical.
          const ttl = 2000;
          await showToastAsync('設定を保存しました!!', '保存完了', ttl);

          // after toast lifecycle completes, perform replace
          doReplaceForVc(val);
        } catch(e){
          console.warn('post-save flow failed', e);
        }
      }, 40);
    }, false);
    saveBtn.__vc_postsave_attached__ = true;
  }

  // helper cookie writer used above
  function setVcCookie(val) {
    const d = new Date();
    d.setTime(d.getTime() + 30*24*60*60*1000);
    document.cookie = 'vc=' + encodeURIComponent(String(val)) + ';expires=' + d.toUTCString() + ';path=/';
  }

});
