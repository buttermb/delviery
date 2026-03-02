/**
 * Fetch Weather Edge Function
 *
 * Fetches weather data from OpenWeatherMap API for delivery planning.
 * Returns current conditions and forecast to help plan deliveries.
 */

import { serve, corsHeaders, z } from '../_shared/deps.ts';

// Request validation schema
const requestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  units: z.enum(['metric', 'imperial']).optional().default('imperial'),
});

// Weather condition severity for delivery planning
type WeatherSeverity = 'good' | 'moderate' | 'poor' | 'severe';

interface WeatherCondition {
  id: number;
  main: string;
  description: string;
  icon: string;
}

interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  visibility: number;
  conditions: WeatherCondition[];
  cloudiness: number;
  precipitation?: number;
}

interface ForecastHour {
  timestamp: number;
  dateTime: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  conditions: WeatherCondition[];
  precipitationChance: number;
  precipitation?: number;
}

interface DeliveryAlert {
  severity: WeatherSeverity;
  type: string;
  message: string;
  recommendation: string;
}

interface WeatherResponse {
  current: CurrentWeather;
  forecast: ForecastHour[];
  alerts: DeliveryAlert[];
  deliveryCondition: WeatherSeverity;
  deliveryRecommendation: string;
  location: {
    name: string;
    country: string;
  };
  units: 'metric' | 'imperial';
  fetchedAt: string;
}

