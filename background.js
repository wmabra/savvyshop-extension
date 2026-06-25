// SavvyShop Background Service Worker
// Scans tabs for product pages, tracks detected products

let productTabs = {};
let notificationShown = {};

// --- Tab Scanner ---
// Ignore these domains (never treat as product pages)
const NON_PRODUCT_DOMAINS = [
	"google.com",
	"docs.google.com",
	"sheets.google.com",
	"drive.google.com",
	"mail.google.com",
	"calendar.google.com",
	"meet.google.com",
	"youtube.com",
	"twitter.com",
	"x.com",
	"instagram.com",
	"reddit.com",
	"linkedin.com",
	"github.com",
	"outlook.com",
	"office.com",
	"dropbox.com",
	"notion.so",
	"slack.com",
	"discord.com",
	"zoom.us",
	"netflix.com",
	"hulu.com",
	"spotify.com",
	"twitch.tv",
	"chatgpt.com",
	"claude.ai",
	"perplexity.ai",
	"bankofamerica.com",
	"chase.com",
	"paypal.com",
	// Streaming / entertainment
	"tubitv.com",
	"tubi.tv",
	"pluto.tv",
	"peacocktv.com",
	"paramountplus.com",
	"disneyplus.com",
	"hbomax.com",
	"max.com",
	"primevideo.com",
	"roku.com",
	"crunchyroll.com",
	"fandango.com",
	"imdb.com",
	"vudu.com",
	// Finance / banking / trading
	"tdameritrade.com",
	"schwab.com",
	"fidelity.com",
	"vanguard.com",
	"robinhood.com",
	"etrade.com",
	"webull.com",
	"sofi.com",
	"betterment.com",
	"marcus.com",
	"nerdwallet.com",
	"investopedia.com",
	"marketwatch.com",
	"bloomberg.com",
	"cnbc.com",
	"yahoo.com/finance",
	"finance.yahoo.com",
	// Social / messaging (NOTE: facebook.com and tiktok.com NOT blocked — they have shops)
	"snapchat.com",
	"whatsapp.com",
	"telegram.org",
	"pinterest.com",
	"tumblr.com",
	"mastodon.social",
	// News / weather
	"weather.com",
	"accuweather.com",
	"foxnews.com",
	"msnbc.com",
	"theguardian.com",
	"nytimes.com",
	"wsj.com",
	"washingtonpost.com",
	// Travel
	"expedia.com",
	"booking.com",
	"airbnb.com",
	"kayak.com",
	"tripadvisor.com",
	// Food delivery / restaurants
	"doordash.com",
	"ubereats.com",
	"grubhub.com",
	"postmates.com",
	"seamless.com",
	"chownow.com",
	"toasttab.com",
	"menupages.com",
	"orderspoon.com",
	"slice.com",
	"waitrapp.com",
	"deliveroo.com",
	// Meal kits / food subscriptions
	"hellofresh.com",
	"blueapron.com",
	"sunbasket.com",
	"homechef.com",
	"greenchef.com",
	"everyplate.com",
	"dinnerly.com",
	"gobble.com",
	"freshly.com",
	"factor75.com",
	"marleyspoon.com",
	"purplecarrot.com",
	// Ticketing / events
	"ticketmaster.com",
	"stubhub.com",
	"seatgeek.com",
	"vividseats.com",
	"eventbrite.com",
	"meetup.com",
	"ticketfly.com",
	"axs.com",
	// Real estate / classifieds
	"zillow.com",
	"redfin.com",
	"realtor.com",
	"trulia.com",
	"craigslist.org",
	"offerup.com",
	"nextdoor.com",
	// Deal / coupon aggregators
	"slickdeals.net",
	"dealnews.com",
	"retailmenot.com",
	"honey.com",
	"groupon.com",
	"living social.com",
	"woot.com",
	// Crowdfunding
	"kickstarter.com",
	"gofundme.com",
	"indiegogo.com",
	// Insurance / utilities
	"progressive.com",
	"geico.com",
	"statefarm.com",
	"allstate.com",
	"libertymutual.com",
	"esurance.com",
	// Services / freelancing marketplaces
	"fiverr.com",
	"upwork.com",
	"freelancer.com",
	"taskrabbit.com",
	"thumbtack.com",
	"angi.com",
	"homeadvisor.com",
	"toptal.com",
	// Membership / subscription platforms
	"patreon.com",
	"onlyfans.com",
	"substack.com",
	"medium.com",
	"buymeacoffee.com",
	"ko-fi.com",
	"ghost.org",
	// Course / education platforms (digital goods, not physical products)
	"udemy.com",
	"coursera.org",
	"skillshare.com",
	"masterclass.com",
	"edx.org",
	"pluralsight.com",
	"linkedin.com/learning",
	"brilliant.org",
	"datacamp.com",
	"codecademy.com",
	"domestika.org",
	"teachable.com",
	"thinkific.com",
	// Digital goods / assets
	"envato.com",
	"themeforest.net",
	"codecanyon.net",
	"creativemarket.com",
	"designcuts.com",
	"graphicriver.net",
	"audioblocks.com",
	"storyblocks.com",
	// SaaS / software tools
	"slack.com",
	"notion.so",
	"asana.com",
	"monday.com",
	"trello.com",
	"basecamp.com",
	"airtable.com",
	"figma.com",
	"canva.com",
	"miro.com",
	"linear.app",
	// Fitness / diet subscriptions (no physical product)
	"classpass.com",
	"mindbodyonline.com",
	"noom.com",
	"weightwatchers.com",
	"myfitnesspal.com",
	"loseit.com",
	// Web hosting / domains
	"godaddy.com",
	"namecheap.com",
	"bluehost.com",
	"siteground.com",
	"shopify.com",
	"squarespace.com",
	"wix.com",
	"webflow.com",
	"weebly.com",
	"bigcommerce.com",
	// NFT / Crypto marketplaces
	"opensea.io",
	"rarible.com",
	"looksrare.org",
	"magiceden.io",
	"blur.io",
	"foundation.app",
	"superrare.com",
	"niftygateway.com",
	// Crypto exchanges (NOT product stores)
	"coinbase.com",
	"binance.com",
	"binance.us",
	"kraken.com",
	"gemini.com",
	"crypto.com",
	"kucoin.com",
	"bybit.com",
	"bitstamp.net",
	"bitfinex.com",
	"gate.io",
	"okx.com",
	// B2B wholesale / industrial (not consumer retail)
	"alibaba.com",
	"thomasnet.com",
	"mfgsupply.com",
	"globalsources.com",
	"made-in-china.com",
	"dhgate.com",
	// Pharmacy / drug savings (not product stores)
	"goodrx.com",
	"ro.co",
	"hims.com",
	"forhims.com",
	"hers.com",
	"forhers.com",
	"lemonaidhealth.com",
	"nurx.com",
	// Auto sales (dedicated car buying sites)
	"carmax.com",
	"carvana.com",
	"autotrader.com",
	"cars.com",
	"truecar.com",
	"cargurus.com",
	"vroom.com",
	"shift.com",
	"edmunds.com",
	"kbb.com",
	"bringatrailer.com",
	// Video game storefronts (digital games, not physical products)
	"store.steampowered.com",
	"steampowered.com",
	"epicgames.com",
	"gog.com",
	"humblebundle.com",
	"greenmangaming.com",
	"itch.io",
	"nintendo.com",
	"playstation.com",
	"xbox.com",
	"fanatical.com",
	"gamesplanet.com",
	// Government / edu
	".gov",
	".edu",
	".mil",
];

