// SavvyShop Side Panel Logic

let products = [];

// Load products from background
async function loadProducts(autoAnalyze = true) {
  try {
    const bg = chrome.runtime;
    products = await new Promise(resolve => {
      bg.sendMessage({ action: 'getProducts' }, resolve);
    }) || [];
    products = Object.values(products).filter(p => p && p.title);
    enrichProducts();
    render();
    
    if (autoAnalyze && products.length >= 2) {
      setTimeout(runAnalysis, 500);
    }
  } catch(e) {
    showEmpty();
  }
}

// --- SavvyScore Calculation ---
// 0-100: Price (40) + Rating (30) + Reviews (10) + Store Trust (20)
function computeScore(p, all) {
  if (!p || !p.priceNum) return null;
  
  // Collect stats from all products
  var prices = [];
  var ratings = [];
  var reviewCounts = [];
  for (var i = 0; i < all.length; i++) {
    var x = all[i];
    if (!x) continue;
    if (x.priceNum && x.priceNum > 0) prices.push(x.priceNum);
    if (x.rating && x.rating > 0) ratings.push(x.rating);
    if (x.reviewCount && x.reviewCount > 0) reviewCounts.push(x.reviewCount);
  }
  if (prices.length === 0) return null;
  
  // Sort for min/max
  prices.sort(function(a,b){return a-b;});
  var cheapest = prices[0];
  var priciest = prices[prices.length-1];
  var spread = priciest - cheapest || 1;
  
  ratings.sort(function(a,b){return a-b;});
  var bestRating = ratings.length > 0 ? ratings[ratings.length-1] : 0;
  
  reviewCounts.sort(function(a,b){return a-b;});
  var mostReviews = reviewCounts.length > 0 ? reviewCounts[reviewCounts.length-1] : 0;
  
  // 1. PRICE (0-40): cheapest = 40, priciest = 0
  var priceScore = Math.round(40 * (1 - ((p.priceNum - cheapest) / spread)));
  if (priceScore < 0) priceScore = 0;
  if (prices.length === 1) priceScore = 30;
  
  // 2. RATING (0-30): relative to best
  var ratingScore = 0;
  if (p.rating && bestRating > 0) {
    ratingScore = Math.round(30 * (p.rating / bestRating));
    if (ratingScore > 30) ratingScore = 30;
  }
  
  // 3. REVIEWS (0-10): log scale
  var reviewScore = 0;
  if (p.reviewCount && p.reviewCount > 0) {
    var logR = Math.log(p.reviewCount + 1) / Math.LN10;  // log10
    var logMax = mostReviews > 0 ? (Math.log(mostReviews + 1) / Math.LN10) : 1;
    reviewScore = Math.round(10 * (logR / logMax));
    if (reviewScore > 10) reviewScore = 10;
  }
  
  // 4. STORE TRUST (0-20)
  var storeScore = 5; // unknown store baseline
  var src = (p.source || '').toLowerCase();
  var trusted = ['amazon','walmart','target','bestbuy','costco','homedepot','lowes','macys','nordstrom','kohls','staples','newegg','ikea','gamestop','sephora','nike','adidas','ebay','wayfair','samsclub'];
  for (var t = 0; t < trusted.length; t++) {
    if (src.indexOf(trusted[t]) >= 0) { storeScore = 20; break; }
  }
  // Well-known store name but not in trusted list
  if (storeScore === 5 && src.length > 3 && !/^\d/.test(src)) storeScore = 12;
  
  var total = priceScore + ratingScore + reviewScore + storeScore;
  if (total > 100) total = 100;
  if (total < 1) total = 1;
  return total;
}

function scoreToGrade(s) {
  if (s >= 85) return 'A';
  if (s >= 70) return 'B';
  if (s >= 55) return 'C';
  if (s >= 40) return 'D';
  return 'F';
}

