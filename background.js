// SavvyShop - Google Shopping Based Comparison
// Uses Google Shopping (via browser tab) to find same product across stores

const productTabs = {};
const activeComparison = {};

const NON_PRODUCT_DOMAINS = [
	"google.com",
	"youtube.com",
	"twitter.com",
	"x.com",
	"instagram.com",
	"reddit.com",
	"linkedin.com",
	"github.com",
	".gov",
	".edu",
	".mil",
];

function isNonProductDomain(url) {
	try {
		const host = new URL(url).hostname.replace("www.", "");
		return NON_PRODUCT_DOMAINS.some(
			(d) => host === d || host.endsWith("." + d),
		);
	} catch (e) {
		return true;
	}
}

async function scanTab(tabId, url) {
	if (!url || url.startsWith("chrome://") || isNonProductDomain(url)) return;
	try {
		const r = await chrome.scripting.executeScript({
			target: { tabId },
			func: extractProductFromPage,
		});
		if (r && r[0] && r[0].result) {
			productTabs[tabId] = { ...r[0].result, url, detectedAt: Date.now() };
			updateBadge();
		}
	} catch (e) {}
}

function updateBadge() {
	const n = Object.keys(productTabs).length;
	chrome.action.setBadgeText({ text: n > 0 ? "" + n : "" });
	chrome.action.setBadgeBackgroundColor({ color: "#818cf8" });
}

function extractProductFromPage() {
	const host = window.location.hostname;
	const schemas = document.querySelectorAll(
		'script[type="application/ld+json"]',
	);
	for (const s of schemas) {
		try {
			const d = JSON.parse(s.textContent);
			const p = d["@graph"]?.find((i) => i["@type"] === "Product") || d;
			if (p["@type"] !== "Product" && p["@type"] !== "ProductGroup") continue;
			let o = p.offers;
			if (!o && p.hasVariant) {
				const v = Array.isArray(p.hasVariant) ? p.hasVariant[0] : p.hasVariant;
				if (v) {
					o = v.offers;
					if (v.name && !p.name) p.name = v.name;
				}
			}
			const pn = o?.price ? parseFloat(o.price) : null;
			if (!pn || pn < 3 || pn > 50000) continue;
			if (!p.name || p.name.length < 3) continue;
			return {
				title: p.name,
				price: "$" + o.price,
				rating: p.aggregateRating?.ratingValue || null,
				reviewCount: p.aggregateRating?.reviewCount || null,
				source: host.replace("www.", "").split(".")[0],
				domain: host.replace("www.", ""),
			};
		} catch (e) {}
	}
	if (host.includes("amazon")) {
		const t = document.getElementById("productTitle")?.textContent?.trim();
		if (!t || t.length < 3) return null;
		const pw = document.querySelector(".a-price-whole");
		if (!pw) return null;
		let raw = pw.textContent.trim().replace(/[^\d,]/g, "");
		const pf = document.querySelector(".a-price-fraction");
		if (pf) raw += "." + pf.textContent.trim().replace(/[^\d]/g, "");
		return {
			title: t.substring(0, 200),
			price: "$" + raw,
			currency: "USD",
			rating:
				parseFloat(
					document
						.getElementById("acrPopover")
						?.title?.match(/(\d+\.?\d*)/)?.[1],
				) || null,
			reviewCount:
				parseInt(
					(
						document
							.getElementById("acrCustomerReviewText")
							?.textContent?.match(/[\d,]+/)?.[0] || ""
					).replace(/,/g, ""),
				) || null,
			source: "amazon",
			domain: host.replace("www.", ""),
		};
	}
	return null;
}

