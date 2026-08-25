package in.ai.chatbot.config.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OpenMeteoCurrentConditions(
        @JsonProperty("temperature_2m")       double temperature2m,
        @JsonProperty("relative_humidity_2m") double relativeHumidity2m,
        @JsonProperty("wind_speed_10m")        double windSpeed10m,
        @JsonProperty("wind_direction_10m")    double windDirection10m,
        @JsonProperty("weather_code")          int    weatherCode
) {}
