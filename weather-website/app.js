// SkyGlass Weather (plain JS) — Open-Meteo + Firebase Hosting
// No build tools. Just open index.html or deploy to Firebase Hosting.

const el = (id) => document.getElementById(id);
const $current = el('current');
const $hourly = el('hourly');
const $daily = el('daily');

const weatherText = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Drizzle: light",
  53: "Drizzle: moderate",
  55: "Drizzle: dense",
  56: "Freezing drizzle: light",
  57: "Freezing drizzle: dense",
  61: "Rain: slight",
  63: "Rain: moderate",
  65: "Rain: heavy",
  66: "Freezing rain: light",
  67: "Freezing rain: heavy",
  71: "Snow fall: slight",
  73: "Snow fall: moderate",
  75: "Snow fall: heavy",
  77: "Snow grains",
  80: "Rain showers: slight",
  81: "Rain showers: moderate",
  82: "Rain showers: violent",
  85: "Snow showers: slight",
  86: "Snow showers: heavy",
  95: "Thunderstorm",
  96: "Thunderstorm w/ slight hail",
  99: "Thunderstorm w/ heavy hail",
};

function setBackground(code) {
  // Change gradient by condition & time
  const hour = new Date().getHours();
  const night = hour < 6 || hour >= 19;
  let bg1 = "#90caf9", bg2 = "#d1c4e9";
  if (night) { bg1 = "#0a0f2c"; bg2 = "#1a237e"; }
  else if ([0,1].includes(code)) { bg1 = "#90caf9"; bg2 = "#e3f2fd"; }
  else if ([2,3].includes(code)) { bg1 = "#81d4fa"; bg2 = "#cfd8dc"; }
  else if ([51,53,55,56,57,61,63,65,80,81,82].includes(code)) { bg1 = "#78909c"; bg2 = "#b0bec5"; }
  else if ([71,73,75,77,85,86].includes(code)) { bg1 = "#cfd8dc"; bg2 = "#90caf9"; }
  document.documentElement.style.setProperty("--bg1", bg1);
  document.documentElement.style.setProperty("--bg2", bg2);
}

function iconFor(code) {
  // Lightweight animated icon HTML
  const wrap = document.createElement('div');
  wrap.className = 'icon';
  if ([0,1].includes(code)) {
    wrap.innerHTML = `<div class="sun"></div>`;
  } else if ([2,3,45,48].includes(code)) {
    wrap.innerHTML = `<div class="cloud"></div>`;
  } else if ([61,63,65,80,81,82,51,53,55,56,57].includes(code)) {
    wrap.innerHTML = `<div class="cloud"></div><div class="rain"></div><div class="rain"></div><div class="rain"></div>`;
  } else if ([71,73,75,77,85,86].includes(code)) {
    wrap.innerHTML = `<div class="cloud"></div><div class="snow"></div><div class="snow"></div><div class="snow"></div>`;
  } else if ([95,96,99].includes(code)) {
    wrap.innerHTML = `<div class="cloud"></div><div class="rain"></div><div class="rain"></div>`; // simple
  } else {
    wrap.innerHTML = `<div class="cloud"></div>`;
  }
  return wrap;
}

async function geocode(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Geocoding failed');
  const j = await r.json();
  if (!j.results || !j.results.length) throw new Error('Place not found');
  const g = j.results[0];
  return { lat: g.latitude, lon: g.longitude, label: `${g.name}${g.country ? ', ' + g.country : ''}` };
}

async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto"
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Weather API failed');
  return r.json();
}

function fmtTime(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}${ampm}`;
}

function dayName(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
}

function renderCurrent(wx, label) {
  const code = wx.current.weather_code;
  setBackground(code);

  const icon = iconFor(code).outerHTML;
  const html = `
    <div class="current">
      <div>
        <div class="temp">${Math.round(wx.current.temperature_2m)}°</div>
        <div class="subtitle">${weatherText[code] || '—'}</div>
        <div class="place">${label || 'Your location'}</div>
        <div class="meta">Feels like ${Math.round(wx.current.apparent_temperature)}°, 
          Humidity ${wx.current.relative_humidity_2m}% · Wind ${Math.round(wx.current.wind_speed_10m)} km/h</div>
      </div>
      <div>${icon}</div>
    </div>
  `;
  $current.innerHTML = html;
  $current.classList.add('glass');
}

function renderHourly(wx) {
  const t = wx.hourly.time;
  const temps = wx.hourly.temperature_2m;
  const prob = wx.hourly.precipitation_probability || [];
  const code = wx.hourly.weather_code;
  $hourly.innerHTML = '';
  for (let i = 0; i < Math.min(12, t.length); i++) {
    const el = document.createElement('div');
    el.className = 'hour';
    el.innerHTML = `
      <div class="ti">${fmtTime(t[i])}</div>
      <div class="t">${Math.round(temps[i])}°</div>
      <div class="ti">${prob[i] != null ? prob[i] : 0}% rain</div>
    `;
    $hourly.appendChild(el);
  }
}

function renderDaily(wx) {
  const t = wx.daily.time;
  const min = wx.daily.temperature_2m_min;
  const max = wx.daily.temperature_2m_max;
  const code = wx.daily.weather_code;

  $daily.innerHTML = '';
  for (let i = 0; i < Math.min(7, t.length); i++) {
    const row = document.createElement('div');
    row.className = 'day';
    row.innerHTML = `
      <div class="name">${dayName(t[i])}</div>
      <div>${(weatherText[code[i]] || '—')}</div>
      <div class="range">${Math.round(min[i])}° / ${Math.round(max[i])}°</div>
    `;
    $daily.appendChild(row);
  }
}

async function searchCity() {
  const q = document.getElementById('search').value.trim();
  if (!q) return;
  try {
    $current.innerHTML = '<div class="skeleton" style="min-height:120px"></div>';
    const g = await geocode(q);
    const wx = await fetchWeather(g.lat, g.lon);
    wx._label = g.label;
    renderCurrent(wx, g.label);
    renderHourly(wx);
    renderDaily(wx);
  } catch (e) {
    $current.innerHTML = `<div class="card glass">Error: ${(e && e.message) || e}</div>`;
  }
}

async function useGeo() {
  if (!navigator.geolocation) return alert('Geolocation not available');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      $current.innerHTML = '<div class="skeleton" style="min-height:120px"></div>';
      const { latitude: lat, longitude: lon } = pos.coords;
      const wx = await fetchWeather(lat, lon);
      renderCurrent(wx, 'Your location');
      renderHourly(wx);
      renderDaily(wx);
    } catch (e) {
      $current.innerHTML = `<div class="card glass">Error: ${(e && e.message) || e}</div>`;
    }
  }, (err) => alert(err.message), { enableHighAccuracy: true });
}

document.getElementById('searchBtn').addEventListener('click', searchCity);
document.getElementById('geoBtn').addEventListener('click', useGeo);
document.getElementById('search').addEventListener('keydown', (e)=>{
  if (e.key === 'Enter') searchCity();
});

// Auto: try geolocation on load (quietly)
useGeo();