// --- Savings Intelligence ---
function enrichProducts() {
  products.forEach(function(p) {
    if (!p) return;
    p.priceNum = p.price ? parseFloat(String(p.price).replace(/[^0-9.]/g, '')) : null;
    p.curr = p.currency || (p.price && String(p.price).startsWith('£') ? 'GBP' : String(p.price).startsWith('€') ? 'EUR' : 'USD');
    p.unitPrice = parseUnitPrice(p.title, p.priceNum);
    p.valueScore = p.rating && p.priceNum ? (p.rating / p.priceNum * 100).toFixed(1) : null;
    p.savvyScore = computeScore(p, products);
    p.scoreGrade = p.savvyScore != null ? scoreToGrade(p.savvyScore) : null;
  });

  var currencies = [];
  products.forEach(function(p) { if (p && p.curr && currencies.indexOf(p.curr) < 0) currencies.push(p.curr); });
  products._mixedCurrencies = currencies.length > 1;

  var withPrice = products.filter(function(p) { return p && p.priceNum; });
  if (withPrice.length >= 2 && !products._mixedCurrencies) {
    const cheapest = withPrice.reduce((a, b) => a.priceNum < b.priceNum ? a : b);
    const priciest = withPrice.reduce((a, b) => a.priceNum > b.priceNum ? a : b);
    const gap = priciest.priceNum - cheapest.priceNum;
    if (gap > 0 && gap < priciest.priceNum) {
      products._savings = { cheapest, priciest, savingsGap: gap.toFixed(2) };
    }
  }

  // Winner = highest SavvyScore (falls back to cheapest if no scores)
  if (withPrice.length > 0) {
    var scored = withPrice.filter(function(p) { return p.savvyScore != null; });
    products._winner = scored.length > 0
      ? scored.reduce(function(a, b) { return (a.savvyScore || 0) >= (b.savvyScore || 0) ? a : b; })
      : withPrice.reduce(function(a, b) { return a.priceNum < b.priceNum ? a : b; });
  }

  // Cross-reference: flag SerpAPI prices that are suspiciously low vs verified tab prices
  var refPrice = null;
  products.forEach(function(p) {
    if (!p.fromSearch && p.priceNum && p.priceNum > 10) {
      refPrice = refPrice ? Math.min(refPrice, p.priceNum) : p.priceNum;
    }
  });

  // Assign badges
  products.forEach(function(p) {
    if (!p) return;
    p.badges = [];
    if (p.fromSearch && p.priceNum && refPrice && p.priceNum < refPrice * 0.7) {
      p.badges.push({ type: 'price-warn', label: '⚠️ Price may be wrong' });
    }
    if (p === products._winner && !p.badges.some(b => b.type === 'price-warn')) p.badges.push({ type: 'winner', label: '🏆 Best Deal' });
    else if (products._savings && p === products._savings.cheapest && !p.badges.some(b => b.type === 'price-warn')) p.badges.push({ type: 'best-price', label: '💰 Best Price' });
    var rated = products.filter(function(x) { return x && x.rating; }).map(function(x) { return x.rating; });
    var maxRating = rated.length > 0 ? Math.max.apply(null, rated) : 0;
    if (p.rating === maxRating && maxRating > 0 && p !== products._winner && p.savvyScore != null && p.savvyScore >= 70 && !p.badges.some(b => b.type === 'price-warn')) {
      p.badges.push({ type: 'top-rated', label: '⭐ Top Rated' });
    }
  });
}

function parseUnitPrice(title, priceNum) {
  if (!title || !priceNum) return null;
  const patterns = [
    /(\d+\.?\d*)\s*(oz|ounce|fl oz|fluid ounce)s?\b/i, /(\d+\.?\d*)\s*(lb|lbs|pound)s?\b/i,
    /(\d+\.?\d*)\s*(ml|mL|milliliter)s?\b/i, /(\d+\.?\d*)\s*(L|liter|litre)s?\b/i,
    /(\d+\.?\d*)\s*(g|gram|kg|kilogram)s?\b/i, /(\d+)\s*(count|ct|pack|pk|roll)\b/i,
  ];
  for (const pat of patterns) {
    const match = title.match(pat);
    if (match) {
      const amount = parseFloat(match[1]);
      let unit = match[2].toLowerCase();
      const um = {oz:'oz',ounce:'oz',lb:'lb',lbs:'lb',pound:'lb',ml:'ml',milliliter:'ml',l:'L',liter:'L',litre:'L',g:'g',gram:'g',kg:'kg',kilogram:'kg',count:'ct',ct:'ct',pack:'pk',pk:'pk',roll:'roll'};
      unit = um[unit] || unit;
      return { amount, unit, perUnit: (priceNum/amount).toFixed(2), label: '$'+(priceNum/amount).toFixed(2)+'/'+unit };
    }
  }
  return null;
}