function isNonProductDomain(url) {
	if (!url) return true;
	try {
		const host = new URL(url).hostname.replace("www.", "");
		return NON_PRODUCT_DOMAINS.some(
			(d) => host === d || host.endsWith("." + d),
		);
	} catch (e) {
		return true;
	}
}

async function scanTab(tabId, url, isRetry) {
	if (!url || url.startsWith("chrome://") || url.startsWith("about:")) return;
	if (isNonProductDomain(url)) return;

	try {
		const results = await chrome.scripting.executeScript({
			target: { tabId },
			func: extractProductFromPage,
		});

		if (results && results[0] && results[0].result) {
			const product = results[0].result;
			productTabs[tabId] = { ...product, url, detectedAt: Date.now() };
			updateBadge();
			checkForNotification();
			return product;
		}

		// If first scan found nothing, retry after 3s (client-rendered content)
		if (!isRetry) {
			setTimeout(() => {
				chrome.scripting
					.executeScript({
						target: { tabId },
						func: extractProductFromPage,
					})
					.then((results2) => {
						if (results2 && results2[0] && results2[0].result) {
							const product = results2[0].result;
							productTabs[tabId] = { ...product, url, detectedAt: Date.now() };
							updateBadge();
						}
					})
					.catch(() => {});
			}, 3000);
		}
	} catch (e) {
		// Retry once after delay (Amazon pages load slow)
		setTimeout(() => {
			chrome.scripting
				.executeScript({
					target: { tabId },
					func: extractProductFromPage,
				})
				.then((results) => {
					if (results && results[0] && results[0].result) {
						const product = results[0].result;
						productTabs[tabId] = { ...product, url, detectedAt: Date.now() };
						updateBadge();
					}
				})
				.catch(() => {});
		}, 4000);
	}
}

