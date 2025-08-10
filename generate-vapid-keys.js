const webpush = require('web-push');

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID Keys Generated:');
console.log('=====================');
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
console.log('');
console.log('Add these to your Vercel environment variables:');
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY =', vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY =', vapidKeys.privateKey);
