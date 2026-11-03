import { Kafka, Consumer } from 'kafkajs';
import { OrderEvent } from '../types';

const kafka = new Kafka({
  clientId: 'order-fulfillment-worker',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: { initialRetryTime: 500, retries: 15 },
});

const consumer: Consumer = kafka.consumer({ groupId: 'fulfillment-processors' });

async function ensureTopicExists(topic: string): Promise<void> {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const existingTopics = await admin.listTopics();
    if (!existingTopics.includes(topic)) {
      console.log(`[Worker] Creating missing Kafka topic: "${topic}"...`);
      await admin.createTopics({
        topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
      });
      console.log(`[Worker] Successfully created topic: "${topic}"`);
    }
  } catch (err: any) {
    console.warn(`[Worker] Admin topic check/create notice: ${err.message}`);
  } finally {
    await admin.disconnect();
  }
}

async function runWorker(retries = 15, delayMs = 3000): Promise<void> {
  while (retries > 0) {
    try {
      console.log('[TypeScript Worker] Connecting to Kafka broker...');
      await ensureTopicExists('order-events');
      await consumer.connect();
      await consumer.subscribe({ topic: 'order-events', fromBeginning: true });
      console.log('[TypeScript Worker] Connected to Kafka. Waiting for checkout events...');

      await consumer.run({
        eachMessage: async ({ message }) => {
          if (!message.value) return;
          const event: OrderEvent = JSON.parse(message.value.toString());

          console.log('----------------------------------------------------');
          console.log(`[Kafka Consumer Worker] Ingested Order ID: ${event.orderId}`);
          console.log(` -> Packaging: Initiating warehouse picker for Product ID ${event.productId}`);
          console.log(` -> Shipping: Label generated for user: "${event.username}"`);
          console.log(` -> Notification: Confirmation email sent for ${event.quantity} item(s)`);
          console.log(` -> Timestamp: ${event.timestamp}`);
          console.log('----------------------------------------------------');
        },
      });
      return;
    } catch (err: any) {
      retries--;
      console.warn(`[Worker] Kafka connection retry (${retries} attempts left):`, err.message);
      if (retries === 0) {
        console.error('[Worker Fatal Error]', err);
        process.exit(1);
      }
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

runWorker();
