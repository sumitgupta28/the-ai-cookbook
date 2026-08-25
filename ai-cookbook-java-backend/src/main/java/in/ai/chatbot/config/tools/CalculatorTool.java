package in.ai.chatbot.config.tools;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class CalculatorTool {

    @Tool(description = "Add two numbers and return their sum. Use this whenever the user asks you to add numbers.")
    public String add(
            @ToolParam(description = "The first number") double a,
            @ToolParam(description = "The second number") double b) {
        double result = a + b;
        log.debug("[tool:add] {} + {} = {}", a, b, result);
        return String.valueOf(result);
    }

    @Tool(description = "Subtract the second number from the first. Use this whenever the user asks you to subtract numbers.")
    public String subtract(
            @ToolParam(description = "The number to subtract from") double a,
            @ToolParam(description = "The number to subtract") double b) {
        double result = a - b;
        log.debug("[tool:subtract] {} - {} = {}", a, b, result);
        return String.valueOf(result);
    }

    @Tool(description = "Multiply two numbers. Use this whenever the user asks you to multiply numbers.")
    public String multiply(
            @ToolParam(description = "The first number") double a,
            @ToolParam(description = "The second number") double b) {
        double result = a * b;
        log.debug("[tool:multiply] {} * {} = {}", a, b, result);
        return String.valueOf(result);
    }

    @Tool(description = "Divide the first number by the second. Returns an error message if the divisor is zero.")
    public String divide(
            @ToolParam(description = "The dividend") double a,
            @ToolParam(description = "The divisor") double b) {
        if (b == 0) {
            log.debug("[tool:divide] division by zero attempted");
            return "Error: division by zero is undefined";
        }
        double result = a / b;
        log.debug("[tool:divide] {} / {} = {}", a, b, result);
        return String.valueOf(result);
    }
}
