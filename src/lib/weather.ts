/**
 * 真实天气数据：Open-Meteo 免费天气 API（无需 Key，支持浏览器跨域）
 * 文档：https://open-meteo.com/en/docs
 */

const BASE = 'https://api.open-meteo.com/v1/forecast';
// 默认城市：四川成都（如需其他城市，替换经纬度即可）
const COORDS = { latitude: 30.66, longitude: 104.07 };

export type WeatherKind = 'sun' | 'cloud-sun' | 'cloud' | 'cloud-rain' | 'cloud-snow' | 'cloud-lightning' | 'cloud-fog';

interface WeatherNow {
  temperature: number;
  humidity: number;
  windLabel: string; // 如「西南风 3 级」
  kind: WeatherKind;
  label: string;
}

interface WeatherDay {
  label: string;
  kind: WeatherKind;
  label_text: string;
  max: number;
  min: number;
}

export interface WeatherData {
  now: WeatherNow;
  days: WeatherDay[];
}

/** WMO 天气码 → 展示分类与中文描述 */
function wmoKind(code: number): WeatherKind {
  if (code === 0) return 'sun';
  if (code === 1 || code === 2) return 'cloud-sun';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'cloud-fog';
  if (code >= 51 && code <= 67) return 'cloud-rain';
  if (code >= 71 && code <= 77) return 'cloud-snow';
  if (code >= 80 && code <= 82) return 'cloud-rain';
  if (code === 85 || code === 86) return 'cloud-snow';
  if (code >= 95) return 'cloud-lightning';
  return 'cloud';
}

function wmoLabel(code: number): string {
  const map: Record<number, string> = {
    0: '晴', 1: '大致晴朗', 2: '多云', 3: '阴',
    45: '有雾', 48: '雾凇',
    51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
    61: '小雨', 63: '中雨', 65: '大雨',
    66: '冻雨', 67: '强冻雨',
    71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
    80: '阵雨', 81: '阵雨', 82: '强阵雨',
    85: '阵雪', 86: '阵雪',
    95: '雷阵雨', 96: '雷雨伴冰雹', 99: '雷雨伴冰雹',
  };
  return map[code] ?? '多云';
}

/** 风向角度 → 八方位中文 */
const windDirName = (deg: number): string => {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
};

/** km/h 风速 → 蒲福风级 */
const windLevel = (kmh: number): number => {
  const bounds = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 117];
  for (let i = 0; i < bounds.length; i++) if (kmh < bounds[i]) return i;
  return 12;
};

/** 拉取任意坐标的实时天气与三日预报 */
export async function fetchWeatherAt(latitude: number, longitude: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'Asia/Shanghai',
    forecast_days: '3',
  });
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const c = j.current;
  const dayLabels = ['今天', '明天', '后天'];
  const days: WeatherDay[] = (j.daily?.time ?? []).slice(0, 3).map((iso: string, i: number) => ({
    label: dayLabels[i] ?? iso,
    kind: wmoKind(j.daily.weather_code[i]),
    label_text: wmoLabel(j.daily.weather_code[i]),
    max: Math.round(j.daily.temperature_2m_max[i]),
    min: Math.round(j.daily.temperature_2m_min[i]),
  }));
  return {
    now: {
      temperature: Math.round(c.temperature_2m),
      humidity: Math.round(c.relative_humidity_2m),
      windLabel: `${windDirName(c.wind_direction_10m)}风 ${windLevel(c.wind_speed_10m)} 级`,
      kind: wmoKind(c.weather_code),
      label: wmoLabel(c.weather_code),
    },
    days,
  };
}

/** 拉取成都实时天气（默认位置） */
export async function fetchChengduWeather(): Promise<WeatherData> {
  return fetchWeatherAt(COORDS.latitude, COORDS.longitude);
}

export interface ResolvedLocation {
  lat: number;
  lon: number;
  label: string;
}

/**
 * 浏览器定位 + 逆地理编码（BigDataCloud 免费客户端接口，无需 Key）
 * 用户拒绝授权或定位失败时返回 null（调用方回落默认城市）
 */
export async function resolveLocation(): Promise<ResolvedLocation | null> {
  if (!navigator.geolocation) return null;
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 600000 });
  });
  const { latitude, longitude } = pos.coords;
  let label = '当前位置';
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh`,
    );
    const j = await res.json();
    const province = (j.principalSubdivision as string) || '';
    const city = (j.city as string) || (j.locality as string) || '';
    label = province && city && province !== city ? `${province} · ${city}` : city || province || label;
  } catch {
    /* 逆地理失败时用通用文案 */
  }
  return { lat: latitude, lon: longitude, label };
}
