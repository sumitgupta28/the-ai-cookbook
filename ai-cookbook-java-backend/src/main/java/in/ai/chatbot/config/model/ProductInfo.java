package in.ai.chatbot.config.model;

import java.math.BigDecimal;

public record ProductInfo(
        Long id,
        String productId,
        String name,
        String category,
        String brand,
        String description,
        BigDecimal price,
        String imageUrl,
        BigDecimal rating,
        Integer stockCount
) {}
