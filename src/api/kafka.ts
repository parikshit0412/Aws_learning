import { Kafka, Producer } from 'kafkajs';
import { OrderEvent } from '../types';

const kafka = new Kafka({
  clientId: 'order-api-producer',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: { initialRetryTime: 300, retries: 8 },
});

const producer: Producer = kafka.producer({
  allowAutoTopicCreation: true,
});
let isConnected = false;

export async function sendOrderEvent(eventData: OrderEvent): Promise<void> {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
  }
  await producer.send({
    topic: 'order-events',
    messages: [
      {
        key: String(eventData.orderId),
        value: JSON.stringify(eventData),
      },
    ],
  });
}