function render() {
  enrichProducts();
  const container = document.getElementById('products-container');
  const aiContainer = document.getElementById('ai-container');
  const aiContent = document.getElementById('ai-content');
  const empty = document.getElementById('empty');
  const actions = document.getElementById('actions');
  const countEl = document.getElementById('header-count');
  if (countEl) countEl.textContent = products.length + ' products';
  
  if (products.length < 2) {
    container.innerHTML = '';
    aiContainer.style.display = 'none';
    actions.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  
  empty.style.display = 'none';
  actions.style.display = 'flex';
  
  // Render product cards
  const winner = products._winner;
  const s = products._savings;
  container.innerHTML = products.map(function(p, index) {
    if (!p) return '';
    const isWinner = winner && p === winner;
    const isCheapest = s && p === s.cheapest;
    const badgeHtml = (p.badges || []).map(b => `<span class="badge badge-${b.type}">${b.label}</span>`).join(' ');
    const unitHtml = p.unitPrice ? `<div class="unit-price">${p.unitPrice.label}</div>` : '';
    return `
    <div class="product-card${isWinner ? ' card-winner' : ''}${isCheapest && !isWinner ? ' card-best-price' : ''}">
      <button class="close-btn" data-index="${index}" title="Remove">✕</button>
      <div class="product-img">
        <img class="store-logo-img" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(getDomain(p) || 'google.com')}&sz=64" 
             style="width:48px;height:48px;margin-bottom:8px;object-fit:contain">
        <div class="store-badge-fallback" style="display:none">${getStoreIcon(p.source)}</div>
        <span class="store-name">${escapeHtml(getDomain(p) || p.source || 'Store')}</span>
      </div>
      <div class="badge-row">${badgeHtml}</div>
      <div class="title">${escapeHtml(p.title)}</div>
      ${p.price ? `<div class="price">${p.price}${p.currency && p.currency !== 'USD' ? ' ' + p.currency : ''}${p.fromSearch ? ' <span class="price-est" title="Price from Google Shopping — may differ from store">~est</span>' : ''}</div>` : '<div class="price no-price">No price</div>'}
      ${unitHtml}
      ${p.valueScore ? `<div class="value-score">Value: ${p.valueScore} pts/$</div>` : ''}
      ${p.savvyScore != null ? `<div class="savvy-score" style="display:flex;align-items:center;gap:8px;margin:4px 0;padding:5px 8px;background:#f0fdf4;border-radius:6px"><span style="font-size:18px;font-weight:800;color:#059669">${p.savvyScore}</span><span style="font-size:10px;color:#065f46;font-weight:600">Score ${p.scoreGrade}</span></div>` : `<div class="savvy-score" style="display:flex;align-items:center;gap:8px;margin:4px 0;padding:5px 8px;background:#fef2f2;border-radius:6px"><span style="font-size:12px;color:#dc2626">no score · priceNum=${p.priceNum} · rawPrice=${(p.price||'none').substring(0,12)}</span></div>`}
      <div class="meta">
        ${p.rating ? `⭐ ${p.rating}` : ''}
        ${p.reviewCount ? ` (${p.reviewCount.toLocaleString()} reviews)` : ''}
      </div>
      <div class="meta">
        ${p.source ? `<span class="source">${escapeHtml(p.source)}</span>` : ''}
      ${p.domain ? `<span class="source" style="background:#e0e7ff;color:#3730a3">🔗 ${escapeHtml(p.domain)}</span>` : ''}
      </div>
      ${p.delivery ? `<div class="meta" style="margin-top:8px;font-size:11px;color:#64748b">🚚 ${escapeHtml(p.delivery).substring(0,80)}</div>` : ''}
      <a href="#" class="buy-link${isWinner ? ' buy-link-winner' : ''}" data-url="${escapeHtml(p.url || '')}" data-source="${p.source || ''}" style="display:none">${isWinner ? '🛒 Buy Now — Best Deal' : '🛒 Buy Now'}</a>
    </div>
  `}).join('');
  
  // Attach store logo img error handlers (CSP-safe, no inline onerror)
  container.querySelectorAll('.store-logo-img').forEach(function(img) {
    img.addEventListener('error', function() {
      this.style.display = 'none';
      this.nextElementSibling.style.display = 'flex';
    });
  });

  // Attach close buttons and buy links
  container.querySelectorAll('.close-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var idx = parseInt(this.getAttribute('data-index'));
      removeProduct(idx);
    });
  });
  container.querySelectorAll('.buy-link').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var url = this.getAttribute('data-url');
      var source = this.getAttribute('data-source');
      var card = this.closest('.product-card');
      var titleEl = card ? card.querySelector('.title') : null;
      var title = titleEl ? titleEl.textContent.trim() : '';
      if (url) {
        openBuyUrl(url, source, title);
      }
    });
  });
  
  // AI recommendation section - show analyze button
  aiContainer.style.display = 'block';
  if (!aiContent.innerHTML.includes('btn-analyze') && !aiContent.innerHTML.includes('Analyzing')) {
    aiContainer.querySelector('h2').textContent = '📊 Ready to Compare';
    aiContent.innerHTML = `<p style="color:#64748b;margin-bottom:12px">${products.length} products loaded. Click below for a full AI-powered analysis.</p>
      <button class="btn btn-primary" id="btn-analyze">🔍 Analyze & Recommend</button>`;
    
    setTimeout(() => {
      var btn = document.getElementById('btn-analyze');
      if (btn) btn.addEventListener('click', runAnalysis);
    }, 100);
  }
}

