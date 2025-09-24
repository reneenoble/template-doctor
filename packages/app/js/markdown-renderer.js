// Initialize marked.js for markdown rendering in the dashboard
(function() {
  // Check if marked is already loaded
  if (window.marked) {
    console.log('Marked.js already loaded');
    return;
  }
  
  // Create a script element to load marked.js from CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js';
  script.integrity = 'sha256-xoB1Zy2Xbkd3OQVguqESGUhVvUQEsTZH2khVquH5Ngw=';
  script.crossOrigin = 'anonymous';
  script.onload = function() {
    console.log('Marked.js loaded successfully');
    // Set default options
    marked.setOptions({
      gfm: true,
      breaks: true,
      pedantic: false,
      sanitize: false,
      smartLists: true,
      smartypants: true
    });
    
    // Create a custom renderer
    const renderer = new marked.Renderer();
    
    // Customize code blocks to have syntax highlighting
    renderer.code = function(code, language) {
      return `<pre class="code-block"><code class="language-${language || 'text'}">${code}</code></pre>`;
    };
    
    // Set the custom renderer
    marked.setOptions({ renderer });
    
    // Dispatch event that marked is ready
    document.dispatchEvent(new Event('marked-ready'));
  };
  
  script.onerror = function() {
    console.error('Failed to load Marked.js');
  };
  
  // Add the script to the document
  document.head.appendChild(script);
})();