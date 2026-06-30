// SavvyShop v3 — Tab-Based Comparison
// Shows products from opened background tabs. Buy Now switches to the tab.

let products = [];
let comparisonId = null;

async function loadProducts() {
	try {
		const bg = chrome.runtime;
		const bgProducts =
			(await new Promise((resolve) => {
				bg.sendMessage({ action: "getProducts" }, resolve);
			})) || [];
		products = Object.values(bgProducts).filter((p) => p && p.title);
		if (products.length >= 2) {
			render();
			setTimeout(runAnalysis, 500);
		} else {
			showEmpty();
		}
	} catch (e) {
		showEmpty();
	}
}

async function loadTabComparison() {
	const data = await chrome.storage.local.get([
		`comparison_${comparisonId}`,
		"comparisonStatus",
	]);
	const compProducts = data[`comparison_${comparisonId}`] || [];
	const status = data.comparisonStatus || "searching";
	const debug = document.getElementById("header-count");
	if (debug)
		debug.textContent =
			"c=" +
			comparisonId +
			" products=" +
			compProducts.length +
			" status=" +
			status;

	const scraped = compProducts.filter(
		(p) => p && p.title && p.title.length > 3,
	);

	if (scraped.length >= 2) {
		products = scraped;
		products._fromTabs = true;
		render();
		setTimeout(runAnalysis, 500);
	} else if (status === "searching" || status === "fetching") {
		// Still fetching, show progress
		showProgress(scraped.length, Math.max(compProducts.length, 6));
		setTimeout(loadTabComparison, 1500);
	} else if (compProducts.length >= 2) {
		// Done but only 1 valid — show whatever we have
		products = compProducts.filter((p) => p.title && p.title.length > 3);
		if (products.length >= 2) {
			render();
			setTimeout(runAnalysis, 500);
		} else {
			showEmpty();
		}
	} else {
		showEmpty();
	}
}

const DOMPurify = window.DOMPurify || { sanitize: (x) => x };
function setHTML(el, html) {
	el.textContent = "";
	const range = document.createRange();
	range.selectNode(document.body);
	el.appendChild(range.createContextualFragment(html));
}

function showProgress(found, total) {
	const empty = document.getElementById("empty");
	const pct = Math.min((found / Math.max(total, 6)) * 100, 90);
	setHTML(
		empty,
		`
    <div class="empty-state">
      <div class="icon">🔍</div>
      <h3>Finding products ${found}/${total}</h3>
      <p>Please allow up to 30 seconds</p>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    </div>`,
	);
	empty.style.display = "block";
}

// ── SavvyScore (kept from v2) ──

function computeScore(p, all) {
	if (!p || !p.priceNum) return null;
	var prices = [],
		ratings = [],
		reviewCounts = [];
	for (var i = 0; i < all.length; i++) {
		var x = all[i];
		if (!x) continue;
		if (x.priceNum && x.priceNum > 0) prices.push(x.priceNum);
		if (x.rating && x.rating > 0) ratings.push(x.rating);
		if (x.reviewCount && x.reviewCount > 0) reviewCounts.push(x.reviewCount);
	}
	if (prices.length === 0) return null;
	prices.sort((a, b) => a - b);
	var cheapest = prices[0],
		priciest = prices[prices.length - 1],
		spread = priciest - cheapest || 1;
	ratings.sort((a, b) => a - b);
	var bestRating = ratings.length > 0 ? ratings[ratings.length - 1] : 0;
	reviewCounts.sort((a, b) => a - b);
	var mostReviews =
		reviewCounts.length > 0 ? reviewCounts[reviewCounts.length - 1] : 0;

	var priceScore = Math.round(40 * (1 - (p.priceNum - cheapest) / spread));
	if (priceScore < 0) priceScore = 0;
	if (prices.length === 1) priceScore = 30;

	var ratingScore = 0;
	if (p.rating && bestRating > 0) {
		ratingScore = Math.round(30 * (p.rating / bestRating));
		if (ratingScore > 30) ratingScore = 30;
	}

	var reviewScore = 0;
	if (p.reviewCount && p.reviewCount > 0) {
		var logR = Math.log(p.reviewCount + 1) / Math.LN10;
		var logMax = mostReviews > 0 ? Math.log(mostReviews + 1) / Math.LN10 : 1;
		reviewScore = Math.round(10 * (logR / logMax));
		if (reviewScore > 10) reviewScore = 10;
	}

	var storeScore = 5;
	var src = (p.source || "").toLowerCase();
	var trusted = [
		"amazon",
		"walmart",
		"target",
		"bestbuy",
		"costco",
		"homedepot",
		"lowes",
		"macys",
		"nordstrom",
		"kohls",
		"staples",
		"newegg",
		"ikea",
		"gamestop",
		"sephora",
		"nike",
		"adidas",
		"ebay",
		"wayfair",
		"samsclub",
	];
	for (var t = 0; t < trusted.length; t++) {
		if (src.indexOf(trusted[t]) >= 0) {
			storeScore = 20;
			break;
		}
	}
	if (storeScore === 5 && src.length > 3 && !/^\d/.test(src)) storeScore = 12;

	var total = priceScore + ratingScore + reviewScore + storeScore;
	if (total > 100) total = 100;
	if (total < 1) total = 1;
	return total;
}

