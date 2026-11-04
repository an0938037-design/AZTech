/* Ví dụ sketch cho không gian Arduino. Toàn bộ chạy hoàn toàn trong trình duyệt. */

export interface ArduinoExample {
  id: string;
  title: string;
  summary: string;
  level: "Cơ bản" | "Trung bình" | "Nâng cao";
  pins: string;
  code: string;
}

export const EXAMPLES: ArduinoExample[] = [
  {
    id: "blink",
    title: "Nháy LED",
    summary: "Bài mở đầu kinh điển: bật/tắt LED đỏ ở chân D13 mỗi nửa giây.",
    level: "Cơ bản",
    pins: "D13",
    code: String.raw`// Nháy LED đỏ ở chân D13 mỗi 500ms
const int LED = 13;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
  Serial.println("Arduino ảo đã khởi động!");
}

void loop() {
  digitalWrite(LED, HIGH);
  delay(500);

  digitalWrite(LED, LOW);
  delay(500);
}
`,
  },
  {
    id: "button",
    title: "Đèn theo nút nhấn",
    summary: "Đọc nút nhấn ở D2 (trở kéo nội) và bật LED khi đang nhấn.",
    level: "Cơ bản",
    pins: "D2 → D13",
    code: String.raw`const int LED = 13;
const int BUTTON = 2;

void setup() {
  pinMode(LED, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  Serial.begin(9600);
  Serial.println("Nhấn nút ở D2 để bật LED");
}

void loop() {
  // INPUT_PULLUP: chưa nhấn = HIGH, nhấn = LOW
  int pressed = digitalRead(BUTTON) == LOW;

  digitalWrite(LED, pressed ? HIGH : LOW);

  if (pressed) {
    Serial.println("Đang nhấn nút…");
    delay(200);
  }
}
`,
  },
  {
    id: "pot",
    title: "Biến trở điều sáng",
    summary: "Đọc biến trở A0 rồi dùng PWM ở D9 để đổi độ sáng LED.",
    level: "Cơ bản",
    pins: "A0 → D9",
    code: String.raw`const int POT = A0;
const int LED = 9;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int value = analogRead(POT);                       // 0..1023
  int brightness = map(value, 0, 1023, 0, 255);      // 0..255
  analogWrite(LED, brightness);

  Serial.print("Biến trở: ");
  Serial.print(value);
  Serial.print("  →  độ sáng: ");
  Serial.println(brightness);

  delay(200);
}
`,
  },
  {
    id: "light",
    title: "Đèn tự động theo ánh sáng",
    summary: "Quang trở A1 đo ánh sáng; trời càng tối LED PWM D9 càng sáng.",
    level: "Cơ bản",
    pins: "A1 → D9",
    code: String.raw`const int LDR = A1;
const int LED = 9;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(LDR);                      // 0..1023
  int brightness = map(light, 0, 1023, 255, 0);     // tối → sáng
  analogWrite(LED, brightness);

  Serial.print("Ánh sáng: ");
  Serial.print(light);
  Serial.print("  →  PWM: ");
  Serial.println(brightness);
  delay(200);
}
`,
  },
  {
    id: "temperature",
    title: "Đo nhiệt độ TMP36",
    summary: "Đọc cảm biến nhiệt độ A2, quy đổi điện áp sang °C và in Serial.",
    level: "Cơ bản",
    pins: "A2",
    code: String.raw`const int TMP36 = A2;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(TMP36);

  // TMP36: 0.5V ở 0°C, 10mV cho mỗi °C
  float voltage = raw * 5.0 / 1023.0;
  float celsius = (voltage - 0.5) * 100.0;

  Serial.print("Nhiệt độ: ");
  Serial.print(celsius);
  Serial.println(" °C");

  delay(500);
}
`,
  },
  {
    id: "rgb",
    title: "RGB LED đổi màu",
    summary: "Pha ba kênh PWM D3 – D5 – D6 để tạo các màu cơ bản.",
    level: "Trung bình",
    pins: "D3, D5, D6",
    code: String.raw`const int RED = 3;
const int GREEN = 5;
const int BLUE = 6;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(GREEN, OUTPUT);
  pinMode(BLUE, OUTPUT);
  Serial.begin(9600);
}

void setColor(int r, int g, int b) {
  analogWrite(RED, r);
  analogWrite(GREEN, g);
  analogWrite(BLUE, b);
}

void loop() {
  setColor(255, 0, 0);
  Serial.println("Đỏ");
  delay(700);

  setColor(0, 255, 0);
  Serial.println("Lá");
  delay(700);

  setColor(0, 0, 255);
  Serial.println("Lam");
  delay(700);

  setColor(255, 255, 0);
  Serial.println("Vàng");
  delay(700);

  setColor(0, 255, 255);
  Serial.println("Ngọc");
  delay(700);

  setColor(255, 0, 255);
  Serial.println("Tím");
  delay(700);
}
`,
  },
  {
    id: "ultrasonic",
    title: "Đo khoảng cách siêu âm",
    summary: "HC-SR04 ở TRIG D4 / ECHO A3; pulseIn() trả thời gian sóng dội về.",
    level: "Trung bình",
    pins: "D4 → A3",
    code: String.raw`const int TRIG = 4;
const int ECHO = A3;

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  // Thời gian sóng đi-về (µs); chia 58 ra centimet
  long duration = pulseIn(ECHO, HIGH, 30000);
  long distance = duration / 58;

  Serial.print("Khoảng cách: ");
  Serial.print(distance);
  Serial.println(" cm");

  delay(400);
}
`,
  },
  {
    id: "pir",
    title: "Cảm biến chuyển động PIR",
    summary: "PIR ở D7 phát hiện người đi qua và bật LED D13.",
    level: "Cơ bản",
    pins: "D7 → D13",
    code: String.raw`const int PIR = 7;
const int LED = 13;

void setup() {
  pinMode(PIR, INPUT);
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
  Serial.println("Cảm biến chuyển động sẵn sàng");
}

void loop() {
  int motion = digitalRead(PIR);
  digitalWrite(LED, motion ? HIGH : LOW);

  if (motion) {
    Serial.println("Phát hiện chuyển động!");
    delay(300);
  }
}
`,
  },
  {
    id: "lcd",
    title: "LCD 16×2 I2C",
    summary: "Hiển thị hai dòng chữ trên LCD I2C bằng thư viện LiquidCrystal_I2C.",
    level: "Trung bình",
    pins: "I2C · A4/A5",
    code: String.raw`#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();

  lcd.setCursor(0, 0);
  lcd.print("AZTeach Arduino");
  lcd.setCursor(0, 1);
  lcd.print("Xin chao!");

  Serial.begin(9600);
  Serial.println("LCD 16x2 đã sẵn sàng");
}

void loop() {
  delay(1000);
}
`,
  },
  {
    id: "traffic",
    title: "Đèn giao thông",
    summary: "Ba LED đỏ – vàng – lá chạy theo chu trình có thời gian chờ.",
    level: "Trung bình",
    pins: "D13, D12, D11",
    code: String.raw`const int RED = 13;
const int YELLOW = 12;
const int GREEN = 11;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Đèn giao thông bắt đầu");
}

void loop() {
  digitalWrite(RED, HIGH);
  Serial.println("ĐỎ");
  delay(1200);
  digitalWrite(RED, LOW);

  digitalWrite(GREEN, HIGH);
  Serial.println("XANH");
  delay(1200);
  digitalWrite(GREEN, LOW);

  digitalWrite(YELLOW, HIGH);
  Serial.println("VÀNG");
  delay(500);
  digitalWrite(YELLOW, LOW);
}
`,
  },
  {
    id: "siren",
    title: "Còi báo động",
    summary: "Dùng tone() quét tần số để tạo tiếng hú, rồi nghỉ một nhịp.",
    level: "Trung bình",
    pins: "D8",
    code: String.raw`const int BUZZER = 8;

void setup() {
  pinMode(BUZZER, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  for (int freq = 400; freq <= 1200; freq += 100) {
    tone(BUZZER, freq);
    delay(80);
  }

  noTone(BUZZER);
  Serial.println("Hú còi!");
  delay(400);
}
`,
  },
  {
    id: "servo",
    title: "Servo quét góc",
    summary: "Thư viện Servo có sẵn: quay servo ở D10 từ 0° đến 180°.",
    level: "Trung bình",
    pins: "D10",
    code: String.raw`#include <Servo.h>   // thư viện Servo được hỗ trợ sẵn

Servo servo;

void setup() {
  servo.attach(10);
  Serial.begin(9600);
  Serial.println("Quét servo 0° → 180°");
}

void loop() {
  for (int angle = 0; angle <= 180; angle += 15) {
    servo.write(angle);
    delay(120);
  }

  for (int angle = 180; angle >= 0; angle -= 15) {
    servo.write(angle);
    delay(120);
  }
}
`,
  },
  {
    id: "millis",
    title: "Đếm giây không delay",
    summary: "Dùng millis() thay delay() để không chặn việc khác — kỹ thuật quan trọng.",
    level: "Nâng cao",
    pins: "D13",
    code: String.raw`const int LED = 13;

unsigned long lastChange = 0;
bool ledOn = false;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  // Không có delay(): vòng lặp vẫn chạy liên tục
  if (millis() - lastChange >= 500) {
    lastChange = millis();
    ledOn = !ledOn;
    digitalWrite(LED, ledOn ? HIGH : LOW);

    Serial.print("Đã chạy ");
    Serial.print(millis() / 1000);
    Serial.println(" giây");
  }
}
`,
  },
  {
    id: "serial",
    title: "Điều khiển qua Serial",
    summary: "Gửi 1 hoặc 0 từ Serial Monitor để bật/tắt LED ngay khi sketch đang chạy.",
    level: "Nâng cao",
    pins: "D13",
    code: String.raw`void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Gõ 1 để bật LED, 0 để tắt.");
}

void loop() {
  if (Serial.available() > 0) {
    char c = Serial.read();

    if (c == '1') {
      digitalWrite(13, HIGH);
      Serial.println("→ LED bật");
    }

    if (c == '0') {
      digitalWrite(13, LOW);
      Serial.println("→ LED tắt");
    }
  }
}
`,
  },
];

export function getExample(id: string): ArduinoExample {
  return EXAMPLES.find((example) => example.id === id) ?? EXAMPLES[0];
}

export const DEFAULT_CODE = EXAMPLES[0].code;
