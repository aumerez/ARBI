/**
 * Mock Redis Service for testing BullMQ workers
 * Simulates Redis connection and job queue operations without actual Redis
 */

export class MockRedisService {
  private queues: Map<string, Map<string, any>> = new Map();
  private connections: number = 0;

  async connect(): Promise<void> {
    this.connections++;
    console.log(`MockRedis: Connected (connections: ${this.connections})`);
  }

  async disconnect(): Promise<void> {
    this.connections = Math.max(0, this.connections - 1);
    console.log(`MockRedis: Disconnected (connections: ${this.connections})`);
  }

  async addToQueue(queueName: string, jobData: any): Promise<string> {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, new Map());
    }
    const queue = this.queues.get(queueName)!;
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    queue.set(jobId, {
      id: jobId,
      data: jobData,
      status: 'waiting',
      createdAt: new Date().toISOString(),
    });
    console.log(`MockRedis: Job ${jobId} added to queue ${queueName}`);
    return jobId;
  }

  async getJob(queueName: string, jobId: string): Promise<any | null> {
    const queue = this.queues.get(queueName);
    if (!queue) return null;
    return queue.get(jobId) || null;
  }

  async updateJobStatus(
    queueName: string,
    jobId: string,
    status: string,
    result?: any
  ): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) return;
    const job = queue.get(jobId);
    if (job) {
      job.status = status;
      if (result) job.result = result;
      job.updatedAt = new Date().toISOString();
    }
  }

  async getQueueLength(queueName: string): Promise<number> {
    const queue = this.queues.get(queueName);
    return queue ? queue.size : 0;
  }

  async clearQueue(queueName: string): Promise<void> {
    this.queues.delete(queueName);
    console.log(`MockRedis: Cleared queue ${queueName}`);
  }

  getConnection(): any {
    return {
      connect: this.connect.bind(this),
      disconnect: this.disconnect.bind(this),
    };
  }
}
