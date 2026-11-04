/* Đồng hồ ảo dùng chung cho trình thông dịch và bo mạch.
   Thời gian trôi theo thời gian thực để các sketch dùng millis() hoạt động
   đúng như trên phần cứng thật. */
export interface Clock {
  now(): number;
}

export class RealTimeClock implements Clock {
  private readonly startedAt = performance.now();
  private pausedAt: number | null = null;
  private pausedTotal = 0;

  now(): number {
    if (this.pausedAt !== null) return this.pausedAt - this.startedAt - this.pausedTotal;
    return performance.now() - this.startedAt - this.pausedTotal;
  }

  pause(): void {
    if (this.pausedAt === null) this.pausedAt = performance.now();
  }

  resume(): void {
    if (this.pausedAt === null) return;
    this.pausedTotal += performance.now() - this.pausedAt;
    this.pausedAt = null;
  }
}
