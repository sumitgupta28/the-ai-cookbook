package in.ai.chatbot.config.model;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record WeatherResult(
        String location,
        String condition,
        Double temperatureC,
        Double humidityPercent,
        Double windKmh,
        String windDirection,
        String error
) {
    public static WeatherResult success(String location, String condition,
                                        double temperatureC, double humidityPercent,
                                        double windKmh, String windDirection) {
        return new WeatherResult(location, condition, temperatureC, humidityPercent, windKmh, windDirection, null);
    }

    public static WeatherResult failure(String error) {
        return new WeatherResult(null, null, null, null, null, null, error);
    }
}
