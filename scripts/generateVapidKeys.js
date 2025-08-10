const webpush = require('web-push');

console.log('🔑 Generating VAPID keys for push notifications...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ VAPID Keys Generated!\n');
console.log('📋 Add these to your .env.local file:\n');
console.log('# Push Notification VAPID Keys');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:your-email@example.com`);
console.log('\n🚨 Important: Keep the private key secure and never expose it publicly!');
console.log('📝 The public key can be safely used in client-side code.\n');
