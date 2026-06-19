
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, connectFirestoreEmulator } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

async function test() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log("Testing Client SDK with Project ID:", firebaseConfig.projectId);
    console.log("Database ID:", firebaseConfig.firestoreDatabaseId);

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    
    console.log("Attempting to list erp_users...");
    const qs = await getDocs(collection(db, 'erp_users'));
    console.log("SUCCESS! Documents found:", qs.docs.length);
  } catch (err: any) {
    console.error("Test failed:", err.message);
  }
}

test();
