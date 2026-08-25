package in.ai.chatbot.config.service;

import in.ai.chatbot.config.model.Product;
import in.ai.chatbot.config.model.ProductInfo;
import in.ai.chatbot.config.model.ProductUploadResult;
import in.ai.chatbot.config.repository.ProductRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class ProductIngestionService {

    private final VectorStore productVectorStore;
    private final ProductRepository productRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public ProductIngestionService(@Qualifier("productVectorStore") VectorStore productVectorStore,
                                   ProductRepository productRepository) {
        this.productVectorStore = productVectorStore;
        this.productRepository = productRepository;
    }

    public ProductUploadResult ingest(MultipartFile file) throws Exception {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        String filename = file.getOriginalFilename();
        if (filename == null || (!filename.endsWith(".xlsx") && !filename.endsWith(".xls"))) {
            throw new IllegalArgumentException("Only .xlsx and .xls files are supported");
        }

        int imported = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                throw new IllegalArgumentException("XLS file has no header row");
            }

            Map<String, Integer> colIndex = buildColumnIndex(headerRow);
            log.debug("XLS columns found: {}", colIndex.keySet());

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowBlank(row)) continue;

                try {
                    Product product = parseRow(row, colIndex);
                    upsertProduct(product);
                    imported++;
                } catch (Exception e) {
                    log.warn("Skipping row {}: {}", i + 1, e.getMessage());
                    errors.add("Row " + (i + 1) + ": " + e.getMessage());
                    skipped++;
                }
            }
        }

        log.info("XLS ingestion complete: {} imported, {} skipped", imported, skipped);
        return new ProductUploadResult(imported, skipped, errors);
    }

    private void upsertProduct(Product product) {
        productRepository.findByProductId(product.getProductId()).ifPresent(existing -> {
            deleteVectorsByProductId(existing.getProductId());
            productRepository.delete(existing);
        });

        Product saved = productRepository.save(product);

        String embeddingText = String.format(
                "Product: %s. Category: %s. Brand: %s. Description: %s. Price: $%.2f.",
                nvl(saved.getName()), nvl(saved.getCategory()), nvl(saved.getBrand()),
                nvl(saved.getDescription()), saved.getPrice());

        // Add metadata for filtering
        Map<String, Object> metadata = Map.of(
                "product_id", saved.getProductId(),
                "category", saved.getCategory(), // Example static category
                "price", Double.parseDouble(saved.getPrice().toString()),
                "brand", saved.getBrand()
        );

        Document doc = new Document(embeddingText, metadata);
        productVectorStore.add(List.of(doc));
        log.debug("Indexed product '{}' into product_vector_store", saved.getProductId());
    }

    @Transactional
    public void deleteProduct(Long id) {
        productRepository.findById(id).ifPresent(product -> {
            deleteVectorsByProductId(product.getProductId());
            productRepository.deleteById(id);
            log.debug("Deleted product id={} ({})", id, product.getProductId());
        });
    }

    private void deleteVectorsByProductId(String productId) {
        entityManager.createNativeQuery(
                "DELETE FROM product_vector_store WHERE metadata->>'product_id' = :productId"
        ).setParameter("productId", productId).executeUpdate();
    }

    public List<ProductInfo> listProducts() {
        return productRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toDto)
                .toList();
    }

    private Product parseRow(Row row, Map<String, Integer> colIndex) {
        String productId = requireCell(row, colIndex, "ProductID");
        String name = requireCell(row, colIndex, "Name");

        String priceStr = getCell(row, colIndex, "Price");
        BigDecimal price;
        try {
            assert priceStr != null;
            price = new BigDecimal(priceStr.replaceAll("[^\\d.]", ""));
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid price: " + priceStr);
        }

        String ratingStr = getCell(row, colIndex, "Rating");
        BigDecimal rating = null;
        if (ratingStr != null && !ratingStr.isBlank()) {
            try { rating = new BigDecimal(ratingStr.trim()); } catch (Exception ignored) {}
        }

        String stockStr = getCell(row, colIndex, "StockCount");
        Integer stockCount = null;
        if (stockStr != null && !stockStr.isBlank()) {
            try { stockCount = Integer.parseInt(stockStr.trim()); } catch (Exception ignored) {}
        }

        return Product.builder()
                .productId(productId.trim())
                .name(name.trim())
                .category(getCell(row, colIndex, "Category"))
                .brand(getCell(row, colIndex, "Brand"))
                .description(getCell(row, colIndex, "Description"))
                .price(price)
                .imageUrl(getCell(row, colIndex, "ImageUrl"))
                .rating(rating)
                .stockCount(stockCount)
                .build();
    }

    private Map<String, Integer> buildColumnIndex(Row header) {
        Map<String, Integer> map = new java.util.HashMap<>();
        for (Cell cell : header) {
            if (cell != null) {
                map.put(cell.getStringCellValue().trim(), cell.getColumnIndex());
            }
        }
        return map;
    }

    private String requireCell(Row row, Map<String, Integer> colIndex, String colName) {
        String val = getCell(row, colIndex, colName);
        if (val == null || val.isBlank()) {
            throw new IllegalArgumentException("Missing required column: " + colName);
        }
        return val;
    }

    private String getCell(Row row, Map<String, Integer> colIndex, String colName) {
        Integer idx = colIndex.get(colName);
        if (idx == null) return null;
        Cell cell = row.getCell(idx);
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double d = cell.getNumericCellValue();
                yield d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> "";
        };
    }

    private boolean isRowBlank(Row row) {
        for (Cell cell : row) {
            if (cell != null && cell.getCellType() != CellType.BLANK) return false;
        }
        return true;
    }

    private String nvl(String s) {
        return s != null ? s : "";
    }

    public ProductInfo toDto(Product p) {
        return new ProductInfo(p.getId(), p.getProductId(), p.getName(), p.getCategory(),
                p.getBrand(), p.getDescription(), p.getPrice(), p.getImageUrl(),
                p.getRating(), p.getStockCount());
    }
}