// --- Product Extractor ---
function extractProductFromPage() {
	// Schema.org
	const schemas = document.querySelectorAll(
		'script[type="application/ld+json"]',
	);
	for (const s of schemas) {
		try {
			const data = JSON.parse(s.textContent);
			const product =
				data["@graph"]?.find((i) => i["@type"] === "Product") || data;
			if (
				product["@type"] === "Product" ||
				product["@type"] === "ProductGroup"
			) {
				// Handle ProductGroup: extract from first variant
				let offers = product.offers;
				if (!offers && product.hasVariant) {
					const firstVar = Array.isArray(product.hasVariant)
						? product.hasVariant[0]
						: product.hasVariant;
					if (firstVar && firstVar["@type"] === "Product") {
						offers = firstVar.offers;
						if (firstVar.name && !product.name) product.name = firstVar.name;
						if (firstVar.image && !product.image)
							product.image = firstVar.image;
					}
				}

				const priceStr = offers?.price ? parseFloat(offers.price) : null;
				// Skip schemas with no product name or tiny prices (data errors)
				if (priceStr && priceStr < 3) continue;
				if (!product.name || product.name.length < 3) continue;

				const curr =
					offers?.priceCurrency ||
					((h) => {
						if (h.includes(".mx")) return "MXN";
						if (h.includes(".co.za")) return "ZAR";
						if (h.includes(".co.uk")) return "GBP";
						if (
							h.includes(".de") ||
							h.includes(".fr") ||
							h.includes(".it") ||
							h.includes(".es") ||
							h.includes(".nl")
						)
							return "EUR";
						if (h.includes(".ca")) return "CAD";
						if (h.includes(".com.au")) return "AUD";
						return "USD";
					})(window.location.hostname);
				return {
					title: product.name || "",
					price: priceStr
						? ({
								MXN: "MX$",
								ZAR: "R",
								EUR: "€",
								GBP: "£",
								CAD: "C$",
								AUD: "A$",
								USD: "$",
							}[curr] || "$") + offers.price
						: null,
					currency: curr,
					rating: product.aggregateRating?.ratingValue || null,
					reviewCount: product.aggregateRating?.reviewCount || null,
					image: product.image?.[0] || product.image || "",
					source: window.location.hostname.replace("www.", "").split(".")[0],
					domain: window.location.hostname.replace("www.", ""),
					inStock: true,
				};
			}
		} catch (e) {}
	}

	// Amazon
	const host = window.location.hostname;
	if (host.includes("amazon")) {
		const title = document.getElementById("productTitle")?.textContent?.trim();
		if (!title || title.length < 3) return null;
		const t = title.length > 200 ? title.substring(0, 197) + "..." : title;
		let price = null;
		const pw = document.querySelector(".a-price-whole");
		if (pw) {
			let raw = pw.textContent.trim().replace(/[^\d,]/g, "");
			const pf = document.querySelector(".a-price-fraction");
			if (pf) raw += "." + pf.textContent.trim().replace(/[^\d]/g, "");
			if (!raw.includes(".")) raw += ".00";
			price =
				((h) => {
					if (h.includes(".mx")) return "MX$";
					if (h.includes(".co.za")) return "R";
					if (h.includes(".co.uk")) return "£";
					if (
						h.includes(".de") ||
						h.includes(".fr") ||
						h.includes(".it") ||
						h.includes(".es") ||
						h.includes(".nl")
					)
						return "€";
					if (h.includes(".ca")) return "C$";
					if (h.includes(".com.au")) return "A$";
					return "$";
				})(host) + raw;
		}
		const rating = document
			.getElementById("acrPopover")
			?.title?.match(/(\d+\.?\d*)/)?.[1];
		const reviews = document
			.getElementById("acrCustomerReviewText")
			?.textContent?.match(/[\d,]+/)?.[0];
		if (!price) return null;
		return {
			title: t,
			price,
			currency: ((h) => {
				if (h.includes(".mx")) return "MXN";
				if (h.includes(".co.za")) return "ZAR";
				if (h.includes(".co.uk")) return "GBP";
				if (
					h.includes(".de") ||
					h.includes(".fr") ||
					h.includes(".it") ||
					h.includes(".es") ||
					h.includes(".nl")
				)
					return "EUR";
				if (h.includes(".ca")) return "CAD";
				if (h.includes(".com.au")) return "AUD";
				return "USD";
			})(host),
			rating: rating ? parseFloat(rating) : null,
			reviewCount: reviews ? parseInt(reviews.replace(/,/g, "")) : null,
			image: document.getElementById("landingImage")?.src || "",
			source: host.replace("www.", "").split(".")[0],
			domain: host.replace("www.", ""),
			inStock: !document.querySelector("#outOfStock"),
		};
	}

	// Walmart
	if (host.includes("walmart")) {
		const title = document
			.querySelector('[data-testid="product-title"], h1[itemprop="name"], h1')
			?.textContent?.trim();
		if (!title || title.length < 5) return null;
		let price = null;
		const priceEl = document.querySelector(
			'[data-testid="price-wrap"], [itemprop="price"], .price-now, .prod-PriceHero [itemprop="price"]',
		);
		if (priceEl) {
			const raw = priceEl.textContent.trim().replace(/[^\d.]/g, "");
			if (raw && parseFloat(raw) > 0) price = "$" + raw;
		}
		// Fallback: look for price in aria-label or span
		if (!price) {
			const ariaPrice = document.querySelector('[aria-label*="$"]');
			if (ariaPrice) {
				const m = ariaPrice.getAttribute("aria-label").match(/\$(\d+\.?\d*)/);
				if (m) price = "$" + m[1];
			}
		}
		const rating = document
			.querySelector(
				'[data-testid="reviews-header"] [itemprop="ratingValue"], [itemprop="ratingValue"]',
			)
			?.textContent?.trim();
		const reviews = document
			.querySelector('[itemprop="reviewCount"], .rating-number')
			?.textContent?.match(/[\d,]+/)?.[0];
		const delivery = document
			.querySelector(
				'[data-testid="fulfillment-text"], .fulfillment-text, .shipping-delivery',
			)
			?.textContent?.trim();
		const t = title.length > 200 ? title.substring(0, 197) + "..." : title;
		if (!price) return null;
		return {
			title: t,
			price,
			currency: "USD",
			rating: rating ? parseFloat(rating) : null,
			reviewCount: reviews ? parseInt(reviews.replace(/,/g, "")) : null,
			image:
				document.querySelector('meta[property="og:image"]')?.content ||
				document.querySelector('[data-testid="hero-image"] img')?.src ||
				"",
			source: "walmart",
			domain: "walmart.com",
			delivery: delivery || null,
			inStock: !document.querySelector(
				'[data-testid="out-of-stock-message"], .out-of-stock',
			),
		};
	}

	// Shopify stores — only detect if we find actual product elements AND a price
	if (
		(host.includes("shopify") ||
			host.includes("myshopify") ||
			document.querySelector('link[href*="shopify"]') ||
			document.querySelector('script[src*="shopify"]')) &&
		(document.querySelector(
			".product__title, .product-single__title, .product, [data-product-id]",
		) ||
			document.querySelector('meta[property="og:type"]')?.content === "product")
	) {
		const title =
			document
				.querySelector(".product__title, .product-single__title, h1")
				?.textContent?.trim() ||
			document.querySelector('meta[property="og:title"]')?.content;
		if (!title || title.length < 5) return null;
		const ogImage = document.querySelector(
			'meta[property="og:image"]',
		)?.content;
		const priceEl = document.querySelector(
			".price-item--regular, .product__price, .price, [data-price]",
		);
		const bodyText = document.body.innerText?.substring(0, 3000) || "";
		const allPrices = [];
		const priceText = priceEl?.textContent || bodyText;
		let m;
		const re = /\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g;
		while ((m = re.exec(priceText)) !== null) {
			const num = parseFloat(m[0].replace(/,/g, ""));
			if (num > 1 && num < 999999) allPrices.push({ str: m[0], num: num });
		}
		let foundPrice =
			allPrices.length > 0
				? allPrices.reduce((a, b) => (a.num > b.num ? a : b))
				: null;
		if (!foundPrice) {
			const fm = bodyText.match(/\$\s*(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)/);
			if (!fm) bodyText.match(/\$\s*(\d+\.\d{2})/);
			if (!fm) bodyText.match(/\$\s*(\d+)/);
			foundPrice = fm
				? { str: fm[1], num: parseFloat(fm[1].replace(/,/g, "")) }
				: null;
		}
		if (!foundPrice) return null; // Must have a price
		const t = title.length > 200 ? title.substring(0, 197) + "..." : title;
		const priceStr = foundPrice ? foundPrice.str.replace(/,/g, "") : null;
		return {
			title: t,
			price: priceStr ? "$" + priceStr : null,
			currency: "USD",
			rating: null,
			reviewCount: null,
			image: ogImage || "",
			source: host.replace("www.", "").split(".")[0],
			domain: host.replace("www.", ""),
			inStock: true,
		};
	}

	// WooCommerce — only if product-specific elements found AND has a price
	const isWooCommerce = !!(
		document.querySelector(
			".woocommerce, .product-type-simple, .single-product",
		) ||
		document.querySelector('link[href*="woocommerce"]') ||
		(document.body.className && document.body.className.includes("woocommerce"))
	);
	if (
		isWooCommerce &&
		(document.querySelector(
			".product_title, .price .amount, .woocommerce-Price-amount",
		) ||
			document.querySelector('meta[property="og:type"]')?.content === "product")
	) {
		const title =
			document
				.querySelector(".product_title, h1.product-title, h1")
				?.textContent?.trim() ||
			document.querySelector('meta[property="og:title"]')?.content;
		const ogImage = document.querySelector(
			'meta[property="og:image"]',
		)?.content;
		const priceEl = document.querySelector(
			".price .amount, .woocommerce-Price-amount, .product-price",
		);
		const bodyText = document.body.innerText?.substring(0, 3000) || "";
		let foundPrice = priceEl?.textContent?.match(
			/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
		);
		if (!foundPrice)
			foundPrice = bodyText.match(/\$\s*(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)/);
		if (!foundPrice) foundPrice = bodyText.match(/\$\s*(\d+\.\d{2})/);
		if (!foundPrice) foundPrice = bodyText.match(/\$\s*(\d+)/);
		if (!foundPrice || !title || title.length < 5) return null; // Must have price AND title
		const t = title.length > 200 ? title.substring(0, 197) + "..." : title;
		const priceStr = foundPrice
			? (foundPrice[1] || foundPrice.str || "").replace(/,/g, "")
			: null;
		return {
			title: t,
			price: priceStr ? "$" + priceStr : null,
			currency: "USD",
			rating: null,
			reviewCount: null,
			image: ogImage || "",
			source: host.replace("www.", "").split(".")[0],
			domain: host.replace("www.", ""),
			inStock: true,
		};
	}

	// Google Shopping: extract product info from the search result page
	if (
		host.includes("google.com") &&
		window.location.search.includes("ibp=oshop")
	) {
		// Find the first non-Google store link on the page
		var storeUrl = null;
		var allLinks = document.querySelectorAll('a[href*="http"]');
		for (var li = 0; li < allLinks.length; li++) {
			var href = allLinks[li].href;
			if (href && !href.includes("google.com") && href.startsWith("http")) {
				storeUrl = href;
				break;
			}
		}
		var priceEl = document.querySelector('[class*="price"], [class*="Price"]');
		var rawPrice = priceEl?.textContent || "";
		var pm =
			rawPrice.match(/([$£€])\s*([\d,]+\.?\d*)/) ||
			rawPrice.match(/([\d,]+\.?\d*)\s*([$£€])/);
		var price = pm ? pm[1] + pm[2] : null;
		const h1gs = document.querySelector("h1")?.textContent?.trim();
		const title =
			h1gs || document.title?.replace(" - Google Shopping", "") || "";
		if (title && title.length > 5) {
			return {
				title: title.length > 200 ? title.substring(0, 197) + "..." : title,
				price,
				rating: null,
				reviewCount: null,
				image:
					document.querySelector('meta[property="og:image"]')?.content || "",
				source: "google-shopping",
				domain: "google.com",
				inStock: true,
				url: storeUrl || window.location.href,
			};
		}
	}

	// NO generic fallback for bare pages.
	// But try the narrow fallback below for pages with strong product signals.

	// NARROW fallback: only for pages with strong product signals but no schema.
	// Requires ALL THREE: buy/add-to-cart button, valid price, product-like title.
	var hasBuyButton = !!(
		document
			.querySelector('button, a, input[type="submit"]')
			?.textContent?.match(
				/\b(add to (cart|bag|basket)|buy( now)?|shop now|purchase|checkout|order now|pre.?order|place order)\b/i,
			) ||
		document.querySelector(
			'[aria-label*="buy" i], [aria-label*="cart" i], [aria-label*="purchase" i]',
		) ||
		document.querySelector(
			'.add-to-cart, .btn-buy, .btn-cart, .btn-add-to-cart, .purchase-btn, [data-testid*="buy"]',
		)
	);

	if (!hasBuyButton) return null;

	var bodyText = document.body.innerText?.substring(0, 5000) || "";
	var priceMatch =
		bodyText.match(/[$€£₹¥]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/) ||
		bodyText.match(/MX\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/) ||
		bodyText.match(/R\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
	if (!priceMatch) {
		priceMatch =
			bodyText.match(/[$€£₹¥]\s*(\d+\.\d{2})/) ||
			bodyText.match(/[$€£₹¥]\s*(\d+)/);
	}
	if (!priceMatch) return null;

	var h1 = document.querySelector("h1")?.textContent?.trim();
	var metaTitle =
		document.querySelector('meta[property="og:title"]')?.content?.trim() ||
		document.querySelector("title")?.textContent?.trim();
	var rawTitle = h1 || metaTitle || "";

	if (!rawTitle || rawTitle.length < 8 || rawTitle.length > 200) return null;
	if (/^[A-Z\s]{2,30}$/.test(rawTitle)) return null;
	if (/BREAKING|BREAKING NEWS|LIVE:|EXCLUSIVE|OPINION|ANALYSIS/i.test(rawTitle))
		return null;
	if (
		/login|sign in|account|dashboard|settings|profile|welcome/i.test(
			rawTitle.toLowerCase(),
		)
	)
		return null;
	if (
		/watch |stream |play |episode |season |trailer/i.test(
			rawTitle.toLowerCase(),
		)
	)
		return null;

	var title =
		rawTitle.length > 150 ? rawTitle.substring(0, 147) + "..." : rawTitle;
	var priceStr = priceMatch[1].replace(/,/g, "");
	var currMap = {
		$: "USD",
		"€": "EUR",
		"£": "GBP",
		"₹": "INR",
		"¥": "JPY",
		MX$: "MXN",
		R: "ZAR",
	};
	var sym = (priceMatch[0].match(/MX\$|[$€£₹¥]|R/) || ["$"])[0];
	var curr = currMap[sym] || "USD";

	return {
		title: title,
		price: sym + priceStr,
		currency: curr,
		rating: (() => {
			var r = document.querySelector(
				'[itemprop="ratingValue"], .rating, .star-rating, [data-rating]',
			);
			if (r) {
				var m = (r.textContent || r.getAttribute("content") || "").match(
					/(\d+\.?\d*)/,
				);
				return m ? parseFloat(m[1]) : null;
			}
			return null;
		})(),
		reviewCount: (() => {
			var rc = document.querySelector(
				'[itemprop="reviewCount"], .review-count, .num-reviews',
			);
			if (rc) {
				var m = (rc.textContent || "").match(/[\d,]+/);
				return m ? parseInt(m[0].replace(/,/g, "")) : null;
			}
			return null;
		})(),
		delivery: (() => {
			var d = document.querySelector(
				'[data-testid="fulfillment-text"], .fulfillment-text, .shipping-text, .delivery-message',
			);
			return d ? d.textContent.trim().substring(0, 200) : null;
		})(),
		image: document.querySelector('meta[property="og:image"]')?.content || "",
		source: host.replace("www.", "").split(".")[0],
		domain: host.replace("www.", ""),
		inStock: true,
	};
}

function updateBadge() {
	const count = Object.keys(productTabs).length;
	if (count > 0) {
		chrome.action.setBadgeText({ text: count.toString() });
		chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
	} else {
		chrome.action.setBadgeText({ text: "" });
	}
}

// Build direct store product URL from source + product title
// Best-effort real domain from SerpApi source name (e.g., "Walmart - Newegg Inc." → "walmart.com")
function getRealDomain(source) {
	var s = source.toLowerCase();
	var domainMap = {
		amazon: "amazon.com",
		walmart: "walmart.com",
		target: "target.com",
		"best buy": "bestbuy.com",
		bestbuy: "bestbuy.com",
		ebay: "ebay.com",
		homedepot: "homedepot.com",
		"home depot": "homedepot.com",
		costco: "costco.com",
		newegg: "newegg.com",
		lowes: "lowes.com",
		macys: "macys.com",
		kohls: "kohls.com",
		nordstrom: "nordstrom.com",
		staples: "staples.com",
		officedepot: "officedepot.com",
		wayfair: "wayfair.com",
		ikea: "ikea.com",
		etsy: "etsy.com",
		sephora: "sephora.com",
		nike: "nike.com",
		adidas: "adidas.com",
		gamestop: "gamestop.com",
		zara: "zara.com",
		hm: "hm.com",
		aliexpress: "aliexpress.com",
		"sams club": "samsclub.com",
		"bjs wholesale": "bjs.com",
		"bj's": "bjs.com",
		sony: "sony.com",
		samsung: "samsung.com",
		apple: "apple.com",
		dell: "dell.com",
		hp: "hp.com",
		lenovo: "lenovo.com",
		lg: "lg.com",
		bose: "bose.com",
		microcenter: "microcenter.com",
	};
	// Check if source contains any known store name
	for (var key in domainMap) {
		if (s.indexOf(key) >= 0) return domainMap[key];
	}
	return ""; // Unknown — will show store name text instead of domain
}

// Filter out stores that clearly don't sell this type of product
function isRelevantStore(storeKey, productTitle) {
	// Block non-retail sources that pollute Google Shopping results
	var blockedSources = [
		"university",
		"college",
		"school",
		"institute",
		"academy",
		"government",
		"gov",
		"federal",
		"state of",
		"county of",
		"city of",
		"church",
		"ministry",
		"temple",
		"diocese",
		"parish",
		"library",
		"museum",
		"foundation",
		"nonprofit",
		"non-profit",
		"wikipedia",
		"wiki",
		"blog",
		"forum",
		"reddit",
		"linkedin",
		"facebook",
		"instagram",
		"twitter",
		"pinterest",
		"campus",
		"bookstore",
		"student",
		"alumni",
		"cornell",
		"barnes & noble",
	];
	var src = storeKey.toLowerCase();
	for (var i = 0; i < blockedSources.length; i++) {
		if (src.indexOf(blockedSources[i]) >= 0) return false;
	}

	var clothingStores = [
		"hm",
		"zara",
		"nike",
		"adidas",
		"gap",
		"oldnavy",
		"banana republic",
		"forever21",
		"asos",
		"shein",
		"fashionnova",
		"uniqlo",
		"levis",
		"guess",
		"ralph lauren",
		"tommy hilfiger",
		"calvin klein",
		"under armour",
		"lululemon",
		"puma",
		"reebok",
		"skechers",
		"vans",
		"converse",
	];
	if (clothingStores.indexOf(storeKey) >= 0) {
		var electronics =
			/tablet|laptop|phone|iphone|samsung|galaxy|ipad|tv|television|monitor|camera|headphone|speaker|console|controller|drone|watch|smartwatch|gps|router|modem|printer|scanner|keyboard|mouse|charger|cable|adapter|memory|cpu|processor|graphics|gaming pc/i;
		if (electronics.test(productTitle.toLowerCase())) return false;
	}
	return true;
}

function checkForNotification() {
	const count = Object.keys(productTabs).length;
	if (count < 2) return;
	const now = Date.now();
	for (const [tabId, data] of Object.entries(productTabs)) {
		if (now - data.detectedAt > 60000 && !notificationShown[tabId]) {
			notificationShown[tabId] = now;
			const tid = parseInt(tabId);
			chrome.scripting.executeScript({
				target: { tabId: tid },
				func: (c) => {
					const toast = document.createElement("div");
					toast.id = "savvy-toast";
					toast.textContent = "Comparing " + c + " products? ";
					const link = document.createElement("a");
					link.href = "#";
					link.style.cssText = "color:#6366f1;font-weight:600";
					link.textContent = "See SavvyShop \u2192";
					toast.appendChild(link);
					toast.style.cssText =
						"position:fixed;bottom:20px;right:20px;z-index:999999;background:#1e1b4b;color:white;padding:12px 20px;border-radius:12px;font-family:-apple-system,sans-serif;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,0.3)";
					document.body.appendChild(toast);
					toast.querySelector("a").onclick = (e) => {
						e.preventDefault();
						chrome.runtime.sendMessage({ action: "openCompare" });
						toast.remove();
					};
					setTimeout(() => toast.remove(), 15000);
				},
				args: [count],
			});
			break;
		}
	}
}

// === Product Search: auto-find similar products ===
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.action === "resolveUrl") {
		var url = message.url;
		// Follow HTTP redirects to get the real store URL
		// Google Shopping links redirect through /aclk or /url?q= to the store
		if (url && url.includes("google.com") && !url.includes("google.com/maps")) {
			fetch(url, { redirect: "follow" })
				.then((r) => {
					// Response.url is the final URL after all redirects
					var finalUrl = r.url;
					if (finalUrl && !finalUrl.includes("google.com")) {
						sendResponse({ resolvedUrl: finalUrl });
					} else {
						// Still on Google — parse HTML for store link
						return r.text().then((html) => {
							var m = html.match(/\/url\?q=(https?:\/\/[^"&]+)/);
							if (!m) m = html.match(/content="0;\s*url=(https?:\/\/[^"]+)"/i);
							if (!m) {
								var links = html.match(
									/href="(https?:\/\/(?!www\.google|google\.com)[^"\s]+\.(com|net|org)[^"\s]*)"/g,
								);
								if (links && links.length > 0)
									m = links[0].match(/href="(https?:\/\/[^"]+)"/);
							}
							sendResponse({ resolvedUrl: m ? decodeURIComponent(m[1]) : url });
						});
					}
				})
				.catch(() => {
					sendResponse({ resolvedUrl: url });
				});
			return true;
		}
		sendResponse({ resolvedUrl: url });
		return false;
	}

	if (message.action === "getProducts") {
		sendResponse(Object.values(productTabs));
		return true;
	}
	if (message.action === "openCompare") {
		chrome.tabs.create({ url: chrome.runtime.getURL("compare.html") });
	}
	if (message.action === "rescanAll") {
		productTabs = {};
		notificationShown = {};
		chrome.tabs.query({}, (tabs) => {
			tabs.forEach((tab) => {
				if (tab.id) scanTab(tab.id, tab.url);
			});
			updateBadge();
			sendResponse({
				scanned: tabs.length,
				found: Object.keys(productTabs).length,
			});
		});
		return true;
	}

	if (message.action === "findSimilar") {
		var title = message.query || "";
		var cleanTitle = title
			.replace(/[()]/g, " ")
			.replace(/[|][^|]*$/g, "")
			.replace(/[,-]/g, " ")
			.replace(/\s+/g, " ")
			.trim()
			.substring(0, 80);
		var apiUrl =
			"https://serpapi.com/search?engine=google_shopping&q=" +
			encodeURIComponent(cleanTitle) +
			"&api_key=fc8ce8c2377b7bb410b37a2e754cc2a3af8fb25e85f73c2f1620fe4a6c4c7918";

		fetch(apiUrl)
			.then((r) => r.json())
			.then((data) => {
				var results = (data.shopping_results || []).slice(0, 25);
				var products = results.map((r) => {
					var source = (r.source || "Store").toLowerCase();
					// Extract actual seller name for display (last part after " - ")
					var parts = source.split(" - ");
					var displaySource =
						parts.length > 1 ? parts[parts.length - 1].trim() : parts[0].trim();
					var title = (r.title || "").substring(0, 200);
					// Only use direct store link if it actually points to the store (not a Google redirect)
					var directLink =
						r.product_link && !r.product_link.includes("google.com")
							? r.product_link
							: null;
					return {
						title: title,
						price: (r.extracted_price || r.price || "").toString(),
						source: displaySource,
						url: directLink || buildDirectUrl(source, title) || r.productUrl,
						domain: getRealDomain(displaySource),
						rating: r.rating || null,
						reviewCount: r.reviews || null,
						currency: "USD",
						shipping: r.shipping || "",
						inStock: true,
						fromSearch: true,
					};
				});

				// Merge with existing storage (popup already set currentProduct)
				chrome.storage.local.get(["searchResults"], (d) => {
					var existing = d.searchResults || [];

					var existingKeys = {};
					existing.forEach((p) => {
						var key = getStoreKey(p.source);
						if (key) existingKeys[key] = true;
					});

					var added = [];
					var marketplaces = {}; // Track marketplaces: only 1 per platform
					products.forEach((p) => {
						var key = getStoreKey(p.source);
						if (existingKeys[key]) return;
						// Check marketplace (first part before " - ")
						var mp = (p.source || "")
							.split(" - ")[0]
							.toLowerCase()
							.replace(/[^a-z]/g, "");
						if (marketplaces[mp]) return;
						if (!isRelevantStore(key, p.title)) return;
						// Skip unknown stores — only show verified retailers
						if (!isKnownStore(p.source)) return;
						// Price validation: skip products with suspicious prices
						if (p.price) {
							var priceNum = parseFloat(
								p.price.toString().replace(/[^0-9.]/g, ""),
							);
							if (priceNum > 0 && products.length >= 3) {
								// Find median price of all products
								var allPrices = [];
								products.forEach((x) => {
									var n = parseFloat(
										(x.price || "").toString().replace(/[^0-9.]/g, ""),
									);
									if (n > 0) allPrices.push(n);
								});
								if (allPrices.length >= 3) {
									allPrices.sort((a, b) => a - b);
									var median = allPrices[Math.floor(allPrices.length / 2)];
									// Skip if price is less than 1/5 or more than 3x the median
									if (priceNum < median / 5 || priceNum > median * 3) {
										console.log(
											"Filtered suspicious price:",
											p.title.substring(0, 50),
											"$" + priceNum,
											"vs median $" + median,
										);
										return;
									}
								}
							}
						}
						var origTitle = (
							(existing[0] && existing[0].title) ||
							""
						).toLowerCase();
						var isNew =
							!/refurbished|renewed|certified refurbished|pre.owned|open box|used - like new/i.test(
								origTitle,
							);
						if (
							isNew &&
							/refurbished|renewed|certified refurbished|pre.owned|open box|used - like new/i.test(
								p.title.toLowerCase(),
							)
						) {
							console.log("Filtered refurbished:", p.title.substring(0, 60));
							return;
						}
						existingKeys[key] = true;
						marketplaces[mp] = true;
						var origTitle = (
							(existing[0] && existing[0].title) ||
							""
						).toLowerCase();
						if (
							origTitle &&
							!isMatchingProduct(origTitle, p.title.toLowerCase())
						)
							return;
						added.push(p);
					});

					var maxNew = 7;
					if (added.length > maxNew) added = added.slice(0, maxNew);

					// Verify each product URL actually resolves to a real product page before showing it
					verifyProductUrls(added).then((verified) => {
						existing.push.apply(existing, verified);
						chrome.storage.local.set({
							searchResults: existing,
							searchStatus: "searching",
						});
						sendResponse({ count: verified.length });
					});

					// Now fetch from Serper.dev
					fetch("https://google.serper.dev/shopping", {
						method: "POST",
						headers: {
							"X-API-KEY": "ae7318b553c00d6877d41125707395778623682f",
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ q: cleanTitle }),
					})
						.then((r) => r.json())
						.then((sd) => {
							var sp = (sd.shopping || []).slice(0, 25).map((r) => ({
								title: (r.title || "").substring(0, 200),
								price: r.price || "",
								source: (r.source || "Store").toLowerCase(),
								url:
									(r.product_link && !r.product_link.includes("google.com")
										? r.product_link
										: null) ||
									buildDirectUrl(
										(r.source || "Store").toLowerCase(),
										r.title || "",
									),
								domain: getRealDomain((r.source || "Store").toLowerCase()),
								rating: r.rating || null,
								reviewCount: r.ratingCount || null,
								currency: "USD",
								shipping: "",
								inStock: true,
								fromSearch: true,
							}));
							chrome.storage.local.get(["searchResults"], (d) => {
								var cur = d.searchResults || [];
								var serperAdded = [];
								sp.forEach((p) => {
									if (cur.length + serperAdded.length >= 8) return;
									var key = getStoreKey(p.source);
									for (var i = 0; i < cur.length; i++) {
										if (getStoreKey(cur[i].source) === key) return;
									}
									for (var i = 0; i < serperAdded.length; i++) {
										if (getStoreKey(serperAdded[i].source) === key) return;
									}
									var mp = (p.source || "")
										.split(" - ")[0]
										.toLowerCase()
										.replace(/[^a-z]/g, "");
									for (var i = 0; i < cur.length; i++) {
										var emp = (cur[i].source || "")
											.split(" - ")[0]
											.toLowerCase()
											.replace(/[^a-z]/g, "");
										if (emp === mp) return;
									}
									if (!isKnownStore(p.source)) return;
									var origTitle2 = (
										(cur[0] && cur[0].title) ||
										""
									).toLowerCase();
									if (
										origTitle2 &&
										!isMatchingProduct(origTitle2, p.title.toLowerCase())
									)
										return;
									serperAdded.push(p);
								});
								// Verify Serper product URLs before adding
								verifyProductUrls(serperAdded).then((verified) => {
									verified.forEach((p) => {
										if (cur.length < 8) cur.push(p);
									});
									chrome.storage.local.set({
										searchResults: cur,
										searchStatus: "done",
									});
								});
							});
						})
						.catch(() => {
							// Serper failed — mark search as done with what we have
							chrome.storage.local.set({ searchStatus: "done" });
						});
				});
			})
			.catch(() => {
				chrome.storage.local.set({ searchStatus: "done" });
				sendResponse({ count: 0 });
			});

		return true;
	}

	function getStoreKey(src) {
		var parts = (src || "").split(" - ");
		var seller = parts.length > 1 ? parts[parts.length - 1] : src || "";
		var s = seller.toLowerCase().replace(/[^a-z0-9]/g, "");
		var storeKeys = [
			"amazon",
			"walmart",
			"target",
			"bestbuy",
			"ebay",
			"homedepot",
			"costco",
			"newegg",
			"lowes",
			"macys",
			"kohls",
			"nordstrom",
			"staples",
			"wayfair",
			"ikea",
			"etsy",
			"sephora",
			"nike",
			"adidas",
			"gamestop",
			"zara",
			"hm",
			"aliexpress",
			"samsclub",
			"bjs",
			"officedepot",
			"microcenter",
		];
		for (var i = 0; i < storeKeys.length; i++) {
			if (s.indexOf(storeKeys[i]) >= 0) return storeKeys[i];
		}
		return s;
	}

	// Verify product URLs actually resolve to real product pages
	// Returns a filtered array of products whose URLs pass verification
	function verifyProductUrls(products) {
		if (!products || products.length === 0) return Promise.resolve([]);
		// Build array of verification promises
		var promiseList = products.map((p) => {
			var url = p.url;
			if (!url || url === "null" || url === "undefined")
				return Promise.resolve(p);
			if (!url.startsWith("http")) return Promise.resolve(p);
			// For products with search URLs, skip HEAD check — search URLs are always valid
			if (
				url.includes("google.com") ||
				url.includes("/search") ||
				url.includes("/s?")
			)
				return Promise.resolve(p);
			// Quick HEAD check: verify the URL resolves to a real page
			return fetch(url, {
				method: "HEAD",
				redirect: "follow",
				signal: AbortSignal.timeout(5000),
			})
				.then((r) => {
					if (r.status >= 400) {
						console.log("SKIP: HTTP", r.status);
						return null;
					}
					return p;
				})
				.catch(() => p);
		});
		return Promise.all(promiseList).then((results) => {
			var valid = results.filter((r) => r !== null);
			console.log("Verified:", valid.length, "of", results.length, "products");
			return valid;
		});
	}

	// Build direct store search URL from source + product title
	function buildDirectUrl(source, title) {
		var src = (source || "").toLowerCase();
		// Build search from the product name (before first comma), skip model/SKU numbers
		var productName = title
			.split(/,/)[0]
			.replace(/[|].*$/, "")
			.replace(/[[\]()]/g, " ")
			.trim();
		var modelMatch = productName.match(/([A-Z]{2,}[\d-]+[A-Z]*|\d+[A-Z]{2,})$/);
		var core = productName;
		if (modelMatch)
			core = productName.replace(modelMatch[0], "").replace(/\s+/g, " ").trim();
		if (!core || core.length < 5)
			core = title.split(/\s+/).slice(0, 4).join(" ");
		var query = encodeURIComponent(core);

		// ONLY construct URLs for verified stores we know work
		var urlMap = {
			amazon: "https://www.amazon.com/s?k=",
			walmart: "https://www.walmart.com/search?q=",
			target: "https://www.target.com/s?searchTerm=",
			"best buy": "https://www.bestbuy.com/site/searchpage.jsp?st=",
			bestbuy: "https://www.bestbuy.com/site/searchpage.jsp?st=",
			homedepot: "https://www.homedepot.com/s/",
			lowes: "https://www.lowes.com/search?searchTerm=",
			costco: "https://www.costco.com/CatalogSearch?keyword=",
			ebay: "https://www.ebay.com/sch/i.html?_nkw=",
			newegg: "https://www.newegg.com/p/pl?d=",
			etsy: "https://www.etsy.com/search?q=",
			ikea: "https://www.ikea.com/us/en/search/?q=",
			wayfair: "https://www.wayfair.com/keyword.php?keyword=",
		};

		for (var key in urlMap) {
			if (src.indexOf(key) >= 0) return urlMap[key] + query;
		}

		return null; // Unknown store — will be filtered out
	}

	function isKnownStore(source) {
		var known = [
			"amazon",
			"walmart",
			"target",
			"best buy",
			"bestbuy",
			"homedepot",
			"home depot",
			"lowes",
			"costco",
			"ebay",
			"newegg",
			"etsy",
			"ikea",
			"wayfair",
		];
		var s = (source || "").toLowerCase();
		for (var i = 0; i < known.length; i++) {
			if (s.indexOf(known[i]) >= 0) return true;
		}
		return false;
	}
});
function isMatchingProduct(origTitle, resultTitle) {
	if (!origTitle || !resultTitle) return true;

	// ── BRAND CHECK ── extract brand from first 1-3 words and compare
	var knownBrands = [
		"apple",
		"samsung",
		"google",
		"sony",
		"lg",
		"dell",
		"hp",
		"lenovo",
		"microsoft",
		"asus",
		"acer",
		"msi",
		"razer",
		"bose",
		"nintendo",
		"logitech",
		"dyson",
		"irobot",
		"gopro",
		"fitbit",
		"garmin",
		"anker",
		"belkin",
		"sandisk",
		"wd",
		"seagate",
		"western digital",
		"philips",
		"kitchenaid",
		"breville",
		"cuisinart",
		"ninja",
		"instant pot",
		"keurig",
		"nespresso",
		"vitamix",
		"t-fal",
		"le creuset",
		"staub",
		"crock-pot",
		"hamilton beach",
		"oster",
		"black+decker",
		"makita",
		"dewalt",
		"milwaukee",
		"bosch",
		"ryobi",
		"craftsman",
		"fisher-price",
		"lego",
		"hasbro",
		"mattel",
		"leapfrog",
		"vtech",
		"graco",
		"chicco",
		"britax",
		"evenflo",
	];
	var extractBrand = (t) => {
		var words = t.toLowerCase().split(/\s+/);
		// Check first word, then first two words, then first three
		for (var n = 3; n >= 1; n--) {
			var candidate = words.slice(0, n).join(" ");
			if (knownBrands.indexOf(candidate) >= 0) return candidate;
		}
		// Check if any known brand appears in first 3 words
		for (var i = 0; i < knownBrands.length; i++) {
			var b = knownBrands[i];
			for (var n2 = 3; n2 >= 1; n2--) {
				if (words.slice(0, n2).join(" ").indexOf(b) >= 0) return b;
			}
		}
		return null;
	};
	var origBrand = extractBrand(origTitle);
	var resultBrand = extractBrand(resultTitle);
	// If original has a known brand, result must match or at least mention the brand
	if (origBrand) {
		if (resultBrand && resultBrand !== origBrand) {
			console.log(
				"Brand mismatch:",
				origBrand,
				"vs",
				resultBrand,
				"- rejecting",
			);
			return false;
		}
		if (!resultBrand && resultTitle.indexOf(origBrand) < 0) {
			console.log(
				"Missing brand '" + origBrand + "' in result - rejecting:",
				resultTitle.substring(0, 60),
			);
			return false;
		}
	}

	// ── MODEL NUMBER CHECK ── common patterns: Galaxy S24, iPhone 15, XPS 15, ThinkPad X1, Inspiron 16, etc.
	var modelPatterns = [
		/(?:galaxy|iphone|pixel|oneplus|moto)\s*[a-z]*\s*\d+[a-z]*/i,
		/(?:ipad|macbook|imac|mac)\s*[a-z]*\s*\d*/i,
		/(?:xps|inspiron|latitude|precision|thinkpad|ideapad|yoga|legion|omen|envy|pavilion|spectre|elitebook|probook)\s*[a-z]*\s*\d+[a-z]*/i,
		/(?:surface)\s*[a-z]*\s*\d*/i,
		/(?:kindle|fire|echo)\s*[a-z]*\s*\d*/i,
		/(?:playstation|ps|psp)\s*\d/i,
		/(?:xbox|series)\s*[a-z]/i,
		/(?:switch|wii|ds)\s*[a-z]*/i,
		/(?:bravia|trinitron|vaio|walkman)\s*[a-z]*/i,
		/(?:geforce|rtx|gtx)\s*\d+/i,
		/(?:radeon|rx)\s*\d+/i,
		/(?:core\s*i\d|ryzen\s*\d|snapdragon\s*\d|exynos\s*\d|dimensity\s*\d)/i,
	];
	var extractModel = (t) => {
		for (var i = 0; i < modelPatterns.length; i++) {
			var m = t.match(modelPatterns[i]);
			if (m) return m[0].toLowerCase().replace(/\s+/g, "");
		}
		return null;
	};
	var origModel = extractModel(origTitle);
	var resultModel = extractModel(resultTitle);
	if (origModel && resultModel && origModel !== resultModel) {
		console.log(
			"Model mismatch:",
			origModel,
			"vs",
			resultModel,
			"- rejecting",
			resultTitle.substring(0, 60),
		);
		return false;
	}

	// ── CATEGORY KEYWORD CHECK ── if original mentions a category, result must too
	var categoryKeywords = [
		"laptop",
		"tablet",
		"phone",
		"tv",
		"monitor",
		"headphone",
		"camera",
		"watch",
		"printer",
		"speaker",
		"console",
		"controller",
		"keyboard",
		"mouse",
		"drone",
		"vacuum",
		"blender",
		"mixer",
		"toaster",
		"coffee",
		"grill",
		"drill",
		"saw",
	];
	var extractCategory = (t) => {
		for (var i = 0; i < categoryKeywords.length; i++) {
			if (t.indexOf(categoryKeywords[i]) >= 0) return categoryKeywords[i];
		}
		return null;
	};
	var origCat = extractCategory(origTitle);
	var resultCat = extractCategory(resultTitle);
	if (origCat && resultCat && origCat !== resultCat) {
		console.log(
			"Category mismatch:",
			origCat,
			"vs",
			resultCat,
			"- rejecting",
			resultTitle.substring(0, 60),
		);
		return false;
	}

	// ── SPEC CHECKS (existing) ──
	var screenMatch = (t) => {
		var m = t.match(/(\d+\.?\d*)\s*["\u201d\u201c]|(\d+\.?\d*)\s*inch/);
		return m ? parseFloat(m[1] || m[2]) : null;
	};
	var origScreen = screenMatch(origTitle);
	var resultScreen = screenMatch(resultTitle);
	if (origScreen && resultScreen && origScreen !== resultScreen) return false;
	var storageMatch = (t) => {
		var m = t.match(/(\d+)\s*(GB|TB|gb|tb)/);
		return m ? m[0].toLowerCase() : null;
	};
	var origStorage = storageMatch(origTitle);
	var resultStorage = storageMatch(resultTitle);
	if (origStorage && resultStorage && origStorage !== resultStorage)
		return false;
	var ramMatch = (t) => {
		var m = t.match(/(\d+)\s*GB\s*(RAM|ram|memory)/);
		return m ? parseInt(m[1]) : null;
	};
	var origRam = ramMatch(origTitle);
	var resultRam = ramMatch(resultTitle);
	if (origRam && resultRam && origRam !== resultRam) return false;
	var cpuMatch = (t) => {
		var m = t.match(/core\s*i(\d)|ryzen\s*(\d)/i);
		if (!m) return null;
		return (m[1] || m[2]).toLowerCase();
	};
	var origCpu = cpuMatch(origTitle);
	var resultCpu = cpuMatch(resultTitle);
	if (origCpu && resultCpu && origCpu !== resultCpu) return false;
	return true;
}

// --- Tab Event Listeners ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === "complete") scanTab(tabId, tab.url);
});

chrome.tabs.onRemoved.addListener((tabId) => {
	delete productTabs[tabId];
	delete notificationShown[tabId];
	updateBadge();
});

// Initial scan of all existing tabs
setTimeout(() => {
	chrome.tabs.query({}, (tabs) => {
		tabs.forEach((tab) => {
			if (tab.id) scanTab(tab.id, tab.url);
		});
		updateBadge();
	});
}, 2000);