function assessDeliveryConditions(
  current: CurrentWeather,
  forecast: ForecastHour[]
): { severity: WeatherSeverity; recommendation: string; alerts: DeliveryAlert[] } {
  const alerts: DeliveryAlert[] = [];
  let overallSeverity: WeatherSeverity = 'good';

  // Check current conditions
  const weatherMain = current.conditions[0]?.main?.toLowerCase() || '';
  const weatherId = current.conditions[0]?.id || 0;

  // Temperature extremes (imperial: Fahrenheit)
  if (current.temperature > 95) {
    alerts.push({
      severity: 'moderate',
      type: 'extreme_heat',
      message: 'Extreme heat warning',
      recommendation: 'Ensure products requiring temperature control are properly insulated. Consider early morning deliveries.',
    });
    overallSeverity = 'moderate';
  } else if (current.temperature < 32) {
    alerts.push({
      severity: 'moderate',
      type: 'freezing',
      message: 'Freezing conditions',
      recommendation: 'Watch for icy roads. Allow extra time for deliveries.',
    });
    overallSeverity = 'moderate';
  }

  // Wind conditions (mph for imperial)
  if (current.windSpeed > 30) {
    alerts.push({
      severity: 'moderate',
      type: 'high_wind',
      message: 'High wind warning',
      recommendation: 'Secure loose items. Be cautious with vehicle doors.',
    });
    if (overallSeverity === 'good') overallSeverity = 'moderate';
  } else if (current.windSpeed > 45) {
    alerts.push({
      severity: 'poor',
      type: 'dangerous_wind',
      message: 'Dangerous wind conditions',
      recommendation: 'Consider delaying non-urgent deliveries. Watch for debris on roads.',
    });
    overallSeverity = 'poor';
  }

  // Precipitation - Thunderstorms (200-299), Drizzle (300-399), Rain (500-599)
  if (weatherId >= 200 && weatherId < 300) {
    alerts.push({
      severity: 'poor',
      type: 'thunderstorm',
      message: 'Thunderstorm in progress',
      recommendation: 'Delay deliveries if possible. Seek shelter during lightning.',
    });
    overallSeverity = 'poor';
  } else if (weatherId >= 500 && weatherId < 600) {
    if (weatherId >= 502) {
      alerts.push({
        severity: 'moderate',
        type: 'heavy_rain',
        message: 'Heavy rain',
        recommendation: 'Reduce speed and increase following distance. Protect packages from water.',
      });
      if (overallSeverity === 'good') overallSeverity = 'moderate';
    }
  }

  // Snow (600-699)
  if (weatherId >= 600 && weatherId < 700) {
    if (weatherId >= 602) {
      alerts.push({
        severity: 'poor',
        type: 'heavy_snow',
        message: 'Heavy snow conditions',
        recommendation: 'Consider rescheduling deliveries. Roads may be hazardous.',
      });
      overallSeverity = 'poor';
    } else {
      alerts.push({
        severity: 'moderate',
        type: 'snow',
        message: 'Snow conditions',
        recommendation: 'Allow extra time. Drive cautiously.',
      });
      if (overallSeverity === 'good') overallSeverity = 'moderate';
    }
  }

  // Fog/Mist (700-799)
  if (weatherId >= 700 && weatherId < 800) {
    if (current.visibility < 1000) {
      alerts.push({
        severity: 'moderate',
        type: 'low_visibility',
        message: 'Low visibility conditions',
        recommendation: 'Use fog lights. Reduce speed significantly.',
      });
      if (overallSeverity === 'good') overallSeverity = 'moderate';
    }
  }

  // Check upcoming forecast for changes
  const next3Hours = forecast.slice(0, 3);
  for (const hour of next3Hours) {
    if (hour.precipitationChance > 70) {
      const forecastCondition = hour.conditions[0]?.main?.toLowerCase() || '';
      if (!alerts.some(a => a.type.includes('rain') || a.type.includes('snow'))) {
        alerts.push({
          severity: 'moderate',
          type: 'incoming_precipitation',
          message: `${forecastCondition} expected within ${next3Hours.indexOf(hour) + 1} hours`,
          recommendation: 'Plan deliveries accordingly. Consider completing routes before precipitation arrives.',
        });
      }
      break;
    }
  }

  // Generate overall recommendation
  let recommendation: string;
  switch (overallSeverity) {
    case 'good':
      recommendation = 'Excellent conditions for deliveries. No weather-related delays expected.';
      break;
    case 'moderate':
      recommendation = 'Fair delivery conditions. Allow extra time and take appropriate precautions.';
      break;
    case 'poor':
      recommendation = 'Challenging conditions. Consider rescheduling non-urgent deliveries.';
      break;
    case 'severe':
      recommendation = 'Dangerous conditions. Strongly recommend postponing all deliveries.';
      break;
  }

  return { severity: overallSeverity, recommendation, alerts };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OPENWEATHERMAP_API_KEY');

    if (!apiKey) {
      // Return mock data if no API key is configured (development/demo mode)
      const mockResponse: WeatherResponse = {
        current: {
          temperature: 72,
          feelsLike: 70,
          humidity: 45,
          windSpeed: 8,
          windDirection: 180,
          visibility: 10000,
          conditions: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
          cloudiness: 5,
        },
        forecast: Array.from({ length: 8 }, (_, i) => ({
          timestamp: Date.now() + i * 3600000,
          dateTime: new Date(Date.now() + i * 3600000).toISOString(),
          temperature: 70 + Math.floor(Math.random() * 10),
          feelsLike: 68 + Math.floor(Math.random() * 10),
          humidity: 40 + Math.floor(Math.random() * 20),
          windSpeed: 5 + Math.floor(Math.random() * 10),
          conditions: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
          precipitationChance: Math.floor(Math.random() * 30),
        })),
        alerts: [],
        deliveryCondition: 'good',
        deliveryRecommendation: 'Excellent conditions for deliveries. No weather-related delays expected.',
        location: {
          name: 'Demo Location',
          country: 'US',
        },
        units: 'imperial',
        fetchedAt: new Date().toISOString(),
      };

      return new Response(
        JSON.stringify({ success: true, data: mockResponse, demo: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: (parsed as { success: false; error: { errors: unknown[] } }).error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { latitude, longitude, units } = parsed.data;

    // Fetch current weather
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=${units}&appid=${apiKey}`;
    const currentRes = await fetch(currentUrl);

    if (!currentRes.ok) {
      const errorText = await currentRes.text();
      throw new Error(`Weather API error: ${currentRes.status} - ${errorText}`);
    }

    const currentData = await currentRes.json();

    // Fetch 5-day forecast (3-hour intervals)
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=${units}&cnt=8&appid=${apiKey}`;
    const forecastRes = await fetch(forecastUrl);

    if (!forecastRes.ok) {
      const errorText = await forecastRes.text();
      throw new Error(`Forecast API error: ${forecastRes.status} - ${errorText}`);
    }

    const forecastData = await forecastRes.json();

    // Transform current weather data
    const current: CurrentWeather = {
      temperature: Math.round(currentData.main.temp),
      feelsLike: Math.round(currentData.main.feels_like),
      humidity: currentData.main.humidity,
      windSpeed: Math.round(currentData.wind.speed),
      windDirection: currentData.wind.deg || 0,
      visibility: currentData.visibility,
      conditions: currentData.weather,
      cloudiness: currentData.clouds?.all || 0,
      precipitation: currentData.rain?.['1h'] || currentData.snow?.['1h'],
    };

    // Transform forecast data
    const forecast: ForecastHour[] = forecastData.list.map((item: Record<string, unknown>) => ({
      timestamp: (item.dt as number) * 1000,
      dateTime: new Date((item.dt as number) * 1000).toISOString(),
      temperature: Math.round((item.main as Record<string, number>).temp),
      feelsLike: Math.round((item.main as Record<string, number>).feels_like),
      humidity: (item.main as Record<string, number>).humidity,
      windSpeed: Math.round((item.wind as Record<string, number>).speed),
      conditions: item.weather as WeatherCondition[],
      precipitationChance: Math.round(((item.pop as number) || 0) * 100),
      precipitation: (item.rain as Record<string, number>)?.['3h'] || (item.snow as Record<string, number>)?.['3h'],
    }));

    // Assess delivery conditions
    const assessment = assessDeliveryConditions(current, forecast);

    const response: WeatherResponse = {
      current,
      forecast,
      alerts: assessment.alerts,
      deliveryCondition: assessment.severity,
      deliveryRecommendation: assessment.recommendation,
      location: {
        name: currentData.name,
        country: currentData.sys.country,
      },
      units,
      fetchedAt: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({ success: true, data: response }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Weather fetch error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
