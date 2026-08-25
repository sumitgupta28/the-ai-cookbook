package in.ai.chatbot.config.controller;

import in.ai.chatbot.config.tools.CalculatorTool;
import in.ai.chatbot.config.tools.CurrentTimeStampTool;
import in.ai.chatbot.config.tools.WeatherTool;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
public class ToolChatController {

    private final ChatClient chatClient;
    private final CalculatorTool calculatorTool;
    private final CurrentTimeStampTool currentTimeStampTool;
    private final WeatherTool weatherTool;

    @GetMapping(value = "/tool/ai/chat/string", produces = MediaType.TEXT_PLAIN_VALUE)
    public String chat(
            @RequestParam(value = "message", defaultValue = "What is 42 multiplied by 17?") String message) {
        log.debug("[/tool/ai/chat/string] message='{}'", message);
        // Tools.
        Object[] objects = {calculatorTool, currentTimeStampTool, weatherTool};

        String response = chatClient.prompt()
                .user(message)
                .tools(objects)
                .call()
                .content();

        log.debug("[/tool/ai/chat/string] response='{}'", response);
        return response;
    }
}
