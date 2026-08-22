#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

const char* WIFI_SSID = "GANTI_NAMA_WIFI";
const char* WIFI_PASS = "GANTI_PASSWORD_WIFI";

const int PIN_TRIG = 5;       // D1
const int PIN_ECHO = 4;       // D2 (pakai voltage divider 5V -> 3.3V)
const int PIN_LAMP = 13;      // D7 (relay/LED lampu meja)
const int PIN_DESK_UP = 14;   // D5 (driver motor IN1)
const int PIN_DESK_DOWN = 12; // D6 (driver motor IN2)

const float IDEAL_MIN_CM = 40.0;
const float IDEAL_MAX_CM = 70.0;
const float MAX_VALID_CM = 400.0;
const unsigned long MOVE_STEP_MS = 350;
const unsigned long AUTO_INTERVAL_MS = 700;
const unsigned long ECHO_TIMEOUT_US = 30000UL;

ESP8266WebServer server(80);

String mode = "manual";
String deskState = "idle";
bool lampOn = false;
bool moving = false;
unsigned long moveEndTime = 0;
unsigned long lastAutoCheck = 0;
float lastDistance = 0;

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
  lastDistance = readDistanceCm();
  char buf[256];
  snprintf(buf, sizeof(buf),
           "{\"distance_cm\":%.1f,\"posture\":\"%s\",\"status_label\":\"%s\","
           "\"mode\":\"%s\",\"lamp\":%s,\"desk_state\":\"%s\",\"uptime_s\":%lu,\"rssi\":%d}",
           lastDistance,
           postureKey(lastDistance).c_str(),
           postureLabel(lastDistance).c_str(),
           mode.c_str(),
           lampOn ? "true" : "false",
           deskState.c_str(),
           millis() / 1000UL,
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
  pinMode(PIN_DESK_UP, OUTPUT);
  pinMode(PIN_DESK_DOWN, OUTPUT);

  motorsOff();
  digitalWrite(PIN_LAMP, LOW);

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

  if (moving && millis() > moveEndTime) {
    motorsOff();
  }

  if (mode == "auto" && !moving && millis() - lastAutoCheck > AUTO_INTERVAL_MS) {
    lastAutoCheck = millis();
    float cm = readDistanceCm();
    if (cm > 0 && cm <= MAX_VALID_CM) {
      if (cm < IDEAL_MIN_CM) deskMove("up");
      else if (cm > IDEAL_MAX_CM) deskMove("down");
    }
  }
}
