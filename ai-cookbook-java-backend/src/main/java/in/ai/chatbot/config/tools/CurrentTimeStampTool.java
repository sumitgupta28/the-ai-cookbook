package in.ai.chatbot.config.tools;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Component
public class CurrentTimeStampTool {

    @Tool(description = "Return the current date and time with timezone. Use this whenever the user asks about the current time, date, or day of the week.")
    public String getCurrentDateTime() {
        String now = ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        log.debug("[tool:getCurrentDateTime] {}", now);
        return now;
    }
}
