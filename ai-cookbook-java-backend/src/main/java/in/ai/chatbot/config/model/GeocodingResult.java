package in.ai.chatbot.config.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GeocodingResult(
        String name,
        double latitude,
        double longitude,
        String country,
        String admin1
) {}
