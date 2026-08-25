package in.ai.chatbot.config.repository;

import in.ai.chatbot.config.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findByProductId(String productId);
    List<Product> findAllByOrderByCreatedAtDesc();
    void deleteByProductId(String productId);
}
