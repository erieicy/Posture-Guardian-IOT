#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <Wire.h>

#define USE_OLED 1

#if USE_OLED
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#endif

const char* WIFI_SSID = "GANTI_NAMA_WIFI";
const char* WIFI_PASS = "GANTI_PASSWORD_WIFI";

const int PIN_SDA = 4;        // D2 - OLED SDA
const int PIN_SCL = 5;        // D1 - OLED SCL
const int PIN_TRIG = 14;      // D5 - HC-SR04 TRIG
const int PIN_ECHO = 12;      // D6 - HC-SR04 ECHO (voltage divider 5V -> 3.3V)
const int PIN_LAMP = 13;      // D7 - relay lampu meja
const int PIN_LED_ALERT = 15; // D8 - LED istirahat (menyala saat duduk terlalu lama)
const int PIN_DESK_UP = 0;    // D3 - driver motor IN1
const int PIN_DESK_DOWN = 2;  // D4 - driver motor IN2

const float IDEAL_MIN_CM = 40.0;
const float IDEAL_MAX_CM = 70.0;
const float MAX_VALID_CM = 400.0;
const unsigned long MOVE_STEP_MS = 350;
const unsigned long AUTO_INTERVAL_MS = 700;
const unsigned long ECHO_TIMEOUT_US = 30000UL;
const unsigned long SAMPLE_MS = 300;
const unsigned long OLED_UPDATE_MS = 500;
const unsigned long PRESENCE_RESET_MS = 15000;
const unsigned long SIT_LIMIT_S = 45UL * 60UL;

#if USE_OLED
Adafruit_SSD1306 display(128, 64, &Wire, -1);
#endif

ESP8266WebServer server(80);

String mode = "manual";
String deskState = "idle";
bool lampOn = false;
bool moving = false;
bool oledOk = false;

unsigned long moveEndTime = 0;
unsigned long lastAutoCheck = 0;
unsigned long lastSampleMs = 0;
unsigned long lastOledMs = 0;

float currentCm = 0;
bool present = false;
unsigned long presentStartMs = 0;
unsigned long lastSeenMs = 0;
unsigned long badStartMs = 0;

float readDistanceCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(3);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  unsigned long dur = pulseIn(PIN_ECHO, HIGH, ECHO_TIMEOUT_US);
  if (dur == 0) return 0;
  return (dur * 0.0343) / 2.0;
}

String postureKey(float cm) {
  if (cm <= 0 || cm > MAX_VALID_CM) return "none";
  if (cm < IDEAL_MIN_CM) return "too_close";
  if (cm <= IDEAL_MAX_CM) return "ideal";
  return "too_far";
}

String postureLabel(float cm) {
  if (cm <= 0 || cm > MAX_VALID_CM) return "Tidak Terdeteksi";
  if (cm < IDEAL_MIN_CM) return "Terlalu Dekat";
  if (cm <= IDEAL_MAX_CM) return "Posisi Ideal";
  return "Terlalu Jauh";
}

unsigned long presenceSeconds() {
  if (!present) return 0;
  return (millis() - presentStartMs) / 1000UL;
}

unsigned long badPostureSeconds() {
  if (badStartMs == 0) return 0;
  return (millis() - badStartMs) / 1000UL;
}

bool sitAlertActive() {
  return present && presenceSeconds() >= SIT_LIMIT_S;
}

void sampleSensor() {
  currentCm = readDistanceCm();
  unsigned long now = millis();

  if (currentCm > 0 && currentCm <= MAX_VALID_CM) {
    if (!present) {
      present = true;
      presentStartMs = now;
    }
    lastSeenMs = now;

    String k = postureKey(currentCm);
    if (k == "too_close" || k == "too_far") {
      if (badStartMs == 0) badStartMs = now;
    } else if (k == "ideal") {
      badStartMs = 0;
    }
  } else if (present && now - lastSeenMs > PRESENCE_RESET_MS) {
    present = false;
    badStartMs = 0;
    presentStartMs = 0;
  }

  digitalWrite(PIN_LED_ALERT, sitAlertActive() ? HIGH : LOW);
}

void motorsOff() {
  digitalWrite(PIN_DESK_UP, LOW);
  digitalWrite(PIN_DESK_DOWN, LOW);
  moving = false;
  deskState = "idle";
}

void deskMove(const String& dir) {
  if (dir == "stop") {
    motorsOff();
    return;
  }
  digitalWrite(PIN_DESK_UP, dir == "up" ? HIGH : LOW);
  digitalWrite(PIN_DESK_DOWN, dir == "down" ? HIGH : LOW);
  moving = true;
  moveEndTime = millis() + MOVE_STEP_MS;
  deskState = (dir == "up") ? "naik" : "turun";
}