function scoreToGrade(s) {
	if (s >= 85) return "A";
	if (s >= 70) return "B";
	if (s >= 55) return "C";
	if (s >= 40) return "D";
	return "F";
}

function enrichProducts() {
	products.forEach((p) => {
		if (!p) return;
		p.priceNum = p.price
			? parseFloat(String(p.price).replace(/[^0-9.]/g, ""))
			: null;
		p.curr = p.currency || "USD";
		p.savvyScore = computeScore(p, products);
		p.scoreGrade = p.savvyScore != null ? scoreToGrade(p.savvyScore) : null;
	});
	var withPrice = products.filter((p) => p && p.priceNum);
	if (withPrice.length > 0) {
		var scored = withPrice.filter((p) => p.savvyScore != null);
		products._winner =
			scored.length > 0
				? scored.reduce((a, b) =>
						(a.savvyScore || 0) >= (b.savvyScore || 0) ? a : b,
					)
				: withPrice.reduce((a, b) => (a.priceNum < b.priceNum ? a : b));
	}
	products.forEach((p) => {
		if (!p) return;
		p.badges = [];
		if (p === products._winner)
			p.badges.push({ type: "winner", label: "🏆 Best Deal" });
	});
}

function render() {
	enrichProducts();
	const container = document.getElementById("products-container");
	const aiContainer = document.getElementById("ai-container");
	const aiContent = document.getElementById("ai-content");
	const empty = document.getElementById("empty");
	const actions = document.getElementById("actions");
	const countEl = document.getElementById("header-count");

	if (products.length < 2) {
		container.textContent = "";
		aiContainer.style.display = "none";
		actions.style.display = "none";
		empty.style.display = "block";
		return;
	}

	empty.style.display = "none";
	actions.style.display = "flex";
	if (countEl) countEl.textContent = products.length + " products";

	const winner = products._winner;
	setHTML(
		container,
		products
			.map((p) => {
				if (!p) return "";
				const isWinner = winner && p === winner;
				return `
    <div class="product-card${isWinner ? " card-winner" : ""}">
      <div class="product-img">
        <img class="store-logo-img" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(p.domain || p.source || "google.com")}&sz=64" style="width:40px;height:40px;object-fit:contain">
        <span class="store-name">${escapeHtml(p.source || p.domain || "Store")}</span>
      </div>
      <div class="badge-row">${(p.badges || []).map((b) => `<span class="badge badge-${b.type}">${b.label}</span>`).join(" ")}</div>
      <div class="title">${escapeHtml(p.title)}</div>
      ${p.price ? `<div class="price">${p.price}</div>` : ""}
      ${p.savvyScore != null ? `<div class="savvy-score"><span class="score-number">${p.savvyScore}</span><span class="score-grade">Score ${p.scoreGrade}</span></div>` : '<div class="savvy-score no-score"><span class="score-number">—</span><span class="score-grade">No score</span></div>'}
      <div class="meta">
        ${p.rating ? `⭐ ${p.rating}` : ""}
        ${p.reviewCount ? ` (${p.reviewCount.toLocaleString()} reviews)` : ""}
      </div>
      ${p.source ? `<span class="source-tag">${escapeHtml(p.source)}</span>` : ""}
      <button class="buy-link${isWinner ? " buy-link-winner" : ""}" data-url="${escapeHtml(p.url || "")}" data-tab-id="${p.tabId || ""}">🏆 Buy Now</button>
    </div>`;
			})
			.join(""),
	);

	// Attach Buy Now handlers — switch to tab or open URL directly
	container.querySelectorAll(".buy-link").forEach((btn) => {
		btn.addEventListener("click", function () {
			const tabId = parseInt(this.getAttribute("data-tab-id"));
			const url = this.getAttribute("data-url");
			if (tabId) {
				chrome.runtime.sendMessage({ action: "activateTab", tabId: tabId });
			} else if (url) {
				chrome.tabs.create({ url: url, active: true });
			}
		});
	});

	// AI Section
	aiContainer.style.display = "block";
	aiContainer.querySelector("h2").textContent = "🤖 AI Analysis";
	if (
		!aiContent.textContent.includes("Analyze & Recommend") &&
		!aiContent.textContent.includes("Comparing all products")
	) {
		setHTML(
			aiContent,
			`<p style="color:var(--muted);margin-bottom:12px">${products.length} products loaded. Click below for AI analysis.</p>
      <button class="btn btn-primary" id="btn-analyze">🔍 Analyze & Recommend</button>`,
		);
		setTimeout(() => {
			var btn = document.getElementById("btn-analyze");
			if (btn) btn.addEventListener("click", runAnalysis);
		}, 100);
	}
}

