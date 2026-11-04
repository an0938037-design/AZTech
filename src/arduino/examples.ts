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