// --- Injected: Parse Google Shopping results page ---
function parseGoogleShopping() {
	// Wait for JS rendering
	const start = Date.now();
	while (Date.now() - start < 10000) {
		const results = [];
		// Google Shopping product cards
		const cards = document.querySelectorAll(
			"[data-docid], .sh-dgr__content, .sh-dlr__list-result, [data-sb]",
		);

		for (const card of cards) {
			const link = card.querySelector("a[href]");
			if (!link || !link.href) continue;

			// Extract store name from the URL or card text
			let store = "";
			const linkUrl = link.href;

			// Known stores
			const knownStores = [
				"walmart",
				"target",
				"bestbuy",
				"homedepot",
				"lowes",
				"costco",
				"newegg",
				"macys",
				"kohls",
				"staples",
				"wayfair",
				"ebay",
			];
			for (const s of knownStores) {
				if (linkUrl.includes(s + ".com") || linkUrl.includes(s)) {
					store = s;
					break;
				}
			}

			// If no known store found, try to extract from card text
			if (!store) {
				const storeEl = card.querySelector(
					"[data-merchant-name], .aULzUe, .IuHnof, .E5ocAb",
				);
				if (storeEl)
					store = storeEl.textContent.trim().toLowerCase().replace(/\s+/g, "");
			}

			if (!store || store.length > 20) continue;

			// Extract price
			let price = "";
			const priceEl = card.querySelector(
				'.a8Pemb, .kHxwFf, span[aria-hidden="true"]',
			);
			if (priceEl) {
				const pText = priceEl.textContent.trim();
				const pMatch = pText.match(/\$[\d,]+\.?\d*/);
				if (pMatch) price = pMatch[0];
			}

			// Extract title
			const titleEl = card.querySelector("h3, .tAxDx, .sh-np__product-title");
			const title = titleEl ? titleEl.textContent.trim().substring(0, 200) : "";

			if (store && (price || title)) {
				results.push({
					store: store.charAt(0).toUpperCase() + store.slice(1),
					storeDomain: store + ".com",
					price: price || null,
					title: title || "",
					url: linkUrl,
				});
			}
		}

		if (results.length > 0) return results;
	}

	// Fallback: scan ALL links on page
	const results = [];
	const links = document.querySelectorAll("a[href]");
	for (const link of links) {
		const href = link.href;
		const knownStores = [
			"walmart.com",
			"target.com",
			"bestbuy.com",
			"homedepot.com",
			"lowes.com",
			"costco.com",
			"macys.com",
			"kohls.com",
		];
		for (const store of knownStores) {
			if (href.includes(store)) {
				const storeName = store.split(".")[0];
				// Try to find associated price nearby
				let price = "";
				const parent = link.closest("div, li, tr");
				if (parent) {
					const pMatch = parent.textContent.match(/\$[\d,]+\.?\d{0,2}/);
					if (pMatch) price = pMatch[0];
				}
				results.push({
					store: storeName.charAt(0).toUpperCase() + storeName.slice(1),
					storeDomain: store,
					price: price || null,
					title: link.textContent.trim().substring(0, 200),
					url: href,
				});
				break;
			}
		}
	}
	return results;
}

