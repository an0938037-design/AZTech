/* Bo mạch Arduino Uno ảo: chân số/tương tự, PWM, Serial, còi, servo,
   cảm biến và LCD. Đây là "phần cứng" mà trình thông dịch điều khiển. */

import type { Clock } from "./clock";

export type PinMode = "input" | "output" | "input_pullup";

export const PIN_COUNT = 20;
export const SERIAL_LIMIT = 300;
export const LCD_COLS = 16;
export const LCD_ROWS = 2;

export interface LedComponent {
  pin: number;
  color: string;
  label: string;
}

/* Sơ đồ đấu dây cố định của shield ảo — ví dụ mẫu dùng đúng các chân này. */
export const LED_COMPONENTS: LedComponent[] = [
  { pin: 13, color: "#ff5d5d", label: "Đỏ" },
  { pin: 12, color: "#ffc94d", label: "Vàng" },
  { pin: 11, color: "#5ee2a0", label: "Lá" },
  { pin: 9, color: "#67d3ff", label: "PWM" },
];

export const BUTTON_PIN = 2;
export const POT_PIN = 14; // A0
export const LDR_PIN = 15; // A1
export const TEMP_PIN = 16; // A2
export const ULTRASONIC_TRIG_PIN = 4;
export const ULTRASONIC_ECHO_PIN = 17; // A3
export const PIR_PIN = 7;
export const BUZZER_PIN = 8;
export const SERVO_PIN = 10;
export const RGB_PINS = { r: 3, g: 5, b: 6 } as const;

export interface BoardSnapshot {
  pins: Array<{ mode: PinMode; value: number; level: number }>;
  button: boolean;
  pot: number;
  sensors: { light: number; temperature: number; distance: number; motion: boolean };
  rgb: { r: number; g: number; b: number };
  lcd: { lines: string[]; row: number; col: number; backlight: boolean; enabled: boolean };
  buzzer: { active: boolean; freq: number; pin: number | null };
  servo: { angle: number; attached: boolean; pin: number | null };
  serial: string[];
  baud: number;
  tx: boolean;
  time: number;
}

export function pinLabel(pin: number): string {
  if (pin >= 14 && pin <= 19) return `A${pin - 14}`;
  return `D${pin}`;
}

