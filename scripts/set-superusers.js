/*
TO RUN:

// set emails below then run:
node scripts/set-superusers.js
*/

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '../server/.env' });

const SUPERUSER_EMAILS = [
  'riley.koo@vanderbilt.edu',
  'test@user.com',
];

async function setSuperUsers() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    // Connect WITHOUT specifying dbName - let the URI handle it
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('✅ Connected');
    
    // Manually specify the database and collection
    const db = mongoose.connection.client.db('Users');
    const usersCollection = db.collection('users');
    
    // Test connection
    const count = await usersCollection.countDocuments();
    console.log(`Found ${count} users\n`);
    
    const normalizedEmails = SUPERUSER_EMAILS.map(e => e.toLowerCase());
    
    // Find users to promote
    const usersToPromote = await usersCollection.find({
      email: { $in: normalizedEmails },
      isSuperUser: { $ne: true }
    }).toArray();
    
    if (usersToPromote.length > 0) {
      // Promote them
      const result = await usersCollection.updateMany(
        { email: { $in: normalizedEmails } },
        { $set: { isSuperUser: true } }
      );
      
      console.log(`✅ Promoted ${result.modifiedCount} users:`);
      usersToPromote.forEach(u => console.log(`   • ${u.email} (${u.name})`));
    } else {
      console.log('ℹ️  No users to promote');
    }
    
    // Show all superusers
    const superusers = await usersCollection.find({ isSuperUser: true }).toArray();
    console.log(`\n📋 All superusers (${superusers.length}):`);
    superusers.forEach(u => console.log(`   • ${u.email} (${u.name})`));
    
    await mongoose.connection.close();
    console.log('\n✅ Done!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setSuperUsers();