// --- Message Router ---
chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
	if (message.action === "getProducts") {
		if (Object.keys(productTabs).length === 0) {
			const tabs = await new Promise((r) => chrome.tabs.query({}, r));
			for (const t of tabs) {
				if (t.id) await scanTab(t.id, t.url);
			}
		}
		sendResponse(Object.values(productTabs));
		return true;
	}

	if (message.action === "openCompare") {
		chrome.tabs.create({ url: chrome.runtime.getURL("compare.html") });
		return false;
	}

	if (message.action === "activateTab") {
		if (message.tabId) chrome.tabs.update(message.tabId, { active: true });
		return false;
	}

	if (message.action === "findSimilarTabs") {
		const title = message.query || "";
		const currentDomain = (message.currentDomain || "").toLowerCase();
		const originalProduct = productTabs[message.currentTabId] || {};
		const originalSource =
			originalProduct.source || currentDomain.split(".")[0];
		const comparisonId = Date.now();

		activeComparison[comparisonId] = {
			status: "fetching",
			productTabIds: [],
			products: [
				{
					title,
					price: message.price || null,
					rating: message.rating || null,
					reviewCount: message.reviewCount || null,
					url: originalProduct.url || null,
					tabId: message.currentTabId,
					source: originalSource,
					scraped: true,
				},
			],
		};

		chrome.storage.local.set(
			{
				[`comparison_${comparisonId}`]: activeComparison[comparisonId].products,
				comparisonStatus: "fetching",
				comparisonId,
			},
			() => {
				chrome.tabs.create({
					url: chrome.runtime.getURL(
						"compare.html?mode=search&sid=" + comparisonId,
					),
				});
				sendResponse({ comparisonId });
			},
		);

		const cleanTitle = title
			.replace(/[^\w\s-]/g, " ")
			.replace(/\s+/g, " ")
			.trim()
			.split(" ")
			.slice(0, 6)
			.join(" ");

		console.log("[SavvyShop] Google Shopping for:", cleanTitle);

		const comp = activeComparison[comparisonId];

		(async () => {
			try {
				const shopUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(cleanTitle)}`;

				const tab = await new Promise((r) =>
					chrome.tabs.create({ url: shopUrl, active: false }, r),
				);
				const workerTabId = tab.id;

				// Wait for page load
				const loaded = await Promise.race([
					new Promise((resolve) => {
						const listener = (tabId, changeInfo) => {
							if (tabId === workerTabId && changeInfo.status === "complete") {
								chrome.tabs.onUpdated.removeListener(listener);
								resolve(true);
							}
						};
						chrome.tabs.onUpdated.addListener(listener);
					}),
					new Promise((resolve) => setTimeout(() => resolve(false), 15000)),
				]);

				if (!loaded) {
					console.log("[SavvyShop] Google Shopping timeout");
					chrome.tabs.remove(workerTabId);
					comp.status = "done";
					chrome.storage.local.set({
						[`comparison_${comparisonId}`]: comp.products,
						comparisonStatus: "done",
					});
					return;
				}

				// Wait for Google Shopping JS to render results
				console.log("[SavvyShop] Waiting for Google Shopping to render...");
				await new Promise((r) => setTimeout(r, 4000));

				// Parse Google Shopping results
				const shoppingData = await new Promise((resolve) => {
					chrome.scripting.executeScript(
						{
							target: { tabId: workerTabId },
							func: parseGoogleShopping,
						},
						(results) => {
							resolve(results?.[0]?.result || []);
						},
					);
				});

				console.log(
					"[SavvyShop] Google Shopping found:",
					shoppingData.length,
					"stores",
				);
				console.log(
					"[SavvyShop] Data:",
					JSON.stringify(shoppingData.slice(0, 5)),
				);

				// Close the Google Shopping tab
				chrome.tabs.remove(workerTabId);

				// Filter: exclude the original domain, deduplicate stores
				const seen = new Set();
				for (const item of shoppingData) {
					if (currentDomain.includes(item.store.toLowerCase())) continue; // Skip original store
					if (seen.has(item.store.toLowerCase())) continue;
					seen.add(item.store.toLowerCase());

					comp.products.push({
						title: item.title || title,
						price: item.price || null,
						rating: null,
						reviewCount: null,
						url: item.url || null,
						tabId: null,
						source: item.store,
						scraped: true,
					});

					if (comp.products.length >= 8) break; // Max 7 stores + original
				}

				console.log("[SavvyShop] Added", comp.products.length - 1, "stores");
			} catch (e) {
				console.log("[SavvyShop] Error:", e.message);
			}

			comp.status = "done";
			chrome.storage.local.set({
				[`comparison_${comparisonId}`]: comp.products,
				comparisonStatus: "done",
			});
			console.log("[SavvyShop] DONE. Products:", comp.products.length);
		})();

		return true;
	}

	if (message.action === "getComparison") {
		const cid = message.comparisonId;
		chrome.storage.local.get(
			[`comparison_${cid}`, "comparisonStatus", "comparisonId"],
			(data) => {
				sendResponse({
					products: data[`comparison_${cid}`] || [],
					status: data.comparisonStatus || "fetching",
					id: data.comparisonId,
				});
			},
		);
		return true;
	}

	if (message.action === "aiAnalysis") {
		fetch("https://api.deepseek.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer sk-3cf448cce77048659ce5eaf4efdd9562",
			},
			body: JSON.stringify({
				model: "deepseek-chat",
				messages: [
					{
						role: "system",
						content:
							"You are an expert product analyst. Prices shown are live from store pages.",
					},
					{ role: "user", content: message.prompt },
				],
				max_tokens: 2000,
				temperature: 0.7,
			}),
		})
			.then((r) => r.json())
			.then((d) => sendResponse({ content: d.choices[0].message.content }))
			.catch(() => sendResponse({ content: null }));
		return true;
	}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === "complete") scanTab(tabId, tab.url);
});
chrome.tabs.onRemoved.addListener((tabId) => {
	delete productTabs[tabId];
	updateBadge();
});
setTimeout(() => {
	chrome.tabs.query({}, (tabs) => {
		tabs.forEach((t) => {
			if (t.id) scanTab(t.id, t.url);
		});
		updateBadge();
	});
}, 2000);
