// SavvyShop v3 — Tab-Based Comparison Popup

document.addEventListener("DOMContentLoaded", async () => {
	const stats = document.getElementById("stats");
	const products =
		(await chrome.runtime.sendMessage({ action: "getProducts" })) || [];
	const list = products.filter((p) => p && p.title);

	if (list.length === 0) {
		stats.textContent = "Open a product page, then click Find Similar";
		return;
	}
	stats.textContent =
		list.length + " product" + (list.length > 1 ? "s" : "") + " ready";
});

document.getElementById("openCompare").addEventListener("click", () => {
	chrome.tabs.create({ url: chrome.runtime.getURL("compare.html") });
});

document.getElementById("findSimilar").addEventListener("click", async () => {
	var btn = document.getElementById("findSimilar");

	var products =
		(await chrome.runtime.sendMessage({ action: "getProducts" })) || [];
	var list = products.filter((p) => p && p.title);
	if (list.length === 0) {
		btn.textContent = "Open a product page first";
		setTimeout(() => {
			btn.textContent = "🔍 Find Similar Products";
		}, 2000);
		return;
	}

	var currentProduct = list[0];
	btn.textContent = "⏳ Searching...";
	btn.disabled = true;

	// Get the actual product tab (not the popup)
	const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
	const currentTab = tabs.find(
		(t) => t.url && !t.url.startsWith("chrome-extension://"),
	);
	const domain = currentTab
		? new URL(currentTab.url).hostname.replace("www.", "")
		: "";

	// Start tab-based comparison
	const searchId = Date.now();
	chrome.storage.local.set({
		comparisonStatus: "searching",
		comparisonId: searchId,
	});

	chrome.runtime.sendMessage(
		{
			action: "findSimilarTabs",
			query: currentProduct.title,
			currentDomain: domain,
			currentTabId: currentTab.id,
			price: currentProduct.price,
			rating: currentProduct.rating,
			reviewCount: currentProduct.reviewCount,
		},
		(response) => {
			if (response && response.comparisonId) {
				// Background opens the comparison tab — just close popup
				window.close();
			} else {
				btn.textContent = "⚠️ Search failed";
				setTimeout(() => {
					btn.textContent = "🔍 Find Similar Products";
					btn.disabled = false;
				}, 3000);
			}
		},
	);
});