function escapeHtml(text) {
	if (!text) return "";
	return String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function showEmpty() {
	document.getElementById("products-container").textContent = "";
	document.getElementById("ai-container").style.display = "none";
	document.getElementById("actions").style.display = "none";
	document.getElementById("empty").style.display = "block";
}

// ── AI Analysis ──

async function runAnalysis() {
	const aiContent = document.getElementById("ai-content");
	setHTML(aiContent, '<div class="loader">Comparing all products</div>');

	try {
		const rec = await generateRecommendation();
		setHTML(aiContent, rec);
		setTimeout(() => showBuyButton(), 300);
	} catch (e) {
		setHTML(aiContent, generateQuickCompare());
	}
}

async function generateRecommendation() {
	let prompt =
		"You are SavvyShop, an expert shopping assistant. Analyze these products and recommend the best place to buy.\n\nFORMAT YOUR RESPONSE LIKE THIS:\n\n📊 PRICE COMPARISON: List each store with its price. Note which is cheapest.\n\n⭐ STORE ANALYSIS: For each store, evaluate reputation, return policy, shipping reliability, and customer service. Give each a trust rating (High/Medium/Low).\n\n💰 VALUE ASSESSMENT: Is the cheapest actually the best value considering store trust and return policy?\n\n🏆 FINAL VERDICT: Pick ONE winner. Explain exactly why this store is the best choice for THIS specific product.\n\nBe specific, detailed, and helpful. Use the store names and prices provided.\n\nProducts:\n";
	products.forEach((p, i) => {
		if (!p || !p.title) return;
		prompt += "Product " + (i + 1) + ": " + p.title + "\n";
		if (p.savvyScore != null)
			prompt +=
				"  SavvyScore: " +
				p.savvyScore +
				"/100 (Grade " +
				(p.scoreGrade || "?") +
				")\n";
		if (p.price) prompt += "  Price: " + p.price + "\n";
		if (p.rating) prompt += "  Rating: " + p.rating + "/5\n";
		if (p.reviewCount) prompt += "  Reviews: " + p.reviewCount + "\n";
		if (p.source) prompt += "  Store: " + p.source + "\n";
		prompt += "\n";
	});

	try {
		const response = await chrome.runtime.sendMessage({
			action: "aiAnalysis",
			prompt: prompt,
		});
		if (response && response.content) {
			var text = response.content
				.replace(/###?\s+/g, "") // ### headers
				.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // **bold**
				.replace(/\*(.*?)\*/g, "<em>$1</em>") // *italic*
				.replace(/^\d+\.\s/gm, "• ") // numbered lists
				.replace(/^-\s/gm, "• ") // bullet lists
				.replace(/\n/g, "<br>");
			return text;
		}
	} catch (e) {}
	return generateQuickCompare();
}

function generateQuickCompare() {
	if (products.length < 2) return "Need at least 2 products to compare.";
	var result = '<div style="line-height:1.8">';
	var ranked = products
		.filter((p) => p && p.savvyScore != null)
		.sort((a, b) => (b.savvyScore || 0) - (a.savvyScore || 0));

	// Price comparison table
	var withPrices = products.filter((p) => p && p.price);
	if (withPrices.length > 0) {
		result += "<h3>📊 Price Comparison</h3>";
		withPrices.sort(
			(a, b) =>
				parseFloat(String(a.price).replace(/[^0-9.]/g, "")) -
				parseFloat(String(b.price).replace(/[^0-9.]/g, "")),
		);
		withPrices.forEach((p, i) => {
			var isCheapest = i === 0;
			result +=
				"<div style='margin:4px 0'>" +
				"<strong>" +
				escapeHtml(p.source || "Unknown") +
				"</strong>: " +
				escapeHtml(p.price || "N/A") +
				(isCheapest ? " 💰 Cheapest" : "") +
				"</div>";
		});
		result += "<br>";
	}

	// Winner analysis
	if (ranked.length > 0) {
		var winner = ranked[0];
		result += "<h3>🏆 Best Deal</h3>";
		result +=
			"<p><strong>" +
			escapeHtml(winner.source || "Store") +
			"</strong> wins with a SavvyScore of <strong>" +
			winner.savvyScore +
			"/100</strong> (Grade " +
			(winner.scoreGrade || "?") +
			")</p>";
		if (winner.price)
			result +=
				"<p>Price: <strong>" + escapeHtml(winner.price) + "</strong></p>";

		// Explain the score
		result += "<p style='font-size:0.9em;color:var(--muted)'>";
		result +=
			"The SavvyScore combines price competitiveness (40%), store rating (30%), review volume (10%), and store trust (20%). ";
		if (winner.savvyScore >= 80)
			result += "This is an excellent deal from a trusted retailer.";
		else if (winner.savvyScore >= 60)
			result += "This is a solid choice with good value.";
		else
			result +=
				"Consider checking the store's return policy before purchasing.";
		result += "</p>";
	}

	// Store trust comparison
	var allStores = products.filter((p) => p && p.source);
	if (allStores.length > 1) {
		result += "<h3>🏪 Store Comparison</h3>";
		result += "<div style='display:flex;flex-wrap:wrap;gap:8px'>";
		var trustedStores = [
			"amazon",
			"walmart",
			"target",
			"bestbuy",
			"costco",
			"homedepot",
			"lowes",
			"macys",
			"nordstrom",
		];
		allStores.forEach((p) => {
			var src = (p.source || "").toLowerCase();
			var isTrusted = trustedStores.some((t) => src.includes(t));
			result +=
				"<span style='padding:4px 10px;border-radius:12px;background:" +
				(isTrusted ? "#dcfce7" : "#fef3c7") +
				";font-size:0.85em'>" +
				escapeHtml(p.source) +
				(isTrusted ? " ✅" : "") +
				"</span>";
		});
		result += "</div>";
	}

	result +=
		"<br><p style='font-size:0.85em;color:var(--muted)'>💡 Click the <strong>Buy Now</strong> button on the recommended product card above to go directly to the store's checkout page.</p>";
	result += "</div>";
	return result;
}

function showBuyButton() {
	document.querySelectorAll(".buy-link").forEach((btn) => {
		btn.style.display = "block";
	});
	var cards = document.querySelectorAll(".product-card");
	var bestIdx = -1,
		bestScore = -1;
	products.forEach((p, i) => {
		if (p.savvyScore != null && p.savvyScore > bestScore) {
			bestScore = p.savvyScore;
			bestIdx = i;
		}
	});
	if (cards[bestIdx]) {
		cards.forEach((c) => {
			c.classList.remove("recommended");
		});
		cards[bestIdx].classList.add("recommended");
		var winBtn = cards[bestIdx].querySelector(".buy-link");
		if (winBtn) winBtn.textContent = "🏆 Buy Now";
	}
}

// ── Init ──

document.addEventListener("DOMContentLoaded", () => {
	const urlParams = new URLSearchParams(window.location.search);
	comparisonId = parseInt(urlParams.get("sid")) || 0;
	const mode = urlParams.get("mode");

	// Debug display
	const debug = document.getElementById("header-count");
	if (debug) debug.textContent = "sid=" + comparisonId + " mode=" + mode;

	if (mode === "search" && comparisonId) {
		loadTabComparison();
	} else {
		loadProducts();
	}

	document.getElementById("btn-rescan").addEventListener("click", () => {
		products = [];
		document.getElementById("ai-container").style.display = "none";
		document.getElementById("ai-content").textContent = "";
		chrome.runtime.sendMessage({ action: "rescanAll" }, () => {
			setTimeout(loadProducts, 2000);
		});
	});
});
