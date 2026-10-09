(() => {
  const config = window.EBM_SUPABASE_CONFIG || {};
  if (!config.url || !config.publishableKey || !window.supabase?.createClient) return;
  const client = window.supabase.createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const text = (tag, value, className) => { const el = document.createElement(tag); if (className) el.className = className; el.textContent = value || ''; return el; };
  const waLink = name => { const a = document.createElement('a'); a.className = 'product-link'; a.target = '_blank'; a.rel = 'noreferrer'; a.href = `https://wa.me/255767798050?text=${encodeURIComponent(`Hello EBM Machinery, I'm interested in the ${name}.`)}`; a.append(document.createTextNode('Ask about this product ')); const arrow = text('span', '↗'); a.append(arrow); return a; };
  function card(product, index) {
    const article = document.createElement('article'); article.className = 'product-card';
    const media = document.createElement('a'); media.className = 'product-media'; media.href = product.image_url || 'assets/ebm-mark.svg'; media.target = '_blank'; media.rel = 'noreferrer'; media.setAttribute('aria-label', `View ${product.name}`);
    const img = document.createElement('img'); img.src = product.image_url || 'assets/ebm-mark.svg'; img.alt = product.name; img.loading = 'lazy'; media.append(img, text('span', product.category.toUpperCase(), 'image-tag'));
    const info = document.createElement('div'); info.className = 'product-info'; info.append(text('div', `${String(index + 1).padStart(2, '0')} / ${product.category.toUpperCase()}`, 'product-number'), text('h3', product.name), text('p', product.description, 'product-subtitle'));
    if (product.price != null) info.append(text('p', new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(product.price), 'product-price'));
    if (product.highlights?.length) { const ul = document.createElement('ul'); ul.className = 'spec-list'; product.highlights.forEach(value => ul.append(text('li', value))); info.append(ul); }
    const videoUrl = product.video_url || (product.slug === 'vibrated-single-block-machine' ? 'assets/single-block-machine-demo.mp4' : null);
    if (videoUrl) { const video = document.createElement('video'); video.className = 'product-demo'; video.controls = true; video.playsInline = true; video.preload = 'metadata'; video.src = videoUrl; video.setAttribute('aria-label', `${product.name} demonstration`); info.append(video); }
    info.append(waLink(product.name)); article.append(media, info); if (product.is_featured) article.classList.add('product-featured'); return article;
  }
  function pavingPhoto(product) {
    const article = document.createElement('article'); article.className = 'product-card';
    const link = document.createElement('a'); link.className = 'product-media'; link.href = product.image_url || 'assets/ebm-mark.svg'; link.target = '_blank'; link.rel = 'noreferrer'; link.setAttribute('aria-label', `View ${product.name}`);
    const img = document.createElement('img'); img.src = product.image_url || 'assets/ebm-mark.svg'; img.alt = product.name; img.loading = 'lazy';
    link.append(img); article.append(link); return article;
  }
  async function load() {
    const { data, error } = await client.from('products').select('slug,name,category,description,highlights,price,image_url,video_url,is_featured,sort_order').eq('is_active', true).order('sort_order').order('name');
    if (error || !data?.length) return;
    const machineGrid = document.querySelector('#machines .product-grid');
    const pavingGrid = document.querySelector('#paving .product-grid');
    const machineProducts = data.filter(product => product.category.toLowerCase() !== 'paving');
    const pavingProducts = data.filter(product => product.category.toLowerCase() === 'paving');
    if (machineGrid && machineProducts.length) machineGrid.replaceChildren(...machineProducts.map(card));
    if (pavingGrid && pavingProducts.length) pavingGrid.replaceChildren(...pavingProducts.map(pavingPhoto));
    const { data: settings } = await client.from('business_settings').select('company_name,phone,whatsapp_number,location,logo_url').eq('id', true).maybeSingle();
    if (settings) {
      document.querySelectorAll('.contact-details a[href^="tel:"]').forEach(a => { a.href = `tel:${settings.phone.replace(/[^+\d]/g, '')}`; a.textContent = settings.phone; });
      const location = document.querySelector('.contact-details div:nth-child(2) p'); if (location) location.textContent = settings.location;
      if (settings.logo_url) document.querySelectorAll('.brand img').forEach(img => { img.src = settings.logo_url; });
      if (settings.company_name) document.querySelectorAll('.contact-details div:nth-child(3) p').forEach(el => { el.textContent = settings.company_name; });
      document.querySelectorAll('a[href*="wa.me/255767798050"]').forEach(a => { a.href = a.href.replace('wa.me/255767798050', `wa.me/${settings.whatsapp_number}`); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