async function generateRecommendation() {
  // Build comparison prompt
  let prompt = 'You are SavvyShop, an expert shopping assistant. Compare up to 6 products using the data below and give a definitive recommendation.\n\nHOW TO DECIDE: The SavvyScore (0-100) factors in price (40), rating (30), reviews (10), and store trust (20). The product with the HIGHEST SavvyScore is mathematically the best deal. Grade A=85+, B=70-84, C=55-69, D=40-54, F=<40. Your recommendation MUST be the highest SavvyScore product. Only override this if there is a very strong reason like international shipping with prohibitive import duties.\n\nIMPORTANT: Consider location. If any product ships from a different country/continent, factor in international shipping, import duties (15-30%), and delivery time. Prices marked "~est" are from Google Shopping and may differ from the actual store price. If a product has "⚠️ Price may be wrong", the listed price is likely inaccurate — do NOT recommend it based on price alone.\n\nDEFAULT RETURN POLICIES: Amazon: 30 days free. Amazon Mexico: 30 days. MercadoLibre: 30 days. Walmart: 90 days. Target: 90 days. Best Buy: 15 days. Costco: unlimited.\n\nANALYZE IN DEPTH — cover every section for every product:\n- 💰 PRICE & VALUE: Compare price, SavvyScore, and overall value for each product\n- 🔧 QUALITY & FEATURES: Build quality, what each product offers, what is missing\n- ⭐ TRUST & REVIEWS: Ratings, review volume, brand reputation, store reliability\n- 🚚 SHIPPING & LOCATION: Where from, speed, cost, international concerns\n- ⚠️ RED FLAGS: Any concerns — missing info, overseas shipping, poor return policies\n- 🏆 VERDICT: Pick the HIGHEST SavvyScore product. State the score, grade, and why it wins.\n\nBe thorough and detailed. Cover each section with 2-3 sentences. Use clear section headers with emoji. If a cheaper product requires international shipping, explain why the hidden costs make it worse.\n\nProducts:\n';
  products.forEach(function(p, i) {
    if (!p) return;
    prompt += 'Product ' + (i+1) + ': ' + p.title + '\n';
    if (p.savvyScore != null) prompt += '  SavvyScore: ' + p.savvyScore + '/100 (Grade ' + (p.scoreGrade || '?') + ')\n';
    if (p.price) prompt += '  Price: ' + p.price;
    if (p.currency) prompt += ' ' + p.currency;
    prompt += '\n';
    if (p.rating) prompt += `  Rating: ${p.rating}/5\n`;
    if (p.reviewCount) prompt += `  Reviews: ${p.reviewCount}\n`;
    if (p.source) prompt += `  Store/Domain: ${p.source} (${p.domain || p.source})\n`;
    if (p.brand) prompt += `  Brand: ${p.brand}\n`;
    if (p.features) prompt += `  Features: ${p.features.substring(0, 500)}\n`;
    if (p.description) prompt += `  Description: ${p.description.substring(0, 300)}\n`;
    if (p.delivery) prompt += `  Delivery: ${p.delivery.substring(0, 200)}\n`;
    if (p.returns) prompt += `  Returns: ${p.returns.substring(0, 200)}\n`;
    prompt += '\n';
  });
  
  // Try to call AI API — fallback to local logic if not available
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-3cf448cce77048659ce5eaf4efdd9562'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an expert product analyst. Write a thorough, detailed comparison. Use clear section headers with emoji. Be specific — mention prices, ratings, and concrete tradeoffs. Write 2-3 sentences per section minimum.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      var content = data.choices[0].message.content
        .replace(/—/g, '--')
        .replace(/–/g, '-')
        .replace(/[\*]{1,2}([^*]+)[\*]{1,2}/g, '$1')  // strip **bold** and *italic*
        .replace(/^#{1,4}\s+/gm, '')  // strip ### markdown headers
        .replace(/\n/g, '<br>');
      return content;
    }
  } catch(e) {}
  
  return generateQuickCompare();
}

