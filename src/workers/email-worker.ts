import { EmailWorker } from '@/services/notifications/EmailWorker';

// Start the email worker with a 1-minute interval
EmailWorker.startWorker(1).catch(error => {
  console.error('Failed to start email worker:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal. Shutting down email worker...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT signal. Shutting down email worker...');
  process.exit(0);
});

console.log('Email worker process started.'); 