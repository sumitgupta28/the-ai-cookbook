package in.ai.chatbot.config.tools;

import in.ai.chatbot.config.model.GeocodingResponse;
import in.ai.chatbot.config.model.GeocodingResult;
import in.ai.chatbot.config.model.OpenMeteoResponse;
import in.ai.chatbot.config.model.WeatherResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Slf4j
@Component
public class WeatherTool {

    private final RestClient geocodingClient = RestClient.builder()
            .baseUrl("https://geocoding-api.open-meteo.com/v1/search")
            .build();

    private final RestClient forecastClient = RestClient.builder()
            .baseUrl("https://api.open-meteo.com/v1/forecast")
            .build();

    @Tool(description = "Return the current weather for a given city. Use this when the user asks about the weather in a specific city.")
    public WeatherResult getWeather(
            @ToolParam(description = "The name of the city, e.g. London, Tokyo, New York") String city) {
        log.debug("[tool:getWeather] city={}", city);

        try {
            GeocodingResponse geo = geocodingClient.get()
                    .uri("?name={name}&count=1&language=en&format=json", city)
                    .retrieve()
                    .body(GeocodingResponse.class);

            if (geo == null || geo.results() == null || geo.results().isEmpty()) {
                log.warn("[tool:getWeather] city not found in geocoding: {}", city);
                return WeatherResult.failure("City not found: " + city + ". Please check the spelling and try again.");
            }

            GeocodingResult location = geo.results().get(0);
            log.debug("[tool:getWeather] geocoded to lat={}, lon={}", location.latitude(), location.longitude());

            OpenMeteoResponse weather = forecastClient.get()
                    .uri("?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code&wind_speed_unit=kmh",
                            location.latitude(), location.longitude())
                    .retrieve()
                    .body(OpenMeteoResponse.class);

            if (weather == null || weather.current() == null) {
                log.warn("[tool:getWeather] empty forecast response for city={}", city);
                return WeatherResult.failure("Weather data not available for " + city + ".");
            }

            var cc = weather.current();
            String locationLabel = location.admin1() != null
                    ? location.name() + ", " + location.admin1() + ", " + location.country()
                    : location.name() + ", " + location.country();

            log.debug("[tool:getWeather] location={}, temp={}, code={}", locationLabel, cc.temperature2m(), cc.weatherCode());

            return WeatherResult.success(
                    locationLabel,
                    describeWeatherCode(cc.weatherCode()),
                    cc.temperature2m(),
                    cc.relativeHumidity2m(),
                    cc.windSpeed10m(),
                    toCardinal(cc.windDirection10m())
            );

        } catch (RestClientException e) {
            log.error("[tool:getWeather] HTTP error for city={}: {}", city, e.getMessage());
            return WeatherResult.failure("Weather data not available for " + city + ". Please try again later.");
        } catch (Exception e) {
            log.error("[tool:getWeather] Unexpected error for city={}: {}", city, e.getMessage(), e);
            return WeatherResult.failure("Weather data not available for " + city + ". Please try again later.");
        }
    }

    private static String describeWeatherCode(int code) {
        return switch (code) {
            case 0             -> "Clear sky";
            case 1             -> "Mainly clear";
            case 2             -> "Partly cloudy";
            case 3             -> "Overcast";
            case 45            -> "Fog";
            case 48            -> "Freezing fog";
            case 51            -> "Light drizzle";
            case 53            -> "Moderate drizzle";
            case 55            -> "Heavy drizzle";
            case 56            -> "Light freezing drizzle";
            case 57            -> "Heavy freezing drizzle";
            case 61            -> "Slight rain";
            case 63            -> "Moderate rain";
            case 65            -> "Heavy rain";
            case 66            -> "Light freezing rain";
            case 67            -> "Heavy freezing rain";
            case 71            -> "Slight snow";
            case 73            -> "Moderate snow";
            case 75            -> "Heavy snow";
            case 77            -> "Snow grains";
            case 80            -> "Slight rain showers";
            case 81            -> "Moderate rain showers";
            case 82            -> "Heavy rain showers";
            case 85            -> "Slight snow showers";
            case 86            -> "Heavy snow showers";
            case 95            -> "Thunderstorm";
            case 96            -> "Thunderstorm with slight hail";
            case 99            -> "Thunderstorm with heavy hail";
            default            -> "Unknown (" + code + ")";
        };
    }

    private static String toCardinal(double degrees) {
        String[] dirs = {"N", "NE", "E", "SE", "S", "SW", "W", "NW"};
        return dirs[(int) Math.round(degrees / 45.0) % 8];
    }
}
