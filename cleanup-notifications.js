/**
 * Cleanup script to remove duplicate "order_created" notifications
 * Run this once to clean up the database, then delete this file
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function cleanup() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const { Notification } = require('./src/models/index');

    // Find all order_created notifications grouped by recipient and order
    const duplicates = await Notification.aggregate([
      { $match: { type: 'order_created' } },
      { $group: { 
          _id: { recipient: '$recipient', message: '$message' }, 
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]);

    console.log(`\n📋 Found ${duplicates.length} groups of duplicate notifications:`);
    
    let totalDeleted = 0;

    for (const group of duplicates) {
      const idsToDelete = group.ids.slice(1); // Keep the first, delete the rest
      const result = await Notification.deleteMany({ _id: { $in: idsToDelete } });
      totalDeleted += result.deletedCount;
      
      console.log(`  • Message: "${group._id.message.substring(0, 50)}..."`);
      console.log(`    Deleted ${result.deletedCount} duplicates (kept 1)`);
    }

    console.log(`\n✅ Total notifications deleted: ${totalDeleted}`);
    console.log('🎉 Cleanup complete!');
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

cleanup();
