// blog-crud.js
// Safe CRUD for your existing layout: Delete + Undo + Add using localStorage
// Key notes:
// - It reads your existing .blog-card elements inside #blogContainer on first run (if localStorage empty).
// - It re-renders cards using the same class names so your CSS remains effective.
// - It provides addBlog(), deleteBlog(), undoDelete() functions.

(function () {
    const STORAGE_KEY = 'inspirehub_blogs_v1';
    let recentlyDeleted = null; // { blog, index }
    let blogs = [];
  
    // Helpers
    function $qs(sel, root = document) { return root.querySelector(sel); }
    function $qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
    function byId(id) { return document.getElementById(id); }
    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(blogs)); }
    function load() { 
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
      catch(e) { return null; }
    }
  
    // 1) Initialize storage from DOM if empty
    function initializeFromDOM() {
      const stored = load();
      if (stored && Array.isArray(stored) && stored.length > 0) {
        blogs = stored;
        return;
      }
  
      const container = byId('blogList');
      if (!container) { blogs = []; return; }
  
      const staticCards = $qsa('.blog-card', container);
      if (staticCards.length === 0) { blogs = []; save(); return; }
  
      // Read each static card and extract title/image/content/detail link (if present)
      const newBlogs = staticCards.map((card, i) => {
        // image
        const img = $qs('img', card);
        const image = img ? img.getAttribute('src') : '';
  
        // title: first h1/h2/h3/h4 inside card
        const t = $qs('h1, h2, h3, h4', card);
        const title = t ? t.innerText.trim() : `Post ${i+1}`;
  
        // content: first paragraph or .excerpt
        const p = $qs('p', card);
        const content = p ? p.innerText.trim() : '';
  
        // detail link (Read More): anchor that contains 'Read' text or has class 'read-more'
        let detailUrl = '';
        const aCandidates = $qsa('a', card);
        for (const a of aCandidates) {
          const txt = (a.innerText || '').toLowerCase();
          if (txt.includes('read') || a.classList.contains('read-more')) {
            detailUrl = a.getAttribute('href') || '';
            break;
          }
        }
  
        return {
          id: Date.now() + i,
          title,
          image,
          content,
          detailUrl
        };
      });
  
      blogs = newBlogs;
      save();
    }
  
    // 2) Render blogs into #blogContainer using the same classes
    function renderBlogs() {
      const container = byId('blogList');
      if (!container) return;
  
      // Clear existing content (we will re-render)
      container.innerHTML = '';
  
      // Create each card following your original structure: keep .blog-card class so CSS matches
      blogs.forEach((blog, idx) => {
        const card = document.createElement('div');
        card.className = 'blog-card';
        // Build inner HTML that mirrors typical original structure (image on top, title, excerpt, buttons)
        // We keep same class names so your CSS stays intact.
        const imageHtml = blog.image ? `<div class="card-image"><img src="${escapeHtml(blog.image)}" alt="${escapeHtml(blog.title)}"></div>` : '';
        const titleHtml = `<h3 class="blog-title">${escapeHtml(blog.title)}</h3>`;
        const excerptHtml = `<p class="blog-excerpt">${escapeHtml(truncate(blog.content, 320))}</p>`;
  
        // If there was an original detailUrl, use it for Read More; otherwise link to single.html?id=...
        const readHref = blog.detailUrl && blog.detailUrl.trim() !== '' ? blog.detailUrl : `single.html?id=${blog.id}`;
  
        const footerHtml = `
          <div class="card-buttons">
            <a class="read-more btn" href="${escapeHtml(readHref)}">Read More</a>
            <button class="delete-btn btn" data-index="${idx}">Delete</button>
          </div>
        `;
  
        card.innerHTML = imageHtml + `<div class="card-body">` + titleHtml + excerptHtml + footerHtml + `</div>`;
        container.appendChild(card);
      });
  
      // Attach event listeners to Delete buttons (delegation alternative)
      const delBtns = $qsa('.delete-btn', container);
      delBtns.forEach(btn => {
        btn.removeEventListener('click', onDeleteBtnClick); // safe remove
        btn.addEventListener('click', onDeleteBtnClick);
      });
    }
  
    // Delete handler
    function onDeleteBtnClick(e) {
      const btn = e.currentTarget;
      const idx = Number(btn.getAttribute('data-index'));
      deleteBlog(idx);
    }
  
    // Delete blog (moves to recentlyDeleted + shows undo)
    function deleteBlog(index) {
      if (index < 0 || index >= blogs.length) return;
      recentlyDeleted = { blog: blogs[index], index: index };
      blogs.splice(index, 1);
      save();
      renderBlogs();
      showUndo(recentlyDeleted);
    }
  
    // Show Undo message in #undoMessage
    let undoTimeout = null;
    function showUndo(deleted) {
      const box = byId('undoMessage');
      if (!box) return;
      box.innerHTML = `Blog deleted. <button id="undoBtn">Undo</button>`;
      box.style.display = 'block';
  
      // attach undo click
      const undoBtn = byId('undoBtn');
      undoBtn && undoBtn.addEventListener('click', function () { undoDelete(); });
  
      // auto-hide after 6s
      if (undoTimeout) clearTimeout(undoTimeout);
      undoTimeout = setTimeout(() => {
        box.style.display = 'none';
        recentlyDeleted = null;
        undoTimeout = null;
      }, 6000);
    }
  
    // Undo last delete
    function undoDelete() {
      if (!recentlyDeleted) return;
      // restore at original index or at end if index invalid
      const idx = Math.min(recentlyDeleted.index, blogs.length);
      blogs.splice(idx, 0, recentlyDeleted.blog);
      save();
      recentlyDeleted = null;
      const box = byId('undoMessage'); if (box) box.style.display = 'none';
      renderBlogs();
      if (undoTimeout) { clearTimeout(undoTimeout); undoTimeout = null; }
    }
  
    // Utility: add new blog (call from your create form)
    function addBlog({ title, image = '', content = '', detailUrl = '' }) {
      const newBlog = {
        id: Date.now(),
        title: title || 'Untitled',
        image: image || '',
        content: content || '',
        detailUrl: detailUrl || ''
      };
      // push to top (so newest appears first) — change to .push() if you prefer bottom
      blogs.unshift(newBlog);
      save();
      renderBlogs();
    }
  
    // Utility: truncate text
    function truncate(s, n) {
      s = s || '';
      return s.length > n ? s.slice(0, n) + '...' : s;
    }
  
    // Escape HTML for safety
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  
    // OPTIONAL: Render single post on single.html when ?id=...
    function renderSingleIfNeeded() {
      const out = byId('singleBlog');
      if (!out) return;
      const params = new URLSearchParams(location.search);
      const id = params.get('id');
      if (!id) {
        out.innerHTML = '<p>Post not found.</p>';
        return;
      }
      const post = blogs.find(b => String(b.id) === String(id));
      if (!post) {
        out.innerHTML = '<p>Post not found.</p>';
        return;
      }
      out.innerHTML = `
        <h2>${escapeHtml(post.title)}</h2>
        ${ post.image ? `<div class="single-image"><img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}"></div>` : '' }
        <div class="single-content"><p>${escapeHtml(post.content).replace(/\n/g,'<br>')}</p></div>
      `;
    }
  
    // PUBLIC API exposure (so your add page can call addBlog)
    window.inspireHub = {
      addBlog: (obj) => addBlog(obj),
      undoDelete: () => undoDelete(),
      deleteBlogById: (index) => deleteBlog(index)
    };
  
    // Init on DOM ready
    document.addEventListener('DOMContentLoaded', function () {
      initializeFromDOM();
      renderBlogs();
      renderSingleIfNeeded();
    });
  })();
  
  
  


  
  