function generateQuickCompare() {
  if (products.length < 2) return 'Need at least 2 products to compare.';
  
  var result = '<div style="line-height:1.8">';
  
  // Rank by SavvyScore
  var ranked = products.filter(function(p) { return p && p.savvyScore != null; })
    .sort(function(a, b) { return (b.savvyScore || 0) - (a.savvyScore || 0); });
  if (ranked.length > 0) {
    result += '📊 <strong>SavvyScore Ranking:</strong><br>';
    ranked.forEach(function(p, i) {
      result += '&nbsp;&nbsp;# ' + (i+1) + ': ' + escapeHtml(p.title.substring(0, 50)) + '... — ';
      result += '<strong>' + p.savvyScore + '/100 (' + (p.scoreGrade || '?') + ')</strong> ';
      result += 'at ' + (p.price || 'N/A') + ' on ' + (p.source || '?');
      if (i === 0) result += ' 🏆 WINNER';
      result += '<br>';
    });
    result += '<br>';
  }
  
  // Price comparison
  var currencies = {};
  products.forEach(function(p) {
    if (!p || !p.price) return;
    var curr = p.currency || 'USD';
    if (!currencies[curr]) currencies[curr] = [];
    currencies[curr].push(p);
  });
  
  for (var curr in currencies) {
    var items = currencies[curr];
    if (items.length < 2) continue;
    var sorted = items.slice().sort(function(a, b) {
      return parseFloat(String(a.price).replace(/[^\d.]/g, '')) - parseFloat(String(b.price).replace(/[^\d.]/g, ''));
    });
    var cheapest = sorted[0];
    var mostExpensive = sorted[sorted.length - 1];
    var diff = parseFloat(String(mostExpensive.price).replace(/[^\d.]/g, '')) - parseFloat(String(cheapest.price).replace(/[^\d.]/g, ''));
    result += '💰 <strong>Price range (' + curr + '):</strong> ' + cheapest.price + ' – ' + mostExpensive.price;
    if (diff > 0) result += ' (saves up to <strong>' + (curr === 'MXN' ? 'MX$' : curr === 'GBP' ? '£' : curr === 'EUR' ? '€' : '$') + diff.toFixed(2) + '</strong>)';
    result += '<br>';
  }
  
  // Quick verdict
  var winner = products._winner;
  result += '<br>📊 <strong>Verdict:</strong> ';
  if (winner && winner.savvyScore != null) {
    result += 'Pick <strong>' + escapeHtml(winner.title.substring(0, 40)) + '...</strong> ';
    result += '(SavvyScore: ' + winner.savvyScore + '/100, Grade ' + (winner.scoreGrade || '?') + ') ';
    result += 'at ' + (winner.price || 'N/A') + ' on ' + (winner.source || '?') + '.';
  } else if (winner) {
    result += escapeHtml(winner.title.substring(0, 50)) + '... is the best deal.';
  } else {
    result += 'More data needed.';
  }
  
  result += '</div>';
  return result;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getStoreIcon(source) {
  var icons = {
    'amazon':'📦','ebay':'🛍️','walmart':'🏪','target':'🎯','bestbuy':'🔵',
    'best buy':'🔵','homedepot':'🏠','costco':'🏬','newegg':'🔧','etsy':'🎨',
    'aliexpress':'🌐','mercadolibre':'🛒',
  };
  var key = (source || '').toLowerCase().replace('www.','');
  return icons[key] || '🏷️';
}

function getDomain(p) {
  if (p.domain) return p.domain;
  var s = (p.source || '').toLowerCase().replace(/\s+/g,'');
  var map = {
    'amazon':'amazon.com','ebay':'ebay.com','walmart':'walmart.com',
    'target':'target.com','bestbuy':'bestbuy.com',
    'homedepot':'homedepot.com','costco':'costco.com','newegg':'newegg.com',
    'etsy':'etsy.com','aliexpress':'aliexpress.com','mercadolibre':'mercadolibre.com.mx',
    'gamestop':'gamestop.com','microcenter':'microcenter.com',
    'ikea':'ikea.com','sephora':'sephora.com','macys':'macys.com','nike':'nike.com',
    'adidas':'adidas.com','zara':'zara.com','hm':'hm.com','lowes':'lowes.com',
    'staples':'staples.com','officedepot':'officedepot.com','wayfair':'wayfair.com',
    'kohls':'kohls.com','nordstrom':'nordstrom.com',
    'sony':'sony.com','samsung':'samsung.com','apple':'apple.com',
    'dell':'dell.com','hp':'hp.com','lenovo':'lenovo.com',
    'lg':'lg.com','bose':'bose.com',
  };
  var d = map[s];
  if (d) return d;
  if (s.includes('.') && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return s;
  // No real domain — return empty, card will show source name instead
  return '';
}

function openBuyUrl(url, source, productTitle) {
  if (!url || url.length < 5 || url === 'null' || url === 'undefined') {
    alert('Cannot open: no product URL available for this store.');
    return;
  }
  if (!url.startsWith('http')) {
    url = 'https://' + url.replace(/^\/+/, '');
  }
  if (url.indexOf('.', 10) < 0) {
    alert('Invalid product URL: ' + url);
    return;
  }
  // If URL is a Google redirect, resolve it through the background to get the actual store URL
  if (url.includes('google.com')) {
    chrome.runtime.sendMessage({ action: 'resolveUrl', url: url }, function(response) {
      var finalUrl = (response && response.resolvedUrl) ? response.resolvedUrl : url;
      window.open(finalUrl, '_blank');
    });
    return;
  }
  window.open(url, '_blank');
}

function showEmpty() {
  document.getElementById('products-container').innerHTML = '';
  document.getElementById('ai-container').style.display = 'none';
  document.getElementById('actions').style.display = 'none';
  document.getElementById('empty').style.display = 'block';
}

async function runAnalysis() {
  const aiContainer = document.getElementById('ai-container');
  const aiContent = document.getElementById('ai-content');
  aiContainer.querySelector('h2').textContent = '🤖 Analyzing...';
  aiContent.innerHTML = '<div class="loader" style="font-style:normal">Comparing all products</div>';
  
  try {
    const rec = await generateRecommendation();
    aiContainer.querySelector('h2').textContent = '🤖 AI Recommendation';
    aiContent.innerHTML = rec;
    // Show buy button after a small delay to ensure DOM is updated
    setTimeout(() => showBuyButton(rec), 300);
    showSavings();
  } catch(e) {
    aiContainer.querySelector('h2').textContent = '📊 Quick Comparison';
    aiContent.innerHTML = generateQuickCompare();
  }
}

function showBuyButton(analysis) {
  // Show buy buttons on all products after analysis
  var btns = document.querySelectorAll('.buy-link');
  btns.forEach(function(btn) { btn.style.display = 'block'; });
  
  // Always highlight the highest SavvyScore product (matches the winner)
  var cards = document.querySelectorAll('.product-card');
  var bestIdx = -1;
  var bestScore = -1;
  products.forEach(function(p, i) {
    if (p.savvyScore != null && p.savvyScore > bestScore) {
      bestScore = p.savvyScore;
      bestIdx = i;
    }
  });
  
  if (cards[bestIdx]) {
    // Remove any existing recommended class first
    cards.forEach(function(c) { c.classList.remove('recommended'); });
    cards[bestIdx].classList.add('recommended');
    var winBtn = cards[bestIdx].querySelector('.buy-link');
    if (winBtn) winBtn.textContent = '🏆 Buy Now';
  }
}

function showSavings() {
  const aiContent = document.getElementById('ai-content');
  const winner = products._winner;
  
  // Winner callout first
  if (winner) {
    const currStr = winner.currency !== 'USD' ? ' ' + (winner.currency || '') : '';
    aiContent.innerHTML = '<div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:14px;color:#065f46;text-align:center">🏆 <strong>Best Deal:</strong> ' + escapeHtml(winner.title.substring(0, 60)) + '... at <strong>' + (winner.price || 'N/A') + currStr + '</strong></div>' + aiContent.innerHTML;
  }
  
  // Savings: most expensive minus winner (only if positive)
  if (winner && winner.priceNum) {
    const withPrice = products.filter(function(p) { return p && p.priceNum; });
    if (withPrice.length >= 2) {
      const priciest = withPrice.reduce(function(a, b) { return a.priceNum > b.priceNum ? a : b; });
      const saved = priciest.priceNum - winner.priceNum;
      if (saved > 0 && priciest !== winner) {
        const sym = priciest.currency === 'GBP' ? '£' : priciest.currency === 'EUR' ? '€' : priciest.currency === 'ZAR' ? 'R' : '$';
        aiContent.innerHTML = '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:14px;color:#92400e;text-align:center">💰 <strong>Save ' + sym + saved.toFixed(2) + '</strong> vs ' + escapeHtml(priciest.title.substring(0, 30)) + '... by choosing ' + escapeHtml(winner.title.substring(0, 30)) + '...</div>' + aiContent.innerHTML;
      }
    }
  }
}

function refresh() {
  const btn = document.querySelector('.btn-primary');
  const origText = btn.textContent;
  btn.textContent = '⏳ Scanning all tabs...';
  btn.disabled = true;
  
  products = [];
  document.getElementById('ai-container').style.display = 'none';
  document.getElementById('ai-content').innerHTML = '';
  
  chrome.runtime.sendMessage({ action: 'rescanAll' }, (response) => {
    if (response) {
      btn.textContent = '✅ Scanned ' + response.scanned + ' tabs, found ' + response.found + ' products. Refresh product tabs if missing.';
    } else {
      btn.textContent = '⚠️ Scan failed. Refresh product tabs (F5) and try again.';
    }
    setTimeout(() => {
      btn.textContent = origText;
      btn.disabled = false;
    }, 4000);
    setTimeout(loadProducts, 1500);
  });
}

function removeProduct(index) {
  if (index >= 0 && index < products.length) {
    products.splice(index, 1);
    render();
  }
}

// Auto-load — check if this is a search result or tab scan
let pollInterval = null;
document.addEventListener('DOMContentLoaded', () => {
  var urlParams = new URLSearchParams(window.location.search);
  var currentSearchId = parseInt(urlParams.get('sid')) || 0;
  if (urlParams.get('mode') === 'search') {
    // Popup already stored currentProduct + triggered search — just wait for results
    function loadProgress(attempt) {
      chrome.storage.local.get(['searchResults','searchStatus','searchId'], function(data) {
        // Skip stale data from previous searches (old searchId or missing searchId means stale)
        if (!data.searchId || data.searchId !== currentSearchId) {
          if (attempt < 60) setTimeout(function() { loadProgress(attempt + 1); }, 400);
          return;
        }
        products = (data.searchResults || []);
        var status = data.searchStatus || '';
        
        // Keep showing progress while search is running, regardless of count
        if (status === 'searching' && attempt < 60) {
          var msgs = ['Searching across stores...','Finding the best prices...','Comparing options...','Almost there...'];
          var msg = msgs[Math.min(Math.floor(attempt/8), msgs.length-1)];
          var pct = Math.min(attempt * 3.5, 90);
          document.getElementById('empty').innerHTML = 
            '<div class="empty-state">' +
            '<div class="icon">🔍</div>' +
            '<h3>' + msg + '</h3>' +
            '<div class="progress-bar">' +
            '<div class="progress-fill" style="width:' + pct + '%"></div>' +
            '</div></div>';
          document.getElementById('empty').style.display = 'block';
          setTimeout(function() { loadProgress(attempt + 1); }, 400);
        } else if (status === 'done' && products.length >= 2) {
          render();
          setTimeout(runAnalysis, 500);
        } else if (status === 'done') {
          document.getElementById('empty').innerHTML = '<div class="empty-state"><p>No similar products found.</p></div>';
          document.getElementById('empty').style.display = 'block';
        } else {
          // Still waiting, retry
          if (attempt < 60) {
            setTimeout(function() { loadProgress(attempt + 1); }, 400);
          } else {
            document.getElementById('empty').innerHTML = '<div class="empty-state"><p>Search timed out. Please try again.</p></div>';
            document.getElementById('empty').style.display = 'block';
          }
        }
      });
    }
    loadProgress(0);
    var rb = document.getElementById('btn-rescan');
    if (rb) rb.style.display = 'none';
  } else {
    chrome.runtime.sendMessage({ action: 'rescanAll' }, () => {
      setTimeout(() => loadProducts(false), 2000);
    });
    document.getElementById('btn-rescan').addEventListener('click', refresh);
    pollInterval = setInterval(async () => {
      const bg = chrome.runtime;
      const latest = await new Promise(resolve => {
        bg.sendMessage({ action: 'getProducts' }, resolve);
      }) || [];
      if (latest.length !== products.length) {
        products = latest;
        render();
      }
    }, 5000);
  }
});

window.addEventListener('beforeunload', () => {
  if (pollInterval) clearInterval(pollInterval);
});

// Listen for verified price updates from background (real store page prices)
chrome.runtime.onMessage.addListener(function(message) {
  if (message.action === 'priceVerified' && products && products[message.index]) {
    var p = products[message.index];
    p.price = message.price;
    p.fromSearch = false;
    var cards = document.querySelectorAll('.product-card');
    if (cards[message.index]) {
      var priceEl = cards[message.index].querySelector('.price');
      if (priceEl) { priceEl.textContent = message.price; priceEl.style.color = '#059669'; }
      var estEl = cards[message.index].querySelector('.price-est');
      if (estEl) estEl.remove();
      var warnEl = cards[message.index].querySelector('.badge-price-warn');
      if (warnEl) warnEl.remove();
    }
  }
});