export function analogChannel(pin: number): number {
  if (pin >= 14 && pin <= 19) return pin - 14;
  if (pin >= 0 && pin <= 5) return pin;
  return -1;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function emptyLcdLine(): string {
  return " ".repeat(LCD_COLS);
}

export class Board {
  private readonly clock: Clock;
  private modes: PinMode[] = new Array(PIN_COUNT).fill("input");
  private digital: number[] = new Array(PIN_COUNT).fill(0);
  private pwm: number[] = new Array(PIN_COUNT).fill(-1);
  private potValue = 512;
  private lightValue = 512;
  private temperatureC = 25;
  private distanceCm = 30;
  private motion = false;
  private buttonPressed = false;
  private tonePin: number | null = null;
  private toneFreq = 0;
  private toneUntil: number | null = null;
  private servoPin: number | null = null;
  private servoAngle = 90;
  private lcdRows: string[] = [emptyLcdLine(), emptyLcdLine()];
  private lcdRow = 0;
  private lcdCol = 0;
  private lcdBacklightOn = true;
  private lcdEnabled = true;
  private serialLines: string[] = [];
  private serialCurrent = "";
  private serialQueue: number[] = [];
  private baud = 9600;
  private lastTx = -10000;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  /* ----------------------------- Chân ------------------------------ */

  pinMode(pin: number, mode: number): void {
    this.modes[pin] = mode === 2 ? "input_pullup" : mode === 1 ? "output" : "input";
    if (mode !== 1) {
      this.pwm[pin] = -1;
      this.digital[pin] = 0;
    }
  }

  digitalWrite(pin: number, value: number): void {
    this.pwm[pin] = -1;
    this.digital[pin] = value ? 1 : 0;
  }

  digitalRead(pin: number): number {
    const mode = this.modes[pin];

    if (pin === BUTTON_PIN && mode !== "output") {
      if (mode === "input_pullup") return this.buttonPressed ? 0 : 1;
      return this.buttonPressed ? 1 : 0;
    }

    if (pin === PIR_PIN && mode !== "output") {
      return this.motion ? 1 : 0;
    }

    if (mode === "output") return this.digital[pin] ? 1 : 0;
    if (mode === "input_pullup") return 1;
    return 0;
  }

  analogRead(pin: number): number {
    const channel = analogChannel(pin);
    if (channel < 0) return 0;
    if (channel === 0) return Math.round(this.potValue);
    if (channel === 1) return Math.round(this.lightValue);
    if (channel === 2) {
      // TMP36: 0.5V ở 0°C, 10mV mỗi °C → quy đổi ra số đọc ADC 10 bit.
      const volts = clamp(this.temperatureC * 0.01 + 0.5, 0, 5);
      return Math.round((volts / 5) * 1023);
    }
    return 0;
  }

  analogWrite(pin: number, value: number): void {
    const level = Math.max(0, Math.min(255, Math.round(value)));
    this.modes[pin] = "output";
    this.pwm[pin] = level;
    this.digital[pin] = level > 0 ? 1 : 0;
  }

  /* Đo độ rộng xung: mô phỏng HC-SR04 trả về thời gian sóng đi-về. */
  pulseIn(pin: number, _state: number, timeout = 1_000_000): number {
    if (pin !== ULTRASONIC_ECHO_PIN) return 0;
    const microseconds = Math.round(this.distanceCm * 58);
    if (microseconds <= 0) return 0;
    return microseconds > timeout ? 0 : microseconds;
  }

  /* --------------------------- Thiết bị ---------------------------- */

  tone(pin: number, freq: number, duration?: number): void {
    this.tonePin = pin;
    this.toneFreq = Math.max(1, Math.round(freq));
    this.toneUntil = duration && duration > 0 ? this.clock.now() + duration : null;
  }

  noTone(pin: number): void {
    if (this.tonePin === null || pin === this.tonePin) {
      this.tonePin = null;
      this.toneUntil = null;
    }
  }

  attachServo(pin: number): void {
    this.servoPin = pin;
  }

  setServoAngle(angle: number): void {
    this.servoAngle = Math.max(0, Math.min(180, Math.round(angle)));
  }

  /* ----------------------------- LCD ------------------------------- */

  lcdClear(): void {
    this.lcdRows = [emptyLcdLine(), emptyLcdLine()];
    this.lcdRow = 0;
    this.lcdCol = 0;
  }

  lcdHome(): void {
    this.lcdRow = 0;
    this.lcdCol = 0;
  }

  lcdSetCursor(col: number, row: number): void {
    this.lcdCol = clamp(Math.trunc(col), 0, LCD_COLS - 1);
    this.lcdRow = clamp(Math.trunc(row), 0, LCD_ROWS - 1);
  }

  lcdPrint(text: string): void {
    for (const char of text) {
      if (char === "\n") {
        this.lcdRow = Math.min(LCD_ROWS - 1, this.lcdRow + 1);
        this.lcdCol = 0;
        continue;
      }
      if (char === "\r") continue;
      this.putLcdChar(char);
    }
  }

  private putLcdChar(char: string): void {
    const row = this.lcdRows[this.lcdRow];
    this.lcdRows[this.lcdRow] = row.slice(0, this.lcdCol) + char + row.slice(this.lcdCol + 1);
    this.lcdCol += 1;
    if (this.lcdCol >= LCD_COLS) {
      if (this.lcdRow < LCD_ROWS - 1) {
        this.lcdRow += 1;
        this.lcdCol = 0;
      } else {
        this.lcdCol = LCD_COLS - 1;
      }
    }
  }

  lcdBacklight(on: boolean): void {
    this.lcdBacklightOn = on;
  }

  lcdDisplay(on: boolean): void {
    this.lcdEnabled = on;
  }

  /* ---------------------------- Serial ----------------------------- */

  serialBegin(baud: number): void {
    this.baud = Math.round(baud) || 9600;
  }

  serialPrint(text: string): void {
    this.lastTx = this.clock.now();
    const parts = text.split("\n");
    this.serialCurrent += parts[0];
    for (let i = 1; i < parts.length; i += 1) {
      this.raiseLine(this.serialCurrent);
      this.serialCurrent = parts[i];
    }
  }

  serialPrintln(text: string): void {
    this.serialPrint(`${text}\n`);
  }

  private raiseLine(line: string): void {
    this.serialLines.push(line.replace(/\r$/, ""));
    if (this.serialLines.length > SERIAL_LIMIT) {
      this.serialLines.splice(0, this.serialLines.length - SERIAL_LIMIT);
    }
  }

  serialWrite(value: string): void {
    this.serialPrint(value);
  }

  serialAvailable(): number {
    return this.serialQueue.length;
  }

  serialRead(): number {
    if (this.serialQueue.length === 0) return -1;
    return this.serialQueue.shift() ?? -1;
  }

  serialEnd(): void {
    this.serialQueue = [];
  }

  clearSerial(): void {
    this.serialLines = [];
    this.serialCurrent = "";
    this.serialQueue = [];
  }

  pushSerialInput(text: string): void {
    for (const char of text) this.serialQueue.push(char.charCodeAt(0));
    if (!text.endsWith("\n")) this.serialQueue.push(10);
  }

  /* -------------------------- Tương tác ---------------------------- */

  setButton(pressed: boolean): void {
    this.buttonPressed = pressed;
  }

  setPot(value: number): void {
    this.potValue = clamp(Math.round(value), 0, 1023);
  }

  setLight(value: number): void {
    this.lightValue = clamp(Math.round(value), 0, 1023);
  }

  setTemperature(value: number): void {
    this.temperatureC = clamp(value, -40, 125);
  }

  setDistance(value: number): void {
    this.distanceCm = clamp(value, 2, 400);
  }

  setMotion(active: boolean): void {
    this.motion = active;
  }

  getPot(): number {
    return this.potValue;
  }

  isButtonPressed(): boolean {
    return this.buttonPressed;
  }

  /* Dừng khẩn cấp: ngắt mọi đầu ra nhưng giữ lại nội dung Serial Monitor. */
  powerOff(): void {
    this.modes = new Array(PIN_COUNT).fill("input");
    this.digital = new Array(PIN_COUNT).fill(0);
    this.pwm = new Array(PIN_COUNT).fill(-1);
    this.tonePin = null;
    this.toneUntil = null;
    this.servoPin = null;
    this.servoAngle = 90;
    this.lcdRows = [emptyLcdLine(), emptyLcdLine()];
    this.lcdRow = 0;
    this.lcdCol = 0;
    this.lcdBacklightOn = true;
    this.lcdEnabled = true;
  }

  /* --------------------------- Ảnh chụp ---------------------------- */

  private level(pin: number): number {
    if (this.modes[pin] !== "output") return 0;
    if (this.pwm[pin] >= 0) return this.pwm[pin] / 255;
    return this.digital[pin] ? 1 : 0;
  }

  private pinValue(pin: number): number {
    if (this.modes[pin] === "output") {
      return this.pwm[pin] >= 0 ? this.pwm[pin] : this.digital[pin];
    }
    return this.digitalRead(pin);
  }

  private rgbLevel(pin: number): number {
    if (this.modes[pin] !== "output") return 0;
    if (this.pwm[pin] >= 0) return this.pwm[pin];
    return this.digital[pin] ? 255 : 0;
  }

  snapshot(): BoardSnapshot {
    const now = this.clock.now();
    const buzzerActive = this.tonePin !== null && (this.toneUntil === null || now < this.toneUntil);
    if (!buzzerActive && this.toneUntil !== null) {
      this.tonePin = null;
      this.toneUntil = null;
    }

    return {
      pins: Array.from({ length: PIN_COUNT }, (_, pin) => ({
        mode: this.modes[pin],
        value: this.pinValue(pin),
        level: this.level(pin),
      })),
      button: this.buttonPressed,
      pot: Math.round(this.potValue),
      sensors: {
        light: Math.round(this.lightValue),
        temperature: Math.round(this.temperatureC * 10) / 10,
        distance: Math.round(this.distanceCm),
        motion: this.motion,
      },
      rgb: {
        r: this.rgbLevel(RGB_PINS.r),
        g: this.rgbLevel(RGB_PINS.g),
        b: this.rgbLevel(RGB_PINS.b),
      },
      lcd: {
        lines: [...this.lcdRows],
        row: this.lcdRow,
        col: this.lcdCol,
        backlight: this.lcdBacklightOn,
        enabled: this.lcdEnabled,
      },
      buzzer: { active: buzzerActive, freq: this.toneFreq, pin: this.tonePin },
      servo: {
        angle: this.servoAngle,
        attached: this.servoPin !== null,
        pin: this.servoPin,
      },
      serial: this.serialCurrent
        ? [...this.serialLines, this.serialCurrent]
        : [...this.serialLines],
      baud: this.baud,
      tx: now - this.lastTx < 90,
      time: Math.floor(now),
    };
  }
}
