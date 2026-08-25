# Stage 1: Build
FROM gradle:8-jdk17 AS build

WORKDIR /app

COPY build.gradle settings.gradle ./
RUN gradle --no-daemon dependencies --configuration runtimeClasspath

COPY src src
RUN gradle --no-daemon bootJar -x test

# Stage 2: Run
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
