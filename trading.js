(() => {
  'use strict';

  const assets = [
    { symbol: 'BTCUSDT', ticker: 'BTC', name: 'Bitcoin', mark: '₿' },
    { symbol: 'ETHUSDT', ticker: 'ETH', name: 'Ethereum', mark: '◆' },
    { symbol: 'SOLUSDT', ticker: 'SOL', name: 'Solana', mark: '◎' },
    { symbol: 'BNBUSDT', ticker: 'BNB', name: 'BNB', mark: '◆' },
    { symbol: 'XRPUSDT', ticker: 'XRP', name: 'XRP', mark: 'X' },
    { symbol: 'ADAUSDT', ticker: 'ADA', name: 'Cardano', mark: 'A' },
    { symbol: 'DOGEUSDT', ticker: 'DOGE', name: 'Dogecoin', mark: 'Ð' },
    { symbol: 'LINKUSDT', ticker: 'LINK', name: 'Chainlink', mark: '⬡' }
  ];
  const prices = new Map();
  let favorites = new Set();
  let favoritesOnly = false;
  let refreshTimer;

  try {
    favorites = new Set(JSON.parse(localStorage.getItem('marketpulse-favorites') || '[]'));
  } catch (_) { /* Storage can be unavailable in private browsing. */ }

  const money = value => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2
  }).format(value);

  function renderAssets() {
    const body = document.getElementById('assetRows');
    const query = document.getElementById('assetSearch').value.trim().toLowerCase();
    const visible = assets.filter(asset => {
      const matchesSearch = `${asset.name} ${asset.ticker}`.toLowerCase().includes(query);
      return matchesSearch && (!favoritesOnly || favorites.has(asset.symbol));
    });
    document.getElementById('watchCount').textContent = `${visible.length} asset${visible.length === 1 ? '' : 's'}`;
    if (!visible.length) {
      body.innerHTML = '<tr><td colspan="4" class="empty-cell">No matching assets. Try another search.</td></tr>';
      return;
    }
    body.innerHTML = visible.map(asset => {
      const quote = prices.get(asset.symbol);
      const change = quote ? Number(quote.priceChangePercent) : null;
      const changeClass = change === null ? '' : change >= 0 ? 'positive' : 'negative';
      const changeText = change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
      const priceText = quote ? money(Number(quote.lastPrice)) : '—';
      return `<tr>
        <td><div class="asset-name"><span class="asset-logo">${asset.mark}</span><span><span class="asset-symbol">${asset.ticker}</span><span class="asset-fullname">${asset.name}</span></span></div></td>
        <td>${priceText}</td><td class="${changeClass}">${changeText}</td>
        <td><button class="favorite ${favorites.has(asset.symbol) ? 'selected' : ''}" data-favorite="${asset.symbol}" aria-label="${favorites.has(asset.symbol) ? 'Remove' : 'Add'} ${asset.name} ${favorites.has(asset.symbol) ? 'from' : 'to'} favorites" aria-pressed="${favorites.has(asset.symbol)}">${favorites.has(asset.symbol) ? '★' : '☆'}</button></td>
      </tr>`;
    }).join('');
  }

  function updateHighlight(symbol, priceId, changeId) {
    const quote = prices.get(symbol);
    if (!quote) return;
    document.getElementById(priceId).textContent = money(Number(quote.lastPrice));
    const value = Number(quote.priceChangePercent);
    const change = document.getElementById(changeId);
    change.textContent = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    change.classList.toggle('negative', value < 0);
  }

  async function loadPrices() {
    const refresh = document.getElementById('refreshBtn');
    refresh.classList.add('spinning');
    try {
      const symbols = encodeURIComponent(JSON.stringify(assets.map(asset => asset.symbol)));
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Market API returned ${response.status}`);
      const data = await response.json();
      data.forEach(quote => prices.set(quote.symbol, quote));
      updateHighlight('BTCUSDT', 'btcPrice', 'btcChange');
      updateHighlight('ETHUSDT', 'ethPrice', 'ethChange');
      updateHighlight('SOLUSDT', 'solPrice', 'solChange');
      renderAssets();
      document.getElementById('updatedAt').textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    } catch (error) {
      document.getElementById('updatedAt').textContent = 'Live prices unavailable — retrying';
      if (!prices.size) document.getElementById('assetRows').innerHTML = '<tr><td colspan="4" class="empty-cell">Could not load live prices. Check your connection and try again.</td></tr>';
      console.warn('Unable to fetch public crypto prices:', error);
    } finally {
      refresh.classList.remove('spinning');
    }
  }

  function loadChart(symbol) {
    const container = document.getElementById('tradingviewChart');
    container.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true, symbol, interval: 'D', timezone: 'Etc/UTC', theme: 'dark',
      style: '1', locale: 'en', allow_symbol_change: true, calendar: false,
      support_host: 'https://www.tradingview.com'
    });
    container.appendChild(script);
  }

  document.getElementById('assetSearch').addEventListener('input', renderAssets);
  document.getElementById('assetRows').addEventListener('click', event => {
    const button = event.target.closest('[data-favorite]');
    if (!button) return;
    const symbol = button.dataset.favorite;
    favorites.has(symbol) ? favorites.delete(symbol) : favorites.add(symbol);
    try { localStorage.setItem('marketpulse-favorites', JSON.stringify([...favorites])); } catch (_) { /* Keep this session's selection. */ }
    renderAssets();
  });
  document.getElementById('favoritesToggle').addEventListener('click', event => {
    favoritesOnly = !favoritesOnly;
    event.currentTarget.setAttribute('aria-pressed', String(favoritesOnly));
    event.currentTarget.textContent = favoritesOnly ? '★' : '☆';
    renderAssets();
  });
  document.getElementById('refreshBtn').addEventListener('click', loadPrices);
  document.getElementById('chartSymbol').addEventListener('change', event => loadChart(event.target.value));
  document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  document.querySelectorAll('.side-nav a').forEach(link => link.addEventListener('click', () => document.getElementById('sidebar').classList.remove('open')));

  document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  renderAssets();
  loadPrices();
  refreshTimer = window.setInterval(loadPrices, 15000);
  window.addEventListener('pagehide', () => window.clearInterval(refreshTimer), { once: true });
})();