void formatHMS(unsigned long s, char* out, size_t n) {
  snprintf(out, n, "%02lu:%02lu:%02lu", s / 3600UL, (s % 3600UL) / 60UL, s % 60UL);
}

void updateOled() {
#if USE_OLED
  if (!oledOk) return;

  char aktif[12];
  char duduk[12];
  formatHMS(millis() / 1000UL, aktif, sizeof(aktif));
  formatHMS(presenceSeconds(), duduk, sizeof(duduk));

  char jarak[24];
  snprintf(jarak, sizeof(jarak), "Jarak: %3.0f cm", (double)currentCm);

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(F("SMART DESK POSTURE"));
  display.setCursor(0, 16);
  display.print(F("Aktif "));
  display.println(aktif);
  display.setCursor(0, 28);
  display.print(jarak);
  display.setCursor(96, 28);
  display.println(postureKey(currentCm) == "ideal" ? F("OK") : F("!"));
  display.setCursor(0, 40);
  display.print(F("Duduk "));
  display.println(duduk);
  display.setCursor(0, 54);
  if (sitAlertActive()) display.println(F(">> PERLU ISTIRAHAT <<"));
  else display.println(F("Status: aman"));
  display.display();
#endif
}

void addCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleRoot() {
  addCors();
  server.send(200, "application/json",
              "{\"name\":\"smart-desk-posture-guardian\",\"endpoints\":[\"/api/data\",\"/api/control\"]}");
}

void handleData() {
  bool alert = sitAlertActive();
  char buf[320];
  snprintf(buf, sizeof(buf),
           "{\"distance_cm\":%.1f,\"posture\":\"%s\",\"status_label\":\"%s\","
           "\"mode\":\"%s\",\"lamp\":%s,\"desk_state\":\"%s\",\"uptime_s\":%lu,"
           "\"presence_s\":%lu,\"bad_posture_s\":%lu,\"sit_alert\":%s,\"rssi\":%d}",
           currentCm,
           postureKey(currentCm).c_str(),
           postureLabel(currentCm).c_str(),
           mode.c_str(),
           lampOn ? "true" : "false",
           deskState.c_str(),
           millis() / 1000UL,
           presenceSeconds(),
           badPostureSeconds(),
           alert ? "true" : "false",
           WiFi.RSSI());
  addCors();
  server.send(200, "application/json", buf);
}

void handleControl() {
  String action = server.arg("action");
  String value = server.arg("value");

  if (action == "set_mode" && (value == "auto" || value == "manual")) {
    mode = value;
    motorsOff();
  } else if (action == "desk" && (value == "up" || value == "down" || value == "stop")) {
    if (mode == "manual" || value == "stop") deskMove(value);
  } else if (action == "lamp") {
    if (value == "toggle") lampOn = !lampOn;
    else lampOn = (value == "on");
    digitalWrite(PIN_LAMP, lampOn ? HIGH : LOW);
  } else if (action == "sit_reset") {
    presentStartMs = millis();
    lastSeenMs = millis();
  }

  addCors();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleOptions() {
  addCors();
  server.send(204);
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_LAMP, OUTPUT);
  pinMode(PIN_LED_ALERT, OUTPUT);
  pinMode(PIN_DESK_UP, OUTPUT);
  pinMode(PIN_DESK_DOWN, OUTPUT);

  motorsOff();
  digitalWrite(PIN_LAMP, LOW);
  digitalWrite(PIN_LED_ALERT, LOW);

#if USE_OLED
  Wire.begin(PIN_SDA, PIN_SCL);
  oledOk = display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (oledOk) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println(F("Smart Desk PG"));
    display.setCursor(0, 16);
    display.println(F("Menghubungkan WiFi..."));
    display.display();
  }
#endif

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Menghubungkan WiFi");

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Terhubung. Masukkan IP ini di dashboard: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Gagal terhubung ke WiFi.");
  }

  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/data", HTTP_GET, handleData);
  server.on("/api/control", HTTP_POST, handleControl);
  server.on("/api/control", HTTP_GET, handleControl);
  server.onNotFound(handleOptions);
  server.begin();
}

void loop() {
  server.handleClient();
  unsigned long now = millis();

  if (now - lastSampleMs >= SAMPLE_MS) {
    lastSampleMs = now;
    sampleSensor();
  }

  if (moving && now > moveEndTime) {
    motorsOff();
  }

  if (mode == "auto" && !moving && now - lastAutoCheck > AUTO_INTERVAL_MS) {
    lastAutoCheck = now;
    if (currentCm > 0 && currentCm <= MAX_VALID_CM) {
      if (currentCm < IDEAL_MIN_CM) deskMove("up");
      else if (currentCm > IDEAL_MAX_CM) deskMove("down");
    }
  }

  if (now - lastOledMs >= OLED_UPDATE_MS) {
    lastOledMs = now;
    updateOled();
  }
}
