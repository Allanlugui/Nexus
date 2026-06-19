
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

async function test() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log("Testing with Project ID:", firebaseConfig.projectId);
    console.log("Testing with (default) Database ID...");

    const app = getApps().length === 0 ? initializeApp({ projectId: firebaseConfig.projectId }) : getApp();
    const db = getFirestore(app);
    
    console.log("Attempting to list erp_users...");
    const qs = await db.collection('erp_users').limit(1).get();
    console.log("Successfully reached Firestore! Documents found:", qs.docs.length);
  } catch (err: any) {
    console.error("Test failed:", err.message);
  }
}

test();
