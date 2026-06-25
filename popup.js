// SavvyShop / DealVerdict Popup

document.addEventListener("DOMContentLoaded", async () => {
	const stats = document.getElementById("stats");
	const products =
		(await chrome.runtime.sendMessage({ action: "getProducts" })) || [];
	const list = products.filter((p) => p && p.title);

	if (list.length === 0) {
		stats.textContent = "Open a product page, then click Find Similar";
		return;
	}

	stats.textContent = list.length + " products ready";
});

document.getElementById("openCompare").addEventListener("click", () => {
	chrome.tabs.create({ url: chrome.runtime.getURL("compare.html") });
});

document.getElementById("findSimilar").addEventListener("click", async () => {
	var btn = document.getElementById("findSimilar");

	// Get current product from background
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

	// Wipe ALL stale data from previous searches before starting fresh
	var searchId = Date.now();
	chrome.storage.local.clear(() => {
		chrome.storage.local.set(
			{
				searchResults: [currentProduct],
				searchStatus: "searching",
				searchId: searchId,
			},
			() => {
				chrome.tabs.create({
					url: chrome.runtime.getURL(
						"compare.html?mode=search&sid=" + searchId,
					),
				});
			},
		);
	});

	// Search — pass current product so background can include it
	await chrome.runtime.sendMessage({
		action: "findSimilar",
		query: currentProduct.title,
		currentProduct: currentProduct,
	});
});
